import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { intendedPath } from './intendedPath'
import { useSession } from './useSession'

/**
 * Keeps signed-in visitors off the auth screens — and is the single place that
 * performs the redirect-back after login.
 *
 * That is why LoginPage never calls navigate(): a successful sign-in
 * invalidates the session cache, this component re-renders, and the redirect
 * happens here. Signup and the other public routes get the same behaviour free.
 */
export function PublicOnly() {
  const { status } = useSession()
  const location = useLocation()

  if (status === 'authenticated') {
    return <Navigate to={intendedPath(location.state)} replace />
  }
  return <Outlet />
}
