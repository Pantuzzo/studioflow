import { useCallback, useEffect, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const KEY = 'sf-theme'

function readStored(): Theme {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

function apply(theme: Theme): void {
  const el = document.documentElement
  if (theme === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', theme)
}

/**
 * Theme state as a manual override on top of `prefers-color-scheme`.
 * `system` clears the override (CSS falls back to the media query);
 * `light`/`dark` set `data-theme` on <html> and persist to localStorage.
 * The initial paint is handled by an inline script in index.html to avoid a
 * flash of the wrong theme; this hook keeps it in sync afterwards.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStored)

  useEffect(() => {
    apply(theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    if (next === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
    setThemeState(next)
  }, [])

  return { theme, setTheme }
}
