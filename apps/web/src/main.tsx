import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from '@/app/AppProviders'
import { router } from '@/router'
import '@fontsource-variable/roboto'
import '@/styles/tokens.css'
import '@/styles/global.css'

/**
 * Start Mock Service Worker before the app renders.
 *
 * The switch is VITE_ENABLE_MOCKS alone — deliberately not tied to DEV. Tying
 * it to DEV meant a production build could never mock, which would have made
 * the deployed demo an unusable login wall before a backend was reachable; it
 * also made it impossible to point `pnpm dev` at the real API. Set
 * VITE_ENABLE_MOCKS=false to run against NestJS through the Vite proxy.
 */
async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { worker } = await import('@/mocks/browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
    // The worker script is served from the app's own base, not the domain
    // root. Registering it at `/mockServiceWorker.js` works locally and then
    // 404s on any host that serves the app from a subdirectory — where the
    // failure is an app that loads and then answers nothing.
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

void enableMocking().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
})
