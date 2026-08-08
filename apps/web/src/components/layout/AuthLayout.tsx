import type { ReactNode } from 'react'
import styles from './AuthLayout.module.css'

/** Centred card shared by the public auth screens. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <header className={styles.header}>
          <span className={styles.brandMark} aria-hidden="true">
            S
          </span>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </header>
        {children}
      </main>
      {footer && <p className={styles.footer}>{footer}</p>}
    </div>
  )
}
