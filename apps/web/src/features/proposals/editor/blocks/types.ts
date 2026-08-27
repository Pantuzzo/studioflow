import type { ProposalBlock, ProposalBlockType } from '@studioflow/contracts'

/** The variant of the union that carries a given `type`. */
export type BlockOf<T extends ProposalBlockType> = Extract<
  ProposalBlock,
  { type: T }
>

export interface BlockEditorProps<T extends ProposalBlockType> {
  block: BlockOf<T>
  /**
   * Blocks are replaced whole rather than patched: the union is discriminated,
   * so a partial update would have to be narrowed at every call site.
   */
  onChange: (block: ProposalBlock) => void
}

/** What the block is called in menus, labels and drag announcements. */
export const BLOCK_LABELS: Record<ProposalBlockType, string> = {
  heading: 'Heading',
  text: 'Text',
  pricing: 'Pricing table',
  terms: 'Terms',
}
