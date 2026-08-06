import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type {
  LoginInput,
  SignupInput,
  User as PublicUser,
} from '@studioflow/contracts'
import * as argon2 from 'argon2'
import { randomUUID } from 'node:crypto'
import type { Env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'
import { generateToken, hashToken } from './session.util'

/**
 * Concurrent requests can race a rotation: the first swaps the token, the
 * second still carries the old one. Honouring a just-revoked token for this
 * long keeps that from logging honest users out, while a genuinely stolen
 * cookie replayed later still trips reuse detection.
 */
const ROTATION_GRACE_MS = 10_000

export interface ValidatedSession {
  user: PublicUser
  /** Set when the session token was rotated — the caller must re-issue the cookie. */
  rotatedToken?: string
}

export interface IssuedSession {
  user: PublicUser
  token: string
  expiresAt: Date
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get idleTtlMs(): number {
    return this.config.get('SESSION_IDLE_TTL', { infer: true }) * 1000
  }

  private get absoluteTtlMs(): number {
    return this.config.get('SESSION_ABSOLUTE_TTL', { infer: true }) * 1000
  }

  /** Rotate halfway through the idle window, so an active session rotates often. */
  private get rotateAfterMs(): number {
    return Math.floor(this.idleTtlMs / 2)
  }

  private static toPublicUser(user: {
    id: string
    name: string
    email: string
  }): PublicUser {
    return { id: user.id, name: user.name, email: user.email }
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id })
  }

  async signup(input: SignupInput): Promise<IssuedSession> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    })
    if (existing) {
      // Signup necessarily reveals that an address is taken; login and password
      // reset stay silent so this is the only place it leaks.
      throw new ConflictException('That email is already registered')
    }

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: await this.hashPassword(input.password),
      },
    })
    return this.issueSession(user)
  }

  async login(input: LoginInput): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    })

    // Verify against a dummy hash when the account is missing, so a wrong email
    // and a wrong password take the same time — no enumeration by stopwatch.
    const hash = user?.passwordHash ?? (await this.dummyHash())
    const valid = await argon2.verify(hash, input.password).catch(() => false)

    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password')
    }
    return this.issueSession(user)
  }

  private dummyHashCache: string | null = null
  private async dummyHash(): Promise<string> {
    this.dummyHashCache ??= await this.hashPassword(randomUUID())
    return this.dummyHashCache
  }

  private async issueSession(user: {
    id: string
    name: string
    email: string
  }): Promise<IssuedSession> {
    const token = generateToken()
    const expiresAt = new Date(Date.now() + this.absoluteTtlMs)
    await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        familyId: randomUUID(),
        userId: user.id,
        expiresAt,
      },
    })
    return { user: AuthService.toPublicUser(user), token, expiresAt }
  }

  /**
   * Resolve a cookie value to a user, enforcing idle and absolute timeouts,
   * rotating the token periodically, and revoking an entire session family when
   * an already-revoked token reappears.
   */
  async validateSession(token: string): Promise<ValidatedSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    })
    if (!session) return null

    const now = new Date()

    if (session.revokedAt) {
      // The grace window belongs to rotation alone. A logged-out session must
      // die at once, and a reuse revocation must never be forgiven.
      const racedRotation =
        session.revokedReason === 'rotated' &&
        now.getTime() - session.revokedAt.getTime() <= ROTATION_GRACE_MS

      if (racedRotation) {
        return { user: AuthService.toPublicUser(session.user) }
      }

      if (session.revokedReason === 'rotated') {
        // A rotated token resurfacing long after the swap means the cookie
        // leaked. Burn the whole family.
        this.logger.warn(
          `Rotated session token replayed; revoking family ${session.familyId}`,
        )
        await this.prisma.session.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: now, revokedReason: 'reuse' },
        })
      }
      return null
    }

    if (session.expiresAt.getTime() <= now.getTime()) return null
    if (now.getTime() - session.lastUsedAt.getTime() > this.idleTtlMs) {
      return null
    }

    const user = AuthService.toPublicUser(session.user)

    if (now.getTime() - session.createdAt.getTime() > this.rotateAfterMs) {
      const nextToken = generateToken()
      await this.prisma.$transaction([
        this.prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: now, revokedReason: 'rotated' },
        }),
        this.prisma.session.create({
          data: {
            tokenHash: hashToken(nextToken),
            // Same family: rotation is a continuation, not a new login.
            familyId: session.familyId,
            userId: session.userId,
            // The absolute deadline survives rotation, or sessions would be immortal.
            expiresAt: session.expiresAt,
          },
        }),
      ])
      return { user, rotatedToken: nextToken }
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: now },
    })
    return { user }
  }

  /** Revoke the presented session. Idempotent: an unknown token is a no-op. */
  async logout(token: string | undefined): Promise<void> {
    if (!token) return
    await this.prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'logout' },
    })
  }

  /**
   * Always succeeds from the caller's point of view. Reporting whether the
   * address exists would turn this endpoint into an account oracle.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    if (user) {
      this.logger.log(`Password reset requested for ${user.email}`)
      // Delivery lands with the email provider in a later phase.
    }
  }
}
