import { useState } from 'react'
import type { ProposalBlock, ProposalDocument } from '@studioflow/contracts'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { BlockCard } from './BlockCard'
import { BLOCK_LABELS } from './blocks/types'
import styles from './Editor.module.css'

export interface BlockListProps {
  blocks: ProposalDocument
  currency: string
  onChange: (block: ProposalBlock) => void
  onMove: (id: string, to: number) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
}

export function BlockList({
  blocks,
  currency,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: BlockListProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicking into a text
    // field inside a block does not begin dragging it.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const describe = (id: string | number) => {
    const index = blocks.findIndex((block) => block.id === id)
    if (index === -1) return 'block'
    return `${BLOCK_LABELS[blocks[index]!.type]} block`
  }
  const positionOf = (id: string | number) =>
    blocks.findIndex((block) => block.id === id) + 1

  /**
   * Spoken aloud during a keyboard drag. dnd-kit ships defaults, but they can
   * only say "item"; naming the block and its position is the difference
   * between a usable reorder and a guess.
   */
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${describe(active.id)}, position ${positionOf(active.id)} of ${blocks.length}. Use the arrow keys to move it, space to drop, escape to cancel.`,
    onDragOver: ({ active, over }) =>
      // Nothing to say while it is still over its own position. Beyond being
      // noise, announcing it silently destroyed the message above: dnd-kit
      // fires this immediately after onDragStart, React commits both in one
      // render, and the live region only ever showed the second one. The
      // instructions were written, shipped, and never once spoken. The
      // end-to-end suite found that on its first run.
      over && over.id !== active.id
        ? `${describe(active.id)} is now over position ${positionOf(over.id)} of ${blocks.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${describe(active.id)} dropped at position ${positionOf(over.id)} of ${blocks.length}.`
        : `${describe(active.id)} returned to where it started.`,
    onDragCancel: ({ active }) =>
      `Reorder cancelled. ${describe(active.id)} returned to where it started.`,
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const to = blocks.findIndex((block) => block.id === over.id)
    if (to !== -1) onMove(String(active.id), to)
  }

  const dragging = blocks.find((block) => block.id === draggingId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <SortableContext
        items={blocks.map((block) => block.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol className={styles.list}>
          {blocks.map((block, index) => (
            <BlockCard
              key={block.id}
              block={block}
              index={index}
              total={blocks.length}
              currency={currency}
              onChange={onChange}
              onMove={(to) => onMove(block.id, to)}
              onDuplicate={() => onDuplicate(block.id)}
              onRemove={() => onRemove(block.id)}
            />
          ))}
        </ol>
      </SortableContext>

      {/* A small ghost that follows the pointer, so the card being moved stays
          legible while the list shifts underneath it. */}
      <DragOverlay>
        {dragging ? (
          <div className={styles.dragGhost}>{BLOCK_LABELS[dragging.type]}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
