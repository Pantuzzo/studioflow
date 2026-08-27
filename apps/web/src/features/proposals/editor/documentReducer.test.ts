import type { ProposalBlock, ProposalDocument } from '@studioflow/contracts'
import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  createBlock,
  documentReducer,
  initialDocumentState,
  type DocumentAction,
  type DocumentState,
} from './documentReducer'

/** Apply a sequence of actions, the way the editor accumulates them. */
function run(
  actions: DocumentAction[],
  from: DocumentState = initialDocumentState,
): DocumentState {
  return actions.reduce(documentReducer, from)
}

const loaded = (blocks: ProposalDocument): DocumentState =>
  documentReducer(initialDocumentState, { type: 'reset', blocks })

const heading: ProposalBlock = {
  id: 'b1',
  type: 'heading',
  text: 'Scope',
  level: 2,
}
const text: ProposalBlock = { id: 'b2', type: 'text', text: 'Body' }
const terms: ProposalBlock = {
  id: 'b3',
  type: 'terms',
  clauses: [{ id: 'c1', text: '50% up front' }],
}

const ids = (state: DocumentState) => state.blocks.map((b) => b.id)

describe('createBlock', () => {
  it('produces a valid empty block of each type', () => {
    expect(createBlock('heading')).toMatchObject({ type: 'heading', level: 2 })
    expect(createBlock('text')).toMatchObject({ type: 'text', text: '' })
    // A pricing table with no rows has nothing to type into.
    expect(createBlock('pricing')).toMatchObject({ type: 'pricing' })
    expect(createBlock('pricing')).toHaveProperty('items.length', 1)
    expect(createBlock('terms')).toHaveProperty('clauses.length', 1)
  })

  it('never repeats an id', () => {
    const generated = Array.from({ length: 50 }, () => createBlock('text').id)
    expect(new Set(generated).size).toBe(50)
  })
})

describe('documentReducer — editing', () => {
  it('adds at the end by default and at an index when asked', () => {
    const state = run([
      { type: 'add', blockType: 'heading' },
      { type: 'add', blockType: 'text' },
      { type: 'add', blockType: 'terms', index: 1 },
    ])
    expect(state.blocks.map((b) => b.type)).toEqual([
      'heading',
      'terms',
      'text',
    ])
  })

  it('replaces a block on update and ignores an unknown id', () => {
    const state = documentReducer(loaded([heading, text]), {
      type: 'update',
      block: { ...heading, text: 'Renamed' },
    })
    expect(state.blocks[0]).toMatchObject({ id: 'b1', text: 'Renamed' })

    const untouched = documentReducer(state, {
      type: 'update',
      block: { id: 'nope', type: 'text', text: 'x' },
    })
    // Same object back, so React sees no change and nothing rerenders.
    expect(untouched).toBe(state)
  })

  it('removes a block, and does nothing for an id that is not there', () => {
    const state = documentReducer(loaded([heading, text]), {
      type: 'remove',
      id: 'b1',
    })
    expect(ids(state)).toEqual(['b2'])
    expect(documentReducer(state, { type: 'remove', id: 'b1' })).toBe(state)
  })

  it('duplicates a block after the original with entirely fresh ids', () => {
    const state = documentReducer(loaded([terms]), {
      type: 'duplicate',
      id: 'b3',
    })
    expect(state.blocks).toHaveLength(2)
    const [original, copy] = state.blocks
    expect(copy?.id).not.toBe(original?.id)
    // Nested ids too: a shared clause id would make later edits ambiguous.
    expect(copy).toMatchObject({ type: 'terms' })
    if (copy?.type === 'terms' && original?.type === 'terms') {
      expect(copy.clauses[0]?.id).not.toBe(original.clauses[0]?.id)
      expect(copy.clauses[0]?.text).toBe('50% up front')
    }
  })
})

