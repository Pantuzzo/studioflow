import { z } from 'zod'

/** A client of the studio — the people and companies the work is done for. */
export const clientSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  company: z.string(),
  email: z.email(),
  /** ISO 4217 currency code, e.g. "USD". Drives locale-aware formatting later. */
  currency: z.string().length(3),
  /** ISO 8601 timestamp. */
  createdAt: z.iso.datetime(),
})
export type Client = z.infer<typeof clientSchema>

export const clientListSchema = z.array(clientSchema)
