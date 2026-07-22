# Week 2 — Design System + Storybook (design)

- **Date:** 2026-07-22
- **Status:** Approved, ready for implementation planning
- **Roadmap:** Week 2 — "Design system + Storybook", focus: accessible, composable components.

## Goal

Ship a small but showcase-quality design system: documented foundations, a
theme toggle, and the accessible form/overlay primitives the next weeks
consume. Every component meets the project Definition of Done (typed, tested,
accessible, story, both themes).

## Decisions

1. **Scope:** foundations + showcase — not just primitives. Includes a live
   "Foundations" Storybook page (tokens, type scale, spacing), a theme toggle,
   and the component set below.
2. **Primitives base:** **Radix Primitives (headless)** own behaviour, focus,
   ARIA and keyboard for the complex widgets. We style 100% ourselves.
3. **Styling / variants:** keep the app's single styling system — **CSS Modules
   + CSS custom-property tokens** — and add **CVA (class-variance-authority)**
   for typed variant APIs that map to CSS Module class names. No utility-class
   framework, no second styling paradigm.
4. **Typography:** **Roboto**, self-hosted via `@fontsource-variable/roboto`
   (fall back to static 400/500/700 if variable is undesirable). Set
   `--sf-font-sans: 'Roboto', system-ui, …`. This also fixes the current
   `'Inter'` token that was never actually loaded (it silently fell back to
   system-ui).
5. **Theming:** add a manual override on top of `prefers-color-scheme`.
   `data-theme="light|dark"` on `<html>`, driven by a `useTheme` hook persisted
   to `localStorage`, defaulting to system. CSS keeps `:root` (light) +
   `@media (prefers-color-scheme: dark)` for auto, plus
   `:root[data-theme="dark"]` / `[data-theme="light"]` explicit overrides that
   win. A `ThemeToggle` lives in the AppShell.

## Component architecture

Colocated per component, mirroring the repo's feature-folder philosophy:

```
src/components/ui/
  Button/  Button.tsx  Button.module.css  Button.stories.tsx  Button.test.tsx  index.ts
  ...
  index.ts   # barrel
```

Every component follows the **Button template**: Radix (behaviour/a11y) + CVA
(variants) + CSS Modules/tokens (visual).

```tsx
const button = cva(styles.base, {
  variants: {
    variant: { solid: styles.solid, soft: styles.soft, ghost: styles.ghost },
    size:    { sm: styles.sm, md: styles.md, lg: styles.lg },
  },
  defaultVariants: { variant: 'solid', size: 'md' },
})

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button' // Radix Slot → polymorphism
    return <Comp ref={ref} className={button({ variant, size, className })} {...props} />
  },
)
```

Non-negotiables per component:

- `forwardRef` always.
- `asChild` via Radix `Slot` where polymorphism helps (Button → link).
- Props typed off the native element + `VariantProps<typeof …>`.
- CVA maps to CSS Module classes, not loose utilities.
- A11y baseline: focus ring via `--sf-ring`, keyboard + ARIA (Radix on complex
  ones), validated contrast in both themes, respects `prefers-reduced-motion`.

## Component set and order

Tied to real upcoming consumption (Week 3 auth, Week 4 CRUD/modals, Week 5
proposal builder). **Ship in Week 2, in this order:**

1. **Button** (template)
2. **Field** — label + hint + error + required, wiring `aria-describedby` /
   `aria-invalid` / `id`. The a11y backbone for all inputs.
3. **Input** (native + Field)
4. **Textarea** (native + Field)
5. **Checkbox** (Radix)
6. **RadioGroup** (Radix)
7. **Select** (Radix)
8. **Dialog** (Radix) — focus trap, ESC, overlay; the marquee a11y piece.

**Deferred to early Week 3** (not blocking, and Toast pairs naturally with
Week 4 optimistic updates): **Tooltip**, **Toast**.

## Storybook, testing, CI

- **Storybook:** latest stable via `storybook init`, **Vite builder**. Pin the
  exact resolved version at implementation time. Addons: **a11y** (axe),
  **docs/autodocs** (Foundations page + per-component docs), and a **theme
  decorator** (light/dark toolbar reusing `data-theme`; Roboto loaded in
  `preview`).
- **Testing — two layers, no duplication:** DoD test per component is **Vitest +
  Testing Library** (same pattern as the Clients test); stories cover
  variants/states and the a11y addon catches a11y regressions. *Optional
  stretch:* Storybook's Vitest addon running stories as tests (portable
  stories).
- **CI:** add a **`build-storybook`** step so a broken story fails the build.
  Deploying Storybook (GH Pages / Chromatic) is deferred with the app deploy but
  noted as a strong portfolio artifact.

## Definition of Done (Week 2)

Roboto loaded + theming with toggle + extended tokens + 8 components
(Button→Dialog), each with story + test + clean a11y + both themes, a
Foundations page in Storybook, and `build-storybook` green in CI.

## Out of scope (YAGNI)

Tooltip/Toast (early Week 3), Table primitive (extract later when a second table
appears), any component no upcoming week consumes.
