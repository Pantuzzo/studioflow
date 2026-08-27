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

describe('Time entries (e2e)', () => {
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
      .send({ name: 'Timer E2E', email, password })
    expect(signup.status).toBe(201)
    const userId = signup.body.user.id

    const client = await prisma.client.create({
      data: {
        name: 'Ada Owner',
        company: 'Owner Co',
        email: `client-${randomUUID()}@example.test`,
        currency: 'USD',
        ownerId: userId,
      },
    })
    const project = await prisma.project.create({
      data: { name: 'Relaunch', clientId: client.id, ownerId: userId },
    })

    return {
      jar: {
        ...jar,
        ...parseCookies(signup.headers['set-cookie'] as string[] | undefined),
      },
      userId,
      projectId: project.id,
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

  function get(url: string, jar: Record<string, string>) {
    return request(app.getHttpServer())
      .get(url)
      .set('Cookie', cookieHeader(jar))
  }

  it('refuses to list entries without a session', async () => {
    const response = await request(app.getHttpServer()).get('/api/time-entries')
    expect(response.status).toBe(401)
  })

  it('starts a timer on the server clock, ignoring anything the caller sends', async () => {
    const { jar, projectId } = await account()
    const before = Date.now()

    const started = await authed('post', '/api/time-entries/start', jar).send({
      projectId,
      description: 'Wireframes',
      // A browser with a wrong clock must not be able to bill an extra hour.
      startedAt: '1999-01-01T00:00:00.000Z',
    })

    expect(started.status).toBe(201)
    expect(started.body).toMatchObject({
      projectName: 'Relaunch',
      clientName: 'Ada Owner',
      description: 'Wireframes',
      endedAt: null,
    })
    const startedAt = new Date(started.body.startedAt).getTime()
    expect(startedAt).toBeGreaterThanOrEqual(before - 1000)
    expect(startedAt).toBeLessThanOrEqual(Date.now() + 1000)
  })

  it('allows only one running timer per account', async () => {
    const { jar, projectId } = await account()

    await authed('post', '/api/time-entries/start', jar)
      .send({ projectId })
      .expect(201)

    const second = await authed('post', '/api/time-entries/start', jar).send({
      projectId,
    })
    expect(second.status).toBe(409)

    const running = await get('/api/time-entries/running', jar)
    expect(running.body.id).toEqual(expect.any(String))
  })

  it('stops a timer, and refuses to stop it twice', async () => {
    const { jar, projectId } = await account()
    const started = await authed('post', '/api/time-entries/start', jar).send({
      projectId,
    })

    const stopped = await authed(
      'post',
      `/api/time-entries/${started.body.id}/stop`,
      jar,
    )
    expect(stopped.status).toBe(200)
    expect(stopped.body.endedAt).toEqual(expect.any(String))
    expect(new Date(stopped.body.endedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(stopped.body.startedAt).getTime(),
    )

    const again = await authed(
      'post',
      `/api/time-entries/${started.body.id}/stop`,
      jar,
    )
    expect(again.status).toBe(409)

    // With nothing running, the running endpoint answers with nothing.
    const running = await get('/api/time-entries/running', jar)
    expect(running.status).toBe(200)
    expect(running.body).toEqual({})
  })

  it('accepts a completed entry typed in by hand', async () => {
    const { jar, projectId } = await account()
    const entry = await authed('post', '/api/time-entries', jar).send({
      projectId,
      description: 'Offline work',
      startedAt: '2026-08-17T09:00:00.000Z',
      endedAt: '2026-08-17T10:30:00.000Z',
    })
    expect(entry.status).toBe(201)
    // No duration field crosses the wire; it is derived from the timestamps.
    expect(entry.body.durationSeconds).toBeUndefined()
  })

  it('rejects an inverted interval, and one longer than a day', async () => {
    const { jar, projectId } = await account()

    const inverted = await authed('post', '/api/time-entries', jar).send({
      projectId,
      startedAt: '2026-08-17T10:00:00.000Z',
      endedAt: '2026-08-17T09:00:00.000Z',
    })
    expect(inverted.status).toBe(400)

    const tooLong = await authed('post', '/api/time-entries', jar).send({
      projectId,
      startedAt: '2026-08-17T09:00:00.000Z',
      endedAt: '2026-08-19T09:00:00.000Z',
    })
    expect(tooLong.status).toBe(400)
  })

  it('refuses a patch that would invert an interval by moving one end', async () => {
    const { jar, projectId } = await account()
    const entry = await authed('post', '/api/time-entries', jar).send({
      projectId,
      startedAt: '2026-08-17T09:00:00.000Z',
      endedAt: '2026-08-17T10:00:00.000Z',
    })

    // The schema cannot see this on its own: only startedAt is in the body.
    const moved = await authed(
      'patch',
      `/api/time-entries/${entry.body.id}`,
      jar,
    ).send({ startedAt: '2026-08-17T11:00:00.000Z' })
    expect(moved.status).toBe(409)
  })

  it('never times against a project belonging to someone else', async () => {
    const alice = await account()
    const bob = await account()

    const attempt = await authed(
      'post',
      '/api/time-entries/start',
      alice.jar,
    ).send({ projectId: bob.projectId })
    // 404 rather than 403: a 403 would confirm that project exists.
    expect(attempt.status).toBe(404)
  })

  it('never exposes an entry belonging to someone else, by any verb', async () => {
    const alice = await account()
    const bob = await account()

    const bobs = await authed('post', '/api/time-entries/start', bob.jar).send({
      projectId: bob.projectId,
    })

    const stopped = await authed(
      'post',
      `/api/time-entries/${bobs.body.id}/stop`,
      alice.jar,
    )
    expect(stopped.status).toBe(404)

    const patched = await authed(
      'patch',
      `/api/time-entries/${bobs.body.id}`,
      alice.jar,
    ).send({ description: 'stolen' })
    expect(patched.status).toBe(404)

    const removed = await authed(
      'delete',
      `/api/time-entries/${bobs.body.id}`,
      alice.jar,
    )
    expect(removed.status).toBe(404)

    const list = await get('/api/time-entries', alice.jar)
    expect(list.body).toEqual([])

    const survivor = await prisma.timeEntry.findUnique({
      where: { id: bobs.body.id },
    })
    expect(survivor).not.toBeNull()
  })

  it('takes the entries with the project when the project is deleted', async () => {
    const { jar, projectId } = await account()
    await authed('post', '/api/time-entries', jar).send({
      projectId,
      startedAt: '2026-08-17T09:00:00.000Z',
      endedAt: '2026-08-17T10:00:00.000Z',
    })

    await authed('delete', `/api/projects/${projectId}`, jar).expect(204)

    const list = await get('/api/time-entries', jar)
    expect(list.body).toEqual([])
  })

  it('deletes its own entry', async () => {
    const { jar, projectId } = await account()
    const entry = await authed('post', '/api/time-entries', jar).send({
      projectId,
      startedAt: '2026-08-17T09:00:00.000Z',
      endedAt: '2026-08-17T10:00:00.000Z',
    })

    await authed('delete', `/api/time-entries/${entry.body.id}`, jar).expect(
      204,
    )
    const list = await get('/api/time-entries', jar)
    expect(list.body).toEqual([])
  })
})
