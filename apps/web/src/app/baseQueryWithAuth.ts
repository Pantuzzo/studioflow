import { fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query'
import { sessionExpired } from '@/app/sessionEvents'

const CSRF_COOKIE = 'sf_csrf'
const CSRF_HEADER = 'x-csrf-token'

/**
 * Resolve the API base URL. In development Vite proxies `/api` to the server so
 * the app and the API share an origin — which is what lets the session cookie
 * behave identically in development and production. See docs/adr/0006.
 */
function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL
  if (configured) return configured
  if (typeof window !== 'undefined') return `${window.location.origin}/api`
  return '/api'
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: resolveBaseUrl(),
  // The session cookie is the credential; there is no Authorization header,
  // because the browser is never given a token to put in one.
  credentials: 'include',
  prepareHeaders: (headers) => {
    // Double-submit CSRF: echo the readable cookie back in a header the browser
    // will not attach on its own. Harmless on reads, required on writes.
    const csrf = readCookie(CSRF_COOKIE)
    if (csrf) headers.set(CSRF_HEADER, csrf)
    return headers
  },
})

/** A 401 from the auth routes is the answer, not a session problem. */
function isAuthRequest(args: string | FetchArgs): boolean {
  const url = typeof args === 'string' ? args : args.url
  return url.startsWith('auth/') || url.startsWith('/auth/')
}

export const baseQueryWithAuth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions)

  if (result.error?.status === 401 && !isAuthRequest(args)) {
    // No retry and no refresh: session lifetime belongs to the server, which is
    // where the secret lives. Marking the session stale makes the route guard
    // redirect to login on the next render.
    api.dispatch(sessionExpired())
  }

  return result
}
