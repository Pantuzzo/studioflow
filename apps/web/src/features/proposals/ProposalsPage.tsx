import { useState, type ReactNode } from 'react'
import type { ProposalSummary } from '@studioflow/contracts'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useGetClientsQuery } from '@/features/clients/clientsApi'
import styles from '@/styles/listPage.module.css'
import { NewProposalDialog } from './NewProposalDialog'
import { useDeleteProposalMutation, useGetProposalsQuery } from './proposalsApi'

function relativeDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(iso))
}

export function ProposalsPage() {
  const {
    data: proposals,
    isLoading,
    isError,
    refetch,
  } = useGetProposalsQuery()
  const { data: clients } = useGetClientsQuery()
  const hasClients = (clients?.length ?? 0) > 0

  const [creating, setCreating] = useState(false)
  const [deleteProposal] = useDeleteProposalMutation()
  const { toast } = useToast()

  async function remove(proposal: ProposalSummary) {
    try {
      await deleteProposal(proposal.id).unwrap()
    } catch {
      toast({
        title: 'We couldn’t delete that proposal',
        description: 'It’s still on your list.',
        variant: 'error',
      })
    }
  }

  let content: ReactNode
  if (isLoading) {
    content = (
      <p role="status" className={styles.state}>
        Loading proposals…
      </p>
    )
  } else if (isError) {
    content = (
      <div role="alert" className={styles.state}>
        <p>We couldn’t load your proposals.</p>
        <Button variant="soft" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  } else if (!proposals || proposals.length === 0) {
    content = (
      <div className={styles.state}>
        {hasClients ? (
          <>
            <p>No proposals yet.</p>
            <Button variant="soft" size="sm" onClick={() => setCreating(true)}>
              Write your first proposal
            </Button>
          </>
        ) : (
          <>
            <p>No proposals yet — and no clients to address one to.</p>
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
        <caption className="sf-visually-hidden">List of proposals</caption>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Client</th>
            <th scope="col">Project</th>
            <th scope="col">Blocks</th>
            <th scope="col">Updated</th>
            <th scope="col">
              <span className="sf-visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((proposal) => (
            <tr key={proposal.id}>
              <td>
                <Link to={`/proposals/${proposal.id}`}>{proposal.title}</Link>
              </td>
              <td>{proposal.clientName}</td>
              <td>{proposal.projectName ?? '—'}</td>
              {/* The index carries a count, never the documents themselves. */}
              <td>{proposal.blockCount}</td>
              <td>{relativeDate(proposal.updatedAt)}</td>
              <td className={styles.rowActions}>
                <Button variant="ghost" size="sm" asChild>
                  <Link
                    to={`/proposals/${proposal.id}`}
                    aria-label={`Edit ${proposal.title}`}
                  >
                    Edit
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${proposal.title}`}
                  onClick={() => void remove(proposal)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Proposals</h1>
          <p className={styles.subtitle}>
            The documents you send before the work starts.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!hasClients}>
          New proposal
        </Button>
      </header>

      {content}

      <NewProposalDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
