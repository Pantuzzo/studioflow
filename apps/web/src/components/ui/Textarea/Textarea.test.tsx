import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Textarea } from './Textarea'

describe('Textarea', () => {
  it('accepts multiline input', async () => {
    render(<Textarea aria-label="Notes" />)
    const el = screen.getByRole('textbox', { name: 'Notes' })
    await userEvent.type(el, 'line 1{enter}line 2')
    expect(el).toHaveValue('line 1\nline 2')
  })

  it('reflects the invalid state from aria-invalid', () => {
    render(<Textarea aria-label="Notes" aria-invalid />)
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })
})
