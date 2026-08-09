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

**Superseded during Week 3.** The original plan was mock-first through Week 6, with a thin
**Hono** backend arriving in Week 7. The backend was brought forward instead, and built in
**NestJS + Prisma + Postgres** — see [ADR 0005](adr/0005-monorepo-and-nestjs-backend.md).

The trigger was authentication: it is inherently full-stack, and building it against MSW
first would have meant simulating an httpOnly cookie only to throw that work away. The
repository became a pnpm monorepo (`apps/web`, `apps/api`, `packages/contracts`) so the Zod
contract has a single definition shared by the API, the client and the mocks.

**MSW did not go away** — it remains the web client's test double, so frontend tests never
need Postgres, and it now mirrors the real contract rather than defining it.

Week 3 therefore delivered rather more than the row above suggests: the monorepo, the shared
contract package, the API with Swagger, cookie-session authentication with rotation and CSRF
defence ([ADR 0006](adr/0006-session-security.md)), guarded routing, and the login, signup
and password-reset screens.
