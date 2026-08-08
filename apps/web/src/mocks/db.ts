import type { Client, User } from '@studioflow/contracts'

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

interface StoredUser extends User {
  password: string
}

interface DbState {
  users: StoredUser[]
  clients: Client[]
  signedInUserId: string | null
  seq: number
}

function seed(): DbState {
  return {
    users: [{ ...SEED_USER }],
    clients: SEED_CLIENTS.map((client) => ({ ...client })),
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
    state.clients = state.clients.filter((c) => c.id !== id)
    return state.clients.length < before
  },

  nextId(prefix: string): string {
    state.seq += 1
    return `${prefix}_${state.seq}`
  },
}
