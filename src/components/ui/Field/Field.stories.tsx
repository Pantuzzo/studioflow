import type { Meta, StoryObj } from '@storybook/react-vite'
import { Field } from './Field'
import { Input } from '../Input'

const meta = {
  title: 'UI/Field',
  component: Field,
  tags: ['autodocs'],
  args: { label: 'Email' },
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: <Input type="email" placeholder="you@studio.com" /> },
}

export const WithHint: Story = {
  args: {
    hint: 'We never share it.',
    children: <Input type="email" placeholder="you@studio.com" />,
  },
}

export const WithError: Story = {
  args: {
    error: 'Enter a valid email address.',
    children: <Input type="email" defaultValue="not-an-email" />,
  },
}

export const Required: Story = {
  args: { required: true, children: <Input type="email" /> },
}
