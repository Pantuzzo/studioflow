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

  async function addClient(ownerId: string, company: string): Promise<string> {
    const row = await prisma.client.create({
      data: {
        name: 'Owner Test',
        company,
        email: `${company.toLowerCase().replace(/\s/g, '')}@example.test`,
        currency: 'USD',
        ownerId,
      },
    })
    return row.id
  }

  /** A signed request: session cookie plus the double-submit CSRF header. */
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

  const NEW_CLIENT = {
    name: 'Mara Silva',
    company: 'Atlas Works',
    email: 'mara@atlas.works',
    currency: 'USD',
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

  it('creates a client owned by the caller', async () => {
    const { jar } = await account()

    const created = await authed('post', '/api/clients', jar).send(NEW_CLIENT)
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject(NEW_CLIENT)
    expect(created.body.id).toEqual(expect.any(String))
    expect(created.body.ownerId).toBeUndefined()

    const list = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Cookie', cookieHeader(jar))
    expect(list.body).toHaveLength(1)
    expect(list.body[0].id).toBe(created.body.id)
  })

  it('refuses a create without a session, and one without the CSRF header', async () => {
    // Guard order is CSRF before session (see AppModule), so the two failures
    // have to be provoked separately — and that order is the point of the test.
    const armed = await request(app.getHttpServer()).get('/api/health')
    const anonymousJar = parseCookies(
      armed.headers['set-cookie'] as string[] | undefined,
    )

    // Valid CSRF token, but nobody is signed in.
    const anonymous = await authed('post', '/api/clients', anonymousJar).send(
      NEW_CLIENT,
    )
    expect(anonymous.status).toBe(401)

    // A live session is not enough: a cross-site page can make the browser send
    // the cookie, but it cannot read it to produce the matching header.
    const { jar } = await account()
    const forged = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Cookie', cookieHeader(jar))
      .send(NEW_CLIENT)
    expect(forged.status).toBe(403)
  })

  it('validates the body against the shared contract', async () => {
    const { jar } = await account()

    const badEmail = await authed('post', '/api/clients', jar).send({
      ...NEW_CLIENT,
      email: 'not-an-email',
    })
    expect(badEmail.status).toBe(400)

    // Well-formed ISO 4217, but not a currency the product bills in.
    const badCurrency = await authed('post', '/api/clients', jar).send({
      ...NEW_CLIENT,
      currency: 'JPY',
    })
    expect(badCurrency.status).toBe(400)
  })

  it('applies only the fields a patch carries', async () => {
    const { jar, userId } = await account()
    const id = await addClient(userId, 'Before Co')

    const patched = await authed('patch', `/api/clients/${id}`, jar).send({
      company: 'After Co',
    })
    expect(patched.status).toBe(200)
    expect(patched.body).toMatchObject({
      company: 'After Co',
      name: 'Owner Test', // untouched
      currency: 'USD',
    })
  })

  it('rejects an empty patch rather than treating it as a no-op', async () => {
    const { jar, userId } = await account()
    const id = await addClient(userId, 'Empty Patch Co')

    const response = await authed('patch', `/api/clients/${id}`, jar).send({})
    expect(response.status).toBe(400)
  })

  it('deletes the caller’s own client', async () => {
    const { jar, userId } = await account()
    const id = await addClient(userId, 'Doomed Co')

    await authed('delete', `/api/clients/${id}`, jar).expect(204)

    const list = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Cookie', cookieHeader(jar))
    expect(list.body).toEqual([])
  })

  it('answers 404 — not 403 — for another account’s client, and leaves it alone', async () => {
    const alice = await account()
    const bob = await account()
    const bobsClient = await addClient(bob.userId, 'Bob Only')

    // 403 would confirm the id exists, which is what id-guessing is after.
    const patch = await authed(
      'patch',
      `/api/clients/${bobsClient}`,
      alice.jar,
    ).send({ company: 'Stolen Co' })
    expect(patch.status).toBe(404)

    const remove = await authed(
      'delete',
      `/api/clients/${bobsClient}`,
      alice.jar,
    )
    expect(remove.status).toBe(404)

    // Bob's row survived both attempts, unchanged.
    const survivor = await prisma.client.findUnique({
      where: { id: bobsClient },
    })
    expect(survivor?.company).toBe('Bob Only')
  })

  it('answers 404 for an id that does not exist at all', async () => {
    const { jar } = await account()
    const response = await authed('delete', '/api/clients/cl_nope', jar)
    expect(response.status).toBe(404)
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
