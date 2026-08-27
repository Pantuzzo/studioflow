import {
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Client } from '@studioflow/contracts'
import { delay, http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test/test-utils'
import { ClientsPage } from './ClientsPage'

/**
 * The write half of the clients feature, exercised through the real data layer:
 * the component dispatches real RTK Query mutations, MSW answers with the same
 * Zod contract the API validates against, and the assertions are about what the
 * user sees — including the moment before the server has answered.
 *
 * The currency picker is exercised here too. An earlier note in this file said
 * it could not be, because happy-dom lacked the pointer APIs Radix needs; that
 * was re-probed against the current versions and is no longer true.
 */

/** A slow failure — long enough to observe the optimistic state on its own. */
const SLOW_FAILURE = 200

/**
 * Radix mirrors every toast into a hidden live region, so its text is in the
 * document twice: once seen, once announced. Both are wanted; the assertion
 * just has to expect them.
 */
async function findToast(pattern: RegExp) {
  const [visible] = await screen.findAllByText(pattern)
  return visible
}

async function renderSignedIn() {
  const user = userEvent.setup()
  renderWithProviders(<ClientsPage />)
  await screen.findByText('Northwind Studio')
  return user
}

async function fillNewClientForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'New client' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Name'), 'Mara Silva')
  await user.type(within(dialog).getByLabelText('Company'), 'Atlas Works')
  await user.type(within(dialog).getByLabelText('Email'), 'mara@atlas.works')
  return dialog
}

describe('ClientsPage — creating', () => {
  beforeEach(() => {
    const user = db.findUserByEmail('ava@northwind.studio')
    if (user) db.signIn(user.id)
  })

  it('adds the client to the list and closes the dialog', async () => {
    const user = await renderSignedIn()
    const dialog = await fillNewClientForm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Add client' }))

    expect(await screen.findByText('Atlas Works')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    // Newest first, so the new client leads the table.
    const [, firstRow] = screen.getAllByRole('row')
    expect(firstRow).toHaveTextContent('Mara Silva')
  })

  it('refuses to submit a form the API would reject', async () => {
    let posted = false
    server.use(
      http.post('/api/clients', () => {
        posted = true
        return new HttpResponse(null, { status: 201 })
      }),
    )

    const user = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'New client' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Add client' }))

    expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    expect(screen.getByText('Enter a company')).toBeInTheDocument()
    // The shared schema catches it in the browser, so no request is made.
    expect(posted).toBe(false)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows the row immediately, then rolls it back when the save fails', async () => {
    server.use(
      http.post('/api/clients', async () => {
        await delay(SLOW_FAILURE)
        return new HttpResponse(null, { status: 500 })
      }),
    )

    const user = await renderSignedIn()
    const dialog = await fillNewClientForm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Add client' }))

    // The server has not answered yet — this row is pure optimism.
    expect(screen.getByText('Atlas Works')).toBeInTheDocument()
    // It cannot be edited or deleted until it has a real id.
    expect(
      screen.getByRole('button', { name: 'Edit Mara Silva' }),
    ).toBeDisabled()

    await waitForElementToBeRemoved(() => screen.queryByText('Atlas Works'))
    expect(await findToast(/couldn.t add that client/i)).toBeInTheDocument()
  })
})

describe('ClientsPage — editing', () => {
  beforeEach(() => {
    const user = db.findUserByEmail('ava@northwind.studio')
    if (user) db.signIn(user.id)
  })

  it('prefills the form and sends only the fields that changed', async () => {
    let sent: unknown
    server.use(
      http.patch('/api/clients/:id', async ({ params, request }) => {
        sent = await request.json()
        const updated = db.updateClient(
          String(params.id),
          sent as Partial<Client>,
        )
        return HttpResponse.json(updated)
      }),
    )

    const user = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'Edit Luca Bianchi' }))
    const dialog = await screen.findByRole('dialog')

    const company = within(dialog).getByLabelText('Company')
    expect(company).toHaveValue('Fjord Collective')
    expect(within(dialog).getByLabelText('Email')).toHaveValue('luca@fjord.co')

    await user.clear(company)
    await user.type(company, 'Fjord Studio')
    await user.click(
      within(dialog).getByRole('button', { name: 'Save changes' }),
    )

    expect(await screen.findByText('Fjord Studio')).toBeInTheDocument()
    // PATCH means "what changed": the untouched fields never leave the browser.
    expect(sent).toEqual({ company: 'Fjord Studio' })
  })

  it('changes the currency through the picker', async () => {
    let sent: unknown
    server.use(
      http.patch('/api/clients/:id', async ({ params, request }) => {
        sent = await request.json()
        const updated = db.updateClient(
          String(params.id),
          sent as Partial<Client>,
        )
        return HttpResponse.json(updated)
      }),
    )

    const user = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'Edit Luca Bianchi' }))
    const dialog = await screen.findByRole('dialog')

    // The picker opens with the client's current currency selected.
    const currency = within(dialog).getByRole('combobox', { name: 'Currency' })
    expect(currency).toHaveTextContent('EUR')

    await user.click(currency)
    // The listbox is portalled, so it is not inside the dialog element.
    await user.click(await screen.findByRole('option', { name: 'GBP' }))
    await user.click(
      within(dialog).getByRole('button', { name: 'Save changes' }),
    )

    // Scoped to the edited row: another seeded client is already on GBP.
    const row = screen.getByText('Fjord Collective').closest('tr')
    await waitFor(() => expect(row).toHaveTextContent('GBP'))
    expect(sent).toEqual({ currency: 'GBP' })
  })

  it('sends nothing at all when the form is submitted unchanged', async () => {
    let patched = false
    server.use(
      http.patch('/api/clients/:id', () => {
        patched = true
        return new HttpResponse(null, { status: 500 })
      }),
    )

    const user = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'Edit Luca Bianchi' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Save changes' }),
    )

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(patched).toBe(false)
    expect(screen.getByText('Fjord Collective')).toBeInTheDocument()
  })

  it('restores the previous values when the save fails', async () => {
    server.use(
      http.patch('/api/clients/:id', async () => {
        await delay(SLOW_FAILURE)
        return new HttpResponse(null, { status: 500 })
      }),
    )

    const user = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'Edit Luca Bianchi' }))
    const dialog = await screen.findByRole('dialog')
    const company = within(dialog).getByLabelText('Company')
    await user.clear(company)
    await user.type(company, 'Fjord Studio')
    await user.click(
      within(dialog).getByRole('button', { name: 'Save changes' }),
    )

    // Applied to the cache before the request even lands.
    expect(screen.getByText('Fjord Studio')).toBeInTheDocument()

    // The rejection puts the row back exactly as it was.
    expect(await screen.findByText('Fjord Collective')).toBeInTheDocument()
    expect(screen.queryByText('Fjord Studio')).not.toBeInTheDocument()
    expect(await findToast(/couldn.t save your changes/i)).toBeInTheDocument()
  })
})

