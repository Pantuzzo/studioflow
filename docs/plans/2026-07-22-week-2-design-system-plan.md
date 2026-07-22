# Week 2 — Design System + Storybook Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a showcase-quality design system — documented foundations, a theme toggle, and 8 accessible primitives (Button→Dialog) — each with a story, a Vitest/Testing-Library test, and clean a11y in both themes.

**Architecture:** Radix Primitives own behaviour/focus/ARIA for complex widgets; we style 100% with CSS Modules + CSS custom-property tokens; CVA gives typed variant APIs mapping to CSS Module classes. Roboto is self-hosted. Theming is `data-theme` on `<html>` (manual override on top of `prefers-color-scheme`), persisted to localStorage.

**Tech Stack:** React 19 · TypeScript (strict) · Radix Primitives · class-variance-authority · CSS Modules + tokens · `@fontsource-variable/roboto` · Storybook (Vite builder) + addon-a11y · Vitest + Testing Library.

**Companion design doc:** `docs/plans/2026-07-22-week-2-design-system-design.md`

**Conventions for the executor:**

- Commit after every green task. Commit messages must NOT include any Claude/Co-Authored-By trailer (user preference; `includeCoAuthoredBy` is false).
- After each component: `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check` must pass before commit.
- Where a step says **VERIFY API**, open the library's current docs/types before writing code — do not assume an API version. State what you found.
- Test pattern to copy: `src/features/clients/ClientsPage.test.tsx` (uses `renderWithProviders`, MSW, Testing Library).

---

## Phase 0 — Setup

### Task 1: Install dependencies

**Files:** `package.json`, `pnpm-lock.yaml`

**Step 1:** Install runtime deps:
```bash
pnpm add class-variance-authority @fontsource-variable/roboto \
  @radix-ui/react-slot @radix-ui/react-checkbox @radix-ui/react-radio-group \
  @radix-ui/react-select @radix-ui/react-dialog
```
**VERIFY API:** confirm `@fontsource-variable/roboto` exists and exposes a variable face; if not, fall back to `@fontsource/roboto` (import weights 400/500/700). Note which you used.

**Step 2:** Verify install and that the app still builds:
```bash
pnpm build
```
Expected: build succeeds.

**Step 3: Commit**
```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add Radix primitives, CVA, and Roboto font deps"
```

---

### Task 2: Initialize Storybook (Vite builder) + a11y addon

**Files:** `.storybook/main.ts`, `.storybook/preview.ts`(x), `package.json`, `eslint.config.js`

**Step 1: VERIFY API** — run the init and let it detect Vite/React:
```bash
pnpm dlx storybook@latest init --builder vite --yes
```
Record the exact Storybook version it installed (pin it). It adds `storybook`/`build-storybook` scripts and a `stories` glob.

**Step 2:** Add the a11y addon:
```bash
pnpm add -D @storybook/addon-a11y
```
Register it in `.storybook/main.ts` `addons`. **VERIFY API:** in current Storybook the docs addon may be bundled or separate — ensure autodocs is enabled (`docs: { autodocs: 'tag' }` or the current equivalent).

**Step 3:** In `.storybook/preview.ts(x)` import the token + global CSS and the Roboto font so stories render with the real design language:
```ts
import '@fontsource-variable/roboto' // or the static import chosen in Task 1
import '../src/styles/tokens.css'
import '../src/styles/global.css'
```

**Step 4:** Clean up: delete the boilerplate `src/stories/` Storybook example folder. Add `storybook-static` to `.gitignore` and `.prettierignore`. Ensure `eslint.config.js` ignores `!.storybook` correctly and lints `.storybook`.

**Step 5:** Verify dev + build:
```bash
pnpm storybook        # loads with no example stories
pnpm build-storybook  # produces storybook-static/
```
Expected: both succeed.

**Step 6: Commit**
```bash
git add -A
git commit -m "chore: set up Storybook (Vite builder) with a11y addon"
```

---

### Task 3: Roboto + token extensions

**Files:** Modify `src/main.tsx`, `src/styles/tokens.css`

**Step 1:** Import Roboto once at the app entry (`src/main.tsx`, top with the other CSS imports):
```ts
import '@fontsource-variable/roboto' // match Task 1's choice
```

