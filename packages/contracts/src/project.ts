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
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

/** PATCH semantics, as with clients: send what changed, never an empty body. */
export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((values) => Object.keys(values).length > 0, {
    message: 'Provide at least one field to update',
  })
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
