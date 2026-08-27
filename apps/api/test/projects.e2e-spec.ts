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

describe('Projects (e2e)', () => {
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

  /** An account with one client, which is what a project needs to exist. */
  async function account(): Promise<{
    jar: Record<string, string>
    userId: string
    clientId: string
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
      .send({ name: 'Projects E2E', email, password })
    expect(signup.status).toBe(201)

    const client = await prisma.client.create({
      data: {
        name: 'Owner Test',
        company: 'Owner Co',
        email: `client-${randomUUID()}@example.test`,
        currency: 'USD',
        ownerId: signup.body.user.id,
      },
    })

    return {
      jar: {
        ...jar,
        ...parseCookies(signup.headers['set-cookie'] as string[] | undefined),
      },
      userId: signup.body.user.id,
      clientId: client.id,
    }
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

  function list(jar: Record<string, string>) {
    return request(app.getHttpServer())
      .get('/api/projects')
      .set('Cookie', cookieHeader(jar))
  }

  it('refuses to list projects without a session', async () => {
    const response = await request(app.getHttpServer()).get('/api/projects')
    expect(response.status).toBe(401)
  })

  it('creates a project and returns it with the client’s name resolved', async () => {
    const { jar, clientId } = await account()

    const created = await authed('post', '/api/projects', jar).send({
      name: 'Website relaunch',
      clientId,
      status: 'active',
    })

    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      name: 'Website relaunch',
      status: 'active',
      clientId,
      // Denormalised on read: the row is displayed with it, so it travels.
      clientName: 'Owner Test',
    })
    // ownerId is internal and must not leak, here as anywhere else.
    expect(created.body.ownerId).toBeUndefined()
  })

  it('never lets a project be attached to another account’s client', async () => {
    const alice = await account()
    const bob = await account()

    // Alice knows Bob's client id and tries to hang her project off it.
    const attempt = await authed('post', '/api/projects', alice.jar).send({
      name: 'Trespassing',
      clientId: bob.clientId,
      status: 'active',
    })

    // 404, not 403: a 403 would confirm Bob's client exists.
    expect(attempt.status).toBe(404)
    const bobsProjects = await prisma.project.count({
      where: { clientId: bob.clientId },
    })
    expect(bobsProjects).toBe(0)
  })

  it('applies the same check when a patch moves the project', async () => {
    const alice = await account()
    const bob = await account()

    const created = await authed('post', '/api/projects', alice.jar).send({
      name: 'Legitimate',
      clientId: alice.clientId,
      status: 'active',
    })
    expect(created.status).toBe(201)

    const moved = await authed(
      'patch',
      `/api/projects/${created.body.id}`,
      alice.jar,
    ).send({ clientId: bob.clientId })

    expect(moved.status).toBe(404)
    const unchanged = await prisma.project.findUnique({
      where: { id: created.body.id },
    })
    expect(unchanged?.clientId).toBe(alice.clientId)
  })

  it('never returns another account’s projects', async () => {
    const alice = await account()
    const bob = await account()
    await authed('post', '/api/projects', alice.jar).send({
      name: 'Alice Only',
      clientId: alice.clientId,
      status: 'active',
    })
    await authed('post', '/api/projects', bob.jar).send({
      name: 'Bob Only',
      clientId: bob.clientId,
      status: 'active',
    })

    const response = await list(alice.jar)
    const names = response.body.map((p: { name: string }) => p.name)
    expect(names).toContain('Alice Only')
    expect(names).not.toContain('Bob Only')
  })

  it('patches only what it is sent, and validates the status', async () => {
    const { jar, clientId } = await account()
    const created = await authed('post', '/api/projects', jar).send({
      name: 'Before',
      clientId,
      status: 'active',
    })

    const patched = await authed(
      'patch',
      `/api/projects/${created.body.id}`,
      jar,
    ).send({ status: 'completed' })
    expect(patched.status).toBe(200)
    expect(patched.body).toMatchObject({ name: 'Before', status: 'completed' })

    const bogus = await authed(
      'patch',
      `/api/projects/${created.body.id}`,
      jar,
    ).send({ status: 'archived' })
    expect(bogus.status).toBe(400)

    const empty = await authed(
      'patch',
      `/api/projects/${created.body.id}`,
      jar,
    ).send({})
    expect(empty.status).toBe(400)
  })

  it('deletes its own project and 404s on someone else’s', async () => {
    const alice = await account()
    const bob = await account()

    const mine = await authed('post', '/api/projects', alice.jar).send({
      name: 'Doomed',
      clientId: alice.clientId,
      status: 'active',
    })
    const theirs = await authed('post', '/api/projects', bob.jar).send({
      name: 'Not yours',
      clientId: bob.clientId,
      status: 'active',
    })

    await authed('delete', `/api/projects/${mine.body.id}`, alice.jar).expect(
      204,
    )
    const stranger = await authed(
      'delete',
      `/api/projects/${theirs.body.id}`,
      alice.jar,
    )
    expect(stranger.status).toBe(404)

    const survivor = await prisma.project.findUnique({
      where: { id: theirs.body.id },
    })
    expect(survivor).not.toBeNull()
  })

  it('takes projects with the client when the client is deleted', async () => {
    const { jar, clientId } = await account()
    await authed('post', '/api/projects', jar).send({
      name: 'Cascade me',
      clientId,
      status: 'active',
    })

    await authed('delete', `/api/clients/${clientId}`, jar).expect(204)

    const remaining = await list(jar)
    expect(remaining.body).toEqual([])
  })
})
