import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { store } from '@/app/store'
import { router } from '@/router'
import '@fontsource-variable/roboto'
import '@/styles/tokens.css'
import '@/styles/global.css'

/**
 * Start Mock Service Worker before the app renders.
 * Mock-first: enabled in dev unless explicitly turned off. From Week 8 the real
 * backend takes over by setting VITE_ENABLE_MOCKS=false.
 */
async function enableMocking(): Promise<void> {
  const disabled = import.meta.env.VITE_ENABLE_MOCKS === 'false'
  if (disabled || !import.meta.env.DEV) return
  const { worker } = await import('@/mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

void enableMocking().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </StrictMode>,
  )
})
