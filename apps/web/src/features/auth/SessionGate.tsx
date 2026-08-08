import { Outlet } from 'react-router-dom'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { useSession } from './useSession'

/**
 * Holds every route until the session question is answered.
 *
 * It wraps the public routes too, on purpose: without it a returning user would
 * see the login screen flash before the session check came back.
 */
export function SessionGate() {
  const { status } = useSession()

  if (status === 'checking') {
    return <FullPageLoader label="Checking your session…" />
  }
  return <Outlet />
}
