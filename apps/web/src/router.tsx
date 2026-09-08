import { createBrowserRouter } from 'react-router-dom'
import { routes } from '@/routes'

/**
 * `basename` comes from Vite's base, which is `/` everywhere except the
 * published demo — that one is served from a subdirectory. Without it every
 * route would resolve one level above where the app actually lives and the
 * whole thing would render as a 404 that looks like a routing bug.
 */
export const router = createBrowserRouter(routes, {
  basename: import.meta.env.BASE_URL,
})
