import { Injectable, NotFoundException } from '@nestjs/common'
import {
  proposalDocumentSchema,
  type CreateProposalInput,
  type Proposal,
  type ProposalSummary,
  type UpdateProposalInput,
} from '@studioflow/contracts'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

/** Both shapes display the client and the project, so both join for them. */
const withRelations = {
  client: { select: { name: true, currency: true } },
  project: { select: { name: true } },
} satisfies Prisma.ProposalInclude

type ProposalRow = Prisma.ProposalGetPayload<{ include: typeof withRelations }>

/**
 * The column is jsonb, so its contents are only as good as what wrote them.
 * Every write goes through the same schema, which makes a stored document that
 * fails to parse a genuine bug — surfaced rather than quietly replaced with an
 * empty one, which would destroy the very thing the user came to edit.
 */
function readDocument(row: ProposalRow) {
  return proposalDocumentSchema.parse(row.blocks)
}

function toSummary(row: ProposalRow): ProposalSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    clientId: row.clientId,
    clientName: row.client.name,
    clientCurrency: row.client.currency,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    blockCount: readDocument(row).length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toContract(row: ProposalRow): Proposal {
  const { blockCount: _blockCount, ...summary } = toSummary(row)
  return { ...summary, blocks: readDocument(row) }
}

function isMissingRecord(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  )
}

@Injectable()
export class ProposalsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The index carries no documents — see `proposalSummarySchema`. */
  async findAllForOwner(ownerId: string): Promise<ProposalSummary[]> {
    const rows = await this.prisma.proposal.findMany({
      where: { ownerId },
      include: withRelations,
      orderBy: { updatedAt: 'desc' },
    })
    return rows.map(toSummary)
  }

  async findOneForOwner(ownerId: string, id: string): Promise<Proposal> {
    const row = await this.prisma.proposal.findFirst({
      where: { id, ownerId },
      include: withRelations,
    })
    if (!row) throw new NotFoundException('Proposal not found')
    return toContract(row)
  }

  /**
   * Both foreign keys arrive from the browser, so both are checked against the
   * caller before they are trusted — and a stranger's id answers 404, which
   * declines to confirm that it exists.
   */
  private async assertOwns(
    ownerId: string,
    ids: { clientId?: string; projectId?: string | null },
  ): Promise<void> {
    if (ids.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: ids.clientId, ownerId },
        select: { id: true },
      })
      if (!client) throw new NotFoundException('Client not found')
    }
    if (ids.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: ids.projectId, ownerId },
        select: { id: true },
      })
      if (!project) throw new NotFoundException('Project not found')
    }
  }

  async createForOwner(
    ownerId: string,
    input: CreateProposalInput,
  ): Promise<Proposal> {
    await this.assertOwns(ownerId, input)
    const row = await this.prisma.proposal.create({
      data: {
        title: input.title,
        clientId: input.clientId,
        projectId: input.projectId ?? null,
        ownerId,
        // A new proposal is an empty document; blocks arrive through autosave.
        blocks: [],
      },
      include: withRelations,
    })
    return toContract(row)
  }

  async updateForOwner(
    ownerId: string,
    id: string,
    patch: UpdateProposalInput,
  ): Promise<Proposal> {
    await this.assertOwns(ownerId, patch)

    const { blocks, ...rest } = patch
    try {
      const row = await this.prisma.proposal.update({
        where: { id, ownerId },
        data: {
          ...rest,
          // Already validated by the pipe against the same schema the editor
          // uses; the cast is only Prisma's Json input type.
          ...(blocks ? { blocks: blocks as Prisma.InputJsonValue } : {}),
        },
        include: withRelations,
      })
      return toContract(row)
    } catch (error) {
      if (isMissingRecord(error))
        throw new NotFoundException('Proposal not found')
      throw error
    }
  }

  async removeForOwner(ownerId: string, id: string): Promise<void> {
    try {
      await this.prisma.proposal.delete({ where: { id, ownerId } })
    } catch (error) {
      if (isMissingRecord(error))
        throw new NotFoundException('Proposal not found')
      throw error
    }
  }
}
