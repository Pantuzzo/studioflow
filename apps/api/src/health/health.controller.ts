import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { PrismaService } from '../prisma/prisma.service'

export interface HealthResponse {
  status: 'ok' | 'degraded'
  database: 'up' | 'down'
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness plus a real database round-trip — a health check that cannot lie. */
  @Get()
  @ApiOkResponse({ description: 'Service and database status.' })
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { status: 'ok', database: 'up' }
    } catch {
      return { status: 'degraded', database: 'down' }
    }
  }
}
