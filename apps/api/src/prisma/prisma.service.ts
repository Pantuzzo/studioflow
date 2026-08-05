import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import type { Env } from '../config/env'

/**
 * Prisma 7 requires a driver adapter — `new PrismaClient()` with no options
 * throws rather than falling back to a bundled query engine.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name)

  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
    this.logger.log('Connected to Postgres')
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
