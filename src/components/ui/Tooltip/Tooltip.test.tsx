import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('renders its trigger', () => {
    render(
      <Tooltip content="Delete client">
        <button>Delete</button>
      </Tooltip>,
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('shows the tooltip content when the trigger is focused', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Delete client">
        <button>Delete</button>
      </Tooltip>,
    )
    await user.tab()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Delete client',
    )
  })
})
