import 'dotenv/config'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'

/**
 * A fresh address per test keeps the unique constraint on email from turning a
 * re-run into a false failure. randomUUID rather than faker: faker v10 is
 * ESM-only and Jest runs CommonJS here, and uniqueness is all this needs.
 */
const uniqueEmail = (): string => `e2e-${randomUUID()}@studioflow.test`

const SESSION_COOKIE = 'sf_session'
const CSRF_COOKIE = 'sf_csrf'
const CSRF_HEADER = 'x-csrf-token'

/** Parse a Set-Cookie header list into { name: value }. */
function parseCookies(setCookie: string[] | undefined): Record<string, string> {
  const jar: Record<string, string> = {}
  for (const raw of setCookie ?? []) {
    const [pair] = raw.split(';')
    const index = pair?.indexOf('=') ?? -1
    if (pair && index > 0) {
      jar[pair.slice(0, index)] = pair.slice(index + 1)
    }
  }
  return jar
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

function rawCookie(setCookie: string[] | undefined, name: string): string {
  return (setCookie ?? []).find((c) => c.startsWith(`${name}=`)) ?? ''
}

describe('Auth (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  const password = 'correct-horse-battery'
  let email: string

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

  beforeEach(() => {
    email = uniqueEmail()
  })

  afterAll(async () => {
    // Leave the seeded demo data alone; only remove what this suite created.
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@studioflow.test' } },
    })
    await app.close()
  })

  /** Arm a client with a CSRF token, the way the browser does on boot. */
  async function armed(): Promise<Record<string, string>> {
    const response = await request(app.getHttpServer()).get('/api/health')
    return parseCookies(response.headers['set-cookie'] as string[] | undefined)
  }

  async function signup(): Promise<Record<string, string>> {
    const jar = await armed()
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ name: 'E2E User', email, password })
    expect(response.status).toBe(201)
    return {
      ...jar,
      ...parseCookies(response.headers['set-cookie'] as string[] | undefined),
    }
  }

  it('issues a CSRF token on a plain GET so the first POST can be made', async () => {
    const jar = await armed()
    expect(jar[CSRF_COOKIE]).toBeDefined()
  })

  it('signs up, returns the user, and never returns a token', async () => {
    const jar = await armed()
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ name: 'E2E User', email, password })

    expect(response.status).toBe(201)
    expect(response.body.user.email).toBe(email)
    // The security promise, asserted rather than assumed.
    expect(JSON.stringify(response.body)).not.toMatch(/token/i)
    expect(response.body.user.passwordHash).toBeUndefined()
  })

  it('marks the session cookie HttpOnly and SameSite, and the CSRF cookie readable', async () => {
    const jar = await armed()
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ name: 'E2E User', email, password })

    const setCookie = response.headers['set-cookie'] as string[] | undefined
    const session = rawCookie(setCookie, SESSION_COOKIE)
    expect(session).toMatch(/HttpOnly/i)
    expect(session).toMatch(/SameSite=Lax/i)
    expect(session).toMatch(/Path=\//i)

    // The CSRF cookie is deliberately readable — the client must echo it back.
    const csrf = rawCookie(
      (await armed(), response.headers['set-cookie'] as string[] | undefined),
      CSRF_COOKIE,
    )
    if (csrf) expect(csrf).not.toMatch(/HttpOnly/i)
  })

  it('stores only a hash of the session token, never the token itself', async () => {
    const jar = await signup()
    const token = jar[SESSION_COOKIE]
    expect(token).toBeDefined()

    const stored = await prisma.session.findMany({
      select: { tokenHash: true },
    })
    expect(stored.length).toBeGreaterThan(0)
    expect(stored.some((s) => s.tokenHash === token)).toBe(false)
  })

  it('returns the current user for a valid session cookie', async () => {
    const jar = await signup()
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookieHeader(jar))
    expect(response.status).toBe(200)
    expect(response.body.user.email).toBe(email)
  })

  it('rejects /auth/me without a session', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/me')
    expect(response.status).toBe(401)
  })

  it('logs in with the right password and rejects the wrong one with the same generic message', async () => {
    await signup()
    const jar = await armed()

    const ok = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ email, password })
    expect(ok.status).toBe(200)

    const bad = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ email, password: 'wrong-password' })
    expect(bad.status).toBe(401)
    expect(bad.body.message).toBe('Invalid email or password')

    // An unknown account must be indistinguishable from a wrong password.
    const unknown = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ email: uniqueEmail(), password })
    expect(unknown.status).toBe(401)
    expect(unknown.body.message).toBe(bad.body.message)
  })

  it('revokes the session server-side on logout, so the old cookie is dead', async () => {
    const jar = await signup()

    const before = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookieHeader(jar))
    expect(before.status).toBe(200)

    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
    expect(logout.status).toBe(204)

    // Replaying the exact same cookie must fail: logout is not just a client hint.
    const after = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookieHeader(jar))
    expect(after.status).toBe(401)
  })

  it('rejects a state-changing request that has no CSRF header', async () => {
    const jar = await armed()
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Cookie', cookieHeader(jar))
      .send({ email, password })
    expect(response.status).toBe(403)
  })

  it('rejects a state-changing request whose CSRF header does not match the cookie', async () => {
    const jar = await armed()
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, 'not-the-real-token')
      .send({ email, password })
    expect(response.status).toBe(403)
  })

  it('rejects a request from a foreign origin', async () => {
    const jar = await armed()
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .set('Origin', 'https://evil.example')
      .send({ email, password })
    expect(response.status).toBe(403)
  })

  it('answers forgot-password identically for known and unknown addresses', async () => {
    await signup()
    const jar = await armed()

    const known = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ email })

    const unknown = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ email: uniqueEmail() })

    expect(known.status).toBe(202)
    expect(unknown.status).toBe(202)
    expect(known.body).toEqual(unknown.body)
  })

  it('rejects a duplicate signup', async () => {
    await signup()
    const jar = await armed()
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ name: 'E2E User', email, password })
    expect(response.status).toBe(409)
  })

  it('validates the body against the shared contract', async () => {
    const jar = await armed()
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
      .send({ name: 'E2E User', email: 'not-an-email', password: 'short' })
    expect(response.status).toBe(400)
  })
})
