import { zodResolver } from '@hookform/resolvers/zod'
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@studioflow/contracts'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useForgotPasswordMutation } from './authApi'
import styles from './LoginPage.module.css'

export function ForgotPasswordPage() {
  const [requestReset, { isLoading, isSuccess, data }] =
    useForgotPasswordMutation()
  const { control, handleSubmit } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    await requestReset(values)
      .unwrap()
      .catch(() => undefined)
  })

  // The API answers 202 whether or not the address exists, so the confirmation
  // is identical either way. Saying "we sent you a link" only when the account
  // is real would turn this screen into an account oracle.
  if (isSuccess) {
    return (
      <AuthLayout
        title="Check your inbox"
        footer={<Link to="/login">Back to sign in</Link>}
      >
        <p role="status">
          {data?.message ??
            'If that email is registered, a reset link is on its way.'}
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We’ll email you a link to set a new one."
      footer={<Link to="/login">Back to sign in</Link>}
    >
      <form onSubmit={onSubmit} className={styles.form} noValidate>
        <FormField control={control} name="email" label="Email" required>
          {(field) => <Input {...field} type="email" autoComplete="email" />}
        </FormField>

        <Button type="submit" disabled={isLoading} aria-busy={isLoading}>
          {isLoading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  )
}
