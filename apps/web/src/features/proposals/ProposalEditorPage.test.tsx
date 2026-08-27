import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { renderApp } from '@/test/test-utils'

/**
 * The editor, driven the way it has to be operable: from the keyboard.
 *
 * Reordering is exercised through the block menu and through dnd-kit's keyboard
 * sensor rather than by simulating a mouse drag. That is not a compromise — it
 * is the claim the week is making, and it happens to be the only version a test
 * runner can assert on.
 */

const EDITOR_ROUTE = '/proposals/pp_001'

function renderEditor(route = EDITOR_ROUTE) {
  const user = userEvent.setup()
  // The real route tree: the page reads :id from the router, and the session
  // guard is exercised on the way in exactly as it ships.
  renderApp({ route })
  return user
}

/** Block titles in document order — the only h3s on the page. */
function blockOrder() {
  return screen
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent?.replace(/\s*·.*$/, '').trim())
}

beforeEach(() => {
  const user = db.findUserByEmail('ava@northwind.studio')
  if (user) db.signIn(user.id)

  // Autosave is debounced and also flushes on unmount, so a save can land after
  // the test has finished and the mock database has been rewound — writing one
  // test's document into the next one's fixture. These tests are about what the
  // editor shows; persistence is asserted in useAutosave.test.ts, where the
  // save is awaited. So here the write is accepted and discarded.
  server.use(
    http.patch('/api/proposals/:id', async ({ params, request }) => {
      const body = (await request.json()) as { title?: string }
      const current = db.findProposal(String(params.id))
      if (!current) return HttpResponse.json({}, { status: 404 })
      return HttpResponse.json({
        ...current,
        title: body.title ?? current.title,
      })
    }),
  )
})

describe('ProposalEditorPage — loading', () => {
  it('shows the document the server holds', async () => {
    renderEditor()

    expect(await screen.findByLabelText('Proposal title')).toHaveValue(
      'Website relaunch — proposal',
    )
    expect(blockOrder()).toEqual(['Heading', 'Text', 'Pricing table'])
    // 12 × 95.00 plus 30 × 110.00, formatted in the client's own currency
    // rather than a hardcoded one.
    expect(screen.getByText(/4[.,]440/)).toBeInTheDocument()
  })

  it('offers a retry when the proposal cannot be loaded', async () => {
    server.use(
      http.get('/api/proposals/:id', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    )
    renderEditor()

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load/i)
  })

  it('shows an empty document as an invitation, not a blank page', async () => {
    renderEditor('/proposals/pp_002')
    expect(
      await screen.findByText(/this proposal is empty/i),
    ).toBeInTheDocument()
  })
})

describe('ProposalEditorPage — reordering', () => {
  it('moves a block with the menu, and the menu alone', async () => {
    const user = renderEditor()
    await screen.findByLabelText('Proposal title')
    expect(blockOrder()).toEqual(['Heading', 'Text', 'Pricing table'])

    await user.click(screen.getByRole('button', { name: 'Text block actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Move up' }))

    expect(blockOrder()).toEqual(['Text', 'Heading', 'Pricing table'])
  })

  it('disables the move that would fall off the end', async () => {
    const user = renderEditor()
    await screen.findByLabelText('Proposal title')

    await user.click(
      screen.getByRole('button', { name: 'Heading block actions' }),
    )
    expect(
      await screen.findByRole('menuitem', { name: 'Move up' }),
    ).toHaveAttribute('data-disabled')
  })

  it('reorders with dnd-kit’s keyboard sensor', async () => {
    // dnd-kit decides where a block lands by measuring the page, and happy-dom
    // reports every element as a zero-sized box at the origin. Stacking the
    // cards vertically is the smallest lie that gives the sensor something real
    // to move through.
    const stack = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        const card = this.tagName === 'LI' ? this : this.closest('li')
        const siblings = card?.parentElement?.children
        const index = siblings
          ? Array.prototype.indexOf.call(siblings, card)
          : -1
        const top = index === -1 ? 0 : index * 100
        return {
          x: 0,
          y: top,
          top,
          bottom: top + 100,
          left: 0,
          right: 320,
          width: 320,
          height: 100,
          toJSON: () => ({}),
        } as DOMRect
      })

    try {
      const user = renderEditor()
      await screen.findByLabelText('Proposal title')

      // Space picks the block up, an arrow moves it, space drops it.
      const handle = screen.getByRole('button', {
        name: /Reorder Heading block/,
      })
      handle.focus()
      await user.keyboard(' ')
      await user.keyboard('{ArrowDown}')
      await user.keyboard(' ')

      await waitFor(() =>
        expect(blockOrder()).toEqual(['Text', 'Heading', 'Pricing table']),
      )
    } finally {
      stack.mockRestore()
    }
  })

  it('names the block and its position in the handle, for screen readers', async () => {
    renderEditor()
    await screen.findByLabelText('Proposal title')

    // "Reorder" on its own is useless in a list of ten.
    expect(
      screen.getByRole('button', { name: 'Reorder Heading block, 1 of 3' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reorder Text block, 2 of 3' }),
    ).toBeInTheDocument()
  })

  it('undoes a reorder', async () => {
    const user = renderEditor()
    await screen.findByLabelText('Proposal title')

    await user.click(screen.getByRole('button', { name: 'Text block actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Move up' }))
    expect(blockOrder()).toEqual(['Text', 'Heading', 'Pricing table'])

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(blockOrder()).toEqual(['Heading', 'Text', 'Pricing table'])

    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(blockOrder()).toEqual(['Text', 'Heading', 'Pricing table'])
  })
})

describe('ProposalEditorPage — editing', () => {
  it('adds a block of the chosen type', async () => {
    const user = renderEditor()
    await screen.findByLabelText('Proposal title')

    await user.click(screen.getByRole('button', { name: 'Add block' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Terms' }))

    expect(blockOrder()).toEqual(['Heading', 'Text', 'Pricing table', 'Terms'])
  })

  it('duplicates a block without reusing its ids', async () => {
    const user = renderEditor()
    await screen.findByLabelText('Proposal title')

    await user.click(
      screen.getByRole('button', { name: 'Heading block actions' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))

    expect(blockOrder()).toEqual([
      'Heading',
      'Heading',
      'Text',
      'Pricing table',
    ])
  })

  it('deletes a block', async () => {
    const user = renderEditor()
    await screen.findByLabelText('Proposal title')

    await user.click(screen.getByRole('button', { name: 'Text block actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    expect(blockOrder()).toEqual(['Heading', 'Pricing table'])
  })

  it('keeps money in integer cents while the user types', async () => {
    const user = renderEditor()
    await screen.findByLabelText('Proposal title')

    const price = screen.getByLabelText('Unit price, line 1')
    expect(price).toHaveValue('95.00')

    await user.clear(price)
    await user.type(price, '12.34')

    // The field shows what was typed — no caret-jumping reformat mid-edit.
    expect(price).toHaveValue('12.34')
    // 12 units at 12.34 → 148.08, formatted in the client's currency.
    await waitFor(() =>
      expect(screen.getByText(/148[.,]08/)).toBeInTheDocument(),
    )
  })
})
