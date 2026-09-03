import {
  INVOICE_STATUSES,
  invoiceLineTotalCents,
  invoiceTotalCents,
  type InvoiceStatus,
} from '@studioflow/contracts'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import {
  formatDate,
  formatHours,
  formatMoney,
  formatRelativeDays,
} from '@/i18n/format'
import styles from './InvoiceDetailPage.module.css'
import { useGetInvoiceQuery, useUpdateInvoiceMutation } from './invoicesApi'

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  void: 'Void',
}

const statusOptions = INVOICE_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}))

/**
 * The invoice itself, and the thing that gets printed.
 *
 * There is no PDF library here on purpose. The browser already has a very good
 * PDF engine behind `window.print()`, it respects the reader's paper size and
 * margins, and it needs no server. What that costs is a print stylesheet that
 * has to be maintained as a real view rather than an afterthought, which is
 * what `InvoiceDetailPage.module.css` is.
 */
export function InvoiceDetailPage() {
  const { id = '' } = useParams()
  const {
    data: invoice,
    isLoading,
    isError,
    refetch,
  } = useGetInvoiceQuery(id, {
    skip: !id,
  })
  const [updateInvoice] = useUpdateInvoiceMutation()
  const { toast } = useToast()

  if (isLoading) {
    return (
      <p role="status" className={styles.state}>
        Loading invoice…
      </p>
    )
  }

  if (isError || !invoice) {
    return (
      <div role="alert" className={styles.state}>
        <p>We couldn’t load this invoice.</p>
        <Button variant="soft" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const total = invoiceTotalCents(invoice.lines)

  async function setStatus(status: string) {
    try {
      await updateInvoice({
        id,
        patch: { status: status as InvoiceStatus },
      }).unwrap()
    } catch {
      toast({
        title: 'We couldn’t update that invoice',
        variant: 'error',
      })
    }
  }

  return (
    <article className={styles.page}>
      {/* Everything in here is hidden when printing: it is app, not document. */}
      <div className={styles.toolbar}>
        <Link to="/invoices">All invoices</Link>
        <div className={styles.toolbarActions}>
          <Select
            aria-label="Status"
            options={statusOptions}
            value={invoice.status}
            onValueChange={(value) => void setStatus(value)}
          />
          <Button onClick={() => window.print()}>Print or save as PDF</Button>
        </div>
      </div>

      <div className={styles.document}>
        <header className={styles.documentHeader}>
          <div>
            <h1 className={styles.title}>Invoice #{invoice.number}</h1>
            <p className={styles.meta}>Issued {formatDate(invoice.issuedAt)}</p>
            <p className={styles.meta}>
              Due {formatDate(invoice.dueAt)} (
              {formatRelativeDays(invoice.dueAt)})
            </p>
          </div>
          <div className={styles.billTo}>
            <p className={styles.billToLabel}>Billed to</p>
            {/* Frozen at generation: renaming the client cannot rewrite this. */}
            <p className={styles.billToName}>{invoice.clientCompany}</p>
            <p className={styles.meta}>{invoice.clientName}</p>
          </div>
        </header>

        <table className={styles.lines}>
          <caption className="sf-visually-hidden">Invoice lines</caption>
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col">Hours</th>
              <th scope="col">Rate</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                {/* Plural-aware: "1 hour" but "1.5 hours". */}
                <td>{formatHours(line.quantityHours)}</td>
                <td>{formatMoney(line.unitPriceCents, invoice.currency)}</td>
                <td>
                  {formatMoney(invoiceLineTotalCents(line), invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>
                Total
              </th>
              <td className={styles.total}>
                {formatMoney(total, invoice.currency)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className={styles.terms}>
          Payment due {formatDate(invoice.dueAt)}. Amounts are in{' '}
          {invoice.currency}.
        </p>
      </div>
    </article>
  )
}
