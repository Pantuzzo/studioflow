import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import type { Response } from 'express'
import type { Env } from '../config/env'
import { type AuthedRequest, IS_PUBLIC_KEY } from './auth.constants'
import { AuthService } from './auth.service'
import { sessionCookieName, sessionCookieOptions } from './session.util'

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const http = context.switchToHttp()
    const request = http.getRequest<AuthedRequest>()
    const response = http.getResponse<Response>()

    const isProduction =
      this.config.get('NODE_ENV', { infer: true }) === 'production'
    const cookieName = sessionCookieName(isProduction)
    const token = (request.cookies as Record<string, string> | undefined)?.[
      cookieName
    ]

    if (!token) throw new UnauthorizedException('Not signed in')

    const result = await this.auth.validateSession(token)
    if (!result) {
      response.clearCookie(cookieName, { path: '/' })
      throw new UnauthorizedException('Your session has expired')
    }

    if (result.rotatedToken) {
      const absoluteTtl = this.config.get('SESSION_ABSOLUTE_TTL', {
        infer: true,
      })
      response.cookie(
        cookieName,
        result.rotatedToken,
        sessionCookieOptions(isProduction, absoluteTtl),
      )
    }

    request.sessionUser = result.user
    return true
  }
}
