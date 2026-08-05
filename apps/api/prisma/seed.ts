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

    const total = await prisma.client.count({ where: { ownerId: user.id } })
    console.log(`Seeded ${SEED_EMAIL} with ${total} clients.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
