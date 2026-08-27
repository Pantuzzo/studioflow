import type { Project } from '@studioflow/contracts'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import styles from '@/styles/formDialog.module.css'
import { useDeleteProjectMutation } from './projectsApi'

export interface DeleteProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  project,
}: DeleteProjectDialogProps) {
  const [deleteProject] = useDeleteProjectMutation()
  const { toast } = useToast()

  async function confirm() {
    if (!project) return
    onOpenChange(false)
    try {
      await deleteProject(project.id).unwrap()
    } catch {
      toast({
        title: 'We couldn’t delete that project',
        description: 'It’s still on your list.',
        variant: 'error',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Delete project"
        description={
          project
            ? `${project.name} will be removed. This can’t be undone.`
            : undefined
        }
      >
        <div className={styles.actions}>
          <DialogClose asChild>
            <Button type="button" variant="soft">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            className={styles.destructive}
            onClick={() => void confirm()}
          >
            Delete project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
