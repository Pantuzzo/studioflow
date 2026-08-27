import type { Client } from '@studioflow/contracts'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useDeleteClientMutation } from './clientsApi'
import styles from '@/styles/formDialog.module.css'

export interface DeleteClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client
}

/**
 * Deletion is the one write that cannot be undone by retyping, so it asks
 * first. Once confirmed it behaves like the others: the row leaves immediately
 * and comes back if the server refuses.
 */
export function DeleteClientDialog({
  open,
  onOpenChange,
  client,
}: DeleteClientDialogProps) {
  const [deleteClient] = useDeleteClientMutation()
  const { toast } = useToast()

  async function confirm() {
    if (!client) return
    onOpenChange(false)
    try {
      await deleteClient(client.id).unwrap()
    } catch {
      toast({
        title: 'We couldn’t delete that client',
        description: 'They’re still on your list.',
        variant: 'error',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Delete client"
        description={
          client
            ? `${client.name} will be removed from your clients. This can’t be undone.`
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
            Delete client
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
