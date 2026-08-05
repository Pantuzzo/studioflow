import styles from './DashboardPage.module.css'

const STATS = [
  { label: 'Active clients', value: '3' },
  { label: 'Open proposals', value: '2' },
  { label: 'Unpaid invoices', value: '$4,200' },
  { label: 'Tracked this week', value: '18h 40m' },
] as const

export function DashboardPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Dashboard</h1>
        <p className={styles.subtitle}>Your studio at a glance.</p>
      </header>
      <section className={styles.grid} aria-label="Key metrics">
        {STATS.map((stat) => (
          <article key={stat.label} className={styles.card}>
            <p className={styles.cardLabel}>{stat.label}</p>
            <p className={styles.cardValue}>{stat.value}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
