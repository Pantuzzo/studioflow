import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from './useSession'

/** Guards the application routes, remembering where the visitor was headed. */
export function RequireAuth() {
  const { status } = useSession()
  const location = useLocation()

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
