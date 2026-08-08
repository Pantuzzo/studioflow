import { Injectable } from '@nestjs/common'
import type { Client } from '@studioflow/contracts'
import type { Client as ClientRow } from '@prisma/client'
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

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scoped by owner at the query level rather than filtered afterwards, so a
   * missing check cannot leak another account's rows.
   */
  async findAllForOwner(ownerId: string): Promise<Client[]> {
    const rows = await this.prisma.client.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toContract)
  }
}
