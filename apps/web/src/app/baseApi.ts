import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithAuth } from '@/app/baseQueryWithAuth'

/**
 * Single RTK Query API slice. Feature modules extend it with
 * `baseApi.injectEndpoints(...)` so code stays colocated per domain
 * while sharing one cache and one set of tags.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  // 'Me' is the session itself: the cached answer to "who is signed in".
  tagTypes: ['Me', 'Client', 'Project', 'Proposal', 'Invoice', 'TimeEntry'],
  endpoints: () => ({}),
})
