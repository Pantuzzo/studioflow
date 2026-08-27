import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import styles from '../Editor.module.css'
import type { BlockEditorProps } from './types'

const LEVEL_OPTIONS = [
  { value: '2', label: 'Section (H2)' },
  { value: '3', label: 'Sub-section (H3)' },
]

/**
 * The level is a choice, not a style: the document sits inside a page that
 * already owns the h1, so these are the only two the outline allows, and the
 * contract enforces the same thing.
 */
export function HeadingBlockEditor({
  block,
  onChange,
}: BlockEditorProps<'heading'>) {
  return (
    <div className={styles.fieldRow}>
      <Field label="Heading">
        <Input
          value={block.text}
          placeholder="Section title"
          onChange={(event) => onChange({ ...block, text: event.target.value })}
        />
      </Field>
      <Field label="Level">
        <Select
          value={String(block.level)}
          options={LEVEL_OPTIONS}
          onValueChange={(value) =>
            onChange({ ...block, level: value === '3' ? 3 : 2 })
          }
        />
      </Field>
    </div>
  )
}
