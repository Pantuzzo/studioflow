import { Button } from '@/components/ui/Button'
import { useDirection } from './useDirection'

/**
 * Flips the writing direction of the whole app.
 *
 * It sits next to the theme toggle because it is the same kind of control: a
 * switch that proves the layout is not hardcoded to one way of reading.
 */
export function DirectionToggle() {
  const { direction, toggle } = useDirection()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={
        direction === 'ltr'
          ? 'Switch to right-to-left layout'
          : 'Switch to left-to-right layout'
      }
      title="Writing direction"
    >
      {direction === 'ltr' ? 'LTR' : 'RTL'}
    </Button>
  )
}
