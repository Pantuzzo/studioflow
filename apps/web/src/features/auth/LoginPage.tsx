import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@studioflow/contracts'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useLoginMutation } from './authApi'
import { apiErrorMessage } from './apiErrorMessage'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const [login, { isLoading, error }] = useLoginMutation()
  const { control, handleSubmit } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // No navigate() here on purpose: a successful login invalidates the session
  // cache, and PublicOnly performs the redirect-back. One place owns it.
  const onSubmit = handleSubmit(async (values) => {
    await login(values)
      .unwrap()
      .catch(() => undefined)
  })

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back to StudioFlow."
      footer={
        <>
          No account yet? <Link to="/signup">Create one</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className={styles.form} noValidate>
        {error && (
          <p role="alert" className={styles.error}>
            {apiErrorMessage(error)}
          </p>
        )}

        <FormField control={control} name="email" label="Email" required>
          {(field) => (
            <Input
              {...field}
              type="email"
              autoComplete="email"
              placeholder="you@studio.com"
            />
          )}
        </FormField>

        <FormField control={control} name="password" label="Password" required>
          {(field) => (
            <Input {...field} type="password" autoComplete="current-password" />
          )}
        </FormField>

        <Button type="submit" disabled={isLoading} aria-busy={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </Button>

        <Link to="/forgot-password" className={styles.forgot}>
          Forgot your password?
        </Link>
      </form>
    </AuthLayout>
  )
}
