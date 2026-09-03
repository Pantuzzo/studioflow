import { z } from 'zod'

/**
 * Environment contract. A misconfigured server must fail at boot rather than at
 * the first request, so this is validated before Nest starts.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Origin allowed to send credentialed requests. */
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  /** Seconds of inactivity before a session is refused. */
  SESSION_IDLE_TTL: z.coerce.number().int().positive().default(1800),
  /** Seconds after which a session dies regardless of activity. */
  SESSION_ABSOLUTE_TTL: z.coerce.number().int().positive().default(604800),

  /**
   * Stripe, in test mode. Both are optional so the app still boots without
   * them: payments are a feature, not a prerequisite, and a contributor who
   * only wants to run the rest of the app should not need Stripe credentials.
   * The endpoints refuse politely when they are absent instead of crashing at
   * boot or, worse, at the first payment.
   */
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  /** Signs the webhook. Without it, no event can be trusted, so none is acted on. */
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${details}`)
  }
  return result.data
}
