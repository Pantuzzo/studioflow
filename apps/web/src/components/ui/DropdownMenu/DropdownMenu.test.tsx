import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../Button'
import { DropdownMenu } from './DropdownMenu'

function setup(onMoveUp = vi.fn(), onDelete = vi.fn()) {
  return {
    onMoveUp,
    onDelete,
    ...render(
      <DropdownMenu
        trigger={<Button aria-label="Heading block actions">⋯</Button>}
        items={[
          { label: 'Move up', onSelect: onMoveUp },
          { label: 'Move down', onSelect: vi.fn(), disabled: true },
          { label: 'Delete', onSelect: onDelete, destructive: true },
        ]}
      />,
    ),
  }
}

describe('DropdownMenu', () => {
  it('opens from the trigger and exposes its items as a menu', async () => {
    const user = userEvent.setup()
    setup()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Heading block actions' }),
    )

    expect(await screen.findByRole('menu')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  })

  it('runs the selected action', async () => {
    const user = userEvent.setup()
    const { onMoveUp } = setup()

    await user.click(
      screen.getByRole('button', { name: 'Heading block actions' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Move up' }))

    expect(onMoveUp).toHaveBeenCalledTimes(1)
  })

  it('is operable from the keyboard alone', async () => {
    const user = userEvent.setup()
    const { onMoveUp } = setup()

    screen.getByRole('button', { name: 'Heading block actions' }).focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('menu')
    // First item is focused on open, so Enter takes it.
    await user.keyboard('{Enter}')

    expect(onMoveUp).toHaveBeenCalledTimes(1)
  })

  it('marks a disabled item and does not fire it', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <DropdownMenu
        trigger={<Button aria-label="Actions">⋯</Button>}
        items={[{ label: 'Move down', onSelect, disabled: true }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Actions' }))
    const item = await screen.findByRole('menuitem', { name: 'Move down' })
    expect(item).toHaveAttribute('data-disabled')

    await user.click(item)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('returns focus to the trigger when dismissed', async () => {
    const user = userEvent.setup()
    setup()
    const trigger = screen.getByRole('button', {
      name: 'Heading block actions',
    })

    await user.click(trigger)
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')

    // The block menu is the keyboard route to reordering, so losing focus here
    // would drop the user at the top of the document after every action.
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
