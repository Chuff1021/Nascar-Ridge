// Shared league chat backed by Vercel KV (Upstash Redis REST).
// Messages live in a single Redis list so every phone sees the same history.
// Env vars are injected automatically when a KV store is linked to the project:
//   KV_REST_API_URL / KV_REST_API_TOKEN  (Vercel KV)
// with a fallback to the raw Upstash names in case the integration uses those.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const CHAT_KEY = 'shuyler-ridge-chat'
const MAX_MESSAGES = 500

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

function parseMessages(lrangeResult) {
  const rows = Array.isArray(lrangeResult?.result) ? lrangeResult.result : []
  const messages = []
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row)
      if (parsed && parsed.id && parsed.playerId && typeof parsed.body === 'string') {
        messages.push(parsed)
      }
    } catch {
      // Skip anything that isn't a valid stored message.
    }
  }
  return messages
}

export default async function handler(request, response) {
  if (!KV_URL || !KV_TOKEN) {
    // Store not linked yet — tell the client so it can stay on its local cache
    // instead of treating this as a hard error.
    response.status(200).json({ messages: [], configured: false })
    return
  }

  try {
    if (request.method === 'POST') {
      const incoming = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
      const id = String(incoming?.id ?? '').slice(0, 80)
      const playerId = String(incoming?.playerId ?? '').slice(0, 80)
      const body = String(incoming?.body ?? '').trim().slice(0, 600)
      const sentAt = String(incoming?.sentAt ?? new Date().toISOString()).slice(0, 40)

      if (!id || !playerId || !body) {
        response.status(400).json({ error: 'Message needs id, playerId, and body.' })
        return
      }

      const message = JSON.stringify({ id, playerId, body, sentAt })
      const [, , lrange] = await redis([
        ['RPUSH', CHAT_KEY, message],
        ['LTRIM', CHAT_KEY, String(-MAX_MESSAGES), '-1'],
        ['LRANGE', CHAT_KEY, '0', '-1'],
      ])
      response.status(200).json({ messages: parseMessages(lrange), configured: true })
      return
    }

    const [lrange] = await redis([['LRANGE', CHAT_KEY, '0', '-1']])
    response.setHeader('Cache-Control', 'no-store')
    response.status(200).json({ messages: parseMessages(lrange), configured: true })
  } catch {
    response.status(502).json({ error: 'Chat store is unavailable right now.' })
  }
}
