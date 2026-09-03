import { z } from 'zod'

/**
 * Where a project is in its life.
 *
 * Note the contrast with a client's currency, which reads liberally and writes
 * strictly: this set is one the application owns — the column is a Postgres
 * enum — so there is no legacy value to be generous about, and read and write
 * can agree.
 */
export const PROJECT_STATUSES = ['active', 'paused', 'completed'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

/** A piece of work done for a client. */
export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  status: z.enum(PROJECT_STATUSES),
  /**
   * What an hour on this project costs, in integer minor units of the client's
   * currency. On the project rather than the client, because two projects for
   * the same client are routinely billed differently, and the reverse is not
   * a thing anyone needs.
   */
  hourlyRateCents: z.number().int().nonnegative().max(1_000_000_000),
  clientId: z.string(),
  /**
   * Denormalised for display. The list renders the client's name on every row,
   * and making the browser join two caches to produce it would be more moving
   * parts than sending eight characters.
   */
  clientName: z.string(),
  /** ISO 8601 timestamp. */
  createdAt: z.iso.datetime(),
})
export type Project = z.infer<typeof projectSchema>

export const projectListSchema = z.array(projectSchema)

/**
 * The editable half. `clientName` is absent on purpose: it is derived from
 * `clientId`, and accepting both would invite them to disagree.
 */
export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name')
    .max(80, 'Use at most 80 characters'),
  // Distinct from the picker's "Choose a client" placeholder on purpose: an
  // error that reads identically to the empty state tells the user nothing.
  clientId: z.string().min(1, 'Choose a client for this project'),
  status: z.enum(PROJECT_STATUSES),
  /**
   * Optional rather than defaulted. A `.default()` makes the schema's input
   * type differ from its output type, which fights zodResolver; and making it
   * required would break every caller that predates billing. Absent means the
   * column's zero, which reads as "not billable yet".
   */
  hourlyRateCents: z
    .number()
    .int('Use whole cents')
    .nonnegative('A rate cannot be negative')
    .max(1_000_000_000)
    .optional(),
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

/** PATCH semantics, as with clients: send what changed, never an empty body. */
export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((values) => Object.keys(values).length > 0, {
    message: 'Provide at least one field to update',
  })
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
