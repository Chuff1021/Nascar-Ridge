// Proxies NASCAR's public driver directory and returns a slim list the app can
// use to map a drawn driver (by name or car number) to their Nascar_Driver_ID.
// The headshot/badge image URLs themselves are built client-side from the id +
// series + car number, all of which live on the un-gated cf.nascar.com CDN.
export default async function handler(_request, response) {
  try {
    const upstream = await fetch('https://cf.nascar.com/cacher/drivers.json', {
      headers: { accept: 'application/json' },
    })

    if (!upstream.ok) {
      response.status(upstream.status).json({ error: 'NASCAR driver directory unavailable' })
      return
    }

    const payload = await upstream.json()
    const drivers = (payload?.response ?? [])
      .map((driver) => ({
        id: Number(driver?.Nascar_Driver_ID) || 0,
        name: String(driver?.Full_Name ?? '').trim(),
        number: String(driver?.Badge ?? '').trim(),
      }))
      .filter((driver) => driver.id && driver.name)

    response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    response.status(200).json({ drivers })
  } catch {
    response.status(502).json({ error: 'Unable to reach NASCAR driver directory' })
  }
}
