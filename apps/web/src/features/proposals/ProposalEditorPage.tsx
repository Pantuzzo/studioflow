import { useEffect, useMemo, useReducer, useState } from 'react'
import type { ProposalBlockType } from '@studioflow/contracts'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { Input } from '@/components/ui/Input'
import { BlockList } from './editor/BlockList'
import { BLOCK_LABELS } from './editor/blocks/types'
import {
  canRedo,
  canUndo,
  documentReducer,
  initialDocumentState,
} from './editor/documentReducer'
import { useAutosave, type SaveStatus } from './editor/useAutosave'
import { useGetProposalQuery, useUpdateProposalMutation } from './proposalsApi'
import styles from './ProposalEditorPage.module.css'

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: 'All changes saved',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Couldn’t save',
}

export function ProposalEditorPage() {
  const { id = '' } = useParams()
  const { data, isLoading, isError, refetch } = useGetProposalQuery(id, {
    skip: !id,
  })
  const [updateProposal] = useUpdateProposalMutation()

  const [state, dispatch] = useReducer(documentReducer, initialDocumentState)
  const [title, setTitle] = useState('')
  const [ready, setReady] = useState(false)

  // The server's copy loads once into the editor's own state; from then on the
  // reducer is the document, and autosave is what reconciles the two.
  useEffect(() => {
    if (!data) return
    dispatch({ type: 'reset', blocks: data.blocks })
    setTitle(data.title)
    setReady(true)
  }, [data])

  const payload = useMemo(
    () => ({ title, blocks: state.blocks }),
    [title, state.blocks],
  )

  const autosave = useAutosave(
    payload,
    (next) => updateProposal({ id, patch: next }).unwrap(),
    { enabled: ready },
  )

  if (isLoading) {
    return (
      <p role="status" className={styles.state}>
        Loading proposal…
      </p>
    )
  }

  if (isError || !data) {
    return (
      <div role="alert" className={styles.state}>
        <p>We couldn’t load this proposal.</p>
        <Button variant="soft" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Input
            aria-label="Proposal title"
            className={styles.title}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <p className={styles.meta}>
            For {data.clientName}
            {data.projectName ? ` · ${data.projectName}` : ''} ·{' '}
            <Link to="/proposals">All proposals</Link>
          </p>
        </div>

        <div className={styles.actions}>
          {/*
            Announced politely rather than assertively: it changes on a timer,
            and interrupting someone mid-sentence to say "Saving…" is worse
            than telling them a moment later.
          */}
          <p
            role="status"
            aria-live="polite"
            className={styles.saveStatus}
            data-status={autosave.status}
          >
            {STATUS_TEXT[autosave.status]}
          </p>
          {autosave.status === 'error' && (
            <Button variant="soft" size="sm" onClick={autosave.retry}>
              Retry
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={!canUndo(state)}
            onClick={() => dispatch({ type: 'undo' })}
          >
            Undo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canRedo(state)}
            onClick={() => dispatch({ type: 'redo' })}
          >
            Redo
          </Button>
        </div>
      </header>

      {state.blocks.length === 0 ? (
        <p className={styles.empty}>
          This proposal is empty. Add a block to begin.
        </p>
      ) : (
        <BlockList
          blocks={state.blocks}
          currency={data.clientCurrency}
          onChange={(block) => dispatch({ type: 'update', block })}
          onMove={(blockId, to) => dispatch({ type: 'move', id: blockId, to })}
          onDuplicate={(blockId) =>
            dispatch({ type: 'duplicate', id: blockId })
          }
          onRemove={(blockId) => dispatch({ type: 'remove', id: blockId })}
        />
      )}

      <div className={styles.addBlock}>
        <DropdownMenu
          align="start"
          trigger={<Button variant="soft">Add block</Button>}
          items={(Object.keys(BLOCK_LABELS) as ProposalBlockType[]).map(
            (blockType) => ({
              label: BLOCK_LABELS[blockType],
              onSelect: () => dispatch({ type: 'add', blockType }),
            }),
          )}
        />
      </div>
    </div>
  )
}
