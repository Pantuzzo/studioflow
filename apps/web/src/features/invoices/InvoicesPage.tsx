import { useState, type ReactNode } from 'react'
import type { InvoiceSummary } from '@studioflow/contracts'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useGetClientsQuery } from '@/features/clients/clientsApi'
import { formatCount, formatDate } from '@/i18n/format'
import styles from '@/styles/listPage.module.css'
import { GenerateInvoiceDialog } from './GenerateInvoiceDialog'
import { useDeleteInvoiceMutation, useGetInvoicesQuery } from './invoicesApi'

const STATUS_LABELS: Record<InvoiceSummary['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  void: 'Void',
}

export function InvoicesPage() {
  const { data: invoices, isLoading, isError, refetch } = useGetInvoicesQuery()
  const { data: clients } = useGetClientsQuery()
  const hasClients = (clients?.length ?? 0) > 0

  const [generating, setGenerating] = useState(false)
  const [deleteInvoice] = useDeleteInvoiceMutation()
  const { toast } = useToast()

  async function remove(invoice: InvoiceSummary) {
    try {
      await deleteInvoice(invoice.id).unwrap()
      toast({
        title: `Invoice ${invoice.number} deleted`,
        // Worth saying: the hours are not gone, they are billable again.
        description: 'Its hours are available to invoice again.',
      })
    } catch {
      toast({
        title: 'We couldn’t delete that invoice',
        description: 'It’s still on your list.',
        variant: 'error',
      })
    }
  }

  let content: ReactNode
  if (isLoading) {
    content = (
      <p role="status" className={styles.state}>
        Loading invoices…
      </p>
    )
  } else if (isError) {
    content = (
      <div role="alert" className={styles.state}>
        <p>We couldn’t load your invoices.</p>
        <Button variant="soft" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  } else if (!invoices || invoices.length === 0) {
    content = (
      <div className={styles.state}>
        {hasClients ? (
          <>
            <p>No invoices yet. They are generated from tracked time.</p>
            <Button
              variant="soft"
              size="sm"
              onClick={() => setGenerating(true)}
            >
              Generate your first invoice
            </Button>
          </>
        ) : (
          <>
            <p>No invoices yet — and nobody to bill.</p>
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
        <caption className="sf-visually-hidden">List of invoices</caption>
        <thead>
          <tr>
            <th scope="col">Number</th>
            <th scope="col">Client</th>
            <th scope="col">Issued</th>
            <th scope="col">Due</th>
            <th scope="col">Status</th>
            <th scope="col">Lines</th>
            <th scope="col">
              <span className="sf-visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>
                <Link to={`/invoices/${invoice.id}`}>#{invoice.number}</Link>
              </td>
              <td>{invoice.clientCompany}</td>
              <td>{formatDate(invoice.issuedAt)}</td>
              <td>{formatDate(invoice.dueAt)}</td>
              <td>
                <span className={styles.status} data-status={invoice.status}>
                  {STATUS_LABELS[invoice.status]}
                </span>
              </td>
              {/*
                The index has no lines, so the total is not derivable here. The
                line count is what it can honestly show.
              */}
              <td>
                {formatCount(invoice.lineCount, {
                  one: 'line',
                  other: 'lines',
                })}
              </td>
              <td className={styles.rowActions}>
                <Button variant="ghost" size="sm" asChild>
                  <Link
                    to={`/invoices/${invoice.id}`}
                    aria-label={`Open invoice ${invoice.number}`}
                  >
                    Open
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete invoice ${invoice.number}`}
                  onClick={() => void remove(invoice)}
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
          <h1>Invoices</h1>
          <p className={styles.subtitle}>
            Generated from the hours you tracked.
          </p>
        </div>
        <Button onClick={() => setGenerating(true)} disabled={!hasClients}>
          Generate invoice
        </Button>
      </header>

      {content}

      <GenerateInvoiceDialog open={generating} onOpenChange={setGenerating} />
    </div>
  )
}
