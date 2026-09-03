import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  invoiceLinesSchema,
  type GenerateInvoiceInput,
  type Invoice,
  type InvoiceLine,
  type InvoiceSummary,
  type UpdateInvoiceInput,
} from '@studioflow/contracts'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type InvoiceRow = Prisma.InvoiceGetPayload<object>

/**
 * Hours are rounded to two decimals once, here, at generation. The rounded
 * figure is what gets frozen onto the line, so the hours printed and the money
 * charged are computed from the same number. Rounding later, at display time,
 * is how an invoice ends up showing 2.5 hours next to a total that says 2.51.
 */
function hoursFromSeconds(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100
}

function readLines(row: InvoiceRow): InvoiceLine[] {
  return invoiceLinesSchema.parse(row.lines)
}

function toContract(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    clientId: row.clientId,
    clientName: row.clientName,
    clientCompany: row.clientCompany,
    currency: row.currency,
    lines: readLines(row),
    issuedAt: row.issuedAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toSummary(row: InvoiceRow): InvoiceSummary {
  const { lines, ...rest } = toContract(row)
  return { ...rest, lineCount: lines.length }
}

function isMissingRecord(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  )
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForOwner(ownerId: string): Promise<InvoiceSummary[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { ownerId },
      orderBy: { number: 'desc' },
    })
    return rows.map(toSummary)
  }

  async findOneForOwner(ownerId: string, id: string): Promise<Invoice> {
    const row = await this.prisma.invoice.findFirst({ where: { id, ownerId } })
    if (!row) throw new NotFoundException('Invoice not found')
    return toContract(row)
  }

  /**
   * Turn tracked time into an invoice.
   *
   * The browser sends a client and a period and nothing else. Everything that
   * decides the amount — which entries qualify, how long they ran, what an hour
   * costs — is read here, because a client cannot be trusted to say what it
   * owes.
   */
  async generateForOwner(
    ownerId: string,
    input: GenerateInvoiceInput,
  ): Promise<Invoice> {
    const client = await this.prisma.client.findFirst({
      where: { id: input.clientId, ownerId },
    })
    if (!client) throw new NotFoundException('Client not found')

    const from = new Date(input.from)
    const to = new Date(input.to)

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        ownerId,
        // Already billed, so not billable again. This is the whole
        // double-billing guard, and it is a column rather than a convention.
        invoiceId: null,
        // A running timer is not billable: it has no end to measure to.
        endedAt: { not: null },
        startedAt: { gte: from, lt: to },
        project: { clientId: client.id },
      },
      include: { project: { select: { name: true, hourlyRateCents: true } } },
      orderBy: { startedAt: 'asc' },
    })

    if (entries.length === 0) {
      throw new ConflictException('No unbilled time in that period')
    }

    // One line per project, not per entry: an invoice is a bill, not a log.
    const byProject = new Map<
      string,
      { name: string; rateCents: number; seconds: number }
    >()
    for (const entry of entries) {
      const seconds = Math.max(
        0,
        Math.floor(
          ((entry.endedAt as Date).getTime() - entry.startedAt.getTime()) /
            1000,
        ),
      )
      const existing = byProject.get(entry.projectId)
      if (existing) {
        existing.seconds += seconds
      } else {
        byProject.set(entry.projectId, {
          name: entry.project.name,
          rateCents: entry.project.hourlyRateCents,
          seconds,
        })
      }
    }

    const lines: InvoiceLine[] = [...byProject.entries()].map(
      ([projectId, project]) => ({
        id: projectId,
        // Copied, not referenced: the project may be renamed or deleted later.
        description: project.name,
        projectId,
        quantityHours: hoursFromSeconds(project.seconds),
        unitPriceCents: project.rateCents,
      }),
    )

    const issuedAt = new Date()
    // A fortnight unless told otherwise.
    const dueInDays = input.dueInDays ?? 14
    const dueAt = new Date(issuedAt.getTime() + dueInDays * 24 * 60 * 60 * 1000)

    return this.prisma.$transaction(async (tx) => {
      // Drawn from a counter, not from a count of existing rows. Counting would
      // hand out a number twice under concurrency, and would hand out a deleted
      // invoice's number again — an invoice number is a permanent reference,
      // so burning one is correct and reusing it is not.
      const { invoiceSeq } = await tx.user.update({
        where: { id: ownerId },
        data: { invoiceSeq: { increment: 1 } },
        select: { invoiceSeq: true },
      })

      const invoice = await tx.invoice.create({
        data: {
          number: invoiceSeq,
          clientId: client.id,
          clientName: client.name,
          clientCompany: client.company,
          currency: client.currency,
          lines: lines as unknown as Prisma.InputJsonValue,
          issuedAt,
          dueAt,
          ownerId,
        },
      })

      await tx.timeEntry.updateMany({
        where: { id: { in: entries.map((entry) => entry.id) } },
        data: { invoiceId: invoice.id },
      })

      return toContract(invoice)
    })
  }

  async updateForOwner(
    ownerId: string,
    id: string,
    patch: UpdateInvoiceInput,
  ): Promise<Invoice> {
    try {
      const row = await this.prisma.invoice.update({
        where: { id, ownerId },
        data: {
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.dueAt ? { dueAt: new Date(patch.dueAt) } : {}),
        },
      })
      return toContract(row)
    } catch (error) {
      if (isMissingRecord(error))
        throw new NotFoundException('Invoice not found')
      throw error
    }
  }

  /** Deleting an invoice releases its hours rather than destroying them. */
  async removeForOwner(ownerId: string, id: string): Promise<void> {
    try {
      await this.prisma.invoice.delete({ where: { id, ownerId } })
    } catch (error) {
      if (isMissingRecord(error))
        throw new NotFoundException('Invoice not found')
      throw error
    }
  }
}
