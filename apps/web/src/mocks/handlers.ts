import {
  forgotPasswordSchema,
  loginSchema,
  signupSchema,
} from '@studioflow/contracts'
import { http, HttpResponse } from 'msw'
import { db } from '@/mocks/db'

/**
 * The REST contract the frontend codes against — a mirror of the NestJS API,
 * validated with the very same Zod schemas so the mock cannot drift from the
 * real thing in silence.
 *
 * Path-only patterns match by pathname on any origin, so these work in the
 * browser worker and in the node test server alike.
 */

const unauthorized = () =>
  HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })

const badRequest = () =>
  HttpResponse.json({ message: 'Validation failed' }, { status: 400 })

export const handlers = [
  http.get('/api/auth/me', () => {
    const user = db.signedInUser
    return user ? HttpResponse.json({ user }) : unauthorized()
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const parsed = loginSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()

    const user = db.findUserByEmail(parsed.data.email)
    if (!user || user.password !== parsed.data.password) {
      // One generic message, exactly as the API answers — no enumeration.
      return HttpResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 },
      )
    }
    db.signIn(user.id)
    return HttpResponse.json({ user: db.signedInUser })
  }),

  http.post('/api/auth/signup', async ({ request }) => {
    const parsed = signupSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()

    if (db.findUserByEmail(parsed.data.email)) {
      return HttpResponse.json(
        { message: 'That email is already registered' },
        { status: 409 },
      )
    }
    const user = db.createUser(parsed.data)
    db.signIn(user.id)
    return HttpResponse.json({ user }, { status: 201 })
  }),

  http.post('/api/auth/logout', () => {
    db.signOut()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/auth/forgot-password', async ({ request }) => {
    const parsed = forgotPasswordSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()
    // Always accepted, known address or not.
    return HttpResponse.json(
      { message: 'If that email is registered, a reset link is on its way.' },
      { status: 202 },
    )
  }),

  http.get('/api/clients', () => {
    if (!db.signedInUser) return unauthorized()
    return HttpResponse.json(db.clients)
  }),
]
