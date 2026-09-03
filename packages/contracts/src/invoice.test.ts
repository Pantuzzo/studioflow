import { describe, expect, it } from 'vitest'
import {
  generateInvoiceSchema,
  invoiceLineTotalCents,
  invoiceSchema,
  invoiceSummarySchema,
  invoiceTotalCents,
  updateInvoiceSchema,
} from './index'

const LINE = {
  id: 'il_001',
  description: 'Website relaunch',
  projectId: 'pr_001',
  quantityHours: 12.5,
  unitPriceCents: 9500,
}

const INVOICE = {
  id: 'in_001',
  number: 1,
  status: 'draft',
  clientId: 'cl_001',
  clientName: 'Ava Thompson',
  clientCompany: 'Northwind Studio',
  currency: 'USD',
  lines: [LINE],
  issuedAt: '2026-08-17T09:00:00.000Z',
  dueAt: '2026-08-31T09:00:00.000Z',
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:00:00.000Z',
}

describe('invoiceSchema', () => {
  it('accepts a generated invoice', () => {
    expect(invoiceSchema.safeParse(INVOICE).success).toBe(true)
  })

  it('carries the client details as frozen text, not as a lookup', () => {
    // Renaming the client next month must not rewrite last month's invoice.
    const parsed = invoiceSchema.parse(INVOICE)
    expect(parsed.clientName).toBe('Ava Thompson')
    expect(parsed.clientCompany).toBe('Northwind Studio')
    expect(parsed.currency).toBe('USD')
  })

  it('refuses a number that is not a positive integer', () => {
    expect(invoiceSchema.safeParse({ ...INVOICE, number: 0 }).success).toBe(
      false,
    )
    expect(invoiceSchema.safeParse({ ...INVOICE, number: 1.5 }).success).toBe(
      false,
    )
  })

  it('refuses fractional money on a line', () => {
    expect(
      invoiceSchema.safeParse({
        ...INVOICE,
        lines: [{ ...LINE, unitPriceCents: 95.5 }],
      }).success,
    ).toBe(false)
  })

  it('allows a line whose project has since been deleted', () => {
    // The description is what prints; projectId is only a trace back.
    expect(
      invoiceSchema.safeParse({
        ...INVOICE,
        lines: [{ ...LINE, projectId: null }],
      }).success,
    ).toBe(true)
  })
})

describe('invoiceSummarySchema', () => {
  it('carries a line count instead of the lines', () => {
    const parsed = invoiceSummarySchema.parse({ ...INVOICE, lineCount: 1 })
    expect(parsed).not.toHaveProperty('lines')
    expect(parsed.lineCount).toBe(1)
  })
})

describe('invoice totals', () => {
  it('rounds each line to whole cents', () => {
    expect(invoiceLineTotalCents(LINE)).toBe(118_750)
    expect(
      Number.isInteger(
        invoiceLineTotalCents({ quantityHours: 1.005, unitPriceCents: 999 }),
      ),
    ).toBe(true)
  })

  it('rounds per line, then sums', () => {
    const lines = Array.from({ length: 3 }, (_, index) => ({
      ...LINE,
      id: `il_${index}`,
      quantityHours: 0.333,
      unitPriceCents: 100,
    }))
    // 33.3 rounds to 33 on each line: 99, not the 100 one multiplication gives.
    expect(invoiceTotalCents(lines)).toBe(99)
  })

  it('is zero for an invoice with no lines', () => {
    expect(invoiceTotalCents([])).toBe(0)
  })
})

describe('generateInvoiceSchema', () => {
  const period = {
    clientId: 'cl_001',
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-09-01T00:00:00.000Z',
  }

  it('takes a client and a period, and never any lines', () => {
    const parsed = generateInvoiceSchema.parse({
      ...period,
      lines: [{ description: 'Made up', quantityHours: 999 }],
    })
    // A browser does not get to decide what it is owed.
    expect(parsed).not.toHaveProperty('lines')
    // Absent rather than defaulted here; the server fills it in.
    expect(parsed.dueInDays).toBeUndefined()
  })

  it('refuses a period that ends before it starts', () => {
    const result = generateInvoiceSchema.safeParse({
      ...period,
      to: '2026-07-01T00:00:00.000Z',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'The end of the period has to come after its start',
    )
  })

  it('caps the payment window at a year', () => {
    expect(
      generateInvoiceSchema.safeParse({ ...period, dueInDays: 400 }).success,
    ).toBe(false)
  })
})

describe('updateInvoiceSchema', () => {
  it('accepts a status change', () => {
    expect(updateInvoiceSchema.safeParse({ status: 'paid' }).success).toBe(true)
  })

  it('will not let anyone edit the lines', () => {
    // Correcting an issued invoice is a credit note, not an edit.
    const parsed = updateInvoiceSchema.parse({
      status: 'sent',
      lines: [{ description: 'Silently added', quantityHours: 1 }],
    })
    expect(parsed).not.toHaveProperty('lines')
  })

  it('rejects an empty patch', () => {
    expect(updateInvoiceSchema.safeParse({}).success).toBe(false)
  })
})