**Step 2:** In `src/styles/tokens.css` set the sans stack and add the component tokens (light `:root` and the dark `@media` block):
```css
--sf-font-sans: 'Roboto', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

/* Interaction / component tokens */
--sf-ring: var(--sf-primary);      /* focus ring color */
--sf-primary-active: #3730a3;      /* pressed (dark block: a lighter indigo) */
--sf-surface-disabled: #e2e8f0;    /* dark block: #1e293b */

/* Motion */
--sf-duration-fast: 120ms;
--sf-ease: cubic-bezier(0.2, 0, 0, 1);
```
Add the dark-theme values in the existing `@media (prefers-color-scheme: dark)` block.

**Step 3:** Point the global focus ring at the token in `src/styles/global.css`:
```css
:focus-visible { outline: 2px solid var(--sf-ring); outline-offset: 2px; border-radius: 4px; }
```

**Step 4:** Verify visually — run `pnpm dev`, confirm the app now renders in Roboto (inspect computed `font-family` on `body`).

**Step 5: Commit**
```bash
git add src/main.tsx src/styles/tokens.css src/styles/global.css
git commit -m "feat: load Roboto and add interaction/motion tokens"
```

---

### Task 4: Theming — `useTheme` hook + `data-theme` + ThemeToggle

**Files:** Create `src/theme/useTheme.ts`, `src/theme/useTheme.test.ts`, `src/components/ui/ThemeToggle/ThemeToggle.tsx` (+ `.module.css`, `.stories.tsx`, `.test.tsx`, `index.ts`). Modify `src/styles/tokens.css`, `src/components/layout/AppShell.tsx`.

**Step 1: Write the failing test** (`src/theme/useTheme.test.ts`):
```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useTheme } from './useTheme'

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('useTheme', () => {
  it('defaults to system (no data-theme attribute, no stored value)', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('sets and persists an explicit theme', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('sf-theme')).toBe('dark')
  })

  it('clearing back to system removes the attribute', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('light'))
    act(() => result.current.setTheme('system'))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})
```

**Step 2: Run to verify it fails**
```bash
pnpm test src/theme/useTheme.test.ts
```
Expected: FAIL (module not found).

**Step 3: Implement `src/theme/useTheme.ts`:**
```ts
import { useCallback, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'
const KEY = 'sf-theme'

function apply(theme: Theme) {
  const el = document.documentElement
  if (theme === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', theme)
}

function read(): Theme {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function useTheme() {
  const [theme, set] = useState<Theme>(() => {
    const t = read()
    apply(t)
    return t
  })
  const setTheme = useCallback((t: Theme) => {
    if (t === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
    apply(t)
    set(t)
  }, [])
  return { theme, setTheme }
}
```

**Step 4:** Add explicit-override CSS to `src/styles/tokens.css` so a manual choice beats the media query. Duplicate the light values under `:root[data-theme='light']` and the dark values under `:root[data-theme='dark']` (these win over `@media` because of specificity + source order). Keep the existing `:root` and `@media` blocks for the system default.

**Step 5: Run to verify pass**
```bash
pnpm test src/theme/useTheme.test.ts
```
Expected: PASS.

**Step 6:** Build `ThemeToggle` (follow the Button template from Task 5 for file layout). It cycles system→light→dark or offers 3 buttons; must have an accessible name (`aria-label`) and indicate the current value (`aria-pressed` or a segmented `role="radiogroup"`). Add a test asserting it updates `data-theme`, and a story. Mount it in `AppShell` (in the sidebar brand row).

**Step 7:** Verify all gates, then commit:
```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
git add -A
git commit -m "feat: theme toggle with data-theme override and persistence"
```

---

## Phase 1 — Component template + Foundations

### Task 5: Button (the reference component)

This task establishes the pattern every later component copies: Radix + CVA + CSS Modules, `forwardRef`, `asChild`, typed variants, story, test.

**Files:** Create `src/components/ui/Button/Button.tsx`, `Button.module.css`, `Button.stories.tsx`, `Button.test.tsx`, `index.ts`.

