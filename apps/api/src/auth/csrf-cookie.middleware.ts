import { Injectable, type NestMiddleware } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { NextFunction, Request, Response } from 'express'
import type { Env } from '../config/env'
import {
  csrfCookieName,
  csrfCookieOptions,
  generateToken,
} from './session.util'

/**
 * Hands the client a CSRF token whenever it doesn't already have one.
 *
 * Without this there is a chicken-and-egg problem: login is a POST, so it needs
 * a token, but a fresh visitor has never received one. Issuing on any request
 * means the client's first read (`GET /auth/me` at boot) always arms it.
 */
@Injectable()
export class CsrfCookieMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService<Env, true>) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const isProduction =
      this.config.get('NODE_ENV', { infer: true }) === 'production'
    const name = csrfCookieName(isProduction)
    const cookies = request.cookies as Record<string, string> | undefined

    if (!cookies?.[name]) {
      const token = generateToken()
      const ttl = this.config.get('SESSION_ABSOLUTE_TTL', { infer: true })
      response.cookie(name, token, csrfCookieOptions(isProduction, ttl))
      // Make it visible to a guard running later in this same request.
      request.cookies = { ...(cookies ?? {}), [name]: token }
    }
    next()
  }
}
