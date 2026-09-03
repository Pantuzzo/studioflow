import {
  createClientSchema,
  createProjectSchema,
  createProposalSchema,
  forgotPasswordSchema,
  loginSchema,
  signupSchema,
  updateClientSchema,
  updateProjectSchema,
  updateProposalSchema,
  createTimeEntrySchema,
  startTimerSchema,
  updateTimeEntrySchema,
  generateInvoiceSchema,
  updateInvoiceSchema,
  type Client,
  type InvoiceLine,
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

const notFound = (
  what: 'Client' | 'Project' | 'Proposal' | 'Time entry' | 'Invoice' = 'Client',
) => HttpResponse.json({ message: `${what} not found` }, { status: 404 })

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

  http.post('/api/clients', async ({ request }) => {
    if (!db.signedInUser) return unauthorized()
    const parsed = createClientSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()

    // Identity and creation time are the server's to assign, here as well.
    const client: Client = {
      ...parsed.data,
      id: db.nextId('cl'),
      createdAt: new Date().toISOString(),
    }
    return HttpResponse.json(db.insertClient(client), { status: 201 })
  }),

  http.patch('/api/clients/:id', async ({ params, request }) => {
    if (!db.signedInUser) return unauthorized()
    const parsed = updateClientSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()

    const updated = db.updateClient(String(params.id), parsed.data)
    // 404 rather than 403 for an unknown id, exactly as the API answers.
    return updated ? HttpResponse.json(updated) : notFound()
  }),

  http.delete('/api/clients/:id', ({ params }) => {
    if (!db.signedInUser) return unauthorized()
    return db.deleteClient(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : notFound()
  }),

  http.get('/api/projects', () => {
    if (!db.signedInUser) return unauthorized()
    return HttpResponse.json(db.projects)
  }),

  http.post('/api/projects', async ({ request }) => {
    if (!db.signedInUser) return unauthorized()
    const parsed = createProjectSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()
    // The API checks the client belongs to the caller before trusting the id.
    if (!db.findClient(parsed.data.clientId)) return notFound()

    const created = db.insertProject({
      ...parsed.data,
      // Absent means not billable yet, which is the column's default.
      hourlyRateCents: parsed.data.hourlyRateCents ?? 0,
      id: db.nextId('pr'),
      createdAt: new Date().toISOString(),
    })
    return created ? HttpResponse.json(created, { status: 201 }) : notFound()
  }),

  http.patch('/api/projects/:id', async ({ params, request }) => {
    if (!db.signedInUser) return unauthorized()
    const parsed = updateProjectSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()
    if (parsed.data.clientId && !db.findClient(parsed.data.clientId)) {
      return notFound()
    }

    const updated = db.updateProject(String(params.id), parsed.data)
    return updated ? HttpResponse.json(updated) : notFound('Project')
  }),

  http.delete('/api/projects/:id', ({ params }) => {
    if (!db.signedInUser) return unauthorized()
    return db.deleteProject(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : notFound('Project')
  }),

  // The index carries summaries; the document only travels for one proposal.
  http.get('/api/proposals', () => {
    if (!db.signedInUser) return unauthorized()
    return HttpResponse.json(db.proposals)
  }),

  http.get('/api/proposals/:id', ({ params }) => {
    if (!db.signedInUser) return unauthorized()
    const found = db.findProposal(String(params.id))
    return found ? HttpResponse.json(found) : notFound('Proposal')
  }),

  http.post('/api/proposals', async ({ request }) => {
    if (!db.signedInUser) return unauthorized()
    const parsed = createProposalSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()
    if (!db.findClient(parsed.data.clientId)) return notFound()

    const now = new Date().toISOString()
    const created = db.insertProposal({
      id: db.nextId('pp'),
      title: parsed.data.title,
      status: 'draft',
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId ?? null,
      blocks: [],
      createdAt: now,
      updatedAt: now,
    })
    return created ? HttpResponse.json(created, { status: 201 }) : notFound()
  }),

  http.patch('/api/proposals/:id', async ({ params, request }) => {
    if (!db.signedInUser) return unauthorized()
    // Autosave lands here, and the document is validated by the very schema the
    // editor's reducer is typed from.
    const parsed = updateProposalSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()
    if (parsed.data.clientId && !db.findClient(parsed.data.clientId)) {
      return notFound()
    }

    const updated = db.updateProposal(String(params.id), parsed.data)
    return updated ? HttpResponse.json(updated) : notFound('Proposal')
  }),

  http.delete('/api/proposals/:id', ({ params }) => {
    if (!db.signedInUser) return unauthorized()
    return db.deleteProposal(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : notFound('Proposal')
  }),

  http.get('/api/time-entries', () => {
    if (!db.signedInUser) return unauthorized()
    return HttpResponse.json(db.timeEntries)
  }),

  // Declared before any ":id" route, so "running" is never read as an id.
  http.get('/api/time-entries/running', () => {
    if (!db.signedInUser) return unauthorized()
    const running = db.runningTimeEntry()
    return HttpResponse.json(running ?? {})
  }),

  http.post('/api/time-entries/start', async ({ request }) => {
    if (!db.signedInUser) return unauthorized()
    const parsed = startTimerSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()
    if (!db.projects.some((p) => p.id === parsed.data.projectId)) {
      return notFound('Project')
    }
    // One timer at a time, exactly as the API enforces it.
    if (db.runningTimeEntry()) {
      return HttpResponse.json(
        { message: 'A timer is already running' },
        { status: 409 },
      )
    }

    // The server owns the clock here, so the mock does too.
    const now = new Date().toISOString()
    const created = db.insertTimeEntry({
      id: db.nextId('te'),
      projectId: parsed.data.projectId,
      description: parsed.data.description,
      startedAt: now,
      endedAt: null,
      createdAt: now,
    })
    return created
      ? HttpResponse.json(created, { status: 201 })
      : notFound('Project')
  }),

  http.post('/api/time-entries/:id/stop', ({ params }) => {
    if (!db.signedInUser) return unauthorized()
    const existing = db.findTimeEntry(String(params.id))
    if (!existing) return notFound('Time entry')
    if (existing.endedAt) {
      return HttpResponse.json(
        { message: 'That entry has already been stopped' },
        { status: 409 },
      )
    }
    const stopped = db.updateTimeEntry(String(params.id), {
      endedAt: new Date().toISOString(),
    })
    return stopped ? HttpResponse.json(stopped) : notFound('Time entry')
  }),

  http.post('/api/time-entries', async ({ request }) => {
    if (!db.signedInUser) return unauthorized()
    const parsed = createTimeEntrySchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()
    if (!db.projects.some((p) => p.id === parsed.data.projectId)) {
      return notFound('Project')
    }

    const created = db.insertTimeEntry({
      id: db.nextId('te'),
      projectId: parsed.data.projectId,
      description: parsed.data.description,
      startedAt: parsed.data.startedAt,
      endedAt: parsed.data.endedAt,
      createdAt: new Date().toISOString(),
    })
    return created
      ? HttpResponse.json(created, { status: 201 })
      : notFound('Project')
  }),

  http.patch('/api/time-entries/:id', async ({ params, request }) => {
    if (!db.signedInUser) return unauthorized()
    const parsed = updateTimeEntrySchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()

    const updated = db.updateTimeEntry(String(params.id), parsed.data)
    return updated ? HttpResponse.json(updated) : notFound('Time entry')
  }),

  http.delete('/api/time-entries/:id', ({ params }) => {
    if (!db.signedInUser) return unauthorized()
    return db.deleteTimeEntry(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : notFound('Time entry')
  }),

  http.get('/api/invoices', () => {
    if (!db.signedInUser) return unauthorized()
    return HttpResponse.json(db.invoices)
  }),

  http.get('/api/invoices/:id', ({ params }) => {
    if (!db.signedInUser) return unauthorized()
    const found = db.findInvoice(String(params.id))
    return found ? HttpResponse.json(found) : notFound('Invoice')
  }),

  http.post('/api/invoices/generate', async ({ request }) => {
    if (!db.signedInUser) return unauthorized()
    const parsed = generateInvoiceSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()

    const client = db.findClient(parsed.data.clientId)
    if (!client) return notFound()

    const entries = db.billableEntries(
      client.id,
      parsed.data.from,
      parsed.data.to,
    )
    if (entries.length === 0) {
      return HttpResponse.json(
        { message: 'No unbilled time in that period' },
        { status: 409 },
      )
    }

    // One line per project, priced at the project's rate, exactly as the API
    // does it. The names are copied in rather than referenced.
    const seconds = new Map<string, number>()
    for (const entry of entries) {
      const elapsed = Math.max(
        0,
        Math.floor(
          (new Date(entry.endedAt as string).getTime() -
            new Date(entry.startedAt).getTime()) /
            1000,
        ),
      )
      seconds.set(
        entry.projectId,
        (seconds.get(entry.projectId) ?? 0) + elapsed,
      )
    }

    const lines: InvoiceLine[] = [...seconds.entries()].flatMap(
      ([projectId, total]) => {
        const project = db.projects.find((p) => p.id === projectId)
        if (!project) return []
        return [
          {
            id: projectId,
            description: project.name,
            projectId,
            quantityHours: Math.round((total / 3600) * 100) / 100,
            unitPriceCents: project.hourlyRateCents,
          },
        ]
      },
    )

    const issuedAt = new Date()
    const created = db.insertInvoice({
      id: db.nextId('in'),
      status: 'draft',
      clientId: client.id,
      clientName: client.name,
      clientCompany: client.company,
      currency: client.currency,
      lines,
      issuedAt: issuedAt.toISOString(),
      dueAt: new Date(
        issuedAt.getTime() + (parsed.data.dueInDays ?? 14) * 86_400_000,
      ).toISOString(),
      paidAt: null,
      createdAt: issuedAt.toISOString(),
      updatedAt: issuedAt.toISOString(),
    })
    db.markEntriesBilled(
      entries.map((entry) => entry.id),
      created.id,
    )
    return HttpResponse.json(created, { status: 201 })
  }),

  http.patch('/api/invoices/:id', async ({ params, request }) => {
    if (!db.signedInUser) return unauthorized()
    const parsed = updateInvoiceSchema.safeParse(await request.json())
    if (!parsed.success) return badRequest()

    const updated = db.updateInvoice(String(params.id), parsed.data)
    return updated ? HttpResponse.json(updated) : notFound('Invoice')
  }),

  http.delete('/api/invoices/:id', ({ params }) => {
    if (!db.signedInUser) return unauthorized()
    return db.deleteInvoice(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : notFound('Invoice')
  }),

  http.post('/api/invoices/:id/checkout', ({ params }) => {
    if (!db.signedInUser) return unauthorized()
    const invoice = db.findInvoice(String(params.id))
    if (!invoice) return notFound('Invoice')
    if (invoice.status === 'paid' || invoice.status === 'void') {
      return HttpResponse.json(
        { message: `Cannot take payment for a ${invoice.status} invoice` },
        { status: 409 },
      )
    }
    // The mock stops at the redirect: what happens on Stripe's page, and the
    // webhook that follows, are not the browser's business at all.
    return HttpResponse.json(
      { url: `https://checkout.stripe.test/c/pay/${invoice.id}` },
      { status: 201 },
    )
  }),
]
