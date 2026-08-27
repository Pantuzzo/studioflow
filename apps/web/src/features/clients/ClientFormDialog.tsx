import { zodResolver } from '@hookform/resolvers/zod'
import {
  CURRENCY_CODES,
  createClientSchema,
  type Client,
  type CreateClientInput,
  type CurrencyCode,
  type UpdateClientInput,
} from '@studioflow/contracts'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useCreateClientMutation, useUpdateClientMutation } from './clientsApi'
import styles from '@/styles/formDialog.module.css'

const currencyOptions = CURRENCY_CODES.map((code) => ({
  value: code,
  label: code,
}))

/**
 * The read contract accepts any ISO 4217 code the database happens to hold; the
 * form can only offer the ones the product bills in. Anything else falls back
 * rather than selecting an option that does not exist.
 */
function toCurrencyCode(value: string): CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value)
    ? (value as CurrencyCode)
    : 'USD'
}

export interface ClientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The client being edited, or undefined when creating a new one. */
  client?: Client
}

/**
 * One dialog for both create and edit — the fields are the same, and the only
 * real difference is what happens on submit.
 *
 * It closes the moment you submit, because the cache has already been updated
 * and the row is on screen: holding the dialog open behind a spinner would
 * throw away exactly the latency the optimistic update just bought. The price
 * is that a rejected save loses what was typed, so the failure toast says
 * plainly that the change was rolled back rather than leaving the list to
 * silently disagree with what the user last saw.
 */
export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: ClientFormDialogProps) {
  const editing = client !== undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? 'Edit client' : 'New client'}
        description={
          editing
            ? 'Update the details for this client.'
            : 'Add someone you work with. You can change any of this later.'
        }
      >
        {/* Radix unmounts the content on close, so the form state is fresh on
            every open; the key covers switching straight from one row to another. */}
        <ClientForm
          key={client?.id ?? 'new'}
          client={client}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ClientForm({
  client,
  onDone,
}: {
  client?: Client
  onDone: () => void
}) {
  const [createClient] = useCreateClientMutation()
  const [updateClient] = useUpdateClientMutation()
  const { toast } = useToast()

  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<CreateClientInput>({
    // The same schema the API validates against, so a body the server would
    // reject cannot leave this form in the first place.
    resolver: zodResolver(createClientSchema),
    defaultValues: client
      ? {
          name: client.name,
          company: client.company,
          email: client.email,
          currency: toCurrencyCode(client.currency),
        }
      : { name: '', company: '', email: '', currency: 'USD' },
  })

  /** Success needs no toast: the row on screen is the confirmation. */
  async function report(promise: Promise<unknown>, failure: string) {
    try {
      await promise
    } catch {
      toast({
        title: failure,
        description: 'Your change was rolled back.',
        variant: 'error',
      })
    }
  }

  const onSubmit = handleSubmit((values) => {
    onDone()

    if (!client) {
      void report(createClient(values).unwrap(), 'We couldn’t add that client')
      return
    }

    // PATCH means "what changed", so only dirty fields travel. An untouched
    // form is a no-op rather than a request the API would reject as empty.
    const patch: UpdateClientInput = {}
    if (dirtyFields.name) patch.name = values.name
    if (dirtyFields.company) patch.company = values.company
    if (dirtyFields.email) patch.email = values.email
    if (dirtyFields.currency) patch.currency = values.currency
    if (Object.keys(patch).length === 0) return

    void report(
      updateClient({ id: client.id, patch }).unwrap(),
      'We couldn’t save your changes',
    )
  })

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      <FormField control={control} name="name" label="Name" required>
        {(field) => <Input {...field} autoComplete="off" />}
      </FormField>

      <FormField control={control} name="company" label="Company" required>
        {(field) => <Input {...field} autoComplete="off" />}
      </FormField>

      <FormField control={control} name="email" label="Email" required>
        {(field) => <Input {...field} type="email" autoComplete="off" />}
      </FormField>

      <FormField
        control={control}
        name="currency"
        label="Currency"
        hint="What this client is billed in."
        required
      >
        {(field) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            options={currencyOptions}
            name={field.name}
          />
        )}
      </FormField>

      <div className={styles.actions}>
        <DialogClose asChild>
          <Button type="button" variant="soft">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit">{client ? 'Save changes' : 'Add client'}</Button>
      </div>
    </form>
  )
}