describe('documentReducer — moving', () => {
  const three = loaded([heading, text, terms])

  it('moves a block down and up', () => {
    expect(
      ids(documentReducer(three, { type: 'move', id: 'b1', to: 2 })),
    ).toEqual(['b2', 'b3', 'b1'])
    expect(
      ids(documentReducer(three, { type: 'move', id: 'b3', to: 0 })),
    ).toEqual(['b3', 'b1', 'b2'])
  })

  it('clamps a move past either end instead of losing the block', () => {
    expect(
      ids(documentReducer(three, { type: 'move', id: 'b2', to: 99 })),
    ).toEqual(['b1', 'b3', 'b2'])
    expect(
      ids(documentReducer(three, { type: 'move', id: 'b2', to: -5 })),
    ).toEqual(['b2', 'b1', 'b3'])
  })

  it('treats a move to the same place as no change at all', () => {
    expect(documentReducer(three, { type: 'move', id: 'b1', to: 0 })).toBe(
      three,
    )
  })
})

describe('documentReducer — history', () => {
  it('undoes and redoes an edit', () => {
    const state = run([{ type: 'add', blockType: 'heading' }], loaded([text]))
    expect(state.blocks).toHaveLength(2)

    const undone = documentReducer(state, { type: 'undo' })
    expect(ids(undone)).toEqual(['b2'])
    expect(canRedo(undone)).toBe(true)

    const redone = documentReducer(undone, { type: 'redo' })
    expect(redone.blocks).toHaveLength(2)
  })

  it('undoes a move, which is the one people reach for after a bad drag', () => {
    const moved = documentReducer(loaded([heading, text, terms]), {
      type: 'move',
      id: 'b1',
      to: 2,
    })
    expect(ids(moved)).toEqual(['b2', 'b3', 'b1'])
    expect(ids(documentReducer(moved, { type: 'undo' }))).toEqual([
      'b1',
      'b2',
      'b3',
    ])
  })

  it('abandons the redo branch once you edit after undoing', () => {
    const state = run([{ type: 'add', blockType: 'heading' }], loaded([text]))
    const undone = documentReducer(state, { type: 'undo' })
    const edited = documentReducer(undone, { type: 'add', blockType: 'terms' })
    expect(canRedo(edited)).toBe(false)
  })

  it('does nothing at either end of the history', () => {
    const fresh = loaded([text])
    expect(canUndo(fresh)).toBe(false)
    expect(documentReducer(fresh, { type: 'undo' })).toBe(fresh)
    expect(documentReducer(fresh, { type: 'redo' })).toBe(fresh)
  })

  it('walks back through several edits in order', () => {
    let state = run(
      [
        { type: 'add', blockType: 'heading' },
        { type: 'add', blockType: 'terms' },
        { type: 'remove', id: 'b2' },
      ],
      loaded([text]),
    )
    expect(state.blocks).toHaveLength(2)

    state = documentReducer(state, { type: 'undo' })
    expect(state.blocks).toHaveLength(3)
    state = documentReducer(state, { type: 'undo' })
    expect(state.blocks).toHaveLength(2)
    state = documentReducer(state, { type: 'undo' })
    expect(ids(state)).toEqual(['b2'])
    expect(canUndo(state)).toBe(false)
  })

  it('caps the history rather than growing without bound', () => {
    let state: DocumentState = loaded([])
    for (let i = 0; i < 80; i += 1) {
      state = documentReducer(state, { type: 'add', blockType: 'text' })
    }
    expect(state.blocks).toHaveLength(80)
    expect(state.past.length).toBeLessThanOrEqual(50)
  })

  it('clears the history when a document is loaded — that is not an edit', () => {
    const edited = run([{ type: 'add', blockType: 'text' }], loaded([heading]))
    expect(canUndo(edited)).toBe(true)

    const reloaded = documentReducer(edited, {
      type: 'reset',
      blocks: [heading],
    })
    expect(canUndo(reloaded)).toBe(false)
    expect(canRedo(reloaded)).toBe(false)
  })
})
