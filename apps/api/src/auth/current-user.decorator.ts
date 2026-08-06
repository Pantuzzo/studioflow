import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { User } from '@studioflow/contracts'
import type { AuthedRequest } from './auth.constants'

/** The user resolved by SessionAuthGuard. Only valid on guarded routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const request = context.switchToHttp().getRequest<AuthedRequest>()
    if (!request.sessionUser) {
      throw new Error('CurrentUser used on a route without SessionAuthGuard')
    }
    return request.sessionUser
  },
)
