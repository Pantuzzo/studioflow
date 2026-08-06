import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { CookieOptions } from 'express'

/**
 * Session cookie name. In production the `__Host-` prefix is used: browsers
 * only accept such a cookie when it is Secure, has Path=/ and carries no
 * Domain, which makes it impossible for a subdomain to overwrite it.
 * Plain http development cannot satisfy Secure, so the prefix is dropped there.
 */
export function sessionCookieName(isProduction: boolean): string {
  return isProduction ? '__Host-sf_session' : 'sf_session'
}

/** Readable by JavaScript on purpose — it is the double-submit CSRF token. */
export function csrfCookieName(isProduction: boolean): string {
  return isProduction ? '__Host-sf_csrf' : 'sf_csrf'
}

export const CSRF_HEADER = 'x-csrf-token'

/** 256 bits of entropy, url-safe. This value is what travels in the cookie. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Only the digest is persisted. A database dump therefore contains no value
 * that can be replayed as a live session.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Constant-time comparison — string `===` leaks position through timing. */
export function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function sessionCookieOptions(
  isProduction: boolean,
  maxAgeSeconds: number,
): CookieOptions {
  return {
    httpOnly: true, // the whole point: JavaScript can never read it
    secure: isProduction,
    sameSite: 'lax', // blocks cross-site POSTs while keeping normal navigation
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  }
}

export function csrfCookieOptions(
  isProduction: boolean,
  maxAgeSeconds: number,
): CookieOptions {
  return {
    httpOnly: false, // must be readable so the client can echo it in a header
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  }
}
