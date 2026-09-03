import type {
  Client,
  Invoice,
  InvoiceSummary,
  Project,
  Proposal,
  ProposalSummary,
  TimeEntry,
  User,
} from '@studioflow/contracts'

/**
 * In-memory stand-in for the API's database, reset between tests.
 *
 * It mirrors the real contract rather than replacing it: the same Zod schemas
 * validate both, and the session behaves the same way (sign in, sign out,
 * 401 when anonymous). What it deliberately does not model is cookie mechanics,
 * because the browser code never reads the cookie — the server does.
 */

/** Credentials the dev login screen offers and the tests use. */
export const SEED_EMAIL = 'ava@northwind.studio'
export const SEED_PASSWORD = 'password123'

const SEED_USER = {
  id: '3f1a6b1e-6b0e-4f52-9d1a-2b7c8e5d0a11',
  name: 'Ava Thompson',
  email: SEED_EMAIL,
  password: SEED_PASSWORD,
}

/** Hand-written and stable — tests assert on these names. */
const SEED_CLIENTS: readonly Client[] = [
  {
    id: 'cl_001',
    name: 'Ava Thompson',
    company: 'Northwind Studio',
    email: 'ava@northwind.studio',
    currency: 'USD',
    createdAt: '2026-01-12T09:00:00.000Z',
  },
  {
    id: 'cl_002',
    name: 'Luca Bianchi',
    company: 'Fjord Collective',
    email: 'luca@fjord.co',
    currency: 'EUR',
    createdAt: '2026-02-03T14:30:00.000Z',
  },
  {
    id: 'cl_003',
    name: 'Priya Nair',
    company: 'Lumen Consulting',
    email: 'priya@lumen.consulting',
    currency: 'GBP',
    createdAt: '2026-03-21T11:15:00.000Z',
  },
]

/**
 * Projects are stored the way the database stores them — with a `clientId` and
 * no client name. The name is resolved on read, exactly as the API's include
 * does it, so the mock cannot accidentally serve a name the join wouldn't.
 */
type StoredProject = Omit<Project, 'clientName'>

const SEED_PROJECTS: readonly StoredProject[] = [
  {
    id: 'pr_001',
    name: 'Website relaunch',
    status: 'active',
    hourlyRateCents: 9500,
    clientId: 'cl_001',
    createdAt: '2026-04-02T09:00:00.000Z',
  },
  {
    id: 'pr_002',
    name: 'Brand identity',
    status: 'paused',
    hourlyRateCents: 11000,
    clientId: 'cl_002',
    createdAt: '2026-05-18T13:45:00.000Z',
  },
]

/** Stored as the database stores it: relations by id, resolved on read. */
type StoredProposal = Omit<
  Proposal,
  'clientName' | 'clientCurrency' | 'projectName'
>

const SEED_PROPOSALS: readonly StoredProposal[] = [
  {
    id: 'pp_001',
    title: 'Website relaunch — proposal',
    status: 'draft',
    clientId: 'cl_001',
    projectId: 'pr_001',
    blocks: [
      { id: 'bl_001', type: 'heading', text: 'Scope of work', level: 2 },
      {
        id: 'bl_002',
        type: 'text',
        text: 'A full rebuild of the marketing site, in three phases.',
      },
      {
        id: 'bl_003',
        type: 'pricing',
        items: [
          {
            id: 'li_001',
            description: 'Design',
            quantity: 12,
            unitPriceCents: 9500,
          },
          {
            id: 'li_002',
            description: 'Build',
            quantity: 30,
            unitPriceCents: 11000,
          },
        ],
      },
    ],
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-04T16:20:00.000Z',
  },
  {
    id: 'pp_002',
    title: 'Brand identity — proposal',
    status: 'draft',
    clientId: 'cl_002',
    projectId: null,
    blocks: [],
    createdAt: '2026-06-10T09:30:00.000Z',
    updatedAt: '2026-06-10T09:30:00.000Z',
  },
]

/**
 * Stored the way the database stores it: names resolved through the project,
 * plus the billing link the wire contract does not carry. Its presence is what
 * makes an entry unbillable a second time.
 */
type StoredTimeEntry = Omit<TimeEntry, 'projectName' | 'clientName'> & {
  invoiceId?: string
}

const SEED_TIME_ENTRIES: readonly StoredTimeEntry[] = [
  {
    id: 'te_001',
    projectId: 'pr_001',
    description: 'Wireframes',
    startedAt: '2026-08-16T09:00:00.000Z',
    endedAt: '2026-08-16T11:30:00.000Z',
    createdAt: '2026-08-16T09:00:00.000Z',
  },
  {
    id: 'te_002',
    projectId: 'pr_002',
    description: 'Moodboard',
    startedAt: '2026-08-16T13:00:00.000Z',
    endedAt: '2026-08-16T14:15:00.000Z',
    createdAt: '2026-08-16T13:00:00.000Z',
  },
]

/** Frozen at generation, exactly as the API stores it. */
type StoredInvoice = Invoice

