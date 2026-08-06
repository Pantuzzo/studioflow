import type { ThrottlerModuleOptions } from '@nestjs/throttler'

/**
 * The e2e suite signs up and logs in dozens of times from one address within
 * seconds, which real limits would answer with 429 — the tests would be
 * measuring the rate limiter instead of the behaviour under test.
 *
 * Skipping is therefore confined to NODE_ENV=test, and asserted by a unit test
 * so that "we turned the protection off" can never quietly reach production.
 */
/** Pure on purpose: the environment is read by the caller, so this is testable. */
export function shouldSkipThrottling(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'test'
}

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [{ ttl: 60_000, limit: 100 }],
  skipIf: () => shouldSkipThrottling(process.env['NODE_ENV']),
}
