import { describe, expect, it } from 'vitest'
import {
  createProposalSchema,
  proposalBlockSchema,
  proposalDocumentSchema,
  updateProposalSchema,
} from './index'

const heading = { id: 'b1', type: 'heading', text: 'Scope', level: 2 }
const text = { id: 'b2', type: 'text', text: 'What we will do.' }
const pricing = {
  id: 'b3',
  type: 'pricing',
  items: [
    { id: 'i1', description: 'Design', quantity: 12.5, unitPriceCents: 9500 },
  ],
}
const terms = {
  id: 'b4',
  type: 'terms',
  clauses: [{ id: 'c1', text: '50% up front.' }],
}

describe('proposalBlockSchema', () => {
  it('accepts each of the four block types', () => {
    for (const block of [heading, text, pricing, terms]) {
      expect(proposalBlockSchema.safeParse(block).success).toBe(true)
    }
  })

  it('names the offending variant when a block is malformed', () => {
    const result = proposalBlockSchema.safeParse({
      id: 'b1',
      type: 'heading',
      text: 'Scope',
      level: 7, // only h2 and h3 exist inside the document
    })
    expect(result.success).toBe(false)
    // Discriminated on `type`, so the error points at level rather than
    // complaining that the object matched none of four unrelated shapes.
    expect(result.error?.issues[0]?.path).toEqual(['level'])
  })

  it('rejects a block type that does not exist', () => {
    expect(
      proposalBlockSchema.safeParse({ id: 'b9', type: 'image', url: 'x' })
        .success,
    ).toBe(false)
  })

  it('refuses fractional money', () => {
    // Prices are integer minor units; 95.5 cents is not a thing.
    const result = proposalBlockSchema.safeParse({
      ...pricing,
      items: [
        { id: 'i1', description: 'Design', quantity: 1, unitPriceCents: 95.5 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('allows a fractional quantity, because hours are billed in halves', () => {
    expect(
      proposalBlockSchema.safeParse({
        ...pricing,
        items: [
          {
            id: 'i1',
            description: 'Design',
            quantity: 0.25,
            unitPriceCents: 1,
          },
        ],
      }).success,
    ).toBe(true)
  })

  it('refuses a negative price', () => {
    expect(
      proposalBlockSchema.safeParse({
        ...pricing,
        items: [
          { id: 'i1', description: 'Refund', quantity: 1, unitPriceCents: -1 },
        ],
      }).success,
    ).toBe(false)
  })
})

describe('proposalDocumentSchema', () => {
  it('accepts an empty document — a new proposal has no blocks yet', () => {
    expect(proposalDocumentSchema.safeParse([]).success).toBe(true)
  })

  it('accepts a mixed document', () => {
    expect(
      proposalDocumentSchema.safeParse([heading, text, pricing, terms]).success,
    ).toBe(true)
  })

  it('rejects a document with one bad block among good ones', () => {
    const result = proposalDocumentSchema.safeParse([
      heading,
      { id: 'b2', type: 'text' }, // no text
      terms,
    ])
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path[0]).toBe(1)
  })
})

describe('createProposalSchema', () => {
  it('requires a client and trims the title', () => {
    const parsed = createProposalSchema.parse({
      title: '  Website relaunch  ',
      clientId: 'cl_001',
    })
    expect(parsed.title).toBe('Website relaunch')

    const result = createProposalSchema.safeParse({
      title: 'x',
      clientId: '',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'Choose a client for this proposal',
    )
  })

  it('treats the project as optional and nullable', () => {
    expect(
      createProposalSchema.safeParse({ title: 'x', clientId: 'cl_001' })
        .success,
    ).toBe(true)
    expect(
      createProposalSchema.safeParse({
        title: 'x',
        clientId: 'cl_001',
        projectId: null,
      }).success,
    ).toBe(true)
  })
})

describe('updateProposalSchema', () => {
  it('accepts a document on its own — that is what autosave sends', () => {
    expect(updateProposalSchema.safeParse({ blocks: [heading] }).success).toBe(
      true,
    )
  })

  it('rejects an empty patch', () => {
    const result = updateProposalSchema.safeParse({})
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'Provide at least one field to update',
    )
  })

  it('will not let a client set the status', () => {
    // Nothing implements sending yet, so `status` is readable but not writable.
    const parsed = updateProposalSchema.parse({
      title: 'Renamed',
      status: 'accepted',
    })
    expect(parsed).not.toHaveProperty('status')
  })
})
