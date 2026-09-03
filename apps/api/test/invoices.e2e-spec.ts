import 'dotenv/config'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'

const CSRF_COOKIE = 'sf_csrf'
const CSRF_HEADER = 'x-csrf-token'

const PERIOD = {
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-09-01T00:00:00.000Z',
}

function parseCookies(setCookie: string[] | undefined): Record<string, string> {
  const jar: Record<string, string> = {}
  for (const raw of setCookie ?? []) {
    const [pair] = raw.split(';')
    const index = pair?.indexOf('=') ?? -1
    if (pair && index > 0) jar[pair.slice(0, index)] = pair.slice(index + 1)
  }
  return jar
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

describe('Invoices (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  const password = 'correct-horse-battery'

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.use(cookieParser())
    await app.init()
    prisma = app.get(PrismaService)
  })

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@studioflow.test' } },
    })
    await app.close()
  })

  async function account(): Promise<{
    jar: Record<string, string>
    userId: string
    clientId: string
    projectId: string
  }> {
    const armed = await request(app.getHttpServer()).get('/api/health')
    const jar = parseCookies(
      armed.headers['set-cookie'] as string[] | undefined,
    )

    const email = `e2e-${randomUUID()}@studioflow.test`
    const signup = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ name: 'Invoice E2E', email, password })
    expect(signup.status).toBe(201)
    const userId = signup.body.user.id

    const client = await prisma.client.create({
      data: {
        name: 'Ada Owner',
        company: 'Owner Co',
        email: `client-${randomUUID()}@example.test`,
        currency: 'EUR',
        ownerId: userId,
      },
    })
    const project = await prisma.project.create({
      data: {
        name: 'Relaunch',
        clientId: client.id,
        ownerId: userId,
        hourlyRateCents: 10_000,
      },
    })

    return {
      jar: {
        ...jar,
        ...parseCookies(signup.headers['set-cookie'] as string[] | undefined),
      },
      userId,
      clientId: client.id,
      projectId: project.id,
    }
  }

  /** Hours of tracked, finished time inside the period. */
  async function trackHours(
    ownerId: string,
    projectId: string,
    hours: number,
    startedAt = '2026-08-10T09:00:00.000Z',
  ): Promise<string> {
    const start = new Date(startedAt)
    const entry = await prisma.timeEntry.create({
      data: {
        projectId,
        ownerId,
        description: 'Work',
        startedAt: start,
        endedAt: new Date(start.getTime() + hours * 3600 * 1000),
      },
    })
    return entry.id
  }

  function authed(
    method: 'post' | 'patch' | 'delete',
    url: string,
    jar: Record<string, string>,
  ) {
    const agent = request(app.getHttpServer())
    return agent[method](url)
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
  }

  function get(url: string, jar: Record<string, string>) {
    return request(app.getHttpServer())
      .get(url)
      .set('Cookie', cookieHeader(jar))
  }

  function generate(jar: Record<string, string>, clientId: string) {
    return authed('post', '/api/invoices/generate', jar).send({
      clientId,
      ...PERIOD,
    })
  }

  it('refuses to list invoices without a session', async () => {
    const response = await request(app.getHttpServer()).get('/api/invoices')
    expect(response.status).toBe(401)
  })

  it('prices tracked hours at the project rate, one line per project', async () => {
    const { jar, userId, clientId, projectId } = await account()
    const second = await prisma.project.create({
      data: {
        name: 'Retainer',
        clientId,
        ownerId: userId,
        hourlyRateCents: 5_000,
      },
    })
    await trackHours(userId, projectId, 2)
    await trackHours(userId, projectId, 1.5, '2026-08-11T09:00:00.000Z')
    await trackHours(userId, second.id, 3, '2026-08-12T09:00:00.000Z')

    const invoice = await generate(jar, clientId)
    expect(invoice.status).toBe(201)
    expect(invoice.body.number).toBe(1)
    expect(invoice.body.currency).toBe('EUR')

    // An invoice is a bill, not a log: the two entries on one project merge.
    expect(invoice.body.lines).toHaveLength(2)
    const relaunch = invoice.body.lines.find(
      (l: { description: string }) => l.description === 'Relaunch',
    )
    expect(relaunch).toMatchObject({
      quantityHours: 3.5,
      unitPriceCents: 10_000,
    })
  })

  it('never bills the same hour twice', async () => {
    const { jar, userId, clientId, projectId } = await account()
    await trackHours(userId, projectId, 2)

    const first = await generate(jar, clientId)
    expect(first.status).toBe(201)

    // The entries carry the invoice id now, so there is nothing left unbilled.
    const second = await generate(jar, clientId)
    expect(second.status).toBe(409)

    const entries = await prisma.timeEntry.findMany({
      where: { ownerId: userId },
    })
    expect(entries.every((entry) => entry.invoiceId === first.body.id)).toBe(
      true,
    )
  })

  it('releases the hours again when the invoice is deleted', async () => {
    const { jar, userId, clientId, projectId } = await account()
    await trackHours(userId, projectId, 2)
    const invoice = await generate(jar, clientId)

    await authed('delete', `/api/invoices/${invoice.body.id}`, jar).expect(204)

    // Deleting the bill must not destroy the record of the work.
    const entries = await prisma.timeEntry.findMany({
      where: { ownerId: userId },
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.invoiceId).toBeNull()

    const again = await generate(jar, clientId)
    expect(again.status).toBe(201)
    // Numbers are never reused, even when the invoice that held one is gone.
    expect(again.body.number).toBe(2)
  })

  it('never bills a running timer', async () => {
    const { jar, userId, clientId, projectId } = await account()
    await prisma.timeEntry.create({
      data: {
        projectId,
        ownerId: userId,
        startedAt: new Date('2026-08-10T09:00:00.000Z'),
        endedAt: null,
      },
    })

    const response = await generate(jar, clientId)
    // A timer with no end has no duration to bill.
    expect(response.status).toBe(409)
  })

  it('bills only the hours inside the period', async () => {
    const { jar, userId, clientId, projectId } = await account()
    await trackHours(userId, projectId, 2, '2026-07-15T09:00:00.000Z')
    await trackHours(userId, projectId, 3, '2026-08-15T09:00:00.000Z')

    const invoice = await generate(jar, clientId)
    expect(invoice.body.lines[0].quantityHours).toBe(3)
  })

  it('freezes the client details, so later edits cannot rewrite it', async () => {
    const { jar, userId, clientId, projectId } = await account()
    await trackHours(userId, projectId, 1)
    const invoice = await generate(jar, clientId)

    await authed('patch', `/api/clients/${clientId}`, jar)
      .send({ name: 'Renamed Later', currency: 'BRL' })
      .expect(200)

    const fetched = await get(`/api/invoices/${invoice.body.id}`, jar)
    expect(fetched.body).toMatchObject({
      clientName: 'Ada Owner',
      clientCompany: 'Owner Co',
      currency: 'EUR',
    })
  })

  it('keeps a line readable after its project is deleted', async () => {
    const { jar, userId, clientId, projectId } = await account()
    await trackHours(userId, projectId, 1)
    const invoice = await generate(jar, clientId)

    await authed('delete', `/api/projects/${projectId}`, jar).expect(204)

    const fetched = await get(`/api/invoices/${invoice.body.id}`, jar)
    expect(fetched.status).toBe(200)
    // The description was copied in, so it survives the project.
    expect(fetched.body.lines[0].description).toBe('Relaunch')
  })

  it('numbers invoices sequentially per account, starting at one', async () => {
    const alice = await account()
    const bob = await account()
    await trackHours(alice.userId, alice.projectId, 1)
    await trackHours(bob.userId, bob.projectId, 1)

    const alices = await generate(alice.jar, alice.clientId)
    const bobs = await generate(bob.jar, bob.clientId)

    // Each account has its own sequence; Bob's first invoice is number one too.
    expect(alices.body.number).toBe(1)
    expect(bobs.body.number).toBe(1)
  })

  it('refuses to change the lines of an issued invoice', async () => {
    const { jar, userId, clientId, projectId } = await account()
    await trackHours(userId, projectId, 1)
    const invoice = await generate(jar, clientId)

    const patched = await authed(
      'patch',
      `/api/invoices/${invoice.body.id}`,
      jar,
    ).send({
      status: 'sent',
      lines: [{ id: 'x', description: 'Padding', quantityHours: 99 }],
    })

    expect(patched.status).toBe(200)
    expect(patched.body.status).toBe('sent')
    // Correcting an issued invoice is a credit note, not an edit.
    expect(patched.body.lines).toHaveLength(1)
    expect(patched.body.lines[0].description).toBe('Relaunch')
  })

  it('never generates against another account, nor exposes its invoices', async () => {
    const alice = await account()
    const bob = await account()
    await trackHours(bob.userId, bob.projectId, 2)

    const trespass = await generate(alice.jar, bob.clientId)
    // 404 rather than 403: a 403 would confirm the client exists.
    expect(trespass.status).toBe(404)

    const bobs = await generate(bob.jar, bob.clientId)
    expect(bobs.status).toBe(201)

    expect((await get(`/api/invoices/${bobs.body.id}`, alice.jar)).status).toBe(
      404,
    )
    expect(
      (
        await authed('patch', `/api/invoices/${bobs.body.id}`, alice.jar).send({
          status: 'paid',
        })
      ).status,
    ).toBe(404)
    expect(
      (await authed('delete', `/api/invoices/${bobs.body.id}`, alice.jar))
        .status,
    ).toBe(404)

    const list = await get('/api/invoices', alice.jar)
    expect(list.body).toEqual([])
  })

  it('carries a line count in the index, not the lines', async () => {
    const { jar, userId, clientId, projectId } = await account()
    await trackHours(userId, projectId, 1)
    await generate(jar, clientId)

    const list = await get('/api/invoices', jar)
    expect(list.body[0]).toMatchObject({ lineCount: 1 })
    expect(list.body[0].lines).toBeUndefined()
  })

  it('rejects a period that ends before it starts', async () => {
    const { jar, clientId } = await account()
    const response = await authed('post', '/api/invoices/generate', jar).send({
      clientId,
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-08-01T00:00:00.000Z',
    })
    expect(response.status).toBe(400)
  })
})
