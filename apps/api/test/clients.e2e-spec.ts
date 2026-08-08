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

describe('Clients (e2e)', () => {
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

  /** Create an account and return its cookie jar plus its user id. */
  async function account(): Promise<{
    jar: Record<string, string>
    userId: string
  }> {
    const armed = await request(app.getHttpServer()).get('/api/health')
    const jar = parseCookies(
      armed.headers['set-cookie'] as string[] | undefined,
    )

    const email = `e2e-${randomUUID()}@studioflow.test`
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ name: 'Clients E2E', email, password })
    expect(response.status).toBe(201)

    return {
      jar: {
        ...jar,
        ...parseCookies(response.headers['set-cookie'] as string[] | undefined),
      },
      userId: response.body.user.id,
    }
  }

  async function addClient(ownerId: string, company: string): Promise<void> {
    await prisma.client.create({
      data: {
        name: 'Owner Test',
        company,
        email: `${company.toLowerCase().replace(/\s/g, '')}@example.test`,
        currency: 'USD',
        ownerId,
      },
    })
  }

  it('refuses to list clients without a session', async () => {
    const response = await request(app.getHttpServer()).get('/api/clients')
    expect(response.status).toBe(401)
  })

  it('returns the signed-in account’s clients in the contract shape', async () => {
    const { jar, userId } = await account()
    await addClient(userId, 'Northwind Studio')

    const response = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Cookie', cookieHeader(jar))

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(1)
    expect(response.body[0]).toMatchObject({
      company: 'Northwind Studio',
      currency: 'USD',
    })
    // createdAt crosses the wire as an ISO string, not a Date.
    expect(typeof response.body[0].createdAt).toBe('string')
    // ownerId is internal and must not leak.
    expect(response.body[0].ownerId).toBeUndefined()
  })

  it('never returns another account’s clients', async () => {
    const alice = await account()
    const bob = await account()
    await addClient(alice.userId, 'Alice Only')
    await addClient(bob.userId, 'Bob Only')

    const response = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Cookie', cookieHeader(alice.jar))

    expect(response.status).toBe(200)
    const companies = response.body.map((c: { company: string }) => c.company)
    expect(companies).toContain('Alice Only')
    expect(companies).not.toContain('Bob Only')
  })

  it('returns an empty list for a brand-new account rather than erroring', async () => {
    const { jar } = await account()
    const response = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Cookie', cookieHeader(jar))
    expect(response.status).toBe(200)
    expect(response.body).toEqual([])
  })

  it('stops returning clients once the session is revoked', async () => {
    const { jar, userId } = await account()
    await addClient(userId, 'Revoked Co')

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .expect(204)

    const response = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Cookie', cookieHeader(jar))
    expect(response.status).toBe(401)
  })
})
