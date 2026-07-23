import { useTheme, type Theme } from '@/theme/useTheme'
import styles from './ThemeToggle.module.css'

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'system', label: 'System', icon: '🖥' },
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <div className={styles.group} role="group" aria-label="Theme">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={styles.option}
          aria-pressed={theme === opt.value}
          onClick={() => setTheme(opt.value)}
        >
          <span aria-hidden="true">{opt.icon}</span>
          <span className="sf-visually-hidden">{opt.label} theme</span>
        </button>
      ))}
    </div>
  )
}
