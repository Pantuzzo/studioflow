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

/** The currencies the product bills in. Also the options in the form's Select. */
export const CURRENCY_CODES = [
  'USD',
  'EUR',
  'GBP',
  'BRL',
  'CAD',
  'AUD',
] as const
export type CurrencyCode = (typeof CURRENCY_CODES)[number]

/**
 * The editable half of a client, on the way in.
 *
 * Deliberately stricter than `clientSchema` rather than derived from it: a read
 * must accept any ISO code already stored, while a write only offers the ones
 * the product supports. Reading and writing are different contracts, so they
 * get different schemas — the cost is remembering to extend both.
 */
export const createClientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name')
    .max(80, 'Use at most 80 characters'),
  company: z
    .string()
    .trim()
    .min(1, 'Enter a company')
    .max(80, 'Use at most 80 characters'),
  email: z.email('Enter a valid email address'),
  currency: z.enum(CURRENCY_CODES),
})
export type CreateClientInput = z.infer<typeof createClientSchema>

/**
 * PATCH semantics: send only what changed. An empty body is refused, because it
 * is always a bug on the caller's side rather than a no-op worth honouring.
 */
export const updateClientSchema = createClientSchema
  .partial()
  .refine((values) => Object.keys(values).length > 0, {
    message: 'Provide at least one field to update',
  })
export type UpdateClientInput = z.infer<typeof updateClientSchema>
