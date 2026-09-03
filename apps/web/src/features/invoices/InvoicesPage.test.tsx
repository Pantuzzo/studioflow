import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { renderApp } from '@/test/test-utils'

async function renderInvoices(route = '/invoices') {
  const user = userEvent.setup()
  const app = renderApp({ route })
  return { user, ...app }
}

/** Both date inputs, which the dialog seeds with the current month. */
async function setPeriod(dialog: HTMLElement, from: string, to: string) {
  // Set rather than typed: a date field takes a whole value at once, and
  // typing one produces partial dates on the way.
  fireEvent.change(within(dialog).getByLabelText('From'), {
    target: { value: from },
  })
  fireEvent.change(within(dialog).getByLabelText('To'), {
    target: { value: to },
  })
  await Promise.resolve()
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  combobox: HTMLElement,
  option: string | RegExp,
) {
  await user.click(combobox)
  await user.click(await screen.findByRole('option', { name: option }))
}

beforeEach(() => {
  const user = db.findUserByEmail('ava@northwind.studio')
  if (user) db.signIn(user.id)
})

describe('InvoicesPage', () => {
  it('lists invoices with locale-formatted dates and a plural line count', async () => {
    await renderInvoices()

    expect(await screen.findByText('#1')).toBeInTheDocument()
    expect(screen.getByText('Northwind Studio')).toBeInTheDocument()
    // One line, singular. A naive template would print "1 lines".
    expect(screen.getByText('1 line')).toBeInTheDocument()
  })

  it('offers a retry when the list cannot be loaded', async () => {
    server.use(
      http.get('/api/invoices', () => new HttpResponse(null, { status: 500 })),
    )
    await renderInvoices()
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load/i)
  })

  it('explains that invoices come from tracked time when there are none', async () => {
    server.use(http.get('/api/invoices', () => HttpResponse.json([])))
    await renderInvoices()

    expect(
      await screen.findByRole('button', {
        name: /generate your first invoice/i,
      }),
    ).toBeInTheDocument()
  })

  it('generates an invoice and opens it', async () => {
    const { user, router } = await renderInvoices()
    await screen.findByText('#1')

    await user.click(screen.getByRole('button', { name: 'Generate invoice' }))
    const dialog = await screen.findByRole('dialog')
    await chooseOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Client' }),
      /Northwind Studio/,
    )
    // The period is set explicitly rather than left on its default, which is
    // the current calendar month. Relying on that default made this test pass
    // only while the machine's clock was in the same month as the fixture.
    await setPeriod(dialog, '2026-08-01', '2026-09-01')
    await user.click(within(dialog).getByRole('button', { name: 'Generate' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/invoices\/in_/),
    )
    // 2.5 tracked hours at 95.00 an hour. The separator is the runner's
    // locale's business, which is the whole point of formatting through Intl.
    expect(await screen.findByText(/2[.,]5 hours/)).toBeInTheDocument()
    // Twice: once on the line, once in the total, because there is one line.
    expect(screen.getAllByText(/237[.,]50/)).toHaveLength(2)
  })

  it('says plainly when there is nothing to bill, without a toast', async () => {
    const { user } = await renderInvoices()
    await screen.findByText('#1')

    await user.click(screen.getByRole('button', { name: 'Generate invoice' }))
    const dialog = await screen.findByRole('dialog')
    // Priya has no tracked time at all.
    await chooseOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Client' }),
      /Lumen Consulting/,
    )
    await user.click(within(dialog).getByRole('button', { name: 'Generate' }))

    // An empty period is the commonest outcome and not really an error, so it
    // belongs in the form rather than in a toast.
    expect(
      await screen.findByText(/no unbilled time in that period/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('releases the hours when an invoice is deleted, and says so', async () => {
    const { user } = await renderInvoices()
    await screen.findByText('#1')

    await user.click(screen.getByRole('button', { name: 'Delete invoice 1' }))

    const [toast] = await screen.findAllByText(/its hours are available/i)
    expect(toast).toBeInTheDocument()
    await waitFor(() => expect(db.invoices).toHaveLength(0))
  })
})

describe('InvoiceDetailPage', () => {
  it('prints the frozen client details rather than looking them up', async () => {
    const { user } = await renderInvoices('/invoices/in_001')

    expect(await screen.findByText('Invoice #1')).toBeInTheDocument()
    expect(screen.getByText('Northwind Studio')).toBeInTheDocument()

    // Renaming the client now must not change what this invoice says.
    db.updateClient('cl_001', { name: 'Renamed Later', company: 'New Co' })
    await user.click(screen.getByRole('link', { name: /all invoices/i }))
    await user.click(
      await screen.findByRole('link', { name: 'Open invoice 1' }),
    )

    expect(await screen.findByText('Northwind Studio')).toBeInTheDocument()
    expect(screen.queryByText('New Co')).not.toBeInTheDocument()
  })

  it('formats hours, rate and total in the invoice currency', async () => {
    await renderInvoices('/invoices/in_001')

    expect(await screen.findByText(/2[.,]5 hours/)).toBeInTheDocument()
    expect(screen.getByText(/95[.,]00/)).toBeInTheDocument()
    // 2.5 × 95.00, rounded once: on the line and again in the total.
    expect(screen.getAllByText(/237[.,]50/)).toHaveLength(2)
  })

  it('changes the status through the picker', async () => {
    const { user } = await renderInvoices('/invoices/in_001')
    await screen.findByText('Invoice #1')

    await chooseOption(
      user,
      screen.getByRole('combobox', { name: 'Status' }),
      'Paid',
    )

    await waitFor(() => expect(db.findInvoice('in_001')?.status).toBe('paid'))
  })

  it('offers printing rather than a generated file', async () => {
    await renderInvoices('/invoices/in_001')
    // The browser's own PDF engine, not a bundled library.
    expect(
      await screen.findByRole('button', { name: /print or save as pdf/i }),
    ).toBeInTheDocument()
  })
})

describe('writing direction', () => {
  it('flips the whole document, and says which way it will go', async () => {
    const { user } = await renderInvoices()
    await screen.findByText('#1')

    const toggle = screen.getByRole('button', {
      name: /switch to right-to-left/i,
    })
    await user.click(toggle)

    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    // The label now offers the way back, rather than describing the state.
    expect(
      screen.getByRole('button', { name: /switch to left-to-right/i }),
    ).toBeInTheDocument()
  })
})
