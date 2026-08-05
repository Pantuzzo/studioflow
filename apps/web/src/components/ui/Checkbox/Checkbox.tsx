import { forwardRef, useId, type ComponentPropsWithoutRef } from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import styles from './Checkbox.module.css'

export type CheckboxProps = ComponentPropsWithoutRef<
  typeof CheckboxPrimitive.Root
> & {
  label: string
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 6.5 5 9l4.5-5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  function Checkbox({ label, id, className, ...props }, ref) {
    const generatedId = useId()
    const controlId = id ?? generatedId
    return (
      <div className={styles.wrapper}>
        <CheckboxPrimitive.Root
          ref={ref}
          id={controlId}
          className={[styles.root, className].filter(Boolean).join(' ')}
          {...props}
        >
          <CheckboxPrimitive.Indicator className={styles.indicator}>
            <CheckIcon />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        <label htmlFor={controlId} className={styles.label}>
          {label}
        </label>
      </div>
    )
  },
)
