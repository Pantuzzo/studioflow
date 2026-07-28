import { forwardRef, useId, type ComponentPropsWithoutRef } from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import styles from './RadioGroup.module.css'

export interface RadioOption {
  value: string
  label: string
  disabled?: boolean
}

export type RadioGroupProps = Omit<
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
  'children'
> & {
  label: string
  options: RadioOption[]
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  function RadioGroup({ label, options, className, ...props }, ref) {
    const labelId = useId()
    return (
      <div className={styles.wrapper}>
        <span id={labelId} className={styles.groupLabel}>
          {label}
        </span>
        <RadioGroupPrimitive.Root
          ref={ref}
          aria-labelledby={labelId}
          className={[styles.root, className].filter(Boolean).join(' ')}
          {...props}
        >
          {options.map((opt) => {
            const itemId = `${labelId}-${opt.value}`
            return (
              <div key={opt.value} className={styles.option}>
                <RadioGroupPrimitive.Item
                  id={itemId}
                  value={opt.value}
                  disabled={opt.disabled}
                  className={styles.item}
                >
                  <RadioGroupPrimitive.Indicator className={styles.indicator} />
                </RadioGroupPrimitive.Item>
                <label htmlFor={itemId} className={styles.itemLabel}>
                  {opt.label}
                </label>
              </div>
            )
          })}
        </RadioGroupPrimitive.Root>
      </div>
    )
  },
)
