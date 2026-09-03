import { z } from 'zod'

/**
 * An invoice.
 *
 * The important property of this contract is that an issued invoice is a
 * *snapshot*, not a view. Its lines, its currency and the names printed on it
 * are frozen at the moment it is generated, so renaming a project or moving a
 * client to a different currency next month cannot silently rewrite what was
 * billed last month. That is the same reasoning as ADR 0007, applied to a
 * document with legal weight rather than editorial weight.
 */

/**
 * Where an invoice is.
 *
 * `processing` exists because of a fact about Stripe that is easy to miss:
 * `checkout.session.completed` fires when the customer finishes the form, not
 * when the money arrives. For a card those are the same instant. For a bank
 * debit they are days apart, and treating "completed" as "paid" marks unpaid
 * invoices paid. So there is a state for money that is on its way.
 */
export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'processing',
  'paid',
  'void',
] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

/**
 * The statuses a person is allowed to set.
 *
 * `processing` and `paid` are absent on purpose: they are claims about money,
 * and only a signed webhook from Stripe may make them. A browser that could
 * mark an invoice paid would make the whole payment integration decorative.
 */
export const MANUAL_INVOICE_STATUSES = ['draft', 'sent', 'void'] as const
export type ManualInvoiceStatus = (typeof MANUAL_INVOICE_STATUSES)[number]

/**
 * One billable line. Quantities are fractional because hours are; money is
 * integer minor units because money always is.
 */
export const invoiceLineSchema = z.object({
  id: z.string().min(1),
  /** Frozen at generation: the project may be renamed or deleted later. */
  description: z.string().max(200),
  /** Kept for tracing back, but never trusted for display. */
  projectId: z.string().nullable(),
  quantityHours: z.number().nonnegative().max(100_000),
  unitPriceCents: z.number().int().nonnegative().max(1_000_000_000),
})
export type InvoiceLine = z.infer<typeof invoiceLineSchema>

export const invoiceLinesSchema = z.array(invoiceLineSchema).max(200)

export const invoiceSchema = z.object({
  id: z.string(),
  /** Sequential per account, and never reused. */
  number: z.number().int().positive(),
  status: z.enum(INVOICE_STATUSES),
  clientId: z.string(),
  /** Frozen, like everything else printed on the invoice. */
  clientName: z.string(),
  clientCompany: z.string(),
  /**
   * The currency this invoice is in. Snapshot from the client at generation:
   * an issued invoice does not change currency because the client did.
   */
  currency: z.string().length(3),
  lines: invoiceLinesSchema,
  issuedAt: z.iso.datetime(),
  dueAt: z.iso.datetime(),
  /** Set by the webhook that confirmed the money, and by nothing else. */
  paidAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export type Invoice = z.infer<typeof invoiceSchema>

/** The index carries totals but not lines, as the proposal index carries counts. */
export const invoiceSummarySchema = invoiceSchema
  .omit({ lines: true })
  .extend({ lineCount: z.number().int().nonnegative() })
export type InvoiceSummary = z.infer<typeof invoiceSummarySchema>

/**
 * Rounded per line before summing, the way an invoice is read.
 *
 * Named for its domain rather than shortened: the proposal editor has its own
 * `lineTotalCents` over a different field name, and two functions with one name
 * is how the wrong one gets imported.
 */
export function invoiceLineTotalCents(
  line: Pick<InvoiceLine, 'quantityHours' | 'unitPriceCents'>,
): number {
  return Math.round(line.quantityHours * line.unitPriceCents)
}

export function invoiceTotalCents(lines: readonly InvoiceLine[]): number {
  return lines.reduce((total, line) => total + invoiceLineTotalCents(line), 0)
}

/**
 * Generate an invoice from tracked time.
 *
 * No lines are sent: the server collects the client's unbilled entries in the
 * period and prices them. A browser cannot decide what it is owed.
 */
export const generateInvoiceSchema = z
  .object({
    clientId: z.string().min(1, 'Choose a client'),
    /** Inclusive start, exclusive end, both ISO. */
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    /**
     * Days from issue to due. Optional rather than defaulted, for the third
     * time in this codebase and the same reason: `.default()` makes a schema's
     * input type differ from its output type, and zodResolver types a form
     * from both. The server supplies the fortnight when it is absent.
     */
    dueInDays: z.number().int().min(0).max(365).optional(),
  })
  .refine((v) => new Date(v.to) > new Date(v.from), {
    message: 'The end of the period has to come after its start',
    path: ['to'],
  })
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>

/**
 * What may still be changed after generation.
 *
 * Lines are absent on purpose: correcting an issued invoice is a credit note,
 * not an edit, and pretending otherwise is how billing records stop matching
 * what was actually sent. A draft can be deleted and regenerated instead.
 */
export const updateInvoiceSchema = z
  .object({
    status: z.enum(MANUAL_INVOICE_STATUSES),
    dueAt: z.iso.datetime(),
  })
  .partial()
  .refine((values) => Object.keys(values).length > 0, {
    message: 'Provide at least one field to update',
  })
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>

/**
 * Where to send the payer.
 *
 * A hosted Checkout page rather than card fields in this app: no card data
 * touches this codebase, which is the difference between an integration that
 * needs a PCI conversation and one that does not.
 */
export const checkoutSessionSchema = z.object({
  url: z.url(),
})
export type CheckoutSession = z.infer<typeof checkoutSessionSchema>
