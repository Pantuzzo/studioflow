import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'
import type { Env } from '../config/env'

/**
 * The Stripe client, as an injectable rather than a module-level singleton.
 *
 * Two reasons. The key comes from validated configuration rather than from
 * `process.env` read at import time; and a test can substitute a fake, which
 * is what lets the payment flow be tested without a network or a live account.
 */
export const STRIPE_CLIENT = 'STRIPE_CLIENT'

/** Null when no key is configured, which the callers treat as "not enabled". */
export type MaybeStripe = Stripe | null

export const stripeProvider = {
  provide: STRIPE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): MaybeStripe => {
    const key = config.get('STRIPE_SECRET_KEY', { infer: true })
    if (!key) return null
    return new Stripe(key)
  },
}
