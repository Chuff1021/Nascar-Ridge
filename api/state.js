// Shared league state backed by Vercel KV (Upstash Redis REST).
// One JSON blob holds the league everyone shares: players, weekly draws,
// who paid, and results — so a draw on the commissioner's phone shows up on
// every neighbor's phone. Chat lives in its own key (see api/chat.js); this
// endpoint deliberately ignores chat and per-device fields.
//
// Env vars are injected automatically when a KV store is linked to the project:
//   KV_REST_API_URL / KV_REST_API_TOKEN  (Vercel KV)
// with a fallback to the raw Upstash names in case the integration uses those.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const STATE_KEY = 'shuyler-ridge-state'

async function redis(command) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${KV_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(command),
  })
  if (!res.ok) {
    throw new Error(`KV returned ${res.status}`)
  }
  return res.json()
}

function readStored(getResult) {
  const raw = getResult?.result
  if (typeof raw !== 'string' || !raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.weeks)) {
      return parsed
    }
  } catch {
    // Ignore an unparseable blob — treat it as no shared state yet.
  }
  return null
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
  if (!KV_URL || !KV_TOKEN) {
    // Store not linked yet — tell the client so it can stay on its local copy
    // instead of treating this as a hard error.
    response.status(200).json({ state: null, configured: false })
    return
  }

  try {
    if (request.method === 'POST') {
      const incomingRaw = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
      const incoming = sanitize(incomingRaw)

      const [getResult] = await redis([['GET', STATE_KEY]])
      const stored = readStored(getResult)

      const merged = stored
        ? {
            players: mergePlayers(stored.players, incoming.players),
            weeks: mergeWeeks(stored.weeks, incoming.weeks),
            activeWeekId: incoming.activeWeekId ?? stored.activeWeekId,
          }
        : incoming

      await redis([['SET', STATE_KEY, JSON.stringify(merged)]])
      response.setHeader('Cache-Control', 'no-store')
      response.status(200).json({ state: merged, configured: true })
      return
    }

    const [getResult] = await redis([['GET', STATE_KEY]])
    response.setHeader('Cache-Control', 'no-store')
    response.status(200).json({ state: readStored(getResult), configured: true })
  } catch {
    response.status(502).json({ error: 'League sync is unavailable right now.' })
  }
}
