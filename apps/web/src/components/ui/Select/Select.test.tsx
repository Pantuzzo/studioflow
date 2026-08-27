import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

const options = [
  { value: 'usd', label: 'USD' },
  { value: 'eur', label: 'EUR' },
]

describe('Select', () => {
  it('renders a labeled combobox showing the placeholder', () => {
    render(
      <Select aria-label="Currency" options={options} placeholder="Pick one" />,
    )
    const trigger = screen.getByRole('combobox', { name: 'Currency' })
    expect(trigger).toHaveTextContent('Pick one')
  })

  it('can be disabled', () => {
    render(<Select aria-label="Currency" options={options} disabled />)
    expect(screen.getByRole('combobox', { name: 'Currency' })).toBeDisabled()
  })

  // These two used to be a comment explaining that happy-dom could not run
  // them. It can now — re-probed against the current versions rather than
  // trusted — so the flow is covered here instead of only in Storybook.
  it('opens on click and reports the option chosen', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Select
        aria-label="Currency"
        options={options}
        onValueChange={onValueChange}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    await user.click(await screen.findByRole('option', { name: 'EUR' }))

    expect(onValueChange).toHaveBeenCalledWith('eur')
    expect(
      screen.getByRole('combobox', { name: 'Currency' }),
    ).toHaveTextContent('EUR')
  })

  it('is fully operable from the keyboard', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Select
        aria-label="Currency"
        options={options}
        onValueChange={onValueChange}
      />,
    )

    screen.getByRole('combobox', { name: 'Currency' }).focus()
    await user.keyboard('{ArrowDown}')
    await screen.findByRole('option', { name: 'USD' })
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onValueChange).toHaveBeenCalledWith('eur')
  })
})
