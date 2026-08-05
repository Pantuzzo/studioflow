import { Test } from '@nestjs/testing'
import { PrismaService } from '../prisma/prisma.service'
import { HealthController } from './health.controller'

async function controllerWith(queryRaw: jest.Mock): Promise<HealthController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
  }).compile()
  return moduleRef.get(HealthController)
}

describe('HealthController', () => {
  it('reports ok when the database answers', async () => {
    const controller = await controllerWith(
      jest.fn().mockResolvedValue([{ x: 1 }]),
    )
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    })
  })

  it('reports degraded instead of throwing when the database is unreachable', async () => {
    const controller = await controllerWith(
      jest.fn().mockRejectedValue(new Error('connection refused')),
    )
    await expect(controller.check()).resolves.toEqual({
      status: 'degraded',
      database: 'down',
    })
  })
})
