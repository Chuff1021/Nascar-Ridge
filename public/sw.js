const CACHE_NAME = 'shuyler-ridge-raceday-v9'
const ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/app-icon.png',
  '/apple-touch-icon.png',
  '/shuyler-ridge-logo.png',
  '/shuyler-ridge-logo-header.png',
  '/nascar-logo.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  if (new URL(event.request.url).pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)))
    return
  }

  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)))
})
