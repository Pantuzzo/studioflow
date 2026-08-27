import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { renderApp } from '@/test/test-utils'

async function renderList() {
  const user = userEvent.setup()
  const app = renderApp({ route: '/proposals' })
  await screen.findByRole('heading', { name: 'Proposals', level: 1 })
  return { user, ...app }
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  combobox: HTMLElement,
  option: string,
) {
  await user.click(combobox)
  await user.click(await screen.findByRole('option', { name: option }))
}

beforeEach(() => {
  const user = db.findUserByEmail('ava@northwind.studio')
  if (user) db.signIn(user.id)
})

describe('ProposalsPage', () => {
  it('lists proposals with a block count rather than their documents', async () => {
    await renderList()

    expect(
      await screen.findByText('Website relaunch — proposal'),
    ).toBeInTheDocument()
    const row = screen.getByText('Website relaunch — proposal').closest('tr')
    // Three blocks, counted server-side; the index never carries the document.
    expect(within(row!).getByText('3')).toBeInTheDocument()
    expect(within(row!).getByText('Website relaunch')).toBeInTheDocument()

    // A proposal with no project shows a dash, not an empty cell.
    const unlinked = screen.getByText('Brand identity — proposal').closest('tr')
    expect(within(unlinked!).getByText('—')).toBeInTheDocument()
  })

  it('creates a proposal and opens its editor', async () => {
    const { user, router } = await renderList()
    await screen.findByText('Website relaunch — proposal')

    await user.click(screen.getByRole('button', { name: 'New proposal' }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText('Title'), 'Retainer 2027')
    await chooseOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Client' }),
      'Priya Nair',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Create proposal' }),
    )

    // Creation waits for the real id, because the next thing it does is
    // navigate to it.
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/proposals\/pp_/),
    )
    expect(await screen.findByLabelText('Proposal title')).toHaveValue(
      'Retainer 2027',
    )
  })

  it('offers only the chosen client’s projects', async () => {
    const { user } = await renderList()
    await screen.findByText('Website relaunch — proposal')

    await user.click(screen.getByRole('button', { name: 'New proposal' }))
    const dialog = await screen.findByRole('dialog')

    await chooseOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Client' }),
      'Ava Thompson',
    )
    await user.click(within(dialog).getByRole('combobox', { name: 'Project' }))

    // Ava's project, and not the one belonging to another client.
    expect(
      await screen.findByRole('option', { name: 'Website relaunch' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'Brand identity' }),
    ).not.toBeInTheDocument()
  })

  it('puts a proposal back when deleting it fails', async () => {
    server.use(
      // Slow enough to observe the optimistic removal before it is undone.
      http.delete('/api/proposals/:id', async () => {
        await delay(200)
        return new HttpResponse(null, { status: 500 })
      }),
    )
    const { user } = await renderList()
    await screen.findByText('Brand identity — proposal')

    await user.click(
      screen.getByRole('button', { name: 'Delete Brand identity — proposal' }),
    )

    // Gone optimistically, then restored when the server refuses.
    expect(
      screen.queryByText('Brand identity — proposal'),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText('Brand identity — proposal'),
    ).toBeInTheDocument()
    const [toast] = await screen.findAllByText(/couldn.t delete that proposal/i)
    expect(toast).toBeInTheDocument()
  })

  it('points at clients when there is nobody to address a proposal to', async () => {
    server.use(
      http.get('/api/proposals', () => HttpResponse.json([])),
      http.get('/api/clients', () => HttpResponse.json([])),
    )
    await renderList()

    expect(
      await screen.findByRole('link', { name: /add a client first/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New proposal' })).toBeDisabled()
  })
})