const SEED_INVOICES: readonly StoredInvoice[] = [
  {
    id: 'in_001',
    number: 1,
    status: 'sent',
    clientId: 'cl_001',
    clientName: 'Ava Thompson',
    clientCompany: 'Northwind Studio',
    currency: 'USD',
    lines: [
      {
        id: 'pr_001',
        description: 'Website relaunch',
        projectId: 'pr_001',
        quantityHours: 2.5,
        unitPriceCents: 9500,
      },
    ],
    issuedAt: '2026-08-17T09:00:00.000Z',
    dueAt: '2026-08-31T09:00:00.000Z',
    createdAt: '2026-08-17T09:00:00.000Z',
    updatedAt: '2026-08-17T09:00:00.000Z',
  },
]

interface StoredUser extends User {
  password: string
}

interface DbState {
  users: StoredUser[]
  clients: Client[]
  projects: StoredProject[]
  proposals: StoredProposal[]
  timeEntries: StoredTimeEntry[]
  invoices: StoredInvoice[]
  invoiceSeq: number
  signedInUserId: string | null
  seq: number
}

function seed(): DbState {
  return {
    users: [{ ...SEED_USER }],
    clients: SEED_CLIENTS.map((client) => ({ ...client })),
    projects: SEED_PROJECTS.map((project) => ({ ...project })),
    proposals: SEED_PROPOSALS.map((proposal) => ({
      ...proposal,
      blocks: structuredClone(proposal.blocks),
    })),
    timeEntries: SEED_TIME_ENTRIES.map((entry) => ({ ...entry })),
    invoices: SEED_INVOICES.map((invoice) => structuredClone(invoice)),
    // Drawn from a counter, never from a count of rows: deleting an invoice
    // must not release its number, exactly as the API behaves.
    invoiceSeq: SEED_INVOICES.length,
    signedInUserId: null,
    seq: 100,
  }
}

let state = seed()

function toPublic(user: StoredUser): User {
  return { id: user.id, name: user.name, email: user.email }
}

