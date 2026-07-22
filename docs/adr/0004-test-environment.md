# ADR 0004: Test environment (happy-dom, Vitest 3, and API base URL resolution)

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

Standing up the Week 1 test pipeline (Vitest + Testing Library + MSW, exercising RTK
Query against mocked endpoints on Node 24) surfaced four failures that each have a
non-obvious root cause. They are recorded together because they are all consequences of
the same goal: run the real fetch/cache/request lifecycle in tests, not a stubbed one.
Each fix corrects a reproducible error, so this ADR exists to stop a future reader from
reverting one without knowing what breaks.

## Decision

1. **DOM environment is `happy-dom`, not `jsdom`.**
   With jsdom on Node 24, undici's `fetch` rejects the `AbortSignal` that RTK Query
   creates (`TypeError: Expected signal to be an instance of AbortSignal`): jsdom
   installs its own `AbortController` global from a different realm, so the signal fails
   undici's cross-realm `instanceof` check. happy-dom leaves the platform globals intact.

2. **`happy-dom` must be v20+.**
   happy-dom v15 breaks when MSW clones the response body
   (`TypeError: Invalid state: ReadableStream is locked`). v20+ fixes the stream handling.
   Pinned at `^20.10.6`.

3. **Vitest 3, not Vitest 2.**
   Vitest 2 pulls in Vite 5's types while `@vitejs/plugin-react` resolves Vite 6, so
   `vite.config.ts` fails to typecheck against two incompatible `UserConfig` shapes.
   Vitest 3 aligns on a single Vite 6, removing the duplicate.

4. **The API base URL derives from `window.location.origin` when `VITE_API_URL` is
   unset** (see `src/app/baseApi.ts`).
   `import.meta.env.VITE_*` is inlined statically at build time by Vite, so Vitest's
   `test.env` cannot override it at runtime; and Node's `fetch` rejects a relative URL.
   MSW matches requests by pathname, so an absolute same-origin URL
   (`${window.location.origin}/api`) resolves correctly in both the browser and
   happy-dom.

## Consequences

- Positive: the test suite exercises the genuine RTK Query request lifecycle against MSW
  rather than a mocked fetch, so the tests catch integration bugs a shallower setup would
  miss. The reasoning is now linkable instead of tribal knowledge.
- Negative / trade-offs: three pinned choices (happy-dom ≥ 20, Vitest 3, no jsdom) are
  load-bearing and easy to "modernise" into a regression; the origin-derived base URL is
  a workaround for Vite's static env inlining rather than a first-class config path.
- Follow-ups: revisit the base-URL resolution once a real `VITE_API_URL` backend exists
  (the explicit value takes precedence and this branch stops mattering). Good raw
  material for a build-in-public post on the fetch/AbortSignal pitfall.
