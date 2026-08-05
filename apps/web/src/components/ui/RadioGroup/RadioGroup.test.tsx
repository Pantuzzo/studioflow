import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RadioGroup } from './RadioGroup'

const options = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

describe('RadioGroup', () => {
  it('exposes a labeled radiogroup with the options', () => {
    render(<RadioGroup label="Billing" options={options} />)
    expect(
      screen.getByRole('radiogroup', { name: 'Billing' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Monthly' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Yearly' })).toBeInTheDocument()
  })

  it('selects an option on click', async () => {
    render(<RadioGroup label="Billing" options={options} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Yearly' }))
    expect(screen.getByRole('radio', { name: 'Yearly' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('disables a specific option without affecting the others', () => {
    render(
      <RadioGroup
        label="Billing"
        options={[
          ...options,
          { value: 'lifetime', label: 'Lifetime', disabled: true },
        ]}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Lifetime' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Monthly' })).toBeEnabled()
  })

  // NOTE: arrow-key roving selection is provided by Radix's RovingFocusGroup and
  // relies on real focus/keyboard semantics that happy-dom doesn't emulate, so it
  // is verified in the browser (Storybook) rather than asserted here.
})
