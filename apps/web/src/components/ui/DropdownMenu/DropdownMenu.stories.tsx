import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../Button'
import { DropdownMenu } from './DropdownMenu'

const meta = {
  title: 'UI/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  args: {
    trigger: <Button variant="soft">Block actions</Button>,
    items: [
      { label: 'Move up', onSelect: () => {} },
      { label: 'Move down', onSelect: () => {} },
      { label: 'Duplicate', onSelect: () => {} },
      { label: 'Delete', onSelect: () => {}, destructive: true },
    ],
  },
} satisfies Meta<typeof DropdownMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/**
 * The block menu at the top of a document: there is nowhere above it to move
 * to, so that action is disabled rather than hidden — the menu keeps the same
 * shape wherever it opens.
 */
export const WithDisabledActions: Story = {
  args: {
    items: [
      { label: 'Move up', onSelect: () => {}, disabled: true },
      { label: 'Move down', onSelect: () => {} },
      { label: 'Duplicate', onSelect: () => {} },
      { label: 'Delete', onSelect: () => {}, destructive: true },
    ],
  },
}
