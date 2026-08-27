import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { newBlockId } from '../documentReducer'
import styles from '../Editor.module.css'
import type { BlockEditorProps } from './types'

/**
 * A list within a list. Clauses reorder with buttons rather than dragging:
 * nesting a second drag context inside the document's would mean two overlapping
 * keyboard grammars, and the clauses are short enough that buttons are simply
 * better here.
 */
export function TermsBlockEditor({
  block,
  onChange,
}: BlockEditorProps<'terms'>) {
  function move(index: number, delta: number) {
    const to = index + delta
    if (to < 0 || to >= block.clauses.length) return
    const clauses = [...block.clauses]
    const [moved] = clauses.splice(index, 1)
    clauses.splice(to, 0, moved!)
    onChange({ ...block, clauses })
  }

  return (
    <div className={styles.terms}>
      <ol className={styles.clauseList}>
        {block.clauses.map((clause, index) => (
          <li key={clause.id} className={styles.clause}>
            <Input
              aria-label={`Clause ${index + 1}`}
              value={clause.text}
              placeholder="A term of the agreement"
              onChange={(event) =>
                onChange({
                  ...block,
                  clauses: block.clauses.map((other) =>
                    other.id === clause.id
                      ? { ...other, text: event.target.value }
                      : other,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={index === 0}
              aria-label={`Move clause ${index + 1} up`}
              onClick={() => move(index, -1)}
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={index === block.clauses.length - 1}
              aria-label={`Move clause ${index + 1} down`}
              onClick={() => move(index, 1)}
            >
              ↓
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove clause ${index + 1}`}
              onClick={() =>
                onChange({
                  ...block,
                  clauses: block.clauses.filter(
                    (other) => other.id !== clause.id,
                  ),
                })
              }
            >
              Remove
            </Button>
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="soft"
        size="sm"
        onClick={() =>
          onChange({
            ...block,
            clauses: [...block.clauses, { id: newBlockId('cl'), text: '' }],
          })
        }
      >
        Add clause
      </Button>
    </div>
  )
}
