import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  CreateTimeEntryInput,
  StartTimerInput,
  TimeEntry,
  UpdateTimeEntryInput,
} from '@studioflow/contracts'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

/** Every row displays its project and that project's client. */
const withNames = {
  project: { select: { name: true, client: { select: { name: true } } } },
} satisfies Prisma.TimeEntryInclude

type TimeEntryRow = Prisma.TimeEntryGetPayload<{ include: typeof withNames }>

function toContract(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    clientName: row.project.client.name,
    description: row.description,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
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
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForOwner(ownerId: string): Promise<TimeEntry[]> {
    const rows = await this.prisma.timeEntry.findMany({
      where: { ownerId },
      include: withNames,
      orderBy: { startedAt: 'desc' },
    })
    return rows.map(toContract)
  }

  /** The running entry, if there is one. At most one can exist per account. */
  async findRunningForOwner(ownerId: string): Promise<TimeEntry | null> {
    const row = await this.prisma.timeEntry.findFirst({
      where: { ownerId, endedAt: null },
      include: withNames,
    })
    return row ? toContract(row) : null
  }

  /** The project id comes from the browser, so it is checked before it is used. */
  private async assertOwnsProject(
    ownerId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true },
    })
    if (!project) throw new NotFoundException('Project not found')
  }

  /**
   * Starting a timer takes no timestamp from the caller. The server's clock is
   * the one that decides when now is, because a browser with a wrong clock
   * would otherwise be able to bill an hour it did not work.
   */
  async startForOwner(
    ownerId: string,
    input: StartTimerInput,
  ): Promise<TimeEntry> {
    await this.assertOwnsProject(ownerId, input.projectId)

    // One timer at a time. Enforced here rather than by a unique index because
    // the index would have to be partial, and Prisma cannot describe one.
    const running = await this.prisma.timeEntry.findFirst({
      where: { ownerId, endedAt: null },
      select: { id: true },
    })
    if (running) {
      throw new ConflictException('A timer is already running')
    }

    const row = await this.prisma.timeEntry.create({
      data: {
        projectId: input.projectId,
        description: input.description,
        startedAt: new Date(),
        ownerId,
      },
      include: withNames,
    })
    return toContract(row)
  }

  /** Stopping is also on the server's clock, for the same reason. */
  async stopForOwner(ownerId: string, id: string): Promise<TimeEntry> {
    const existing = await this.prisma.timeEntry.findFirst({
      where: { id, ownerId },
      select: { id: true, endedAt: true },
    })
    if (!existing) throw new NotFoundException('Time entry not found')
    if (existing.endedAt) {
      throw new ConflictException('That entry has already been stopped')
    }

    const row = await this.prisma.timeEntry.update({
      where: { id },
      data: { endedAt: new Date() },
      include: withNames,
    })
    return toContract(row)
  }

  /** A completed entry typed in by hand, for work done away from the app. */
  async createForOwner(
    ownerId: string,
    input: CreateTimeEntryInput,
  ): Promise<TimeEntry> {
    await this.assertOwnsProject(ownerId, input.projectId)
    const row = await this.prisma.timeEntry.create({
      data: {
        projectId: input.projectId,
        description: input.description,
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
        ownerId,
      },
      include: withNames,
    })
    return toContract(row)
  }

  async updateForOwner(
    ownerId: string,
    id: string,
    patch: UpdateTimeEntryInput,
  ): Promise<TimeEntry> {
    if (patch.projectId) await this.assertOwnsProject(ownerId, patch.projectId)

    // A patch that moves only one end has to be checked against the end it is
    // not moving, which the schema alone cannot see.
    const existing = await this.prisma.timeEntry.findFirst({
      where: { id, ownerId },
      select: { startedAt: true, endedAt: true },
    })
    if (!existing) throw new NotFoundException('Time entry not found')

    const startedAt = patch.startedAt
      ? new Date(patch.startedAt)
      : existing.startedAt
    const endedAt =
      patch.endedAt === undefined
        ? existing.endedAt
        : patch.endedAt === null
          ? null
          : new Date(patch.endedAt)
    if (endedAt && endedAt <= startedAt) {
      throw new ConflictException('The end has to come after the start')
    }

    try {
      const row = await this.prisma.timeEntry.update({
        where: { id, ownerId },
        data: {
          ...(patch.projectId ? { projectId: patch.projectId } : {}),
          ...(patch.description !== undefined
            ? { description: patch.description }
            : {}),
          startedAt,
          endedAt,
        },
        include: withNames,
      })
      return toContract(row)
    } catch (error) {
      if (isMissingRecord(error))
        throw new NotFoundException('Time entry not found')
      throw error
    }
  }

  async removeForOwner(ownerId: string, id: string): Promise<void> {
    try {
      await this.prisma.timeEntry.delete({ where: { id, ownerId } })
    } catch (error) {
      if (isMissingRecord(error))
        throw new NotFoundException('Time entry not found')
      throw error
    }
  }
}
