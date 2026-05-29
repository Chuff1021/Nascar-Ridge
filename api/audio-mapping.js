async function resolveLiveSeriesId() {
  try {
    const feed = await fetch('https://cf.nascar.com/live/feeds/live-feed.json', {
      headers: { accept: 'application/json' },
    })

    if (feed.ok) {
      const data = await feed.json()
      const seriesId = Number(data?.series_id)
      if (Number.isInteger(seriesId) && seriesId > 0) {
        return seriesId
      }
    }
  } catch {
    // Fall back to the Cup mapping below.
  }

  return 1
}

function mappingUrl(seriesId) {
  return `https://cf.nascar.com/config/audio/audio_mapping_${seriesId}_3.json`
}

function requestedSeriesId(request) {
  const raw = new URL(request.url, 'https://local').searchParams.get('series')
  const seriesId = Number(raw)
  return [1, 2, 3].includes(seriesId) ? seriesId : null
}

export default async function handler(request, response) {
  try {
    const seriesId = requestedSeriesId(request) ?? (await resolveLiveSeriesId())

    let upstream = await fetch(mappingUrl(seriesId), {
      headers: { accept: 'application/json' },
    })

    if (!upstream.ok && seriesId !== 1) {
      upstream = await fetch(mappingUrl(1), {
        headers: { accept: 'application/json' },
      })
    }

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
