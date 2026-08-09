import { zodResolver } from '@hookform/resolvers/zod'
import { signupFormSchema, type SignupFormInput } from '@studioflow/contracts'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { apiErrorMessage, apiErrorStatus } from './apiErrorMessage'
import { useSignupMutation } from './authApi'
import styles from './LoginPage.module.css'

export function SignupPage() {
  const [signup, { isLoading }] = useSignupMutation()
  const location = useLocation()
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupFormInput>({
    // The form schema adds confirmPassword on top of the wire contract, and
    // cross-checks it with a Zod refine — password confirmation is a UI
    // concern, so it never reaches the API.
    resolver: zodResolver(signupFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    const { confirmPassword: _confirmPassword, ...input } = values
    try {
      await signup(input).unwrap()
      // No navigate(): PublicOnly sees the new session and redirects.
    } catch (error) {
      const rejection = error as Parameters<typeof apiErrorStatus>[0]
      if (apiErrorStatus(rejection) === 409) {
        // A taken address belongs on the field that caused it, not in a banner.
        setError('email', { message: apiErrorMessage(rejection) })
      } else {
        setError('root', { message: apiErrorMessage(rejection) })
      }
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start running your studio in one place."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className={styles.form} noValidate>
        {errors.root && (
          <p role="alert" className={styles.error}>
            {errors.root.message}
          </p>
        )}

        <FormField control={control} name="name" label="Name" required>
          {(field) => <Input {...field} autoComplete="name" />}
        </FormField>

        <FormField control={control} name="email" label="Email" required>
          {(field) => <Input {...field} type="email" autoComplete="email" />}
        </FormField>

        <FormField
          control={control}
          name="password"
          label="Password"
          hint="At least 8 characters."
          required
        >
          {(field) => (
            <Input {...field} type="password" autoComplete="new-password" />
          )}
        </FormField>

        <FormField
          control={control}
          name="confirmPassword"
          label="Confirm password"
          required
        >
          {(field) => (
            <Input {...field} type="password" autoComplete="new-password" />
          )}
        </FormField>

        <Button type="submit" disabled={isLoading} aria-busy={isLoading}>
          {isLoading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