**Step 1: Write the failing test** (`Button.test.tsx`):
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders as a button and handles clicks', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies the variant/size classes', () => {
    render(<Button variant="ghost" size="sm">X</Button>)
    // class names are hashed; assert the element exists and is a button
    expect(screen.getByRole('button', { name: 'X' })).toBeInTheDocument()
  })

  it('renders as a link when asChild is used', () => {
    render(<Button asChild><a href="/x">Go</a></Button>)
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/x')
  })

  it('is not clickable when disabled', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>No</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

**Step 2: Run to verify it fails**
```bash
pnpm test src/components/ui/Button/Button.test.tsx
```
Expected: FAIL (module not found).

**Step 3: Implement `Button.tsx`:**
```tsx
import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import styles from './Button.module.css'

const button = cva(styles.base, {
  variants: {
    variant: { solid: styles.solid, soft: styles.soft, ghost: styles.ghost },
    size: { sm: styles.sm, md: styles.md, lg: styles.lg },
  },
  defaultVariants: { variant: 'solid', size: 'md' },
})

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & { asChild?: boolean }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, asChild = false, ...props }, ref) {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp ref={ref} className={button({ variant, size, className })} {...props} />
    )
  },
)
```
And `index.ts`: `export { Button, type ButtonProps } from './Button'`.

**Step 4:** Write `Button.module.css` using tokens only (no raw colors): `.base` (inline-flex, gap, radius, font, focus handled globally, `disabled` opacity + `cursor: not-allowed`, `transition` using `--sf-duration-fast`/`--sf-ease`), `.solid/.soft/.ghost` (backgrounds via `--sf-primary` / `--sf-surface-subtle` / transparent; hover uses `--sf-primary-hover`; active uses `--sf-primary-active`), `.sm/.md/.lg` (padding + font-size from tokens). Respect `@media (prefers-reduced-motion: reduce) { .base { transition: none } }`.

**Step 5: Run to verify pass**
```bash
pnpm test src/components/ui/Button/Button.test.tsx
```
Expected: PASS.

**Step 6:** Write `Button.stories.tsx`: a default story, a story per variant, per size, a disabled story, and an `asChild` link story. Add the `autodocs` tag. Confirm the a11y addon shows no violations in the Storybook UI.

**Step 7:** Verify gates + commit:
```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
git add src/components/ui/Button
git commit -m "feat: Button component (Radix Slot + CVA template)"
```

---

### Task 6: Foundations Storybook page

**Files:** Create `src/components/ui/Foundations.mdx` (or `Foundations.stories.tsx` if MDX setup is heavier). **VERIFY API** for the current Storybook MDX docs format.

**Step 1:** Render live tokens: color swatches for every `--sf-*` color (shown in light and dark via the theme toolbar), the type scale (`--sf-text-*`), and the spacing scale (`--sf-space-*`). Read them from CSS, not hardcoded hex.

**Step 2:** Verify it renders in `pnpm storybook` under a "Foundations" section.

**Step 3: Commit**
```bash
git add src/components/ui/Foundations.mdx
git commit -m "docs: Foundations page (tokens, type scale, spacing) in Storybook"
```

---

## Phase 2 — Form + overlay components

Each task below follows the **Button template** (files, `forwardRef`, CVA where variants exist, CSS Modules + tokens, story with all states, Vitest test, a11y clean). Steps are always: (1) write failing test, (2) run→fail, (3) implement, (4) run→pass, (5) story, (6) gates + commit. Only the per-component specifics are listed.

### Task 7: Field (a11y backbone for inputs)

**Files:** `src/components/ui/Field/Field.{tsx,module.css,stories.tsx,test.tsx}`, `index.ts`.

**Spec:** Composition (no Radix required, or use `@radix-ui/react-label`). Renders `<label>`, optional description/hint, optional error message, and required indicator. Generates an `id` (React `useId`) and exposes wiring so the child control gets `id`, `aria-describedby` (hint + error ids), and `aria-invalid` when errored. Design the API — recommended: a `Field` that provides context, plus `Field.Label`, `Field.Hint`, `Field.Error`, and a render that passes control props. **Keep it minimal**; Input (Task 8) is its first consumer.

**Key tests:**
- Label is associated with the control (`getByLabelText` finds it).
- When `error` is set, the control has `aria-invalid="true"` and `aria-describedby` includes the error id; the error has `role="alert"`.
- The hint id is in `aria-describedby` when no error.

### Task 8: Input

**Files:** `src/components/ui/Input/Input.{tsx,module.css,stories.tsx,test.tsx}`, `index.ts`.

**Spec:** `forwardRef` native `<input>` styled with tokens; CVA for `size` (sm/md/lg) and an `invalid` boolean variant (red border via `--sf-danger`). Integrates with Field (accepts the wiring props). No new deps.

**Key tests:** renders with a given `type`, forwards `ref`, shows invalid styling when `aria-invalid`, and is reachable by label when wrapped in Field.

### Task 9: Textarea

**Files:** `src/components/ui/Textarea/…`.

**Spec:** Same as Input but `<textarea>` (multiline). CVA `invalid` variant; sensible default `rows`. Integrates with Field.

**Key tests:** forwards ref, accepts value/onChange, invalid styling, label association via Field.

### Task 10: Checkbox

**Files:** `src/components/ui/Checkbox/…`. **VERIFY API:** `@radix-ui/react-checkbox` composition (`Root`/`Indicator`).

**Spec:** Wrap Radix Checkbox; style the box + check indicator with tokens; support `checked`/`defaultChecked`/`onCheckedChange`, `disabled`, and an accessible label (via Field or a passed label). Keyboard (space) comes from Radix.

**Key tests:** toggles on click and on space, reflects `checked`, exposes `role="checkbox"` with correct `aria-checked`, respects `disabled`.

### Task 11: RadioGroup

**Files:** `src/components/ui/RadioGroup/…`. **VERIFY API:** `@radix-ui/react-radio-group` (`Root`/`Item`/`Indicator`).

**Spec:** Wrap Radix RadioGroup; expose `RadioGroup` + `RadioGroup.Item` (or an `items` prop). Arrow-key roving focus comes from Radix. Style with tokens; integrate with Field for the group label (`role="radiogroup"` + `aria-labelledby`).

**Key tests:** selecting an item updates value, arrow keys move selection, only one item is `aria-checked`, group has an accessible name.

### Task 12: Select

**Files:** `src/components/ui/Select/…`. **VERIFY API:** `@radix-ui/react-select` (`Root/Trigger/Value/Content/Viewport/Item/ItemText/ItemIndicator/Portal`).

**Spec:** Wrap Radix Select; expose a `Select` with `Select.Item`s (or `options` prop). Style trigger (looks like Input), content panel, item hover/selected states, and the check indicator — all via tokens. Portaled content; ensure it renders inside the theme scope (portal to `document.body` still inherits tokens from `:root`, so fine). Test in a `Field` for the label.

**Key tests:** opening shows options, selecting updates the trigger's displayed value and fires `onValueChange`, keyboard (Enter/Arrow/typeahead) works, trigger has `aria-expanded`. **Note:** Radix Select uses pointer APIs; in tests prefer `userEvent` and, if needed, `findByRole('option')` after opening. If jsdom/happy-dom pointer quirks appear, document the workaround (this is a known Radix-in-test friction point).

### Task 13: Dialog

**Files:** `src/components/ui/Dialog/…`. **VERIFY API:** `@radix-ui/react-dialog` (`Root/Trigger/Portal/Overlay/Content/Title/Description/Close`).

**Spec:** Wrap Radix Dialog; expose `Dialog` with `Dialog.Trigger`, `Dialog.Content` (requires `Title`; include a visually-hidden `Description` option), and a styled overlay + close button. Focus trap, ESC-to-close, scroll-lock, and `aria-modal` come from Radix. Style with tokens; animate open/close respecting `prefers-reduced-motion`.

**Key tests:** opening renders `role="dialog"` with an accessible name (Title), focus moves into the dialog, ESC closes it, and focus returns to the trigger on close.

---

## Phase 3 — Wrap-up

### Task 14: Barrel exports + CI Storybook gate + final verification

**Files:** `src/components/ui/index.ts`, `.github/workflows/ci.yml`.

**Step 1:** Barrel-export all components from `src/components/ui/index.ts`.

**Step 2:** Add a `build-storybook` step to `.github/workflows/ci.yml` after Build:
```yaml
      - name: Build Storybook
        run: pnpm build-storybook
```

**Step 3:** Full local verification:
```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:coverage && pnpm build && pnpm build-storybook
```
Expected: all green; ui components at high coverage.

**Step 4: Commit + push**
```bash
git add -A
git commit -m "chore: barrel exports and build-storybook CI gate"
git push origin main
```

**Step 5:** Confirm CI passes on GitHub (`gh run watch`), including the new Storybook step.

---

## Definition of Done (Week 2)

Roboto loaded · theming with toggle · extended tokens · 8 components (Button→Dialog) each with story + Vitest test + clean a11y in both themes · Foundations page in Storybook · `build-storybook` green in CI. Tooltip and Toast are explicitly deferred to early Week 3.
