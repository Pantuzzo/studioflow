import 'dotenv/config'
import { faker } from '@faker-js/faker'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import * as argon2 from 'argon2'

/** Credentials shown on the dev login screen and used by the e2e suite. */
export const SEED_EMAIL = 'ava@northwind.studio'
export const SEED_PASSWORD = 'password123'

/**
 * The three clients the web test-suite asserts on by name. These stay
 * hand-written and deterministic; faker only adds volume around them.
 */
const FIXED_CLIENTS = [
  {
    id: 'cl_001',
    name: 'Ava Thompson',
    company: 'Northwind Studio',
    email: 'ava@northwind.studio',
    currency: 'USD',
    createdAt: new Date('2026-01-12T09:00:00.000Z'),
  },
  {
    id: 'cl_002',
    name: 'Luca Bianchi',
    company: 'Fjord Collective',
    email: 'luca@fjord.co',
    currency: 'EUR',
    createdAt: new Date('2026-02-03T14:30:00.000Z'),
  },
  {
    id: 'cl_003',
    name: 'Priya Nair',
    company: 'Lumen Consulting',
    email: 'priya@lumen.consulting',
    currency: 'GBP',
    createdAt: new Date('2026-03-21T11:15:00.000Z'),
  },
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'BRL', 'CAD']

/** Hung off the fixed clients, so the demo opens with projects on screen. */
const FIXED_PROJECTS = [
  {
    id: 'pr_001',
    name: 'Website relaunch',
    status: 'active' as const,
    clientId: 'cl_001',
    createdAt: new Date('2026-04-02T09:00:00.000Z'),
  },
  {
    id: 'pr_002',
    name: 'Brand identity',
    status: 'paused' as const,
    clientId: 'cl_002',
    createdAt: new Date('2026-05-18T13:45:00.000Z'),
  },
  {
    id: 'pr_003',
    name: 'Quarterly retainer',
    status: 'completed' as const,
    clientId: 'cl_003',
    createdAt: new Date('2026-06-09T08:20:00.000Z'),
  },
]

/** One worked example, so the editor opens with something in it. */
const SEED_PROPOSAL = {
  id: 'pp_001',
  title: 'Website relaunch — proposal',
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
    {
      id: 'bl_004',
      type: 'terms',
      clauses: [
        { id: 'cl_001', text: '50% due on acceptance, 50% on delivery.' },
        { id: 'cl_002', text: 'Two rounds of revisions per phase.' },
      ],
    },
  ],
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'] ?? '',
  })
  const prisma = new PrismaClient({ adapter })

  try {
    // A fixed seed keeps the generated rows identical between runs, so demos
    // and screenshots stay stable.
    faker.seed(20260805)

    const passwordHash = await argon2.hash(SEED_PASSWORD, {
      type: argon2.argon2id,
    })

    const user = await prisma.user.upsert({
      where: { email: SEED_EMAIL },
      update: { passwordHash },
      create: { name: 'Ava Thompson', email: SEED_EMAIL, passwordHash },
    })

    await prisma.client.deleteMany({ where: { ownerId: user.id } })

    await prisma.client.createMany({
      data: FIXED_CLIENTS.map((client) => ({ ...client, ownerId: user.id })),
    })

    const generated = Array.from({ length: 22 }, () => {
      const company = faker.company.name()
      return {
        name: faker.person.fullName(),
        company,
        email: faker.internet.email().toLowerCase(),
        currency: faker.helpers.arrayElement(CURRENCIES),
        createdAt: faker.date.between({
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-07-01T00:00:00.000Z',
        }),
        ownerId: user.id,
      }
    })
    await prisma.client.createMany({ data: generated })

    // Deleting the clients above cascaded their projects away, so these are
    // created fresh rather than upserted.
    await prisma.project.createMany({
      data: FIXED_PROJECTS.map((project) => ({ ...project, ownerId: user.id })),
    })

    await prisma.proposal.create({
      data: { ...SEED_PROPOSAL, ownerId: user.id },
    })

    // A couple of finished entries, so the timesheet is not empty on arrival.
    await prisma.timeEntry.createMany({
      data: [
        {
          projectId: 'pr_001',
          description: 'Wireframes',
          startedAt: new Date('2026-08-16T09:00:00.000Z'),
          endedAt: new Date('2026-08-16T11:30:00.000Z'),
          ownerId: user.id,
        },
        {
          projectId: 'pr_002',
          description: 'Moodboard',
          startedAt: new Date('2026-08-16T13:00:00.000Z'),
          endedAt: new Date('2026-08-16T14:15:00.000Z'),
          ownerId: user.id,
        },
      ],
    })

    const total = await prisma.client.count({ where: { ownerId: user.id } })
    const projects = await prisma.project.count({ where: { ownerId: user.id } })
    const proposals = await prisma.proposal.count({
      where: { ownerId: user.id },
    })
    const entries = await prisma.timeEntry.count({
      where: { ownerId: user.id },
    })
    console.log(
      `Seeded ${SEED_EMAIL}: ${total} clients, ${projects} projects, ${proposals} proposals, ${entries} time entries.`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
