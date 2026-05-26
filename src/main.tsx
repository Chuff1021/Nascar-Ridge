import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

function resetStandaloneViewport() {
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  viewport?.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  )

  window.scrollTo(0, 0)
}

const isIosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)

if (window.matchMedia('(display-mode: standalone)').matches || isIosStandalone) {
  resetStandaloneViewport()
  window.setTimeout(resetStandaloneViewport, 80)
  window.setTimeout(resetStandaloneViewport, 320)
  window.addEventListener('pageshow', resetStandaloneViewport)
  window.addEventListener('orientationchange', () => window.setTimeout(resetStandaloneViewport, 250))
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}
