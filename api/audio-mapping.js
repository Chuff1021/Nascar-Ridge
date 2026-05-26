export default async function handler(_request, response) {
  try {
    const upstream = await fetch('https://cf.nascar.com/config/audio/audio_mapping_1_3.json', {
      headers: {
        accept: 'application/json',
      },
    })

    if (!upstream.ok) {
      response.status(upstream.status).json({ error: 'NASCAR scanner mapping unavailable' })
      return
    }

    const data = await upstream.json()
    response.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    response.status(200).json(data)
  } catch {
    response.status(502).json({ error: 'Unable to reach NASCAR scanner mapping' })
  }
}
