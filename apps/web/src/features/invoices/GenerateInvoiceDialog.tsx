import { zodResolver } from '@hookform/resolvers/zod'
import {
  generateInvoiceSchema,
  type GenerateInvoiceInput,
} from '@studioflow/contracts'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useGetClientsQuery } from '@/features/clients/clientsApi'
import styles from '@/styles/formDialog.module.css'
import { useGenerateInvoiceMutation } from './invoicesApi'

/** The current calendar month, which is what people invoice by default. */
function thisMonth(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { from: from.toISOString(), to: to.toISOString() }
}

/** `<input type="date">` speaks YYYY-MM-DD; the contract speaks ISO. */
const toDateInput = (iso: string) => iso.slice(0, 10)
/**
 * Null for anything that is not a whole date. A date field emits partial values
 * while it is being filled in, and `new Date('2026-')` is an Invalid Date whose
 * `toISOString()` throws rather than returning nonsense.
 */
function fromDateInput(value: string): string | null {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export interface GenerateInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GenerateInvoiceDialog({
  open,
  onOpenChange,
}: GenerateInvoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Generate invoice"
        description="Unbilled time in the period becomes one line per project."
      >
        <GenerateInvoiceForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function GenerateInvoiceForm({ onDone }: { onDone: () => void }) {
  const { data: clients } = useGetClientsQuery()
  const [generate, { isLoading }] = useGenerateInvoiceMutation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const { control, handleSubmit, setError, formState } =
    useForm<GenerateInvoiceInput>({
      resolver: zodResolver(generateInvoiceSchema),
      defaultValues: { clientId: '', ...thisMonth(), dueInDays: 14 },
    })

  const onSubmit = handleSubmit(async (values) => {
    try {
      // Not optimistic: only the server knows what is owed, and the next step
      // is a navigation to the invoice it just numbered.
      const invoice = await generate(values).unwrap()
      onDone()
      void navigate(`/invoices/${invoice.id}`)
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 409) {
        // The commonest outcome by far, and not really an error: there was
        // simply nothing to bill.
        setError('root', {
          message: 'There is no unbilled time in that period.',
        })
        return
      }
      toast({
        title: 'We couldn’t generate that invoice',
        description: 'Nothing was saved. Try again in a moment.',
        variant: 'error',
      })
    }
  })

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      {formState.errors.root && (
        <p role="alert">{formState.errors.root.message}</p>
      )}

      <FormField control={control} name="clientId" label="Client" required>
        {(field) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            options={(clients ?? []).map((client) => ({
              value: client.id,
              label: `${client.company} (${client.currency})`,
            }))}
            placeholder="Choose a client"
            name={field.name}
          />
        )}
      </FormField>

      <FormField control={control} name="from" label="From" required>
        {(field) => (
          <Input
            type="date"
            value={toDateInput(field.value)}
            onChange={(event) => {
              const iso = fromDateInput(event.target.value)
              if (iso) field.onChange(iso)
            }}
          />
        )}
      </FormField>

      <FormField
        control={control}
        name="to"
        label="To"
        hint="Exclusive."
        required
      >
        {(field) => (
          <Input
            type="date"
            value={toDateInput(field.value)}
            onChange={(event) => {
              const iso = fromDateInput(event.target.value)
              if (iso) field.onChange(iso)
            }}
          />
        )}
      </FormField>

      <FormField
        control={control}
        name="dueInDays"
        label="Payment terms (days)"
      >
        {(field) => (
          <Input
            type="number"
            inputMode="numeric"
            value={String(field.value ?? 14)}
            onChange={(event) => field.onChange(Number(event.target.value))}
          />
        )}
      </FormField>

      <div className={styles.actions}>
        <DialogClose asChild>
          <Button type="button" variant="soft">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading} aria-busy={isLoading}>
          {isLoading ? 'Generating…' : 'Generate'}
        </Button>
      </div>
    </form>
  )
}
