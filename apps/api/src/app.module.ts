import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, APP_PIPE } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { ZodValidationPipe } from 'nestjs-zod'
import { AuthModule } from './auth/auth.module'
import { CsrfCookieMiddleware } from './auth/csrf-cookie.middleware'
import { CsrfGuard } from './auth/csrf.guard'
import { SessionAuthGuard } from './auth/session-auth.guard'
import { ClientsModule } from './clients/clients.module'
import { validateEnv } from './config/env'
import { throttlerConfig } from './config/throttler.config'
import { HealthController } from './health/health.controller'
import { InvoicesModule } from './invoices/invoices.module'
import { PrismaModule } from './prisma/prisma.module'
import { ProjectsModule } from './projects/projects.module'
import { ProposalsModule } from './proposals/proposals.module'
import { TimeEntriesModule } from './time-entries/time-entries.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot(throttlerConfig),
    PrismaModule,
    AuthModule,
    ClientsModule,
    ProjectsModule,
    ProposalsModule,
    TimeEntriesModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Every request body is validated against the shared Zod contract.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Order matters: throttle before doing work, reject forged cross-site
    // requests before touching the session, and authenticate last.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Runs before guards, so the CSRF cookie exists by the time CsrfGuard looks.
    consumer.apply(CsrfCookieMiddleware).forRoutes('*')
  }
}
