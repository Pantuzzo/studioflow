import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SEED_EMAIL } from '@/mocks/db'
import { renderApp } from '@/test/test-utils'

async function open() {
  renderApp({ route: '/forgot-password' })
  await screen.findByRole('heading', { name: /reset your password/i })
}

async function submit(email: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/email/i), email)
  await user.click(screen.getByRole('button', { name: /send reset link/i }))
}

describe('ForgotPasswordPage', () => {
  it('validates the email before sending', async () => {
    const user = userEvent.setup()
    await open()

    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText(/valid email address/i)).toBeVisible()
  })

  it('confirms identically for a known and an unknown address', async () => {
    // Unmounted between the two runs: leaving both trees mounted would make
    // every query ambiguous.
    const first = renderApp({ route: '/forgot-password' })
    await screen.findByRole('heading', { name: /reset your password/i })
    await submit(SEED_EMAIL)
    const known = (await screen.findByRole('status')).textContent
    first.unmount()

    renderApp({ route: '/forgot-password' })
    await screen.findByRole('heading', { name: /reset your password/i })
    await submit('nobody@studio.test')
    const unknown = (await screen.findByRole('status')).textContent

    // Identical wording either way, or the screen becomes an account oracle.
    expect(unknown).toBe(known)
  })

  it('replaces the form with the confirmation panel', async () => {
    await open()
    await submit(SEED_EMAIL)

    expect(
      await screen.findByRole('heading', { name: /check your inbox/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /send reset link/i }),
    ).not.toBeInTheDocument()
  })
})
