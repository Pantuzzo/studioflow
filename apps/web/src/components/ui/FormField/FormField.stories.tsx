import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../Button'
import { Input } from '../Input'
import { Select } from '../Select'
import { Textarea } from '../Textarea'
import { FormField } from './FormField'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  currency: z.string().min(1, 'Pick a currency'),
  notes: z.string().max(280, 'Keep notes under 280 characters').optional(),
})
type Values = z.infer<typeof schema>

const currencies = [
  { value: 'usd', label: 'USD — US Dollar' },
  { value: 'eur', label: 'EUR — Euro' },
  { value: 'gbp', label: 'GBP — British Pound' },
  { value: 'brl', label: 'BRL — Brazilian Real' },
]

function NewClientForm() {
  const [submitted, setSubmitted] = useState<Values | null>(null)
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', currency: '', notes: '' },
  })

  return (
    <form
      onSubmit={handleSubmit((values) => setSubmitted(values))}
      noValidate
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sf-space-4)',
        maxWidth: 420,
      }}
    >
      <FormField control={control} name="name" label="Name" required>
        {(field) => <Input {...field} placeholder="Ada Lovelace" />}
      </FormField>

      <FormField control={control} name="email" label="Email" required>
        {(field) => (
          <Input {...field} type="email" placeholder="ada@studio.com" />
        )}
      </FormField>

      <FormField control={control} name="currency" label="Currency" required>
        {(field) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            options={currencies}
            placeholder="Select a currency"
          />
        )}
      </FormField>

      <FormField
        control={control}
        name="notes"
        label="Notes"
        hint="Optional — up to 280 characters"
      >
        {(field) => (
          <Textarea {...field} placeholder="Anything we should know?" />
        )}
      </FormField>

      <Button type="submit">Create client</Button>

      {submitted && (
        <pre
          style={{
            padding: 'var(--sf-space-3)',
            background: 'var(--sf-surface-subtle)',
            borderRadius: 'var(--sf-radius-sm)',
            fontSize: 'var(--sf-text-sm)',
            overflow: 'auto',
          }}
        >
          {JSON.stringify(submitted, null, 2)}
        </pre>
      )}
    </form>
  )
}

const meta = {
  title: 'Forms/New client',
  component: NewClientForm,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof NewClientForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
