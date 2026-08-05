import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from './Field'

describe('Field', () => {
  it('associates the label with the control', () => {
    render(
      <Field label="Email">
        <input />
      </Field>,
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('wires the hint into aria-describedby', () => {
    render(
      <Field label="Email" hint="We never share it">
        <input />
      </Field>,
    )
    const input = screen.getByLabelText('Email')
    const hint = screen.getByText('We never share it')
    expect(input.getAttribute('aria-describedby')).toContain(hint.id)
  })

  it('marks the control invalid and exposes the error as an alert', () => {
    render(
      <Field label="Email" error="Required">
        <input />
      </Field>,
    )
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Required')
    expect(input.getAttribute('aria-describedby')).toContain(error.id)
  })

  it('marks the control required', () => {
    render(
      <Field label="Email" required>
        <input />
      </Field>,
    )
    expect(screen.getByLabelText('Email')).toBeRequired()
  })
})
