# ADR 0005: pnpm monorepo with a NestJS + Prisma backend

- **Status:** Accepted
- **Date:** 2026-07-30
- **Supersedes:** the "Backend note" in `docs/ROADMAP.md` (Hono, from Week 7) and the
  backend sentence in [ADR 0002](0002-vite-spa-over-nextjs.md)

## Context

Weeks 1–2 ran **mock-first** on MSW: one endpoint (`GET /api/clients`) and no auth at all.
The roadmap deferred a **Hono** backend to Week 7.

Two forces moved that date and that choice:

1. **Auth is inherently full-stack.** Building it against MSW first meant simulating an
   `httpOnly` cookie inside MSW's cookie jar — feasible, but with caveats and a documented
   fallback. That work would then be thrown away when the real backend arrived.
2. **NestJS is the stack actually in daily use** here, so the code lands faster and more
   correct than it would in a framework picked only for its weight class.

## Decision

Restructure into a **pnpm workspace** and build the backend **now**, in NestJS + Prisma +
Postgres:

```
apps/web         the existing Vite SPA, moved verbatim
apps/api         NestJS + Prisma
packages/contracts   Zod schemas — one source of truth
```

`packages/contracts` is the load-bearing part: the same Zod schemas validate requests in
Nest, drive `react-hook-form` in the web app, generate Swagger docs (via `nestjs-zod`), and
back the MSW handlers. The API contract cannot drift between client and server, because
there is only one copy of it.

**MSW stays** as the web app's test double. Frontend tests must not require Postgres or a
running API.

## Consequences

- Positive: auth is built once, against real cookies. One repository shows the full stack.
  Contract drift becomes structurally impossible rather than merely discouraged.
- Negative: **NestJS is far heavier than Hono** for ~8 endpoints — decorators, DI, modules,
  and a much larger dependency tree. The cost is accepted in exchange for fluency and for
  the guard/module structure that auth benefits from.
- Negative: two test runners in one repo — **Vitest** for the web, **Jest + supertest** for
  the API (the Nest default). Forcing Vitest onto Nest's decorator metadata was judged the
  larger risk.
- Negative: the roadmap's "mock-first through Week 6" framing no longer holds and needs
  rewriting.
- Follow-ups: CI gains a second job with a Postgres service container; deployment must serve
  web and API under one origin so session cookies behave identically in dev and production.
