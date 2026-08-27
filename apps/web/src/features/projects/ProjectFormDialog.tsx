import { zodResolver } from '@hookform/resolvers/zod'
import {
  PROJECT_STATUSES,
  createProjectSchema,
  type CreateProjectInput,
  type Project,
  type UpdateProjectInput,
} from '@studioflow/contracts'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useGetClientsQuery } from '@/features/clients/clientsApi'
import styles from '@/styles/formDialog.module.css'
import {
  useCreateProjectMutation,
  useUpdateProjectMutation,
} from './projectsApi'

const STATUS_LABELS: Record<(typeof PROJECT_STATUSES)[number], string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
}

const statusOptions = PROJECT_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}))

export interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The project being edited, or undefined when creating a new one. */
  project?: Project
}

/**
 * Create and edit, sharing the shape of the client dialog: submit closes it,
 * the write is optimistic, and only a failure speaks up.
 */
export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: ProjectFormDialogProps) {
  const editing = project !== undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? 'Edit project' : 'New project'}
        description={
          editing
            ? 'Update this project’s details.'
            : 'Projects belong to a client. Pick who this one is for.'
        }
      >
        <ProjectForm
          key={project?.id ?? 'new'}
          project={project}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ProjectForm({
  project,
  onDone,
}: {
  project?: Project
  onDone: () => void
}) {
  // The picker needs the client list; it is already cached whenever the user
  // has visited Clients, and fetched here when they have not.
  const { data: clients, isLoading: loadingClients } = useGetClientsQuery()
  const [createProject] = useCreateProjectMutation()
  const [updateProject] = useUpdateProjectMutation()
  const { toast } = useToast()

  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: project
      ? {
          name: project.name,
          clientId: project.clientId,
          status: project.status,
        }
      : // No client is pre-selected: guessing which client a project belongs to
        // is the kind of default that quietly files work under the wrong name.
        { name: '', clientId: '', status: 'active' },
  })

  const clientOptions = (clients ?? []).map((client) => ({
    value: client.id,
    label: client.name,
  }))

  const nameOfClient = (id: string) =>
    clients?.find((client) => client.id === id)?.name ?? ''

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

    if (!project) {
      void report(
        createProject({
          ...values,
          // Sent alongside so the optimistic row can render a name before the
          // server replies; the request body drops it again.
          clientName: nameOfClient(values.clientId),
        }).unwrap(),
        'We couldn’t create that project',
      )
      return
    }

    const patch: UpdateProjectInput = {}
    if (dirtyFields.name) patch.name = values.name
    if (dirtyFields.clientId) patch.clientId = values.clientId
    if (dirtyFields.status) patch.status = values.status
    if (Object.keys(patch).length === 0) return

    void report(
      updateProject({
        id: project.id,
        patch,
        clientName: patch.clientId ? nameOfClient(patch.clientId) : undefined,
      }).unwrap(),
      'We couldn’t save your changes',
    )
  })

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      <FormField control={control} name="name" label="Name" required>
        {(field) => <Input {...field} autoComplete="off" />}
      </FormField>

      <FormField control={control} name="clientId" label="Client" required>
        {(field) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            options={clientOptions}
            placeholder={
              loadingClients ? 'Loading clients…' : 'Choose a client'
            }
            disabled={loadingClients}
            name={field.name}
          />
        )}
      </FormField>

      <FormField control={control} name="status" label="Status" required>
        {(field) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            options={statusOptions}
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
        <Button type="submit">
          {project ? 'Save changes' : 'Create project'}
        </Button>
      </div>
    </form>
  )
}
