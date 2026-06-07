// Shared league chat. Every phone reads and writes the same store so the
// conversation is identical everywhere and survives code deploys.
//
// Storage is a zero-setup anonymous jsonblob.com store (user-approved, no
// account, no dashboard step). If a Vercel KV store is ever linked the KV_*
// env vars take over automatically — KV gives atomic list ops, so it wins when
// present. With jsonblob we read-modify-write and merge by id, which is fine for
// a small league (a rare simultaneous post just re-syncs on the next pull).
const CHAT_BLOB = 'https://jsonblob.com/api/jsonBlob/019ea379-6cf5-7a9a-91d6-0585bf95bda5'

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const USE_KV = Boolean(KV_URL && KV_TOKEN)
const CHAT_KEY = 'shuyler-ridge-chat'
const MAX_MESSAGES = 500

function isMessage(value) {
  return value && value.id && value.playerId && typeof value.body === 'string'
}

function mergeMessages(...lists) {
  const byId = new Map()
  for (const list of lists) {
    for (const message of Array.isArray(list) ? list : []) {
      if (isMessage(message)) {
        byId.set(message.id, message)
      }
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => (a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : 0))
    .slice(-MAX_MESSAGES)
}

async function kv(command) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${KV_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
  })
  if (!res.ok) {
    throw new Error(`KV returned ${res.status}`)
  }
  return res.json()
}

function parseKvRows(lrangeResult) {
  const rows = Array.isArray(lrangeResult?.result) ? lrangeResult.result : []
  const messages = []
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row)
      if (isMessage(parsed)) {
        messages.push(parsed)
      }
    } catch {
      // Skip anything that isn't a valid stored message.
    }
  }
  return messages
}

async function readMessages() {
  if (USE_KV) {
    const [lrange] = await kv([['LRANGE', CHAT_KEY, '0', '-1']])
    return parseKvRows(lrange)
  }
  const res = await fetch(CHAT_BLOB, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    return []
  }
  const parsed = await res.json().catch(() => null)
  return Array.isArray(parsed?.messages) ? parsed.messages.filter(isMessage) : []
}

async function appendMessage(message) {
  if (USE_KV) {
    const [, , lrange] = await kv([
      ['RPUSH', CHAT_KEY, JSON.stringify(message)],
      ['LTRIM', CHAT_KEY, String(-MAX_MESSAGES), '-1'],
      ['LRANGE', CHAT_KEY, '0', '-1'],
    ])
    return parseKvRows(lrange)
  }
  const existing = await readMessages()
  const merged = mergeMessages(existing, [message])
  const res = await fetch(CHAT_BLOB, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ kind: 'shuyler-ridge-chat', messages: merged }),
  })
  if (!res.ok) {
    throw new Error(`jsonblob returned ${res.status}`)
  }
  return merged
}

export default async function handler(request, response) {
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

      const messages = await appendMessage({ id, playerId, body, sentAt })
      response.setHeader('Cache-Control', 'no-store')
      response.status(200).json({ messages, configured: true })
      return
    }

    const messages = await readMessages()
    response.setHeader('Cache-Control', 'no-store')
    response.status(200).json({ messages, configured: true })
  } catch {
    response.status(502).json({ error: 'Chat store is unavailable right now.' })
  }
}
