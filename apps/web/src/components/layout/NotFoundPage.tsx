import { Link } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <AuthLayout
      title="Page not found"
      subtitle="That link doesn’t lead anywhere."
    >
      <Button asChild>
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </AuthLayout>
  )
}
