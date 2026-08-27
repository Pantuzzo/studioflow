import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  Client,
  CreateClientInput,
  UpdateClientInput,
} from '@studioflow/contracts'
import { Prisma, type Client as ClientRow } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

/**
 * Map a database row onto the shared wire contract. Two things happen here that
 * matter: `createdAt` becomes an ISO string, and `ownerId` is dropped — the
 * client already knows who it is, and leaking internal ids buys nothing.
 */
function toContract(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Prisma's "no record matched the WHERE" — here, a row that isn't yours. */
function isMissingRecord(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  )
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scoped by owner at the query level rather than filtered afterwards, so a
   * missing check cannot leak another account's rows. The writes below follow
   * the same rule: `ownerId` is part of every WHERE, never a separate lookup
   * followed by an `if`.
   */
  async findAllForOwner(ownerId: string): Promise<Client[]> {
    const rows = await this.prisma.client.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toContract)
  }

  async createForOwner(
    ownerId: string,
    input: CreateClientInput,
  ): Promise<Client> {
    const row = await this.prisma.client.create({ data: { ...input, ownerId } })
    return toContract(row)
  }

  /**
   * Answers 404 rather than 403 for someone else's client: a 403 would confirm
   * that the id exists, which is exactly what an id-guessing probe is after.
   */
  async updateForOwner(
    ownerId: string,
    id: string,
    patch: UpdateClientInput,
  ): Promise<Client> {
    try {
      const row = await this.prisma.client.update({
        where: { id, ownerId },
        data: patch,
      })
      return toContract(row)
    } catch (error) {
      if (isMissingRecord(error))
        throw new NotFoundException('Client not found')
      throw error
    }
  }

  async removeForOwner(ownerId: string, id: string): Promise<void> {
    try {
      await this.prisma.client.delete({ where: { id, ownerId } })
    } catch (error) {
      if (isMissingRecord(error))
        throw new NotFoundException('Client not found')
      throw error
    }
  }
}
