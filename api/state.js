// Shared league state — the league everyone shares: players, weekly draws,
// who paid, and results — so a draw on the commissioner's phone shows up on
// every neighbor's phone. Chat lives in its own store (see api/chat.js); this
// endpoint deliberately ignores chat and per-device fields.
//
// Storage backends, in priority order:
//   1. Neon Postgres (durable, never purges) when a connection string is set —
//      DATABASE_URL / POSTGRES_URL / NEON_DATABASE_URL.
//   2. A zero-setup anonymous jsonblob.com store as the fallback (works with no
//      setup, but the free blobs get purged after a few idle days).
import { neon } from '@neondatabase/serverless'

const STATE_BLOB = 'https://jsonblob.com/api/jsonBlob/019ed27d-be40-729b-a333-53711e8a7171'
const DB_ENV_NAMES = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'NEON_DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL_NO_SSL',
  'NEON_POSTGRES_URL',
]
const DB_URL = DB_ENV_NAMES.map((name) => process.env[name]).find(Boolean)
const sql = DB_URL ? neon(DB_URL) : null
const STATE_ID = 'current'

function isStateShape(value) {
  return value && typeof value === 'object' && Array.isArray(value.weeks)
}

let schemaReady = null
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = sql`CREATE TABLE IF NOT EXISTS league_state (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`
  }
  return schemaReady
}

// Read the current shared state from whichever backend is active.
async function readBlobShared() {
  const res = await fetch(STATE_BLOB, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    return { state: null, backend: 'jsonblob' }
  }
  const parsed = await res.json().catch(() => null)
  return { state: isStateShape(parsed) ? parsed : null, backend: 'jsonblob' }
}

async function readShared() {
  if (sql) {
    try {
      await ensureSchema()
      const rows = await sql`SELECT data FROM league_state WHERE id = ${STATE_ID}`
      const data = rows[0]?.data
      if (isStateShape(data)) {
        return { state: data, backend: 'neon' }
      }
      const blob = await readBlobShared()
      if (isStateShape(blob.state)) {
        await sql`INSERT INTO league_state (id, data, updated_at)
          VALUES (${STATE_ID}, ${JSON.stringify(blob.state)}::jsonb, now())
          ON CONFLICT (id) DO NOTHING`
        return { state: blob.state, backend: 'neon-migrated' }
      }
    } catch (error) {
      console.error('Neon state read failed; falling back to jsonblob', error)
    }
  }

  return readBlobShared()
}

// Write the merged shared state back to whichever backend is active.
async function writeBlobShared(state) {
  const res = await fetch(STATE_BLOB, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ kind: 'shuyler-ridge-league-state', ...state }),
  })
  if (!res.ok) {
    throw new Error(`jsonblob returned ${res.status}`)
  }
  return 'jsonblob'
}

async function writeShared(state) {
  if (sql) {
    try {
      await ensureSchema()
      await sql`INSERT INTO league_state (id, data, updated_at)
        VALUES (${STATE_ID}, ${JSON.stringify(state)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`
      return 'neon'
    } catch (error) {
      console.error('Neon state write failed; falling back to jsonblob', error)
    }
  }

  return writeBlobShared(state)
}

function weekPickCount(week) {
  const individual = Object.values(week?.assignments ?? {}).reduce(
    (total, picks) => total + (Array.isArray(picks) ? picks.length : 0),
    0,
  )
  return individual + (Array.isArray(week?.communityTeams) ? week.communityTeams.length : 0)
}

function unionIds(a = [], b = []) {
  return Array.from(new Set([...(a ?? []), ...(b ?? [])]))
}

// Never replace a real draw with an empty one; otherwise the NEWER lineup wins
// (by drawnAt), a timestamped re-draw beats a legacy un-timestamped one, and
// richer pick count is the last-resort tiebreak. Mirrors the client's
// preferIncomingDraw so both sides agree and a re-draw can propagate.
function preferIncomingDraw(existing, incoming) {
  const existingPicks = weekPickCount(existing)
  const incomingPicks = weekPickCount(incoming)
  if (incomingPicks === 0) return false
  if (existingPicks === 0) return true
  if (incoming.drawnAt && existing.drawnAt) return incoming.drawnAt > existing.drawnAt
  if (incoming.drawnAt && !existing.drawnAt) return true
  if (!incoming.drawnAt && existing.drawnAt) return false
  return incomingPicks > existingPicks
}

