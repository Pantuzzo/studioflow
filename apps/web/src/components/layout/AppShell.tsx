import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useToast } from '@/components/ui/Toast'
import { useLogoutMutation } from '@/features/auth/authApi'
import { useSession } from '@/features/auth/useSession'
import styles from './AppShell.module.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/clients', label: 'Clients' },
] as const

export function AppShell() {
  const { user } = useSession()
  const [logout, { isLoading: isSigningOut }] = useLogoutMutation()
  const { toast } = useToast()

  // No navigate() needed: logout clears the session cache, so RequireAuth
  // re-renders and sends the visitor to /login on its own.
  async function handleSignOut() {
    await logout()
      .unwrap()
      .catch(() => undefined)
    toast({ title: 'Signed out', variant: 'success' })
  }

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
          {user && (
            <div className={styles.user}>
              <p className={styles.userName}>{user.name}</p>
              <p className={styles.userEmail}>{user.email}</p>
            </div>
          )}
          <div className={styles.footerActions}>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              aria-busy={isSigningOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <main id="main" className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
