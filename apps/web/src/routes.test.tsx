import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db, SEED_EMAIL, SEED_PASSWORD } from '@/mocks/db'
import { renderApp } from '@/test/test-utils'

function signIn(): void {
  const user = db.findUserByEmail(SEED_EMAIL)
  if (user) db.signIn(user.id)
}

describe('routing and auth guards', () => {
  it('sends an anonymous visitor from a protected route to the login screen', async () => {
    const { router } = renderApp({ route: '/clients' })

    expect(
      await screen.findByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('lets a signed-in visitor reach a protected route', async () => {
    signIn()
    renderApp({ route: '/clients' })

    expect(await screen.findByText('Northwind Studio')).toBeInTheDocument()
  })

  it('keeps a signed-in visitor off the login screen', async () => {
    signIn()
    const { router } = renderApp({ route: '/login' })

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/dashboard'),
    )
  })

  it('returns to the originally requested page after signing in', async () => {
    const user = userEvent.setup()
    const { router } = renderApp({ route: '/clients' })

    // Bounced to login, with the destination remembered.
    await screen.findByRole('heading', { name: /sign in/i })

    await user.type(screen.getByLabelText(/email/i), SEED_EMAIL)
    await user.type(screen.getByLabelText(/password/i), SEED_PASSWORD)
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    // Back to /clients, not to the dashboard default.
    await waitFor(() => expect(router.state.location.pathname).toBe('/clients'))
    expect(await screen.findByText('Northwind Studio')).toBeInTheDocument()
  })

  it('shows the API message when the credentials are wrong, and stays put', async () => {
    const user = userEvent.setup()
    const { router } = renderApp({ route: '/login' })

    // Wait for SessionGate to settle; the form does not exist before that.
    await screen.findByRole('heading', { name: /sign in/i })

    await user.type(screen.getByLabelText(/email/i), SEED_EMAIL)
    await user.type(screen.getByLabelText(/password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalid email or password/i,
    )
    expect(router.state.location.pathname).toBe('/login')
  })

  it('signs the user out and returns to login', async () => {
    signIn()
    const user = userEvent.setup()
    const { router } = renderApp({ route: '/dashboard' })

    await screen.findByRole('heading', { name: /dashboard/i })
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('renders a not-found page for an unknown route', async () => {
    signIn()
    renderApp({ route: '/nowhere' })

    expect(
      await screen.findByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument()
  })
})