describe('ClientsPage — deleting', () => {
  beforeEach(() => {
    const user = db.findUserByEmail('ava@northwind.studio')
    if (user) db.signIn(user.id)
  })

  async function confirmDelete(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Delete Priya Nair' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/can.t be undone/i)
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete client' }),
    )
  }

  it('asks first, then removes the row', async () => {
    const user = await renderSignedIn()
    await confirmDelete(user)

    // Gone the instant it is confirmed, with no wait for the round trip.
    expect(screen.queryByText('Lumen Consulting')).not.toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3) // header + 2 clients

    // The request really did land, and the row stays gone afterwards.
    await waitFor(() => expect(db.clients).toHaveLength(2))
    expect(screen.queryByText('Lumen Consulting')).not.toBeInTheDocument()
  })

  it('puts the row back when the delete fails', async () => {
    server.use(
      http.delete('/api/clients/:id', async () => {
        await delay(SLOW_FAILURE)
        return new HttpResponse(null, { status: 500 })
      }),
    )

    const user = await renderSignedIn()
    await confirmDelete(user)

    expect(screen.queryByText('Lumen Consulting')).not.toBeInTheDocument()

    expect(await screen.findByText('Lumen Consulting')).toBeInTheDocument()
    expect(await findToast(/couldn.t delete that client/i)).toBeInTheDocument()
    // Restored in place, not appended to the end.
    const rows = screen.getAllByRole('row')
    expect(rows[rows.length - 1]).toHaveTextContent('Lumen Consulting')
  })
})
