import type { ProposalBlock } from '@studioflow/contracts'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { HeadingBlockEditor } from './blocks/HeadingBlockEditor'
import { PricingBlockEditor } from './blocks/PricingBlockEditor'
import { TermsBlockEditor } from './blocks/TermsBlockEditor'
import { TextBlockEditor } from './blocks/TextBlockEditor'
import { BLOCK_LABELS } from './blocks/types'
import styles from './Editor.module.css'

export interface BlockCardProps {
  block: ProposalBlock
  index: number
  total: number
  currency: string
  onChange: (block: ProposalBlock) => void
  onMove: (to: number) => void
  onDuplicate: () => void
  onRemove: () => void
}

function GripIcon() {
  return (
    <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
      <g fill="currentColor">
        {[0, 5, 10].map((y) =>
          [0, 6].map((x) => (
            <circle key={`${x}-${y}`} cx={x + 1} cy={y + 3} r="1.2" />
          )),
        )}
      </g>
    </svg>
  )
}

export function BlockCard({
  block,
  index,
  total,
  currency,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: BlockCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const label = BLOCK_LABELS[block.type]
  const position = `${index + 1} of ${total}`

  return (
    <li
      ref={setNodeRef}
      className={styles.block}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className={styles.blockHeader}>
        {/*
          A real button, not a div with a cursor: dnd-kit's keyboard sensor
          needs something focusable to start a drag from, and the name has to
          say which block it moves — "Reorder" alone is useless in a list of ten.
        */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={styles.handle}
          aria-label={`Reorder ${label} block, ${position}`}
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>

        <h3 className={styles.blockTitle}>
          {label}
          <span className={styles.blockPosition}> · {position}</span>
        </h3>

        {/*
          Everything the drag does, available without dragging. This is what
          makes the feature keyboard-operable rather than merely keyboard-
          reachable.
        */}
        <DropdownMenu
          trigger={
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${label} block actions`}
            >
              ⋯
            </Button>
          }
          items={[
            {
              label: 'Move up',
              onSelect: () => onMove(index - 1),
              disabled: index === 0,
            },
            {
              label: 'Move down',
              onSelect: () => onMove(index + 1),
              disabled: index === total - 1,
            },
            { label: 'Duplicate', onSelect: onDuplicate },
            { label: 'Delete', onSelect: onRemove, destructive: true },
          ]}
        />
      </div>

      <div className={styles.blockBody}>
        {block.type === 'heading' && (
          <HeadingBlockEditor block={block} onChange={onChange} />
        )}
        {block.type === 'text' && (
          <TextBlockEditor block={block} onChange={onChange} />
        )}
        {block.type === 'pricing' && (
          <PricingBlockEditor
            block={block}
            onChange={onChange}
            currency={currency}
          />
        )}
        {block.type === 'terms' && (
          <TermsBlockEditor block={block} onChange={onChange} />
        )}
      </div>
    </li>
  )
}
