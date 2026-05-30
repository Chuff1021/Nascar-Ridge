// Shared league state — the league everyone shares: players, weekly draws,
// who paid, and results — so a draw on the commissioner's phone shows up on
// every neighbor's phone. Chat lives in its own store (see api/chat.js); this
// endpoint deliberately ignores chat and per-device fields.
//
// Storage is a zero-setup anonymous jsonblob.com store (user-approved, no
// account, no dashboard step). If a Vercel KV store is ever linked the KV_*
// env vars take over automatically — KV is more durable, so it wins when present.
const STATE_BLOB = 'https://jsonblob.com/api/jsonBlob/019e7649-54a5-70e7-a57a-ebf4086b76b7'

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const USE_KV = Boolean(KV_URL && KV_TOKEN)
const STATE_KEY = 'shuyler-ridge-state'

function isStateShape(value) {
  return value && typeof value === 'object' && Array.isArray(value.weeks)
}

// Read the current shared state from whichever backend is active.
async function readShared() {
  if (USE_KV) {
    const res = await fetch(`${KV_URL}/pipeline`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KV_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify([['GET', STATE_KEY]]),
    })
    if (!res.ok) {
      throw new Error(`KV returned ${res.status}`)
    }
    const [getResult] = await res.json()
    const raw = getResult?.result
    if (typeof raw !== 'string' || !raw) {
      return null
    }
    try {
      const parsed = JSON.parse(raw)
      return isStateShape(parsed) ? parsed : null
    } catch {
      return null
    }
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
  if (USE_KV) {
    const res = await fetch(`${KV_URL}/pipeline`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KV_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify([['SET', STATE_KEY, JSON.stringify(state)]]),
    })
    if (!res.ok) {
      throw new Error(`KV returned ${res.status}`)
    }
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
  return Object.values(week?.assignments ?? {}).reduce(
    (total, picks) => total + (Array.isArray(picks) ? picks.length : 0),
    0,
  )
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
      participantIds: unionIds(existing.participantIds, week.participantIds),
      paidBy: unionIds(existing.paidBy, week.paidBy),
      winnerId: existing.winnerId ?? week.winnerId,
      secondId: existing.secondId ?? week.secondId,
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
