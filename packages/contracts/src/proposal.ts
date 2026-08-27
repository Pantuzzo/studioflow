import { z } from 'zod'

/**
 * A proposal is a document assembled from blocks. The block union below is the
 * whole schema of that document: it validates the request in NestJS, types the
 * editor's reducer, and backs the MSW handlers, so the three cannot drift.
 */

/** Ids are generated in the editor, because blocks are created before they are saved. */
const blockId = z.string().min(1)

export const headingBlockSchema = z.object({
  id: blockId,
  type: z.literal('heading'),
  text: z.string().max(200),
  /**
   * The document lives inside a page that already owns `h1`, so a block heading
   * can only ever be an h2 or an h3. Encoding that here keeps the outline valid
   * no matter what the editor does.
   */
  level: z.union([z.literal(2), z.literal(3)]),
})

export const textBlockSchema = z.object({
  id: blockId,
  type: z.literal('text'),
  text: z.string().max(5000),
})

export const lineItemSchema = z.object({
  id: blockId,
  description: z.string().max(200),
  /** Fractional on purpose — hours are billed in halves and quarters. */
  quantity: z.number().nonnegative().max(100_000),
  /**
   * Minor units (cents), as an integer. Money in floating point is the classic
   * way to end up a penny short on a total nobody can explain, and Week 7's
   * invoices will inherit this decision.
   */
  unitPriceCents: z.number().int().nonnegative().max(1_000_000_000),
})
export type LineItem = z.infer<typeof lineItemSchema>

export const pricingBlockSchema = z.object({
  id: blockId,
  type: z.literal('pricing'),
  items: z.array(lineItemSchema).max(50),
})

export const clauseSchema = z.object({
  id: blockId,
  text: z.string().max(500),
})

export const termsBlockSchema = z.object({
  id: blockId,
  type: z.literal('terms'),
  clauses: z.array(clauseSchema).max(50),
})

/** Discriminated on `type`, so a bad block names its own variant in the error. */
export const proposalBlockSchema = z.discriminatedUnion('type', [
  headingBlockSchema,
  textBlockSchema,
  pricingBlockSchema,
  termsBlockSchema,
])
export type ProposalBlock = z.infer<typeof proposalBlockSchema>
export type ProposalBlockType = ProposalBlock['type']

export const PROPOSAL_BLOCK_TYPES = [
  'heading',
  'text',
  'pricing',
  'terms',
] as const

/** The document itself. Capped so a runaway client cannot post a novel. */
export const proposalDocumentSchema = z.array(proposalBlockSchema).max(100)
export type ProposalDocument = z.infer<typeof proposalDocumentSchema>

/**
 * Where a proposal is in its life.
 *
 * Only `draft` is reachable today: the update contract below deliberately does
 * not accept `status`, because nothing implements sending or accepting yet. The
 * field is readable so the UI can show it and so the transition has somewhere
 * to land, not so it can be set by a client that would then be lying.
 */
export const PROPOSAL_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

const proposalBase = z.object({
  id: z.string(),
  title: z.string().min(1),
  status: z.enum(PROPOSAL_STATUSES),
  clientId: z.string(),
  /** Denormalised for display, as on projects. */
  clientName: z.string(),
  /** The client's ISO 4217 code — what the pricing block's totals are in. */
  clientCurrency: z.string().length(3),
  /** A proposal need not concern a project that already exists. */
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

/**
 * The list shape. It carries no blocks: an index of proposals has no use for
 * every document body, and sending them would grow without bound.
 */
export const proposalSummarySchema = proposalBase.extend({
  /** Enough to say "3 blocks" without shipping them. */
  blockCount: z.number().int().nonnegative(),
})
export type ProposalSummary = z.infer<typeof proposalSummarySchema>

/** The full document, as the editor loads it. */
export const proposalSchema = proposalBase.extend({
  blocks: proposalDocumentSchema,
})
export type Proposal = z.infer<typeof proposalSchema>

/** A new proposal starts empty; blocks arrive through the editor's autosave. */
export const createProposalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Enter a title')
    .max(120, 'Use at most 120 characters'),
  clientId: z.string().min(1, 'Choose a client for this proposal'),
  projectId: z.string().nullable().optional(),
})
export type CreateProposalInput = z.infer<typeof createProposalSchema>

/**
 * What autosave sends. `blocks` travels whole rather than as a patch: a
 * document is edited as one thing, and diffing block arrays across the wire
 * would buy nothing but a merge algorithm nobody asked for.
 */
export const updateProposalSchema = z
  .object({
    title: z.string().trim().min(1, 'Enter a title').max(120),
    clientId: z.string().min(1),
    projectId: z.string().nullable(),
    blocks: proposalDocumentSchema,
  })
  .partial()
  .refine((values) => Object.keys(values).length > 0, {
    message: 'Provide at least one field to update',
  })
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>
