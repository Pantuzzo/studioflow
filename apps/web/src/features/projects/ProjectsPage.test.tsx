import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test/test-utils'
import { ProjectsPage } from './ProjectsPage'

/** A slow failure — long enough to observe the optimistic state on its own. */
const SLOW_FAILURE = 200

/** Radix mirrors each toast into a hidden live region, so the text appears twice. */
async function findToast(pattern: RegExp) {
  const [visible] = await screen.findAllByText(pattern)
  return visible
}

/** Radix renders the listbox in a portal, outside the dialog. */
async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  combobox: HTMLElement,
  option: string,
) {
  await user.click(combobox)
  await user.click(await screen.findByRole('option', { name: option }))
}

async function renderSignedIn() {
  const user = userEvent.setup()
  renderWithProviders(<ProjectsPage />)
  return user
}

beforeEach(() => {
  const user = db.findUserByEmail('ava@northwind.studio')
  if (user) db.signIn(user.id)
})

describe('ProjectsPage — reading', () => {
  it('shows a loading state, then the projects with their client and status', async () => {
    await renderSignedIn()

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)

    expect(await screen.findByText('Website relaunch')).toBeInTheDocument()
    // clientName is the client's contact name, resolved server-side, so the row
    // renders it without joining anything in the browser.
    expect(screen.getByText('Ava Thompson')).toBeInTheDocument()
    expect(screen.getByText('Luca Bianchi')).toBeInTheDocument()
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3) // header + 2 projects
  })

  it('offers a retry when the request fails', async () => {
    server.use(
      http.get('/api/projects', () => new HttpResponse(null, { status: 500 })),
    )
    const user = await renderSignedIn()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn.t load/i)

    server.use(http.get('/api/projects', () => HttpResponse.json(db.projects)))
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('Website relaunch')).toBeInTheDocument()
  })

  it('points at clients when there is nothing to attach a project to', async () => {
    server.use(
      http.get('/api/projects', () => HttpResponse.json([])),
      http.get('/api/clients', () => HttpResponse.json([])),
    )
    await renderSignedIn()

    expect(
      await screen.findByRole('link', { name: /add a client first/i }),
    ).toHaveAttribute('href', '/clients')
    // Creating a project would be a dead end, so the action is not offered.
    expect(screen.getByRole('button', { name: 'New project' })).toBeDisabled()
  })

  it('offers creation when there are clients but no projects', async () => {
    server.use(http.get('/api/projects', () => HttpResponse.json([])))
    await renderSignedIn()

    expect(
      await screen.findByRole('button', { name: /create your first project/i }),
    ).toBeInTheDocument()
  })
})

describe('ProjectsPage — writing', () => {
  it('creates a project, choosing its client from the picker', async () => {
    const user = await renderSignedIn()
    await screen.findByText('Website relaunch')

    await user.click(screen.getByRole('button', { name: 'New project' }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText('Name'), 'Packaging refresh')
    await chooseOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Client' }),
      'Priya Nair',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Create project' }),
    )

    expect(await screen.findByText('Packaging refresh')).toBeInTheDocument()
    const [, firstRow] = screen.getAllByRole('row')
    // The optimistic row already carries the client's name, before the reply:
    // the form passes along the name it just had in the picker.
    expect(firstRow).toHaveTextContent('Priya Nair')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('refuses to submit without a client', async () => {
    let posted = false
    server.use(
      http.post('/api/projects', () => {
        posted = true
        return new HttpResponse(null, { status: 201 })
      }),
    )

    const user = await renderSignedIn()
    await screen.findByText('Website relaunch')
    await user.click(screen.getByRole('button', { name: 'New project' }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText('Name'), 'Orphan project')
    await user.click(
      within(dialog).getByRole('button', { name: 'Create project' }),
    )

    expect(
      await screen.findByText('Choose a client for this project'),
    ).toBeInTheDocument()
    expect(posted).toBe(false)
  })

  it('sends only the status when only the status changed', async () => {
    let sent: unknown
    server.use(
      http.patch('/api/projects/:id', async ({ params, request }) => {
        sent = await request.json()
        const updated = db.updateProject(String(params.id), sent as never)
        return HttpResponse.json(updated)
      }),
    )

    const user = await renderSignedIn()
    await screen.findByText('Website relaunch')

    await user.click(
      screen.getByRole('button', { name: 'Edit Website relaunch' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Name')).toHaveValue(
      'Website relaunch',
    )

    await chooseOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Status' }),
      'Completed',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Save changes' }),
    )

    expect(await screen.findByText('Completed')).toBeInTheDocument()
    expect(sent).toEqual({ status: 'completed' })
  })

  it('rolls the row back when the server rejects a new project', async () => {
    server.use(
      http.post('/api/projects', async () => {
        await delay(SLOW_FAILURE)
        return new HttpResponse(null, { status: 500 })
      }),
    )

    const user = await renderSignedIn()
    await screen.findByText('Website relaunch')
    await user.click(screen.getByRole('button', { name: 'New project' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Doomed project')
    await chooseOption(
      user,
      within(dialog).getByRole('combobox', { name: 'Client' }),
      'Ava Thompson',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Create project' }),
    )

    // On screen before the server has answered.
    expect(screen.getByText('Doomed project')).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.queryByText('Doomed project')).not.toBeInTheDocument(),
    )
    expect(await findToast(/couldn.t create that project/i)).toBeInTheDocument()
  })

  it('asks before deleting, then removes the row', async () => {
    const user = await renderSignedIn()
    await screen.findByText('Brand identity')

    await user.click(
      screen.getByRole('button', { name: 'Delete Brand identity' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/can.t be undone/i)
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete project' }),
    )

    expect(screen.queryByText('Brand identity')).not.toBeInTheDocument()
    await waitFor(() => expect(db.projects).toHaveLength(1))
  })

  it('puts the row back when the delete fails', async () => {
    server.use(
      http.delete('/api/projects/:id', async () => {
        await delay(SLOW_FAILURE)
        return new HttpResponse(null, { status: 500 })
      }),
    )

    const user = await renderSignedIn()
    await screen.findByText('Brand identity')
    await user.click(
      screen.getByRole('button', { name: 'Delete Brand identity' }),
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete project' }),
    )

    expect(screen.queryByText('Brand identity')).not.toBeInTheDocument()

    expect(await screen.findByText('Brand identity')).toBeInTheDocument()
    expect(await findToast(/couldn.t delete that project/i)).toBeInTheDocument()
  })
})
