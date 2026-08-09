import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SEED_EMAIL } from '@/mocks/db'
import { renderApp } from '@/test/test-utils'

async function openSignup() {
  const utils = renderApp({ route: '/signup' })
  await screen.findByRole('heading', { name: /create your account/i })
  return utils
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  values: {
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
  },
) {
  if (values.name) await user.type(screen.getByLabelText(/^name/i), values.name)
  if (values.email)
    await user.type(screen.getByLabelText(/^email/i), values.email)
  if (values.password)
    await user.type(screen.getByLabelText(/^password/i), values.password)
  if (values.confirmPassword)
    await user.type(
      screen.getByLabelText(/confirm password/i),
      values.confirmPassword,
    )
}

describe('SignupPage', () => {
  it('reports mismatched passwords on the confirmation field', async () => {
    const user = userEvent.setup()
    await openSignup()

    await fill(user, {
      name: 'New Person',
      email: 'new@studio.test',
      password: 'longenough',
      confirmPassword: 'different',
    })
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeVisible()
    // Reported against the field, so assistive tech ties it to the input.
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('enforces the shared password floor', async () => {
    const user = userEvent.setup()
    await openSignup()

    await fill(user, {
      name: 'New Person',
      email: 'new@studio.test',
      password: 'short',
      confirmPassword: 'short',
    })
    await user.click(screen.getByRole('button', { name: /create account/i }))

    // Matched on "Use at least…" so it cannot collide with the field hint,
    // which says "At least 8 characters."
    expect(await screen.findByText(/use at least 8 characters/i)).toBeVisible()
  })

  it('creates the account and lands in the app', async () => {
    const user = userEvent.setup()
    const { router } = await openSignup()

    await fill(user, {
      name: 'New Person',
      email: 'new@studio.test',
      password: 'longenough',
      confirmPassword: 'longenough',
    })
    await user.click(screen.getByRole('button', { name: /create account/i }))

    // PublicOnly performs the redirect once the session exists.
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/dashboard'),
    )
  })

  it('shows a taken email on the email field rather than as a banner', async () => {
    const user = userEvent.setup()
    await openSignup()

    await fill(user, {
      name: 'Duplicate',
      email: SEED_EMAIL,
      password: 'longenough',
      confirmPassword: 'longenough',
    })
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/already registered/i)).toBeVisible()
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })
})
