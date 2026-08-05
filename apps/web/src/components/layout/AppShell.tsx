import { NavLink, Outlet } from 'react-router-dom'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import styles from './AppShell.module.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/clients', label: 'Clients' },
] as const

export function AppShell() {
  return (
    <div className={styles.shell}>
      <a href="#main" className="sf-skip-link">
        Skip to content
      </a>

      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            S
          </span>
          StudioFlow
        </div>
        <nav aria-label="Primary">
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    isActive
                      ? `${styles.navLink} ${styles.navLinkActive}`
                      : styles.navLink
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.sidebarFooter}>
          <ThemeToggle />
        </div>
      </aside>

      <main id="main" className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
