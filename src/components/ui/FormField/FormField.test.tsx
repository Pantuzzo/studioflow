import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../Button'
import { Input } from '../Input'
import { FormField } from './FormField'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
})
type Values = z.infer<typeof schema>

function TestForm({ onValid }: { onValid: (values: Values) => void }) {
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  })
  return (
    <form onSubmit={handleSubmit(onValid)} noValidate>
      <FormField control={control} name="name" label="Name">
        {(field) => <Input {...field} />}
      </FormField>
      <FormField control={control} name="email" label="Email">
        {(field) => <Input {...field} type="email" />}
      </FormField>
      <Button type="submit">Save</Button>
    </form>
  )
}

describe('FormField + react-hook-form + Zod', () => {
  it('shows the Zod errors on invalid submit and does not call onValid', async () => {
    const onValid = vi.fn()
    const user = userEvent.setup()
    render(<TestForm onValid={onValid} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
    // The error is wired to the input for assistive tech.
    expect(screen.getByLabelText('Name')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(onValid).not.toHaveBeenCalled()
  })

  it('submits typed, validated values when the form is valid', async () => {
    const onValid = vi.fn()
    const user = userEvent.setup()
    render(<TestForm onValid={onValid} />)

    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace')
    await user.type(screen.getByLabelText('Email'), 'ada@studio.com')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1))
    expect(onValid).toHaveBeenCalledWith(
      { name: 'Ada Lovelace', email: 'ada@studio.com' },
      expect.anything(),
    )
  })
})
