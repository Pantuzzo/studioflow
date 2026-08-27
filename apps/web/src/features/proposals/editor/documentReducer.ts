import type {
  ProposalBlock,
  ProposalBlockType,
  ProposalDocument,
} from '@studioflow/contracts'

/**
 * The editor's state, as a pure reducer.
 *
 * This is the file the week's interesting logic lives in, and it deliberately
 * knows nothing about React, dnd-kit or the network: given a state and an
 * action it returns the next state, which is why undo/redo is a pair of stacks
 * rather than a feature, and why the tests need no DOM.
 */
export interface DocumentState {
  blocks: ProposalDocument
  past: ProposalDocument[]
  future: ProposalDocument[]
}

export type DocumentAction =
  /** Insert a new block of `blockType`, at `index` or at the end. */
  | { type: 'add'; blockType: ProposalBlockType; index?: number }
  /** Replace a block wholesale — block editors produce the whole thing. */
  | { type: 'update'; block: ProposalBlock }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string }
  /** Move a block to an absolute position, clamped to the document. */
  | { type: 'move'; id: string; to: number }
  /** Load a document from the server. Not undoable — it is not an edit. */
  | { type: 'reset'; blocks: ProposalDocument }
  | { type: 'undo' }
  | { type: 'redo' }

/** Deep enough for a session's worth of edits, shallow enough to stay cheap. */
const HISTORY_LIMIT = 50

let idSeq = 0
/** Unique within a document, which is all a block id has to be. */
export function newBlockId(prefix = 'bl'): string {
  idSeq += 1
  return `${prefix}_${Date.now().toString(36)}_${idSeq}`
}

export function createBlock(type: ProposalBlockType): ProposalBlock {
  switch (type) {
    case 'heading':
      return { id: newBlockId(), type: 'heading', text: '', level: 2 }
    case 'text':
      return { id: newBlockId(), type: 'text', text: '' }
    case 'pricing':
      return {
        id: newBlockId(),
        type: 'pricing',
        // An empty pricing table has nothing to fill in, so it starts with a row.
        items: [
          {
            id: newBlockId('li'),
            description: '',
            quantity: 1,
            unitPriceCents: 0,
          },
        ],
      }
    case 'terms':
      return {
        id: newBlockId(),
        type: 'terms',
        clauses: [{ id: newBlockId('cl'), text: '' }],
      }
  }
}

export const initialDocumentState: DocumentState = {
  blocks: [],
  past: [],
  future: [],
}

/** Record the current document on the undo stack and drop any redo branch. */
function commit(state: DocumentState, blocks: ProposalDocument): DocumentState {
  return {
    blocks,
    past: [...state.past, state.blocks].slice(-HISTORY_LIMIT),
    // Editing after undoing abandons the redo branch, as every editor does.
    future: [],
  }
}

export function documentReducer(
  state: DocumentState,
  action: DocumentAction,
): DocumentState {
  switch (action.type) {
    case 'add': {
      const block = createBlock(action.blockType)
      const at = action.index ?? state.blocks.length
      const blocks = [...state.blocks]
      blocks.splice(Math.max(0, Math.min(at, blocks.length)), 0, block)
      return commit(state, blocks)
    }

    case 'update': {
      const index = state.blocks.findIndex((b) => b.id === action.block.id)
      if (index === -1) return state
      const blocks = [...state.blocks]
      blocks[index] = action.block
      return commit(state, blocks)
    }

    case 'remove': {
      const blocks = state.blocks.filter((b) => b.id !== action.id)
      if (blocks.length === state.blocks.length) return state
      return commit(state, blocks)
    }

    case 'duplicate': {
      const index = state.blocks.findIndex((b) => b.id === action.id)
      if (index === -1) return state
      // Fresh ids throughout, including nested rows: two blocks sharing an id
      // would make every later edit ambiguous.
      const copy = withNewIds(state.blocks[index]!)
      const blocks = [...state.blocks]
      blocks.splice(index + 1, 0, copy)
      return commit(state, blocks)
    }

    case 'move': {
      const from = state.blocks.findIndex((b) => b.id === action.id)
      if (from === -1) return state
      const to = Math.max(0, Math.min(action.to, state.blocks.length - 1))
      if (to === from) return state
      const blocks = [...state.blocks]
      const [moved] = blocks.splice(from, 1)
      blocks.splice(to, 0, moved!)
      return commit(state, blocks)
    }

    case 'reset':
      return { blocks: action.blocks, past: [], future: [] }

    case 'undo': {
      const previous = state.past.at(-1)
      if (previous === undefined) return state
      return {
        blocks: previous,
        past: state.past.slice(0, -1),
        future: [state.blocks, ...state.future],
      }
    }

    case 'redo': {
      const [next, ...rest] = state.future
      if (next === undefined) return state
      return {
        blocks: next,
        past: [...state.past, state.blocks],
        future: rest,
      }
    }
  }
}

function withNewIds(block: ProposalBlock): ProposalBlock {
  switch (block.type) {
    case 'pricing':
      return {
        ...block,
        id: newBlockId(),
        items: block.items.map((item) => ({ ...item, id: newBlockId('li') })),
      }
    case 'terms':
      return {
        ...block,
        id: newBlockId(),
        clauses: block.clauses.map((clause) => ({
          ...clause,
          id: newBlockId('cl'),
        })),
      }
    default:
      return { ...block, id: newBlockId() }
  }
}

export const canUndo = (state: DocumentState) => state.past.length > 0
export const canRedo = (state: DocumentState) => state.future.length > 0