// Race results (winner/second) are always kept additively. Normal sync follows
// preferIncomingDraw; an explicit forceWeekId is the commissioner's "publish
// this exact lineup" path and replaces that week's draw/participants outright.
function mergeWeeks(baseWeeks = [], incomingWeeks = [], forceWeekId) {
  const byId = new Map()
  for (const week of baseWeeks) {
    byId.set(week.id, week)
  }
  for (const week of incomingWeeks) {
    const existing = byId.get(week.id)
    if (!existing) {
      byId.set(week.id, week)
      continue
    }
    const forceIncoming = forceWeekId === week.id && weekPickCount(week) > 0
    const takeIncoming = forceIncoming || preferIncomingDraw(existing, week)
    byId.set(week.id, {
      ...existing,
      race: forceIncoming ? week.race ?? existing.race : existing.race,
      track: forceIncoming ? week.track ?? existing.track : existing.track,
      date: forceIncoming ? week.date ?? existing.date : existing.date,
      seriesId: forceIncoming ? week.seriesId ?? existing.seriesId : existing.seriesId,
      assignments: takeIncoming ? week.assignments : existing.assignments,
      communityTeams: takeIncoming ? week.communityTeams : existing.communityTeams ?? week.communityTeams,
      drawnAt: takeIncoming ? week.drawnAt ?? existing.drawnAt : existing.drawnAt ?? week.drawnAt,
      participantIds: forceIncoming ? week.participantIds ?? [] : unionIds(existing.participantIds, week.participantIds),
      paidBy: forceIncoming ? week.paidBy ?? [] : unionIds(existing.paidBy, week.paidBy),
      winnerId: existing.winnerId ?? week.winnerId,
      secondId: existing.secondId ?? week.secondId,
      winningDriverNumber: existing.winningDriverNumber ?? week.winningDriverNumber,
      winnerTeamIds: existing.winnerTeamIds ?? week.winnerTeamIds,
      secondDriverNumber: existing.secondDriverNumber ?? week.secondDriverNumber,
      secondTeamIds: existing.secondTeamIds ?? week.secondTeamIds,
    })
  }
  return Array.from(byId.values())
}

function mergePlayers(basePlayers = [], incomingPlayers = []) {
  const byId = new Map()
  for (const player of [...basePlayers, ...incomingPlayers]) {
    if (player && player.id && !byId.has(player.id)) {
      byId.set(player.id, player)
    }
  }
  return Array.from(byId.values())
}

// Keep only the shared league fields. currentUserId is per-device (who is logged
// in on this phone) and messages have their own endpoint — both are dropped so
// they can never leak between neighbors through the shared blob.
function sanitize(state) {
  return {
    players: Array.isArray(state?.players) ? state.players : [],
    weeks: Array.isArray(state?.weeks) ? state.weeks : [],
    activeWeekId: typeof state?.activeWeekId === 'string' ? state.activeWeekId : undefined,
  }
}

export default async function handler(request, response) {
  try {
    if (request.method === 'POST') {
      const incomingRaw = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
      const incoming = sanitize(incomingRaw)
      const forceWeekId = typeof incomingRaw?.forceWeekId === 'string' ? incomingRaw.forceWeekId : undefined

      const { state: stored } = await readShared()
      const merged = stored
        ? {
            players: mergePlayers(stored.players, incoming.players),
            weeks: mergeWeeks(stored.weeks, incoming.weeks, forceWeekId),
            activeWeekId: incoming.activeWeekId ?? stored.activeWeekId,
          }
        : incoming

      const backend = await writeShared(merged)
      response.setHeader('Cache-Control', 'no-store')
      response.status(200).json({ state: merged, configured: true, backend })
      return
    }

    const { state: stored, backend } = await readShared()
    response.setHeader('Cache-Control', 'no-store')
    response.status(200).json({ state: stored, configured: true, backend })
  } catch (error) {
    console.error('League sync handler failed', error)
    response.status(502).json({
      error: 'League sync is unavailable right now.',
      detail: error instanceof Error ? error.message : 'Unknown sync error',
    })
  }
}
