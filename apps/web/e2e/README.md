# End-to-end tests

Four specs. The bar for adding a fifth is high, and it is this:

> **Could this be tested in the unit suite?** If yes, it belongs there.

The unit suite already drives the real reducers, the real store and the real
data layer through MSW, 191 tests of it. A browser test that repeats one of
those is slower, flakier and proves the same thing. What is here is the set of
behaviours a DOM implementation cannot answer at all:

| Spec               | Why a browser is required                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `keyboard-dnd`     | dnd-kit's keyboard sensor moves items by measuring rectangles. `happy-dom` has no layout, so every rectangle is zero.  |
| `code-splitting`   | Whether a chunk is fetched is a network fact. A bundle budget measures bytes on disk; it cannot see what a page loads. |
| `print`            | `@media print` is applied by a rendering engine. Nothing in the unit environment evaluates it.                         |
| `session-redirect` | Redirect-back across a real History API and a full document load, not a memory router.                                 |

## How it runs

Against a production build with the mock layer compiled in, served by
`vite preview`. Not the dev server: this is meant to test the artefact that
would ship.

```bash
pnpm -F @studioflow/web test:e2e            # builds, serves, runs
pnpm -F @studioflow/web test:e2e --ui       # the same, with the Playwright UI
```

The build lands in `dist-e2e/`, not `dist/`, so the bundle budget keeps
measuring the real build. MSW adds weight that production never ships.

## Isolation

There is none to arrange. The mock database is module state inside the page, so
a new page is a new database. Nothing to reset, and nothing to leak between
tests — which is the one thing this environment does better than the unit suite,
where a save flushing during teardown once wrote into the next test's fixture.

## One thing worth reading before editing these

`dnd.ts` explains two behaviours that cost an afternoon: dnd-kit can emit
several announcements inside a single React commit, so the live region has to
be recorded rather than sampled; and its keyboard listener is attached inside a
`setTimeout`, so an arrow key sent in the same tick as the pick-up is dropped
with nothing listening for it.
