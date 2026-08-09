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
| Local complex state | MobX (time-tracking module, later)                        |
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
├── adr/        Architecture Decision Records
└── plans/      Design and implementation plans
```

`packages/contracts` is the load-bearing idea: the same Zod schemas validate requests in NestJS, drive the react-hook-form resolvers in the web app, generate the Swagger docs, and back the MSW handlers. Client and server cannot drift, because there is only one copy of the contract.

## Techniques demonstrated

The recruiter's-eye view — each entry maps to real code.

| Technique                                                                   | Where to look                                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Shared Zod contract across API, client and mocks                            | [packages/contracts/src](packages/contracts/src)                                                        |
| Sessions with no token in the browser (argon2id, rotation, reuse detection) | [apps/api/src/auth](apps/api/src/auth), [ADR 0006](docs/adr/0006-session-security.md)                   |
| CSRF defence in depth (SameSite + Origin + double submit)                   | [csrf.guard.ts](apps/api/src/auth/csrf.guard.ts)                                                        |
| Guarded routing with redirect-back and open-redirect protection             | [routes.tsx](apps/web/src/routes.tsx), [intendedPath.ts](apps/web/src/features/auth/intendedPath.ts)    |
| Single RTK Query API + per-feature endpoint injection                       | [baseApi.ts](apps/web/src/app/baseApi.ts), [clientsApi.ts](apps/web/src/features/clients/clientsApi.ts) |
| Accessible design system on Radix + CVA, with Storybook                     | [apps/web/src/components/ui](apps/web/src/components/ui)                                                |
| Forms wired to the shared schema, errors tied to inputs                     | [FormField.tsx](apps/web/src/components/ui/FormField/FormField.tsx)                                     |
| Design tokens + light/dark theming with a real toggle                       | [tokens.css](apps/web/src/styles/tokens.css)                                                            |
| Explicit loading / error / empty states                                     | [ClientsPage.tsx](apps/web/src/features/clients/ClientsPage.tsx)                                        |
| Integration tests through the real data layer (MSW)                         | [ClientsPage.test.tsx](apps/web/src/features/clients/ClientsPage.test.tsx)                              |
| API e2e against real Postgres                                               | [apps/api/test](apps/api/test)                                                                          |
| Architecture Decision Records                                               | [docs/adr](docs/adr)                                                                                    |
| CI gates: typecheck, lint, format, test, build, Storybook, API e2e          | [ci.yml](.github/workflows/ci.yml)                                                                      |

Still to come: drag-and-drop proposal builder, MobX time tracking with virtualization, i18n and multi-currency, Stripe, and a measured performance pass. See the [roadmap](docs/ROADMAP.md).

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
pnpm -F @studioflow/api db:seed             # demo account + 25 clients
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
```

## Security notes

The browser never receives a token of any kind. Its only credential is an opaque, 256-bit session id in an `HttpOnly` cookie, stored server-side as a SHA-256 digest. Sessions rotate, carry both idle and absolute timeouts, and replaying a rotated id revokes the entire session family. [ADR 0006](docs/adr/0006-session-security.md) explains why JWT was rejected for browser sessions and what CSRF work cookie auth makes mandatory.
