import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('accepts typing and forwards the ref', async () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input ref={ref} aria-label="Name" />)
    const el = screen.getByRole('textbox', { name: 'Name' })
    await userEvent.type(el, 'Ada')
    expect(el).toHaveValue('Ada')
    expect(ref.current).toBe(el)
  })

  it('reflects the invalid state from aria-invalid', () => {
    render(<Input aria-label="Name" aria-invalid />)
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })
})
