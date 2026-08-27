import { z } from 'zod'

/**
 * A stretch of time worked on a project.
 *
 * The duration is not stored. It is `endedAt - startedAt`, and an entry with no
 * `endedAt` is still running. Storing a duration alongside the two timestamps
 * would create three fields that can disagree, and the one that disagrees is
 * always the one an invoice reads.
 */
export const timeEntrySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  /** Denormalised for display, as everywhere else. */
  projectName: z.string(),
  clientName: z.string(),
  description: z.string(),
  startedAt: z.iso.datetime(),
  /** Null while the timer is running. */
  endedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
})
export type TimeEntry = z.infer<typeof timeEntrySchema>

export const timeEntryListSchema = z.array(timeEntrySchema)

/** Seconds elapsed. `now` is a parameter so the caller owns the clock. */
export function entryDurationSeconds(
  entry: Pick<TimeEntry, 'startedAt' | 'endedAt'>,
  now: number = Date.now(),
): number {
  const started = new Date(entry.startedAt).getTime()
  const ended = entry.endedAt ? new Date(entry.endedAt).getTime() : now
  return Math.max(0, Math.floor((ended - started) / 1000))
}

export const isRunning = (entry: Pick<TimeEntry, 'endedAt'>): boolean =>
  entry.endedAt === null

/** A day's worth of seconds, as a cap on any single entry. */
const MAX_ENTRY_SECONDS = 24 * 60 * 60

const description = z.string().trim().max(200, 'Use at most 200 characters')

/**
 * Starting a timer sends no timestamps: the server's clock decides when now is.
 * A browser with a wrong clock should not be able to bill an hour it did not
 * work.
 */
export const startTimerSchema = z.object({
  projectId: z.string().min(1, 'Choose a project'),
  description: description.default(''),
})
export type StartTimerInput = z.infer<typeof startTimerSchema>

/** A completed entry typed in by hand, for work done away from the app. */
export const createTimeEntrySchema = z
  .object({
    projectId: z.string().min(1, 'Choose a project'),
    description: description.default(''),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime(),
  })
  .refine((v) => new Date(v.endedAt) > new Date(v.startedAt), {
    message: 'The end has to come after the start',
    path: ['endedAt'],
  })
  .refine(
    (v) =>
      (new Date(v.endedAt).getTime() - new Date(v.startedAt).getTime()) /
        1000 <=
      MAX_ENTRY_SECONDS,
    { message: 'An entry cannot be longer than a day', path: ['endedAt'] },
  )
export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>

/**
 * Editing an entry after the fact. Every field is optional, but the two
 * timestamps are checked together whenever both are present, because a patch
 * that only moves the start could otherwise invert the interval.
 */
export const updateTimeEntrySchema = z
  .object({
    projectId: z.string().min(1),
    description,
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  })
  .refine(
    (v) =>
      !v.startedAt || !v.endedAt || new Date(v.endedAt) > new Date(v.startedAt),
    { message: 'The end has to come after the start', path: ['endedAt'] },
  )
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>
