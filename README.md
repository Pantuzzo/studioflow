# StudioFlow

> A mini operations SaaS for agencies and freelancers — **clients → projects → proposals → contracts → time tracking → invoices → payments**. Built in public to demonstrate senior-level engineering.

StudioFlow is a portfolio project deliberately modeled on tools like Bonsai. Each feature is shipped to a **production-grade bar**: typed, tested, accessible, secure, and documented. The goal isn't "another CRUD app" — it's to make architecture, security, accessibility, and testing decisions **visible**.

**Live demo:** _coming soon_ · **API docs:** Swagger at `/docs` when the API is running

---

## Tech stack

| Area                | Choice                                                    |
| ------------------- | --------------------------------------------------------- |
| Web                 | Vite · React 19 · TypeScript (strict)                     |
| Global state / data | Redux Toolkit · RTK Query                                 |
| Local complex state | MobX (the running timer, and nothing else)                |
| Forms & validation  | react-hook-form · Zod                                     |
| Design system       | Radix Primitives · CVA · CSS Modules + tokens · Storybook |
| API                 | NestJS · Prisma · Postgres · Swagger (via `nestjs-zod`)   |
| Auth                | Opaque session in an httpOnly cookie · argon2id · CSRF    |
| Testing             | Vitest + Testing Library (web) · Jest + supertest (API)   |
| Quality gates       | ESLint (jsx-a11y) · Prettier · GitHub Actions             |

## Repository layout

A pnpm workspace, so the API contract has exactly one definition.

```
apps/
├── web/        Vite + React SPA
└── api/        NestJS + Prisma
packages/
└── contracts/  Zod schemas + inferred types — the single source of truth
docs/
├── adr/            Architecture Decision Records
├── plans/          Design and implementation plans
├── DEPLOYMENT.md   How the two artefacts are built and run
└── case-study.md   The decisions, written at the end
```

`packages/contracts` is the load-bearing idea: the same Zod schemas validate requests in NestJS, drive the react-hook-form resolvers in the web app, generate the Swagger docs, and back the MSW handlers. Client and server cannot drift, because there is only one copy of the contract.

## Techniques demonstrated

The recruiter's-eye view — each entry maps to real code.

| Technique                                                                    | Where to look                                                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Shared Zod contract across API, client and mocks                             | [packages/contracts/src](packages/contracts/src)                                                                      |
| Sessions with no token in the browser (argon2id, rotation, reuse detection)  | [apps/api/src/auth](apps/api/src/auth), [ADR 0006](docs/adr/0006-session-security.md)                                 |
| CSRF defence in depth (SameSite + Origin + double submit)                    | [csrf.guard.ts](apps/api/src/auth/csrf.guard.ts)                                                                      |
| Guarded routing with redirect-back and open-redirect protection              | [routes.tsx](apps/web/src/routes.tsx), [intendedPath.ts](apps/web/src/features/auth/intendedPath.ts)                  |
| Single RTK Query API + per-feature endpoint injection                        | [baseApi.ts](apps/web/src/app/baseApi.ts), [clientsApi.ts](apps/web/src/features/clients/clientsApi.ts)               |
| Accessible design system on Radix + CVA, with Storybook                      | [apps/web/src/components/ui](apps/web/src/components/ui)                                                              |
| Forms wired to the shared schema, errors tied to inputs                      | [FormField.tsx](apps/web/src/components/ui/FormField/FormField.tsx)                                                   |
| Design tokens + light/dark theming with a real toggle                        | [tokens.css](apps/web/src/styles/tokens.css)                                                                          |
| Explicit loading / error / empty states                                      | [ClientsPage.tsx](apps/web/src/features/clients/ClientsPage.tsx)                                                      |
| Optimistic writes with rollback on rejection                                 | [clientsApi.ts](apps/web/src/features/clients/clientsApi.ts)                                                          |
| PATCH that carries only what changed                                         | [ClientFormDialog.tsx](apps/web/src/features/clients/ClientFormDialog.tsx)                                            |
| A client-supplied foreign key verified against the caller                    | [projects.service.ts](apps/api/src/projects/projects.service.ts)                                                      |
| Documents as validated JSON — a Zod discriminated union over `jsonb`         | [proposal.ts](packages/contracts/src/proposal.ts), [ADR 0007](docs/adr/0007-proposal-documents-as-validated-json.md)  |
| Drag-and-drop that also works from the keyboard, announced as it moves       | [BlockList.tsx](apps/web/src/features/proposals/editor/BlockList.tsx)                                                 |
| Undo/redo as a pure reducer, tested without a DOM                            | [documentReducer.ts](apps/web/src/features/proposals/editor/documentReducer.ts)                                       |
| Debounced autosave that flushes on unmount and surfaces its failures         | [useAutosave.ts](apps/web/src/features/proposals/editor/useAutosave.ts)                                               |
| Money in integer minor units, rounded once and in the open                   | [money.ts](apps/web/src/features/proposals/editor/money.ts)                                                           |
| Two state managers with a written boundary between them                      | [features/time/README.md](apps/web/src/features/time/README.md), [ADR 0003](docs/adr/0003-redux-toolkit-plus-mobx.md) |
| A once-a-second observable that re-renders one component                     | [timerStore.ts](apps/web/src/features/time/timerStore.ts)                                                             |
| A virtualized timesheet that stays small as it grows                         | [TimeTrackingPage.tsx](apps/web/src/features/time/TimeTrackingPage.tsx)                                               |
| Integration tests through the real data layer (MSW)                          | [ClientsPage.test.tsx](apps/web/src/features/clients/ClientsPage.test.tsx)                                            |
| Invoices as frozen snapshots, not views over live data                       | [invoice.ts](packages/contracts/src/invoice.ts), [invoices.service.ts](apps/api/src/invoices/invoices.service.ts)     |
| An hour that cannot be billed twice, enforced by a column                    | [invoices.service.ts](apps/api/src/invoices/invoices.service.ts)                                                      |
| Real `Intl`: plural rules, currency exponents, relative dates                | [i18n/format.ts](apps/web/src/i18n/format.ts)                                                                         |
| RTL as a toggle, with logical CSS properties throughout                      | [useDirection.ts](apps/web/src/i18n/useDirection.ts)                                                                  |
| PDF via the browser's print pipeline and a real print stylesheet             | [InvoiceDetailPage.module.css](apps/web/src/features/invoices/InvoiceDetailPage.module.css)                           |
| Stripe webhooks: signature over raw bytes, idempotent, out-of-order safe     | [payments.service.ts](apps/api/src/payments/payments.service.ts)                                                      |
| A payment state machine where only the webhook may claim money               | [invoice.ts](packages/contracts/src/invoice.ts)                                                                       |
| A CSRF exemption that is explicit, narrow and documented                     | [auth.constants.ts](apps/api/src/auth/auth.constants.ts)                                                              |
| Route-level code splitting, with a bundle budget enforced in CI              | [routes.tsx](apps/web/src/routes.tsx), [check-bundle-size.mjs](apps/web/scripts/check-bundle-size.mjs)                |
| axe run over real screens in CI, not in a panel nobody reopens               | [accessibility.test.tsx](apps/web/src/test/accessibility.test.tsx)                                                    |
| Browser tests for what a DOM implementation cannot answer at all             | [apps/web/e2e](apps/web/e2e), [e2e/README.md](apps/web/e2e/README.md)                                                 |
| A production image that ships no build tooling and runs no migrations        | [Dockerfile](apps/api/Dockerfile), [DEPLOYMENT.md](docs/DEPLOYMENT.md)                                                |
| API e2e against real Postgres                                                | [apps/api/test](apps/api/test)                                                                                        |
| Architecture Decision Records                                                | [docs/adr](docs/adr)                                                                                                  |
| CI gates: typecheck, lint, format, test, build, Storybook, browser + API e2e | [ci.yml](.github/workflows/ci.yml)                                                                                    |

