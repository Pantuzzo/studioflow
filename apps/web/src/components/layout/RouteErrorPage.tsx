import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/Button'

/** Last line of defence: an unhandled render error anywhere below the root. */
export function RouteErrorPage() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'An unexpected error occurred.'

  return (
    <AuthLayout title="Something went wrong" subtitle={detail}>
      <Button onClick={() => window.location.assign('/')}>
        Reload the app
      </Button>
    </AuthLayout>
  )
}
