import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from './ToastProvider'
import { useToast } from './toast-context'

function Demo() {
  const { toast } = useToast()
  return (
    <button
      onClick={() =>
        toast({
          title: 'Client created',
          description: 'Ava Thompson was added.',
          variant: 'success',
        })
      }
    >
      Create
    </button>
  )
}

describe('Toast', () => {
  it('shows a toast with its title and description when triggered', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Client created')).toBeInTheDocument()
    expect(screen.getByText('Ava Thompson was added.')).toBeInTheDocument()
  })

  it('throws a helpful error when useToast is used outside the provider', () => {
    function Orphan() {
      useToast()
      return null
    }
    expect(() => render(<Orphan />)).toThrow(/ToastProvider/)
  })
})
