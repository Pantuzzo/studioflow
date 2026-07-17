# StudioFlow

> A mini operations SaaS for agencies and freelancers — **clients → projects → proposals → contracts → time tracking → invoices → payments**. Built in public to demonstrate senior-level frontend engineering.

StudioFlow is a portfolio project deliberately modeled on tools like Bonsai. Each feature is shipped to a **production-grade bar**: typed, tested, accessible, performant, and documented. The goal isn't "another CRUD app" — it's to make architecture, performance, accessibility, and testing decisions **visible**.

**Live demo:** _coming soon_ · **Build-in-public series:** _`#StudioFlowBuild` on LinkedIn_

---

## Tech stack

| Area                  | Choice                                               |
| --------------------- | ---------------------------------------------------- |
| Core                  | Vite · React 19 · TypeScript (strict)                |
| Global state / data   | Redux Toolkit · RTK Query                            |
| Local complex state   | MobX (time-tracking module)                          |
| API mocking & tests   | Mock Service Worker (MSW)                            |
| Routing               | React Router                                         |
| Testing               | Vitest · Testing Library · (Playwright — e2e, later) |
| Quality gates         | ESLint (jsx-a11y) · Prettier · GitHub Actions        |
| Backend (from Week 7) | Hono · Prisma · Postgres · Stripe (test mode)        |

## Techniques demonstrated

The recruiter's-eye view — each technique maps to real code.

| Technique                                                                         | Where to look                                                                                                                                          | Status    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Strict TypeScript (`noUncheckedIndexedAccess`, etc.)                              | [tsconfig.app.json](tsconfig.app.json)                                                                                                                 | ✅        |
| Single RTK Query API + per-feature endpoint injection                             | [src/app/baseApi.ts](src/app/baseApi.ts), [src/features/clients/clientsApi.ts](src/features/clients/clientsApi.ts)                                     | ✅        |
| Cache invalidation via tags                                                       | [src/features/clients/clientsApi.ts](src/features/clients/clientsApi.ts)                                                                               | ✅        |
| Mock-first API contract (browser + node)                                          | [src/mocks/](src/mocks/)                                                                                                                               | ✅        |
| Accessible UI (skip link, focus-visible, semantic table, `role="status"`/`alert`) | [src/components/layout/AppShell.tsx](src/components/layout/AppShell.tsx), [src/features/clients/ClientsPage.tsx](src/features/clients/ClientsPage.tsx) | ✅        |
| Design tokens + theming (light/dark)                                              | [src/styles/tokens.css](src/styles/tokens.css)                                                                                                         | ✅        |
| Explicit loading / error / empty states                                           | [src/features/clients/ClientsPage.tsx](src/features/clients/ClientsPage.tsx)                                                                           | ✅        |
| Integration test through the real data layer (MSW)                                | [src/features/clients/ClientsPage.test.tsx](src/features/clients/ClientsPage.test.tsx)                                                                 | ✅        |
| Architecture Decision Records                                                     | [docs/adr/](docs/adr/)                                                                                                                                 | ✅        |
| CI quality gates (typecheck, lint, test, build)                                   | [.github/workflows/ci.yml](.github/workflows/ci.yml)                                                                                                   | ✅        |
| Component library + Storybook                                                     | —                                                                                                                                                      | 🔜 Week 2 |
| Drag-and-drop proposal builder                                                    | —                                                                                                                                                      | 🔜 Week 5 |
| MobX time tracking + list virtualization                                          | —                                                                                                                                                      | 🔜 Week 6 |
| i18n / multi-currency (`Intl`)                                                    | —                                                                                                                                                      | 🔜 Week 7 |
| Stripe payments                                                                   | —                                                                                                                                                      | 🔜 Week 8 |
| Performance budget (Lighthouse CI) + e2e (Playwright)                             | —                                                                                                                                                      | 🔜 Week 9 |

## Getting started

```bash
pnpm install        # also generates the MSW worker (prepare script)
pnpm dev            # http://localhost:5173 — runs fully on mocked API
```

Other scripts:

```bash
pnpm test           # unit + integration (Vitest)
pnpm typecheck      # tsc --build, no emit
pnpm lint           # ESLint (incl. jsx-a11y)
pnpm build          # typecheck + production build
```

## Architecture at a glance

```
src/
├── app/          # store, typed hooks, RTK Query base API
├── components/   # shared, presentational building blocks (design system grows here)
├── features/     # one folder per domain: types + api + UI + tests, colocated
│   ├── clients/
│   └── dashboard/
├── mocks/        # MSW handlers = the REST contract
├── styles/       # design tokens + global styles
└── test/         # test setup + render helpers
```

**Why feature-folders?** Each domain owns its types, data access, UI, and tests together, so features stay independently understandable as the app grows. See [docs/adr/](docs/adr/) for the reasoning behind the big decisions.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full 10-week, build-in-public plan.
