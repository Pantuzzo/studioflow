import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../Button'
import { ToastProvider } from './ToastProvider'
import { useToast } from './toast-context'

function ToastDemo() {
  const { toast } = useToast()
  return (
    <div style={{ display: 'flex', gap: 'var(--sf-space-2)' }}>
      <Button
        variant="soft"
        onClick={() =>
          toast({ title: 'Saved', description: 'Your changes were saved.' })
        }
      >
        Default
      </Button>
      <Button
        variant="soft"
        onClick={() =>
          toast({
            title: 'Client created',
            description: 'Ava Thompson was added.',
            variant: 'success',
          })
        }
      >
        Success
      </Button>
      <Button
        variant="soft"
        onClick={() =>
          toast({
            title: 'Something went wrong',
            description: 'Please try again.',
            variant: 'error',
          })
        }
      >
        Error
      </Button>
    </div>
  )
}

const meta = {
  title: 'Feedback/Toast',
  component: ToastDemo,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof ToastDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
