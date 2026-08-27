import { forwardRef, type ReactNode } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import styles from './DropdownMenu.module.css'

export interface DropdownMenuItemSpec {
  label: string
  onSelect: () => void
  disabled?: boolean
  /** Styled as destructive; still just a menu item to assistive tech. */
  destructive?: boolean
}

export interface DropdownMenuProps {
  /** The control that opens the menu — a Button, typically. */
  trigger: ReactNode
  items: DropdownMenuItemSpec[]
  align?: 'start' | 'end'
  className?: string
}

/**
 * A menu of actions, declared as data the way Select declares its options.
 *
 * Radix owns the parts that are easy to get wrong: roving focus, typeahead,
 * Escape, click-outside, and returning focus to the trigger on close. That last
 * one is why this exists at all — the block menu is the keyboard route to
 * reordering, so focus has to come back where it started.
 */
export const DropdownMenu = forwardRef<HTMLButtonElement, DropdownMenuProps>(
  function DropdownMenu({ trigger, items, align = 'end', className }, ref) {
    return (
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild ref={ref}>
          {trigger}
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            className={[styles.content, className].filter(Boolean).join(' ')}
            align={align}
            sideOffset={4}
            collisionPadding={8}
          >
            {items.map((item) => (
              <DropdownMenuPrimitive.Item
                key={item.label}
                className={styles.item}
                disabled={item.disabled}
                data-destructive={item.destructive || undefined}
                onSelect={item.onSelect}
              >
                {item.label}
              </DropdownMenuPrimitive.Item>
            ))}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    )
  },
)
