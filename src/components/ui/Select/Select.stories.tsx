import type { Meta, StoryObj } from '@storybook/react-vite'
import { Select } from './Select'

const currencies = [
  { value: 'usd', label: 'USD — US Dollar' },
  { value: 'eur', label: 'EUR — Euro' },
  { value: 'gbp', label: 'GBP — British Pound' },
  { value: 'brl', label: 'BRL — Brazilian Real' },
]

const meta = {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
  args: {
    'aria-label': 'Currency',
    options: currencies,
    placeholder: 'Select a currency',
  },
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithValue: Story = { args: { defaultValue: 'eur' } }
export const Disabled: Story = { args: { disabled: true } }