The ten-week plan is finished. What each week decided, and what it got wrong, is in the [roadmap](docs/ROADMAP.md) notes and the [case study](docs/case-study.md).

## Getting started

**Frontend only** — no database required:

```bash
pnpm install
pnpm dev            # http://localhost:5173, running on MSW mocks
pnpm storybook      # http://localhost:6006
```

**Full stack** — set `VITE_ENABLE_MOCKS=false` in `apps/web/.env` first:

```bash
docker compose up -d                        # Postgres
cp apps/api/.env.example apps/api/.env
pnpm -F @studioflow/api db:migrate          # apply migrations
pnpm -F @studioflow/api db:seed             # demo account, 25 clients, projects, a proposal
pnpm -F @studioflow/api start:dev           # http://localhost:3000/api, docs at /docs
pnpm dev                                    # Vite proxies /api to the API
```

Seed credentials: `ava@northwind.studio` / `password123`.

Other scripts, all workspace-wide:

```bash
pnpm test           # unit + integration
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm -F @studioflow/api test:e2e   # needs Postgres running
pnpm -F @studioflow/web test:e2e   # Playwright: builds and serves the app itself
```

## Deploying

Two artefacts: a container that serves the API, and a directory of static files
that is the web client. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) has the build
commands, the environment table and the measured image size, plus one decision
worth knowing before reading the Dockerfile: **the container does not run
migrations**. Every replica racing the same migration on every restart is not a
deployment strategy, so they run from the pipeline instead.

```bash
docker build -f apps/api/Dockerfile -t studioflow-api .
pnpm --filter @studioflow/web build       # apps/web/dist, a static SPA
```

A build with `VITE_ENABLE_MOCKS=true` needs no API and no database at all: the
whole app runs on the mock layer the tests use. Useful for a demo, and honest
about being one — every reload starts over.

## Security notes

The browser never receives a token of any kind. Its only credential is an opaque, 256-bit session id in an `HttpOnly` cookie, stored server-side as a SHA-256 digest. Sessions rotate, carry both idle and absolute timeouts, and replaying a rotated id revokes the entire session family. [ADR 0006](docs/adr/0006-session-security.md) explains why JWT was rejected for browser sessions and what CSRF work cookie auth makes mandatory.
