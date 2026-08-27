# ADR 0003: Redux Toolkit for server cache, MobX for the timer module

- **Status:** Accepted
- **Date:** 2026-07-17

## Context

The app has two very different kinds of state: (1) server data that needs caching,
invalidation, and request lifecycle handling, and (2) a live time-tracking module with
running timers and lots of fine-grained, high-frequency local updates.

## Decision

Use **Redux Toolkit + RTK Query** as the backbone for server state across the app.
Use **MobX** for the time-tracking module's local state (running timers, draft
entries), where observable, mutable models are the most ergonomic fit.

## Consequences

- Positive: each tool is used where it shines; demonstrates fluency in both (a role
  requirement) with a genuine, defensible reason rather than for show.
- Negative: two state paradigms in one codebase — a clear module boundary is required
  so they don't leak into each other.
- Follow-ups: ~~document the boundary in the time-tracking feature's README when
  built (Week 6)~~ — done, in
  [apps/web/src/features/time/README.md](../../apps/web/src/features/time/README.md).
  The boundary landed narrower than this ADR implied: MobX owns the running
  entry, the current second and the unsaved description, and nothing else. Every
  request still goes through RTK Query.
