import 'dotenv/config'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { STRIPE_CLIENT } from '../src/payments/stripe.provider'
import { PrismaService } from '../src/prisma/prisma.service'

const CSRF_COOKIE = 'sf_csrf'
const CSRF_HEADER = 'x-csrf-token'
const WEBHOOK_SECRET = 'whsec_test_secret'

/**
 * Stripe is exercised for real where it can be: the signature verification
 * below is the SDK's own HMAC, computed over the same bytes the endpoint
 * receives. Only the network call that creates a session is replaced, because
 * there is nothing to learn from a live one.
 */
const stripe = new Stripe('sk_test_dummy')
let createdSessions: Stripe.Checkout.SessionCreateParams[] = []

stripe.checkout.sessions.create = (async (
  params: Stripe.Checkout.SessionCreateParams,
) => {
  createdSessions.push(params)
  return {
    id: `cs_test_${createdSessions.length}`,
    url: `https://checkout.stripe.test/c/pay/cs_test_${createdSessions.length}`,
  }
}) as never

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

describe('Payments (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  const password = 'correct-horse-battery'

  beforeAll(async () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_dummy'
    process.env['STRIPE_WEBHOOK_SECRET'] = WEBHOOK_SECRET

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STRIPE_CLIENT)
      .useValue(stripe)
      .compile()

    app = moduleRef.createNestApplication({ rawBody: true })
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

  beforeEach(() => {
    createdSessions = []
  })

  /** An account with an invoice ready to be paid. */
  async function account(): Promise<{
    jar: Record<string, string>
    userId: string
    invoiceId: string
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
      .send({ name: 'Payments E2E', email, password })
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
    await prisma.timeEntry.create({
      data: {
        projectId: project.id,
        ownerId: userId,
        startedAt: new Date('2026-08-10T09:00:00.000Z'),
        endedAt: new Date('2026-08-10T11:30:00.000Z'),
      },
    })

    const fullJar = {
      ...jar,
      ...parseCookies(signup.headers['set-cookie'] as string[] | undefined),
    }

    const invoice = await request(app.getHttpServer())
      .post('/api/invoices/generate')
      .set('Cookie', cookieHeader(fullJar))
      .set(CSRF_HEADER, fullJar[CSRF_COOKIE] ?? '')
      .send({
        clientId: client.id,
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-09-01T00:00:00.000Z',
      })
    expect(invoice.status).toBe(201)

    return { jar: fullJar, userId, invoiceId: invoice.body.id }
  }

  function authed(
    method: 'post' | 'patch',
    url: string,
    jar: Record<string, string>,
  ) {
    const agent = request(app.getHttpServer())
    return agent[method](url)
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
  }

  /** A signed delivery, exactly as Stripe would send it. */
  function deliver(event: unknown, secret = WEBHOOK_SECRET) {
    const payload = JSON.stringify(event)
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    })
    return request(app.getHttpServer())
      .post('/api/stripe/webhook')
      .set('stripe-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload)
  }

  function sessionEvent(
    type: string,
    invoiceId: string,
    over: Record<string, unknown> = {},
  ) {
    return {
      id: `evt_${randomUUID()}`,
      object: 'event',
      type,
      data: {
        object: {
          id: 'cs_test_1',
          object: 'checkout.session',
          metadata: { invoiceId },
          payment_status: 'paid',
          ...over,
        },
      },
    }
  }

  const statusOf = async (id: string) =>
    prisma.invoice.findUnique({ where: { id } })

  it('refuses to start a checkout without a session, and without CSRF', async () => {
    // Guard order is CSRF before session, so the two refusals are separate.
    const noCsrf = await request(app.getHttpServer()).post(
      '/api/invoices/whatever/checkout',
    )
    expect(noCsrf.status).toBe(403)

    const armed = await request(app.getHttpServer()).get('/api/health')
    const jar = parseCookies(
      armed.headers['set-cookie'] as string[] | undefined,
    )
    const anonymous = await request(app.getHttpServer())
      .post('/api/invoices/whatever/checkout')
      .set('Cookie', cookieHeader(jar))
      .set(CSRF_HEADER, jar[CSRF_COOKIE] ?? '')
    expect(anonymous.status).toBe(401)
  })

  it('lets Stripe past CSRF, because it carries a signature and no cookie', async () => {
    // The webhook is the one exempt route, and the exemption is what makes it
    // reachable at all: Stripe sends no cookie and cannot echo a CSRF token.
    const { invoiceId } = await account()
    await deliver(sessionEvent('checkout.session.completed', invoiceId)).expect(
      200,
    )
  })

  it('prices the checkout from the stored invoice, not from the request', async () => {
    const { jar, invoiceId } = await account()

    const response = await authed(
      'post',
      `/api/invoices/${invoiceId}/checkout`,
      jar,
    ).send({ amount: 1 })

    expect(response.status).toBe(201)
    expect(response.body.url).toMatch(/^https:\/\/checkout\.stripe\.test\//)

    const [params] = createdSessions
    const item = params?.line_items?.[0]
    // 2.5 hours at 100.00 in EUR, and the quantity is one because Stripe's
    // quantity is an integer while hours are not.
    expect(item?.quantity).toBe(1)
    expect(item?.price_data?.unit_amount).toBe(25_000)
    expect(item?.price_data?.currency).toBe('eur')
    expect(params?.metadata?.['invoiceId']).toBe(invoiceId)

    // The session id is stored so an event can be matched back to the invoice.
    expect((await statusOf(invoiceId))?.stripeSessionId).toBe('cs_test_1')
  })

  it('will not take payment twice for the same invoice', async () => {
    const { jar, invoiceId } = await account()
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'paid', paidAt: new Date() },
    })

    const response = await authed(
      'post',
      `/api/invoices/${invoiceId}/checkout`,
      jar,
    )
    expect(response.status).toBe(409)
  })

  it('will not take payment for a voided invoice', async () => {
    const { jar, invoiceId } = await account()
    await authed('patch', `/api/invoices/${invoiceId}`, jar)
      .send({ status: 'void' })
      .expect(200)

    const response = await authed(
      'post',
      `/api/invoices/${invoiceId}/checkout`,
      jar,
    )
    expect(response.status).toBe(409)
  })

  it('never lets a person mark an invoice paid', async () => {
    const { jar, invoiceId } = await account()

    // Only a signed webhook may make a claim about money.
    const response = await authed(
      'patch',
      `/api/invoices/${invoiceId}`,
      jar,
    ).send({ status: 'paid' })
    expect(response.status).toBe(400)
    expect((await statusOf(invoiceId))?.status).toBe('draft')
  })

  it('refuses a webhook with a missing or forged signature', async () => {
    const { invoiceId } = await account()
    const event = sessionEvent('checkout.session.completed', invoiceId)

    const unsigned = await request(app.getHttpServer())
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event))
    expect(unsigned.status).toBe(400)

    // Correctly formed, signed with the wrong secret.
    const forged = await deliver(event, 'whsec_not_the_secret')
    expect(forged.status).toBe(400)

    // And nothing happened to the invoice.
    expect((await statusOf(invoiceId))?.status).toBe('draft')
  })

  it('marks an invoice paid when the money actually arrived', async () => {
    const { invoiceId } = await account()

    const response = await deliver(
      sessionEvent('checkout.session.completed', invoiceId, {
        payment_status: 'paid',
      }),
    )
    expect(response.status).toBe(200)

    const invoice = await statusOf(invoiceId)
    expect(invoice?.status).toBe('paid')
    expect(invoice?.paidAt).not.toBeNull()
  })

  it('does not mark it paid when the checkout completed but the money has not', async () => {
    const { invoiceId } = await account()

    // A bank debit completes the session and settles days later. Treating this
    // as payment is the mistake the `processing` state exists to prevent.
    await deliver(
      sessionEvent('checkout.session.completed', invoiceId, {
        payment_status: 'unpaid',
      }),
    ).expect(200)

    const invoice = await statusOf(invoiceId)
    expect(invoice?.status).toBe('processing')
    expect(invoice?.paidAt).toBeNull()

    // And then it does arrive.
    await deliver(
      sessionEvent('checkout.session.async_payment_succeeded', invoiceId),
    ).expect(200)
    expect((await statusOf(invoiceId))?.status).toBe('paid')
  })

  it('puts the invoice back when a delayed payment fails', async () => {
    const { invoiceId } = await account()
    await deliver(
      sessionEvent('checkout.session.completed', invoiceId, {
        payment_status: 'unpaid',
      }),
    ).expect(200)

    await deliver(
      sessionEvent('checkout.session.async_payment_failed', invoiceId),
    ).expect(200)

    const invoice = await statusOf(invoiceId)
    expect(invoice?.status).toBe('sent')
    expect(invoice?.paidAt).toBeNull()
  })

  it('acts on a redelivered event exactly once', async () => {
    const { invoiceId } = await account()
    const event = sessionEvent('checkout.session.completed', invoiceId)

    await deliver(event).expect(200)
    const first = await statusOf(invoiceId)

    // Stripe retries, and someone replays it from the dashboard for good
    // measure. Both answer 200: a non-2xx would only make it retry again.
    await deliver(event).expect(200)
    await deliver(event).expect(200)

    const after = await statusOf(invoiceId)
    expect(after?.status).toBe('paid')
    expect(after?.paidAt?.toISOString()).toBe(first?.paidAt?.toISOString())

    const seen = await prisma.webhookEvent.count({ where: { id: event.id } })
    expect(seen).toBe(1)
  })

  it('never un-pays an invoice when events arrive out of order', async () => {
    const { invoiceId } = await account()
    await deliver(sessionEvent('checkout.session.completed', invoiceId)).expect(
      200,
    )
    expect((await statusOf(invoiceId))?.status).toBe('paid')

    // A session expiry that was queued before the payment landed.
    await deliver(sessionEvent('checkout.session.expired', invoiceId)).expect(
      200,
    )

    expect((await statusOf(invoiceId))?.status).toBe('paid')
  })

  it('ignores an event for an invoice that no longer exists', async () => {
    const response = await deliver(
      sessionEvent('checkout.session.completed', 'in_does_not_exist'),
    )
    // Answering 200 stops Stripe retrying something that can never succeed.
    expect(response.status).toBe(200)
  })

  it('accepts an event type it has no handler for', async () => {
    const response = await deliver({
      id: `evt_${randomUUID()}`,
      object: 'event',
      type: 'payment_intent.created',
      data: { object: { id: 'pi_1' } },
    })
    expect(response.status).toBe(200)
  })
})
