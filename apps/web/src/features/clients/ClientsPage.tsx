import { useState, type ReactNode } from 'react'
import type { Client } from '@studioflow/contracts'
import { isPlaceholderId } from '@/app/placeholderId'
import { Button } from '@/components/ui/Button'
import { ClientFormDialog } from './ClientFormDialog'
import { DeleteClientDialog } from './DeleteClientDialog'
import styles from '@/styles/listPage.module.css'
import { useGetClientsQuery } from './clientsApi'

export function ClientsPage() {
  const { data: clients, isLoading, isError, refetch } = useGetClientsQuery()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Client | undefined>()
  const [deleting, setDeleting] = useState<Client | undefined>()

  let content: ReactNode
  if (isLoading) {
    content = (
      <p role="status" className={styles.state}>
        Loading clients…
      </p>
    )
  } else if (isError) {
    content = (
      <div role="alert" className={styles.state}>
        <p>We couldn’t load your clients.</p>
        <Button variant="soft" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  } else if (!clients || clients.length === 0) {
    content = (
      <div className={styles.state}>
        <p>No clients yet.</p>
        <Button variant="soft" size="sm" onClick={() => setCreating(true)}>
          Add your first client
        </Button>
      </div>
    )
  } else {
    content = (
      <table className={styles.table}>
        <caption className="sf-visually-hidden">List of clients</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Company</th>
            <th scope="col">Email</th>
            <th scope="col">Currency</th>
            <th scope="col">
              <span className="sf-visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => {
            // A row the server has not acknowledged yet: visible, but not yet
            // something you can edit or delete, because it has no real id.
            const pending = isPlaceholderId(client.id)
            return (
              <tr key={client.id} data-pending={pending || undefined}>
                <td>{client.name}</td>
                <td>{client.company}</td>
                <td>
                  <a href={`mailto:${client.email}`}>{client.email}</a>
                </td>
                <td>{client.currency}</td>
                <td className={styles.rowActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    aria-label={`Edit ${client.name}`}
                    onClick={() => setEditing(client)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    aria-label={`Delete ${client.name}`}
                    onClick={() => setDeleting(client)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Clients</h1>
          <p className={styles.subtitle}>People and companies you work with.</p>
        </div>
        <Button onClick={() => setCreating(true)}>New client</Button>
      </header>

      {content}

      <ClientFormDialog open={creating} onOpenChange={setCreating} />
      <ClientFormDialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined)
        }}
        client={editing}
      />
      <DeleteClientDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
        client={deleting}
      />
    </div>
  )
}
