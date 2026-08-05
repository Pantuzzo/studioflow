import { forwardRef, type TextareaHTMLAttributes } from 'react'
import styles from './Textarea.module.css'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={[styles.base, className].filter(Boolean).join(' ')}
        {...props}
      />
    )
  },
)
