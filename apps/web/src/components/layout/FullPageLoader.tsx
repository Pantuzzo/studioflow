import styles from './FullPageLoader.module.css'

/**
 * Shown while the session is being checked. It announces itself politely rather
 * than assertively — this is progress, not an alert.
 */
export function FullPageLoader({ label }: { label: string }) {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.label}>{label}</p>
    </div>
  )
}
