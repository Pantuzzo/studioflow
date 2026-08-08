import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test/test-utils'
import { ClientsPage } from './ClientsPage'

describe('ClientsPage', () => {
  beforeEach(() => {
    // /api/clients now answers 401 to anonymous callers, exactly as the real
    // API does. These tests are about the page, so start it signed in.
    const user = db.findUserByEmail('ava@northwind.studio')
    if (user) db.signIn(user.id)
  })

  it('shows a loading state, then the clients from the API', async () => {
    renderWithProviders(<ClientsPage />)

    // Loading state is announced to assistive tech.
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)

    // Data resolves through the MSW-mocked REST contract.
    expect(await screen.findByText('Northwind Studio')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(4) // header + 3 clients
  })

  it('shows an assertive error state when the request fails', async () => {
    server.use(
      http.get('/api/clients', () => new HttpResponse(null, { status: 500 })),
    )
    renderWithProviders(<ClientsPage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn.t load/i)
    expect(
      screen.getByRole('button', { name: /try again/i }),
    ).toBeInTheDocument()
  })

  it('recovers when Try again succeeds after a failure', async () => {
    server.use(
      http.get('/api/clients', () => new HttpResponse(null, { status: 500 })),
    )
    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await screen.findByRole('alert')

    // The next request succeeds; the most-recent handler takes precedence.
    server.use(http.get('/api/clients', () => HttpResponse.json(db.clients)))
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('Northwind Studio')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no clients', async () => {
    server.use(http.get('/api/clients', () => HttpResponse.json([])))
    renderWithProviders(<ClientsPage />)

    expect(await screen.findByText(/no clients yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
