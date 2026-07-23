import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeToggle', () => {
  it('renders three theme options in a labeled group', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('group', { name: /theme/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /system theme/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /light theme/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /dark theme/i }),
    ).toBeInTheDocument()
  })

  it('marks system as active by default', () => {
    render(<ThemeToggle />)
    expect(
      screen.getByRole('button', { name: /system theme/i }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('applies the chosen theme to <html> and marks it active', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button', { name: /dark theme/i }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByRole('button', { name: /dark theme/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
