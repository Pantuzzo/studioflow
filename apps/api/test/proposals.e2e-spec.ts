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

const DOCUMENT = [
  { id: 'b1', type: 'heading', text: 'Scope', level: 2 },
  {
    id: 'b2',
    type: 'pricing',
    items: [
      { id: 'i1', description: 'Design', quantity: 12.5, unitPriceCents: 9500 },
    ],
  },
]

describe('Proposals (e2e)', () => {
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

  /** An account with a client and a project to hang proposals off. */
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
      .send({ name: 'Proposals E2E', email, password })
    expect(signup.status).toBe(201)
    const userId = signup.body.user.id

    const client = await prisma.client.create({
      data: {
        name: 'Owner Test',
        company: 'Owner Co',
        email: `client-${randomUUID()}@example.test`,
        currency: 'EUR',
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
      clientId: client.id,
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

  it('refuses to list proposals without a session', async () => {
    const response = await request(app.getHttpServer()).get('/api/proposals')
    expect(response.status).toBe(401)
  })

  it('creates an empty draft carrying the client’s currency', async () => {
    const { jar, clientId } = await account()

    const created = await authed('post', '/api/proposals', jar).send({
      title: 'Website relaunch',
      clientId,
    })

    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      title: 'Website relaunch',
      status: 'draft',
      clientName: 'Owner Test',
      // Carried so the pricing block can format totals without another request.
      clientCurrency: 'EUR',
      projectId: null,
      projectName: null,
      blocks: [],
    })
  })

  it('stores and returns a document, and keeps it out of the index', async () => {
    const { jar, clientId } = await account()
    const created = await authed('post', '/api/proposals', jar).send({
      title: 'With blocks',
      clientId,
    })

    const saved = await authed(
      'patch',
      `/api/proposals/${created.body.id}`,
      jar,
    ).send({ blocks: DOCUMENT })
    expect(saved.status).toBe(200)
    expect(saved.body.blocks).toEqual(DOCUMENT)

    // Round-trips through jsonb unchanged.
    const fetched = await get(`/api/proposals/${created.body.id}`, jar)
    expect(fetched.body.blocks).toEqual(DOCUMENT)

    // The list carries a count instead of the document itself.
    const index = await get('/api/proposals', jar)
    expect(index.body[0]).toMatchObject({ blockCount: 2 })
    expect(index.body[0].blocks).toBeUndefined()
  })

  it('rejects a document the shared schema would not accept', async () => {
    const { jar, clientId } = await account()
    const created = await authed('post', '/api/proposals', jar).send({
      title: 'Bad blocks',
      clientId,
    })

    const badType = await authed(
      'patch',
      `/api/proposals/${created.body.id}`,
      jar,
    ).send({ blocks: [{ id: 'b1', type: 'image', url: 'http://x' }] })
    expect(badType.status).toBe(400)

    // Fractional cents are not money.
    const badMoney = await authed(
      'patch',
      `/api/proposals/${created.body.id}`,
      jar,
    ).send({
      blocks: [
        {
          id: 'b1',
          type: 'pricing',
          items: [
            { id: 'i1', description: 'x', quantity: 1, unitPriceCents: 9.5 },
          ],
        },
      ],
    })
    expect(badMoney.status).toBe(400)

    // The stored document is untouched by either attempt.
    const fetched = await get(`/api/proposals/${created.body.id}`, jar)
    expect(fetched.body.blocks).toEqual([])
  })

  it('will not accept a status, because nothing implements sending yet', async () => {
    const { jar, clientId } = await account()
    const created = await authed('post', '/api/proposals', jar).send({
      title: 'Still a draft',
      clientId,
    })

    const patched = await authed(
      'patch',
      `/api/proposals/${created.body.id}`,
      jar,
    ).send({ title: 'Renamed', status: 'accepted' })

    expect(patched.status).toBe(200)
    expect(patched.body).toMatchObject({ title: 'Renamed', status: 'draft' })
  })

  it('links a project, and refuses one belonging to another account', async () => {
    const alice = await account()
    const bob = await account()

    const linked = await authed('post', '/api/proposals', alice.jar).send({
      title: 'Linked',
      clientId: alice.clientId,
      projectId: alice.projectId,
    })
    expect(linked.status).toBe(201)
    expect(linked.body.projectName).toBe('Relaunch')

    const trespass = await authed('post', '/api/proposals', alice.jar).send({
      title: 'Trespassing',
      clientId: alice.clientId,
      projectId: bob.projectId,
    })
    // 404 rather than 403: a 403 would confirm Bob's project exists.
    expect(trespass.status).toBe(404)
  })

  it('keeps the proposal when its project is deleted, and forgets the link', async () => {
    const { jar, clientId, projectId } = await account()
    const created = await authed('post', '/api/proposals', jar).send({
      title: 'Outlives its project',
      clientId,
      projectId,
    })

    await authed('delete', `/api/projects/${projectId}`, jar).expect(204)

    const fetched = await get(`/api/proposals/${created.body.id}`, jar)
    expect(fetched.status).toBe(200)
    expect(fetched.body.projectId).toBeNull()
  })

  it('never exposes another account’s proposal, by any verb', async () => {
    const alice = await account()
    const bob = await account()

    const bobs = await authed('post', '/api/proposals', bob.jar).send({
      title: 'Bob Only',
      clientId: bob.clientId,
    })

    const read = await get(`/api/proposals/${bobs.body.id}`, alice.jar)
    expect(read.status).toBe(404)

    const written = await authed(
      'patch',
      `/api/proposals/${bobs.body.id}`,
      alice.jar,
    ).send({ title: 'Stolen' })
    expect(written.status).toBe(404)

    const removed = await authed(
      'delete',
      `/api/proposals/${bobs.body.id}`,
      alice.jar,
    )
    expect(removed.status).toBe(404)

    const survivor = await prisma.proposal.findUnique({
      where: { id: bobs.body.id },
    })
    expect(survivor?.title).toBe('Bob Only')

    const index = await get('/api/proposals', alice.jar)
    expect(index.body.map((p: { title: string }) => p.title)).not.toContain(
      'Bob Only',
    )
  })

  it('deletes its own proposal', async () => {
    const { jar, clientId } = await account()
    const created = await authed('post', '/api/proposals', jar).send({
      title: 'Doomed',
      clientId,
    })

    await authed('delete', `/api/proposals/${created.body.id}`, jar).expect(204)
    const gone = await get(`/api/proposals/${created.body.id}`, jar)
    expect(gone.status).toBe(404)
  })
})
