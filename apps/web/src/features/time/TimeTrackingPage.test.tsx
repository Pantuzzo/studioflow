import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TimeEntry } from '@studioflow/contracts'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { renderApp } from '@/test/test-utils'

async function renderTime() {
  const user = userEvent.setup()
  renderApp({ route: '/time' })
  await screen.findByRole('heading', { name: 'Time', level: 1 })
  return user
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  combobox: HTMLElement,
  option: string | RegExp,
) {
  await user.click(combobox)
  await user.click(await screen.findByRole('option', { name: option }))
}

/** A timesheet far longer than any window could show. */
function manyEntries(count: number): TimeEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `te_bulk_${index}`,
    projectId: 'pr_001',
    projectName: 'Website relaunch',
    clientName: 'Ava Thompson',
    description: `Entry ${index}`,
    startedAt: '2026-08-16T09:00:00.000Z',
    endedAt: '2026-08-16T10:00:00.000Z',
    createdAt: '2026-08-16T09:00:00.000Z',
  }))
}

/**
 * The virtualizer sizes its window from the scroller's `offsetHeight` (checked
 * against @tanstack/virtual-core, which reads exactly that), and happy-dom
 * reports zero for every element. Without a height there is no window, and it
 * renders no rows at all. Lending the environment a viewport is the smallest
 * honest stand-in for the layout it does not do.
 */
const sizes: Array<[string, number]> = [
  ['offsetHeight', 640],
  ['offsetWidth', 800],
]
let originals: Array<[string, PropertyDescriptor | undefined]> = []

beforeEach(() => {
  originals = sizes.map(([name]) => [
    name,
    Object.getOwnPropertyDescriptor(HTMLElement.prototype, name),
  ])
  for (const [name, value] of sizes) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      value,
    })
  }

  const user = db.findUserByEmail('ava@northwind.studio')
  if (user) db.signIn(user.id)
})

afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor)
      Object.defineProperty(HTMLElement.prototype, name, descriptor)
    else
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
  }
  vi.restoreAllMocks()
})

/** Rows inside the timesheet, never the navigation's list items. */
function timesheetRows() {
  return within(screen.getByRole('region', { name: 'Timesheet' })).getAllByRole(
    'listitem',
  )
}

describe('TimeTrackingPage — timesheet', () => {
  it('lists finished entries with their durations and a total', async () => {
    await renderTime()

    expect(await screen.findByText('Wireframes')).toBeInTheDocument()
    // 2h30 plus 1h15.
    expect(screen.getByText('2:30:00')).toBeInTheDocument()
    expect(screen.getByText('1:15:00')).toBeInTheDocument()
    expect(screen.getByText(/2 entries · 3:45:00 tracked/)).toBeInTheDocument()
  })

  it('offers a retry when the timesheet cannot be loaded', async () => {
    server.use(
      http.get(
        '/api/time-entries',
        () => new HttpResponse(null, { status: 500 }),
      ),
    )
    await renderTime()

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load/i)
  })

  it('says so plainly when nothing has been tracked', async () => {
    server.use(http.get('/api/time-entries', () => HttpResponse.json([])))
    await renderTime()

    expect(await screen.findByText(/nothing tracked yet/i)).toBeInTheDocument()
  })

  it('keeps the DOM small no matter how long the timesheet is', async () => {
    const entries = manyEntries(500)
    server.use(http.get('/api/time-entries', () => HttpResponse.json(entries)))
    await renderTime()

    await screen.findByText(/500 entries/)
    // The whole list is accounted for in the total, but only a window of it is
    // ever in the document. Scoped to the timesheet: counting every listitem
    // on the page would be satisfied by the navigation alone.
    const rows = timesheetRows()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(60)
    expect(screen.getByText('Entry 0')).toBeInTheDocument()
    // A row far down the list is not rendered until it is scrolled to.
    expect(screen.queryByText('Entry 499')).not.toBeInTheDocument()
  })

  it('puts an entry back when deleting it fails', async () => {
    server.use(
      http.delete('/api/time-entries/:id', async () => {
        await delay(200)
        return new HttpResponse(null, { status: 500 })
      }),
    )
    const user = await renderTime()
    await screen.findByText('Wireframes')

    await user.click(screen.getByRole('button', { name: 'Delete Wireframes' }))
    expect(screen.queryByText('Wireframes')).not.toBeInTheDocument()

    expect(await screen.findByText('Wireframes')).toBeInTheDocument()
    const [toast] = await screen.findAllByText(/couldn.t delete that entry/i)
    expect(toast).toBeInTheDocument()
  })
})

describe('TimeTrackingPage — the timer', () => {
  it('starts a timer and shows it running', async () => {
    const user = await renderTime()

    await user.type(
      screen.getByLabelText('What are you working on?'),
      'Refactoring',
    )
    await chooseOption(
      user,
      screen.getByRole('combobox', { name: 'Project' }),
      /Website relaunch/,
    )
    await user.click(screen.getByRole('button', { name: 'Start' }))

    // The clock starts at zero, because the server timestamps the start.
    expect(await screen.findByText('00:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByText('Refactoring')).toBeInTheDocument()
  })

  it('picks a running timer back up on load', async () => {
    // What a page refresh looks like: the server already has one running.
    const running: TimeEntry = {
      id: 'te_running',
      projectId: 'pr_001',
      projectName: 'Website relaunch',
      clientName: 'Ava Thompson',
      description: 'Already going',
      startedAt: new Date(Date.now() - 65_000).toISOString(),
      endedAt: null,
      createdAt: new Date(Date.now() - 65_000).toISOString(),
    }
    server.use(
      http.get('/api/time-entries/running', () => HttpResponse.json(running)),
    )
    await renderTime()

    // Elapsed is derived from the start, so it reads a minute in immediately.
    expect(await screen.findByText('01:05')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('stops the timer and returns to the idle bar', async () => {
    const user = await renderTime()

    await chooseOption(
      user,
      screen.getByRole('combobox', { name: 'Project' }),
      /Website relaunch/,
    )
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await screen.findByRole('button', { name: 'Stop' })

    await user.click(screen.getByRole('button', { name: 'Stop' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('button', { name: 'Stop' }),
    ).not.toBeInTheDocument()
  })

  it('refuses to start a second timer, and says why', async () => {
    const user = await renderTime()

    await chooseOption(
      user,
      screen.getByRole('combobox', { name: 'Project' }),
      /Website relaunch/,
    )
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await screen.findByRole('button', { name: 'Stop' })

    // One timer at a time is a server rule; the UI simply cannot ask for two,
    // because the Start button is gone while one runs.
    expect(
      screen.queryByRole('button', { name: 'Start' }),
    ).not.toBeInTheDocument()

    const running = await fetch('/api/time-entries/running').then((r) =>
      r.json(),
    )
    expect(running.id).toEqual(expect.any(String))
  })

  it('cannot start without choosing a project', async () => {
    const user = await renderTime()
    await user.type(
      screen.getByLabelText('What are you working on?'),
      'Thinking',
    )
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
  })

  it('shows the running entry only in the bar, never twice', async () => {
    const user = await renderTime()
    await chooseOption(
      user,
      screen.getByRole('combobox', { name: 'Project' }),
      /Website relaunch/,
    )
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await screen.findByRole('button', { name: 'Stop' })

    // Two clocks for one entry could disagree, so the list holds finished
    // entries only.
    expect(timesheetRows()).toHaveLength(2)
  })
})
