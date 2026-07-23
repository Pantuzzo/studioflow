import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders as a button and handles clicks', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders the given variant and size', () => {
    render(
      <Button variant="ghost" size="sm">
        X
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'X' })).toBeInTheDocument()
  })

  it('renders as a link when asChild is used', () => {
    render(
      <Button asChild>
        <a href="/x">Go</a>
      </Button>,
    )
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute(
      'href',
      '/x',
    )
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        No
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
