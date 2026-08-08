const FALLBACK = '/dashboard'

interface LocationState {
  from?: { pathname?: string; search?: string }
}

/**
 * Where to land after signing in.
 *
 * Only in-app paths are honoured. A value taken from navigation state is
 * attacker-influencable, so anything protocol-relative (`//evil.com`) or
 * absolute is discarded — otherwise the login screen becomes an open redirect.
 */
export function intendedPath(state: unknown): string {
  const from = (state as LocationState | null)?.from
  const pathname = from?.pathname

  if (
    typeof pathname !== 'string' ||
    !pathname.startsWith('/') ||
    pathname.startsWith('//')
  ) {
    return FALLBACK
  }

  // Never bounce back to the auth screens themselves.
  if (['/login', '/signup', '/forgot-password'].includes(pathname)) {
    return FALLBACK
  }

  return `${pathname}${from?.search ?? ''}`
}
