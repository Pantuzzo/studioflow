import { zodResolver } from '@hookform/resolvers/zod'
import {
  createProposalSchema,
  type CreateProposalInput,
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
import { useGetProjectsQuery } from '@/features/projects/projectsApi'
import styles from '@/styles/formDialog.module.css'
import { useCreateProposalMutation } from './proposalsApi'

/**
 * Radix refuses an empty string as an item value — it reserves it for "nothing
 * selected" — so "no project" travels as a sentinel and becomes null on the way
 * out.
 */
const NO_PROJECT = 'none'

export interface NewProposalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewProposalDialog({
  open,
  onOpenChange,
}: NewProposalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="New proposal"
        description="It starts empty — you'll build the document next."
      >
        <NewProposalForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function NewProposalForm({ onDone }: { onDone: () => void }) {
  const { data: clients } = useGetClientsQuery()
  const { data: projects } = useGetProjectsQuery()
  const [createProposal, { isLoading }] = useCreateProposalMutation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const { control, handleSubmit, watch } = useForm<CreateProposalInput>({
    resolver: zodResolver(createProposalSchema),
    defaultValues: { title: '', clientId: '', projectId: NO_PROJECT },
  })

  const clientId = watch('clientId')
  const projectOptions = [
    { value: NO_PROJECT, label: 'No project' },
    // Only this client's projects: offering the rest would invite a pairing the
    // API would reject anyway.
    ...(projects ?? [])
      .filter((project) => project.clientId === clientId)
      .map((project) => ({ value: project.id, label: project.name })),
  ]

  const onSubmit = handleSubmit(async (values) => {
    try {
      // Not optimistic: the next thing that happens is a navigation to this
      // proposal's own URL, and a placeholder id has nowhere to go.
      const created = await createProposal({
        ...values,
        projectId:
          values.projectId && values.projectId !== NO_PROJECT
            ? values.projectId
            : null,
      }).unwrap()
      onDone()
      void navigate(`/proposals/${created.id}`)
    } catch {
      toast({
        title: 'We couldn’t create that proposal',
        description: 'Nothing was saved. Try again in a moment.',
        variant: 'error',
      })
    }
  })

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      <FormField control={control} name="title" label="Title" required>
        {(field) => (
          <Input {...field} autoComplete="off" placeholder="Website relaunch" />
        )}
      </FormField>

      <FormField control={control} name="clientId" label="Client" required>
        {(field) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            options={(clients ?? []).map((client) => ({
              value: client.id,
              label: client.name,
            }))}
            placeholder="Choose a client"
            name={field.name}
          />
        )}
      </FormField>

      <FormField
        control={control}
        name="projectId"
        label="Project"
        hint="Optional — a proposal can come before the project does."
      >
        {(field) => (
          <Select
            value={field.value ?? NO_PROJECT}
            onValueChange={field.onChange}
            options={projectOptions}
            disabled={!clientId}
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
        <Button type="submit" disabled={isLoading} aria-busy={isLoading}>
          {isLoading ? 'Creating…' : 'Create proposal'}
        </Button>
      </div>
    </form>
  )
}
