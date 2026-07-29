import { cloneElement, useId, type ReactElement } from 'react'
import styles from './Field.module.css'

/** Props the Field injects into its single control child. */
export interface ControlProps {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  required?: boolean
}

export interface FieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  /** A single form control (Input, Textarea, …). */
  children: ReactElement<ControlProps>
}

/**
 * Accessible field scaffold: renders the label, optional hint and error, and
 * wires the control with a generated id, `aria-describedby` (hint + error),
 * `aria-invalid`, and `required`. The required marker is CSS-only so it stays
 * out of the control's accessible name (`required` conveys it to AT).
 */
export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const control = cloneElement(children, {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    required,
  })

  return (
    <div className={styles.field}>
      <label
        htmlFor={id}
        className={styles.label}
        data-required={required || undefined}
      >
        {label}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {control}
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
