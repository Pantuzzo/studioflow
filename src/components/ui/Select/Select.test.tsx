import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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

  // NOTE: opening the listbox and selecting an option exercises Radix's portal +
  // pointer/scroll APIs that happy-dom doesn't implement; that flow is verified
  // in the browser (Storybook).
})
