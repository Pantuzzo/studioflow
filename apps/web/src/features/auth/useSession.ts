import type { User } from '@studioflow/contracts'
import { useGetMeQuery } from './authApi'

export type SessionStatus = 'checking' | 'authenticated' | 'anonymous'

/**
 * The session, read straight from the RTK Query cache.
 *
 * `GET /auth/me` is the session state — there is nothing else to hold, because
 * the credential is a cookie the browser cannot read. See docs/adr/0006.
 */
export function useSession(): { status: SessionStatus; user: User | null } {
  const { data, isLoading, isError } = useGetMeQuery()

  // Order matters: an error outranks stale data, or an expired session would
  // keep reading as authenticated while the refetch that failed is ignored.
  if (isError) return { status: 'anonymous', user: null }
  if (data) return { status: 'authenticated', user: data.user }
  if (isLoading) return { status: 'checking', user: null }
  return { status: 'anonymous', user: null }
}
