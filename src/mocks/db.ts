import type { Client } from '@/features/clients/types'

/**
 * In-memory seed data for the mock API. Later replaced by the real
 * Hono + Prisma backend (Week 7+); the REST contract stays identical.
 */
export const clients: Client[] = [
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
