import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import type { Env } from '../config/env'
import { CSRF_HEADER, csrfCookieName, safeEquals } from './session.util'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Cookie authentication is inherently CSRF-exposed, so two independent checks
 * guard every state-changing request:
 *
 * 1. Origin must match the configured web origin. An attacker's page cannot
 *    forge this header.
 * 2. Double submit — the readable CSRF cookie must equal the request header.
 *    A cross-site attacker can make the browser send the cookie but cannot read
 *    it, so it cannot produce the matching header.
 *
 * SameSite=Lax already blocks most of this; these are the belt to its braces.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    if (!MUTATING_METHODS.has(request.method)) return true

    const allowedOrigin = this.config.get('WEB_ORIGIN', { infer: true })
    const origin = request.headers.origin
    if (origin && origin !== allowedOrigin) {
      throw new ForbiddenException('Cross-origin request rejected')
    }

    const isProduction =
      this.config.get('NODE_ENV', { infer: true }) === 'production'
    const cookies = request.cookies as Record<string, string> | undefined
    const cookieToken = cookies?.[csrfCookieName(isProduction)]
    const headerToken = request.headers[CSRF_HEADER]

    if (
      !cookieToken ||
      typeof headerToken !== 'string' ||
      !safeEquals(cookieToken, headerToken)
    ) {
      throw new ForbiddenException('Missing or invalid CSRF token')
    }
    return true
  }
}
