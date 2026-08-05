import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../Button'
import { Tooltip } from './Tooltip'

const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  args: { content: 'Delete client' },
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: <Button variant="soft">Hover or focus me</Button> },
}

export const RightSide: Story = {
  args: {
    side: 'right',
    children: <Button variant="soft">Tooltip on the right</Button>,
  },
}
