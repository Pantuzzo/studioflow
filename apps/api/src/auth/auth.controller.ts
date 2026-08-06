import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Session, User } from '@studioflow/contracts'
import type { Request, Response } from 'express'
import type { Env } from '../config/env'
import { Public } from './auth.constants'
import { ForgotPasswordDto, LoginDto, SessionDto, SignupDto } from './auth.dto'
import { AuthService, type IssuedSession } from './auth.service'
import { CurrentUser } from './current-user.decorator'
import { sessionCookieName, sessionCookieOptions } from './session.util'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get isProduction(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === 'production'
  }

  /** The session token leaves the server here and nowhere else: in a cookie. */
  private setSessionCookie(response: Response, issued: IssuedSession): void {
    const maxAge = Math.floor((issued.expiresAt.getTime() - Date.now()) / 1000)
    response.cookie(
      sessionCookieName(this.isProduction),
      issued.token,
      sessionCookieOptions(this.isProduction, maxAge),
    )
  }

  @Public()
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: SessionDto })
  @ApiConflictResponse({ description: 'Email already registered.' })
  async signup(
    @Body() body: SignupDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Session> {
    const issued = await this.auth.signup(body)
    this.setSessionCookie(response, issued)
    return { user: issued.user }
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Brute force is the obvious attack on this route; 10 attempts a minute per
  // IP keeps honest typos comfortable and guessing impractical.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ type: SessionDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Session> {
    const issued = await this.auth.login(body)
    this.setSessionCookie(response, issued)
    return { user: issued.user }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Session revoked.' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const name = sessionCookieName(this.isProduction)
    const cookies = request.cookies as Record<string, string> | undefined
    // Revoked server-side, not merely forgotten by the browser.
    await this.auth.logout(cookies?.[name])
    response.clearCookie(name, { path: '/' })
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiAcceptedResponse({
    description:
      'Always accepted, whether or not the address exists — otherwise this endpoint would confirm which emails are registered.',
  })
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.auth.requestPasswordReset(body.email)
    return {
      message: 'If that email is registered, a reset link is on its way.',
    }
  }

  @Get('me')
  @ApiOkResponse({ type: SessionDto })
  @ApiUnauthorizedResponse({ description: 'No active session.' })
  me(@CurrentUser() user: User): Session {
    return { user }
  }
}
