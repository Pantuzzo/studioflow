# StudioFlow — Roadmap (build in public)

~10 weeks. Each phase ships **one feature** and **one LinkedIn post**. Quality bar per
feature (Definition of Done): typed (no `any`) · tested (unit + integration) ·
accessible (keyboard + axe clean) · responsive · loading/error/empty states ·
documented.

| Week | Ship                                                                | Specialist focus                     | LinkedIn post                                                     |
| ---- | ------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| 1    | Tooling, CI, design tokens, first ADRs, app shell + data layer      | Platform setup; documented decisions | "Starting a SaaS from scratch — how I structure a senior project" |
| 2    | Design system + Storybook                                           | Accessible, composable components    | "Building an accessible design system with Radix"                 |
| 3    | Auth + app shell + RTK Query + MSW hardening                        | State & data architecture            | "Redux Toolkit + RTK Query at scale"                              |
| 4    | Clients & Projects (CRUD, RHF + Zod, optimistic updates + rollback) | Data flows + resilience              | "Optimistic UI with rollback"                                     |
| 5    | 🌟 Proposal builder (block editor, dnd-kit, autosave)               | Complex, accessible DnD              | "A drag-and-drop editor that's actually accessible"               |
| 6    | Time tracking in MobX (timers, timesheets, virtualized lists)       | 2nd state manager + virtualization   | "Why I reached for MobX here (not Redux)"                         |
| 7    | Invoices (generate from hours, multi-currency, PDF)                 | i18n/l10n with `Intl`                | "Real i18n: currencies, plurals, and RTL"                         |
| 8    | Payments with Stripe (test mode, payment states, webhooks)          | Payment integration + state machine  | "Integrating Stripe: the states nobody shows you"                 |
| 9    | Hardening: Lighthouse CI, Playwright e2e, axe, bundle analysis      | Measured performance + audited a11y  | "Before/after: 62 → 98 on Lighthouse (with numbers)"              |
| 10   | Deploy, README, demo video, case-study article                      | Professional presentation            | Long-form: "I built a mini-Bonsai — what I learned"               |

## Backend note

Weeks 1–6 run **mock-first** on MSW. From Week 7, a thin **Hono + Prisma + Postgres**
backend takes over so persistence and Stripe work end-to-end in the live demo. The REST
contract defined by the MSW handlers stays identical.
