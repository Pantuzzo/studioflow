# ADR 0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-07-17

## Context

This is a portfolio project meant to make senior-level engineering _judgment_
visible, not just working code. Decisions like "Redux vs MobX here" are exactly what
a reviewer wants to see reasoned about.

## Decision

Use lightweight Architecture Decision Records (Michael Nygard format) stored in
`docs/adr/`. One file per significant decision, numbered sequentially, never deleted
(superseded instead).

## Consequences

- Positive: the "why" behind the codebase is documented and linkable — great material
  for build-in-public posts.
- Negative: small ongoing discipline to write one when a real decision is made.
- Follow-ups: link relevant ADRs from the README techniques table.
