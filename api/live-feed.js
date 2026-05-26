export default async function handler(_request, response) {
  try {
    const upstream = await fetch('https://cf.nascar.com/live/feeds/live-feed.json', {
      headers: {
        accept: 'application/json',
      },
    })

    if (!upstream.ok) {
      response.status(upstream.status).json({ error: 'NASCAR live feed unavailable' })
      return
    }

    const data = await upstream.json()
    response.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20')
    response.status(200).json(data)
  } catch {
    response.status(502).json({ error: 'Unable to reach NASCAR live feed' })
  }
}
