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

## Week 4 note

The **Clients** half of the row above is shipped: create, edit and delete across the
shared contract, the NestJS API and the web client, with every write applied to the RTK
Query cache first and rolled back if the server rejects it
([clientsApi.ts](../apps/web/src/features/clients/clientsApi.ts)).

Three decisions worth naming, because they are the interesting part rather than the CRUD:

- **The write contract is stricter than the read contract.** `clientSchema` accepts any
  ISO 4217 code already in the database; `createClientSchema` only accepts the currencies
  the product bills in. Reading and writing are not the same contract.
- **Writes do not invalidate the list.** Invalidating would refetch and overwrite the
  optimistic state moments later, undoing the point of it. The response body reconciles
  the cache instead.
- **Ownership lives in the WHERE clause**, and a client belonging to someone else answers
  404 rather than 403 — a 403 would confirm the id exists.

**Projects** completes the row: the same CRUD, the same optimistic writes, plus one
thing clients did not have — a foreign key that arrives from the browser. A project
carries a `clientId`, so the API checks that the client belongs to the caller before
trusting it; without that check, anyone could hang a project off a stranger's client,
and the error message would confirm that client exists. It answers 404.

Two pieces of the week became shared rather than copied, once a second caller existed:
the optimistic placeholder ids ([placeholderId.ts](../apps/web/src/app/placeholderId.ts))
and the list-page and dialog styling (`apps/web/src/styles`).

A stale note also fell: the design system's Select had been documented since Week 2 as
untestable under happy-dom. Re-probed against the current versions, it is not — so both
pickers are now exercised by the tests rather than by hand.

The bigger suite then exposed a flake that had nothing to do with either feature: RTK
batches store notifications through `requestAnimationFrame`, and happy-dom tears its
window down between test files while such a callback can still be pending, so the run
failed on `cancelAnimationFrame is not defined` with every test green. It reproduced
about one run in three. The test helper now builds its store with `autoBatch: 'tick'`
(a microtask, always flushed by teardown) and the app keeps the default; ten consecutive
runs are clean.

## Week 5 note

The proposal builder is built: four block types, reordering by drag **and** by
keyboard, undo/redo, and autosave. The decisions behind it are in
[ADR 0007](adr/0007-proposal-documents-as-validated-json.md) and the
[design doc](plans/2026-08-16-week-5-proposal-builder-design.md).

What the week actually taught, beyond the feature:

- **The accessible path is the testable path.** happy-dom has no layout, so a
  pointer drag cannot be simulated meaningfully — but dnd-kit's keyboard sensor
  can, given a stubbed set of rects, and the block menu needs no stub at all.
  The version of this feature that a keyboard user can operate is the same
  version a test runner can assert on.
- **Autosave broke test isolation before it broke anything else.** It flushes on
  unmount, so a save dispatched during cleanup resolved after the fixture had
  been rewound, landing one test's document in the next test's database. The
  fix was to drain pending requests before the reset and to reset on the way in
  as well as the way out.
- **Money never touches a float.** Prices are integer minor units end to end;
  the only rounding is in `money.ts`, and it is rounded per line before summing,
  the way an invoice does it.

Not built, on purpose: rich text, PDF export (Week 7 owns it), templates,
collaboration, and the send/accept flow — which is why the update contract
refuses to set `status` at all rather than accepting a value nothing honours.

## Week 6 note

Time tracking is built, and with it the promise [ADR 0003](adr/0003-redux-toolkit-plus-mobx.md)
made in week one: MobX, in the one module that earns it. The boundary is written
down in [apps/web/src/features/time/README.md](../apps/web/src/features/time/README.md).

The boundary came out narrower than the ADR implied, which is the honest result:

- **MobX owns three things.** Which entry is running, what second it is, and the
  description being typed before it is saved. It never calls the network.
- **RTK Query owns everything else**, including starting and stopping, which are
  ordinary mutations. One method, `adopt`, is the only way server state crosses.
- **Elapsed time is derived, not accumulated.** It is `now - startedAt`, so a
  tab that was asleep is never behind, and adopting a timer that started ten
  minutes ago reads ten minutes with no ticks having happened.

Two more decisions worth naming:

- **The server owns the clock.** Starting a timer sends no timestamp; the API
  stamps it. A browser with a wrong clock cannot bill an hour it did not work,
  and there is an e2e test that sends 1999 and asserts the entry starts now.
- **There is no duration column.** Duration is the two timestamps. Three fields
  that can disagree eventually do, and an invoice reads the wrong one.

The virtualized timesheet needed a stand-in for layout in tests: the virtualizer
sizes its window from `offsetHeight`, and happy-dom reports zero for every
element, so it rendered no rows at all. That was found by a probe of the
installed source rather than guessed at, after two wrong fixes.

## Week 7 note

Invoices are generated from tracked time, and the week's real subject is what
an invoice _is_: a snapshot, not a view.

- **Everything printed is frozen at generation.** The client's name, company and
  currency are copied onto the invoice, and the lines carry their own
  descriptions. Renaming a client or moving them to another currency next month
  cannot rewrite what was billed last month, and there are e2e tests that rename
  and re-read to prove it.
- **The lines cannot be edited.** Correcting an issued invoice is a credit note,
  so the update contract accepts only a status and a due date. A draft can be
  deleted and regenerated instead.
- **An hour cannot be billed twice.** Billing stamps each time entry with the
  invoice id, and generation only considers entries with none. Deleting an
  invoice releases its hours rather than destroying them.
- **Invoice numbers come from a counter, never from a count of rows.** Counting
  hands out the same number twice under concurrency, and hands out a deleted
  invoice's number again. A number is a permanent reference, so burning one is
  correct.

On the i18n side, `apps/web/src/i18n` is the only place the app formats anything
locale-dependent, and it exists to enforce one rule: never build a localised
string by concatenation.

- `Intl.PluralRules` decides "1 hour" against "1.5 hours". The plural category
  for 1.5 is "other" even in English, which a hand-rolled `n === 1` gets wrong.
- `formatMoney` asks `Intl` how many minor units the currency has rather than
  dividing by 100. Yen has none and dinar has three; the old helper in the
  proposal editor divided by 100 unconditionally and has been folded into this
  one.
- RTL is a toggle next to the theme switch, not a claim. Every physical CSS
  direction in the app was replaced with its logical counterpart
  (`inset-inline-start`, `border-inline-end`, `text-align: start`), so flipping
  `dir` on `<html>` mirrors the layout. What is not claimed: translated copy.

PDF is the browser's own print pipeline behind a dedicated `@media print`
stylesheet, rather than a bundled generator. The engine is excellent, it
respects the reader's paper size, and it needs no server; the cost is that the
print view is a real view that has to be maintained.

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
