import { Field } from '@/components/ui/Field'
import { Textarea } from '@/components/ui/Textarea'
import type { BlockEditorProps } from './types'

/**
 * Plain text, deliberately. A formatting toolbar is a rich-text editor in
 * disguise, and that is a project of its own — structure comes from the block
 * types instead.
 */
export function TextBlockEditor({ block, onChange }: BlockEditorProps<'text'>) {
  return (
    <Field label="Text">
      <Textarea
        rows={4}
        value={block.text}
        placeholder="What this section says…"
        onChange={(event) => onChange({ ...block, text: event.target.value })}
      />
    </Field>
  )
}
