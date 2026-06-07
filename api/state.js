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

const STATE_BLOB = 'https://jsonblob.com/api/jsonBlob/019ea379-6b7d-72fa-b432-a5c083fe897a'
const DB_URL =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
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
async function readShared() {
  if (sql) {
    await ensureSchema()
    const rows = await sql`SELECT data FROM league_state WHERE id = ${STATE_ID}`
    const data = rows[0]?.data
    return isStateShape(data) ? data : null
  }

  const res = await fetch(STATE_BLOB, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    return null
  }
  const parsed = await res.json().catch(() => null)
  return isStateShape(parsed) ? parsed : null
}

// Write the merged shared state back to whichever backend is active.
async function writeShared(state) {
  if (sql) {
    await ensureSchema()
    await sql`INSERT INTO league_state (id, data, updated_at)
      VALUES (${STATE_ID}, ${JSON.stringify(state)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`
    return
  }

  const res = await fetch(STATE_BLOB, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ kind: 'shuyler-ridge-league-state', ...state }),
  })
  if (!res.ok) {
    throw new Error(`jsonblob returned ${res.status}`)
  }
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

// Merge is strictly additive for draws: for any week we keep whichever side has
// MORE picks, so a sync can never wipe a lineup someone already drew. paidBy is
// unioned and results fill in when missing, mirroring the client's own
// mergeSavedStates so both sides agree.
function mergeWeeks(baseWeeks = [], incomingWeeks = []) {
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
    const richer = weekPickCount(week) > weekPickCount(existing)
    byId.set(week.id, {
      ...existing,
      assignments: richer ? week.assignments : existing.assignments,
      communityTeams: richer ? week.communityTeams : existing.communityTeams ?? week.communityTeams,
      participantIds: unionIds(existing.participantIds, week.participantIds),
      paidBy: unionIds(existing.paidBy, week.paidBy),
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

      const stored = await readShared()
      const merged = stored
        ? {
            players: mergePlayers(stored.players, incoming.players),
            weeks: mergeWeeks(stored.weeks, incoming.weeks),
            activeWeekId: incoming.activeWeekId ?? stored.activeWeekId,
          }
        : incoming

      await writeShared(merged)
      response.setHeader('Cache-Control', 'no-store')
      response.status(200).json({ state: merged, configured: true })
      return
    }

    const stored = await readShared()
    response.setHeader('Cache-Control', 'no-store')
    response.status(200).json({ state: stored, configured: true })
  } catch {
    response.status(502).json({ error: 'League sync is unavailable right now.' })
  }
}
