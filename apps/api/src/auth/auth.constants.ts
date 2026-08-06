import { SetMetadata } from '@nestjs/common'
import type { User } from '@studioflow/contracts'
import type { Request } from 'express'

export const IS_PUBLIC_KEY = 'sf:isPublic'

/** Opt a route out of the globally applied session guard. */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true)

/** Express request after the session guard has resolved the caller. */
export interface AuthedRequest extends Request {
  sessionUser?: User
}