export const db = {
  get clients(): Client[] {
    return state.clients
  },

  /** Resolved through the client, mirroring the API's `include`. */
  get projects(): Project[] {
    return state.projects.flatMap((project) => {
      const found = this.findProject(project.id)
      return found ? [found] : []
    })
  },

  get signedInUser(): User | null {
    const user = state.users.find((u) => u.id === state.signedInUserId)
    return user ? toPublic(user) : null
  },

  /** Restore the seed. Called from the test setup after every test. */
  reset(): void {
    state = seed()
  },

  findUserByEmail(email: string): StoredUser | undefined {
    return state.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    )
  },

  createUser(input: { name: string; email: string; password: string }): User {
    state.seq += 1
    const user: StoredUser = {
      id: `00000000-0000-4000-8000-${String(state.seq).padStart(12, '0')}`,
      name: input.name,
      email: input.email.toLowerCase(),
      password: input.password,
    }
    state.users.push(user)
    return toPublic(user)
  },

  signIn(userId: string): void {
    state.signedInUserId = userId
  },

  signOut(): void {
    state.signedInUserId = null
  },

  // --- seams the CRUD work will use ---
  insertClient(client: Client): Client {
    state.clients.unshift(client)
    return client
  },

  updateClient(id: string, patch: Partial<Client>): Client | undefined {
    const found = state.clients.find((c) => c.id === id)
    if (found) Object.assign(found, patch)
    return found
  },

  deleteClient(id: string): boolean {
    const before = state.clients.length
    // Collected before the projects are removed, or there would be nothing
    // left to match the entries against.
    const doomedProjects = new Set(
      state.projects.filter((p) => p.clientId === id).map((p) => p.id),
    )

    state.clients = state.clients.filter((c) => c.id !== id)
    // The real schema cascades, so the mock does too — otherwise a project
    // could outlive its client here and nowhere else.
    state.projects = state.projects.filter((p) => p.clientId !== id)
    state.proposals = state.proposals.filter((p) => p.clientId !== id)
    state.timeEntries = state.timeEntries.filter(
      (entry) => !doomedProjects.has(entry.projectId),
    )
    return state.clients.length < before
  },

  findClient(id: string): Client | undefined {
    return state.clients.find((c) => c.id === id)
  },

  insertProject(project: StoredProject): Project | undefined {
    state.projects.unshift(project)
    return this.findProject(project.id)
  },

  updateProject(
    id: string,
    patch: Partial<StoredProject>,
  ): Project | undefined {
    const found = state.projects.find((p) => p.id === id)
    if (!found) return undefined
    Object.assign(found, patch)
    return this.findProject(id)
  },

  findProject(id: string): Project | undefined {
    const found = state.projects.find((p) => p.id === id)
    if (!found) return undefined
    const client = state.clients.find((c) => c.id === found.clientId)
    return client ? { ...found, clientName: client.name } : undefined
  },

  deleteProject(id: string): boolean {
    const before = state.projects.length
    state.projects = state.projects.filter((p) => p.id !== id)
    // onDelete: SetNull — the proposal outlives the project it referred to.
    for (const proposal of state.proposals) {
      if (proposal.projectId === id) proposal.projectId = null
    }
    // Time entries cascade, because an entry without a project bills nothing.
    state.timeEntries = state.timeEntries.filter(
      (entry) => entry.projectId !== id,
    )
    return state.projects.length < before
  },

  /** Summaries, exactly as the index endpoint returns them: no documents. */
  get proposals(): ProposalSummary[] {
    return state.proposals.flatMap((stored) => {
      const full = this.findProposal(stored.id)
      if (!full) return []
      const { blocks, ...summary } = full
      return [{ ...summary, blockCount: blocks.length }]
    })
  },

  findProposal(id: string): Proposal | undefined {
    const found = state.proposals.find((p) => p.id === id)
    if (!found) return undefined
    const client = state.clients.find((c) => c.id === found.clientId)
    if (!client) return undefined
    const project = state.projects.find((p) => p.id === found.projectId)
    return {
      ...found,
      clientName: client.name,
      clientCurrency: client.currency,
      projectName: project?.name ?? null,
    }
  },

  insertProposal(proposal: StoredProposal): Proposal | undefined {
    state.proposals.unshift(proposal)
    return this.findProposal(proposal.id)
  },

  updateProposal(
    id: string,
    patch: Partial<StoredProposal>,
  ): Proposal | undefined {
    const found = state.proposals.find((p) => p.id === id)
    if (!found) return undefined
    Object.assign(found, patch, { updatedAt: new Date().toISOString() })
    return this.findProposal(id)
  },

  deleteProposal(id: string): boolean {
    const before = state.proposals.length
    state.proposals = state.proposals.filter((p) => p.id !== id)
    return state.proposals.length < before
  },

  get timeEntries(): TimeEntry[] {
    return state.timeEntries.flatMap((stored) => {
      const found = this.findTimeEntry(stored.id)
      return found ? [found] : []
    })
  },

  findTimeEntry(id: string): TimeEntry | undefined {
    const found = state.timeEntries.find((entry) => entry.id === id)
    if (!found) return undefined
    const project = state.projects.find((p) => p.id === found.projectId)
    if (!project) return undefined
    const client = state.clients.find((c) => c.id === project.clientId)
    if (!client) return undefined
    return { ...found, projectName: project.name, clientName: client.name }
  },

  /** At most one, exactly as the API guarantees. */
  runningTimeEntry(): TimeEntry | undefined {
    const running = state.timeEntries.find((entry) => entry.endedAt === null)
    return running ? this.findTimeEntry(running.id) : undefined
  },

  insertTimeEntry(entry: StoredTimeEntry): TimeEntry | undefined {
    state.timeEntries.unshift(entry)
    return this.findTimeEntry(entry.id)
  },

  updateTimeEntry(
    id: string,
    patch: Partial<StoredTimeEntry>,
  ): TimeEntry | undefined {
    const found = state.timeEntries.find((entry) => entry.id === id)
    if (!found) return undefined
    Object.assign(found, patch)
    return this.findTimeEntry(id)
  },

  deleteTimeEntry(id: string): boolean {
    const before = state.timeEntries.length
    state.timeEntries = state.timeEntries.filter((entry) => entry.id !== id)
    return state.timeEntries.length < before
  },

  get invoices(): InvoiceSummary[] {
    return state.invoices.map(({ lines, ...rest }) => ({
      ...rest,
      lineCount: lines.length,
    }))
  },

  findInvoice(id: string): Invoice | undefined {
    return state.invoices.find((invoice) => invoice.id === id)
  },

  /** Mirrors the API: unbilled, finished entries for that client's projects. */
  billableEntries(clientId: string, from: string, to: string) {
    const projectIds = new Set(
      state.projects.filter((p) => p.clientId === clientId).map((p) => p.id),
    )
    return state.timeEntries.filter(
      (entry) =>
        entry.invoiceId === undefined &&
        entry.endedAt !== null &&
        projectIds.has(entry.projectId) &&
        entry.startedAt >= from &&
        entry.startedAt < to,
    )
  },

  insertInvoice(invoice: Omit<StoredInvoice, 'number'>): Invoice {
    state.invoiceSeq += 1
    const created = { ...invoice, number: state.invoiceSeq }
    state.invoices.unshift(created)
    return created
  },

  markEntriesBilled(entryIds: readonly string[], invoiceId: string): void {
    for (const entry of state.timeEntries) {
      if (entryIds.includes(entry.id)) entry.invoiceId = invoiceId
    }
  },

  updateInvoice(
    id: string,
    patch: Partial<StoredInvoice>,
  ): Invoice | undefined {
    const found = state.invoices.find((invoice) => invoice.id === id)
    if (!found) return undefined
    Object.assign(found, patch, { updatedAt: new Date().toISOString() })
    return found
  },

  deleteInvoice(id: string): boolean {
    const before = state.invoices.length
    state.invoices = state.invoices.filter((invoice) => invoice.id !== id)
    // Releasing the hours, not destroying them.
    for (const entry of state.timeEntries) {
      if (entry.invoiceId === id) entry.invoiceId = undefined
    }
    return state.invoices.length < before
  },

  nextId(prefix: string): string {
    state.seq += 1
    return `${prefix}_${state.seq}`
  },
}
