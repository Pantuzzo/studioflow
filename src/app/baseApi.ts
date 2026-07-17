import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

/**
 * Resolve the API base URL. Prefer an explicit VITE_API_URL (set once the real
 * backend exists). Otherwise use the current origin — an absolute same-origin
 * URL that MSW matches by pathname in both the browser and jsdom (where Node's
 * fetch rejects relative URLs).
 */
function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL
  if (configured) return configured
  if (typeof window !== 'undefined') return `${window.location.origin}/api`
  return '/api'
}

/**
 * Single RTK Query API slice. Feature modules extend it with
 * `baseApi.injectEndpoints(...)` so code stays colocated per domain
 * while sharing one cache and one set of tags.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: resolveBaseUrl(),
  }),
  tagTypes: ['Client', 'Project', 'Proposal', 'Invoice', 'TimeEntry'],
  endpoints: () => ({}),
})
