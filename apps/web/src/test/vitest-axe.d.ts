import 'vitest'
import type { AxeMatchers } from 'vitest-axe/matchers'

/**
 * `expect.extend` adds matchers at runtime; TypeScript needs telling
 * separately, or `toHaveNoViolations` type-checks as a missing property while
 * the tests themselves pass. The build catches that; the test run does not.
 */
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
