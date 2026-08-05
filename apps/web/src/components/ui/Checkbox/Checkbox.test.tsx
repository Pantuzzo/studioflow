import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('has an accessible name from its label and toggles on click', async () => {
    render(<Checkbox label="Remember me" />)
    const box = screen.getByRole('checkbox', { name: 'Remember me' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(box)
    expect(box).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles with the keyboard (space)', async () => {
    const user = userEvent.setup()
    render(<Checkbox label="Subscribe" />)
    const box = screen.getByRole('checkbox', { name: 'Subscribe' })
    box.focus()
    await user.keyboard(' ')
    expect(box).toHaveAttribute('aria-checked', 'true')
  })

  it('does not toggle when disabled', async () => {
    render(<Checkbox label="Disabled" disabled />)
    const box = screen.getByRole('checkbox', { name: 'Disabled' })
    await userEvent.click(box)
    expect(box).toHaveAttribute('aria-checked', 'false')
  })
})
