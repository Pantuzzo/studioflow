import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput,
} from '@studioflow/contracts'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

/** Every read pulls the client's name, because every row displays it. */
const withClientName = {
  client: { select: { name: true } },
} satisfies Prisma.ProjectInclude

type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof withClientName }>

function toContract(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    // The Prisma enum's members are the contract's values, so there is nothing
    // to translate here — that is why they are lowercase in the schema.
    status: row.status,
    clientId: row.clientId,
    clientName: row.client.name,
    createdAt: row.createdAt.toISOString(),
  }
}

function isMissingRecord(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  )
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForOwner(ownerId: string): Promise<Project[]> {
    const rows = await this.prisma.project.findMany({
      where: { ownerId },
      include: withClientName,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toContract)
  }

  /**
   * The client id arrives from the browser, so it is checked against the caller
   * before it is trusted. Without this, anyone could hang a project off another
   * account's client — and the error would confirm that client exists, which is
   * why a stranger's id answers 404 rather than 403.
   */
  private async assertOwnsClient(
    ownerId: string,
    clientId: string,
  ): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, ownerId },
      select: { id: true },
    })
    if (!client) throw new NotFoundException('Client not found')
  }

  async createForOwner(
    ownerId: string,
    input: CreateProjectInput,
  ): Promise<Project> {
    await this.assertOwnsClient(ownerId, input.clientId)
    const row = await this.prisma.project.create({
      data: { ...input, ownerId },
      include: withClientName,
    })
    return toContract(row)
  }

  async updateForOwner(
    ownerId: string,
    id: string,
    patch: UpdateProjectInput,
  ): Promise<Project> {
    // Moving a project to a different client is a write of the same id from the
    // browser, so it gets the same check.
    if (patch.clientId) await this.assertOwnsClient(ownerId, patch.clientId)

    try {
      const row = await this.prisma.project.update({
        where: { id, ownerId },
        data: patch,
        include: withClientName,
      })
      return toContract(row)
    } catch (error) {
      if (isMissingRecord(error))
        throw new NotFoundException('Project not found')
      throw error
    }
  }

  async removeForOwner(ownerId: string, id: string): Promise<void> {
    try {
      await this.prisma.project.delete({ where: { id, ownerId } })
    } catch (error) {
      if (isMissingRecord(error))
        throw new NotFoundException('Project not found')
      throw error
    }
  }
}
