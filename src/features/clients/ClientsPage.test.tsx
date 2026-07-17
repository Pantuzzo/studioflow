import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/test-utils'
import { ClientsPage } from './ClientsPage'

describe('ClientsPage', () => {
  it('shows a loading state, then the clients from the API', async () => {
    renderWithProviders(<ClientsPage />)

    // Loading state is announced to assistive tech.
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)

    // Data resolves through the MSW-mocked REST contract.
    expect(await screen.findByText('Northwind Studio')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(4) // header + 3 clients
  })
})
