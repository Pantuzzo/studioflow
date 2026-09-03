import { SetMetadata } from '@nestjs/common'
import type { User } from '@studioflow/contracts'
import type { Request } from 'express'

export const IS_PUBLIC_KEY = 'sf:isPublic'

/** Opt a route out of the globally applied session guard. */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true)

export const SKIP_CSRF_KEY = 'sf:skipCsrf'

/**
 * Opt a route out of the CSRF guard.
 *
 * Only ever correct for a route that carries no cookie and proves its origin
 * some other way. CSRF exists because browsers attach cookies automatically;
 * a request that is authenticated by a signature it computes itself has no
 * such exposure. Note what this is not for: `@Public()` routes like login and
 * signup are cookie-adjacent and keep their CSRF check.
 *
 * A route wearing this decorator is responsible for authenticating itself.
 */
export const SkipCsrf = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_CSRF_KEY, true)

/** Express request after the session guard has resolved the caller. */
export interface AuthedRequest extends Request {
  sessionUser?: User
}
