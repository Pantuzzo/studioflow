import { useState, type ReactNode } from 'react'
import type { Project } from '@studioflow/contracts'
import { Link } from 'react-router-dom'
import { isPlaceholderId } from '@/app/placeholderId'
import { Button } from '@/components/ui/Button'
import { useGetClientsQuery } from '@/features/clients/clientsApi'
import styles from '@/styles/listPage.module.css'
import { DeleteProjectDialog } from './DeleteProjectDialog'
import { ProjectFormDialog } from './ProjectFormDialog'
import { useGetProjectsQuery } from './projectsApi'

const STATUS_LABELS: Record<Project['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
}

export function ProjectsPage() {
  const { data: projects, isLoading, isError, refetch } = useGetProjectsQuery()
  // A project cannot exist without a client, so the page needs to know whether
  // there are any before it offers to create one.
  const { data: clients } = useGetClientsQuery()
  const hasClients = (clients?.length ?? 0) > 0

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Project | undefined>()
  const [deleting, setDeleting] = useState<Project | undefined>()

  let content: ReactNode
  if (isLoading) {
    content = (
      <p role="status" className={styles.state}>
        Loading projects…
      </p>
    )
  } else if (isError) {
    content = (
      <div role="alert" className={styles.state}>
        <p>We couldn’t load your projects.</p>
        <Button variant="soft" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  } else if (!projects || projects.length === 0) {
    content = (
      <div className={styles.state}>
        {hasClients ? (
          <>
            <p>No projects yet.</p>
            <Button variant="soft" size="sm" onClick={() => setCreating(true)}>
              Create your first project
            </Button>
          </>
        ) : (
          <>
            <p>No projects yet — and no clients to attach one to.</p>
            <Button variant="soft" size="sm" asChild>
              <Link to="/clients">Add a client first</Link>
            </Button>
          </>
        )}
      </div>
    )
  } else {
    content = (
      <table className={styles.table}>
        <caption className="sf-visually-hidden">List of projects</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Client</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sf-visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const pending = isPlaceholderId(project.id)
            return (
              <tr key={project.id} data-pending={pending || undefined}>
                <td>{project.name}</td>
                <td>{project.clientName}</td>
                <td>
                  <span className={styles.status} data-status={project.status}>
                    {STATUS_LABELS[project.status]}
                  </span>
                </td>
                <td className={styles.rowActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    aria-label={`Edit ${project.name}`}
                    onClick={() => setEditing(project)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    aria-label={`Delete ${project.name}`}
                    onClick={() => setDeleting(project)}
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
          <h1>Projects</h1>
          <p className={styles.subtitle}>The work you’re doing, per client.</p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!hasClients}>
          New project
        </Button>
      </header>

      {content}

      <ProjectFormDialog open={creating} onOpenChange={setCreating} />
      <ProjectFormDialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined)
        }}
        project={editing}
      />
      <DeleteProjectDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
        project={deleting}
      />
    </div>
  )
}
