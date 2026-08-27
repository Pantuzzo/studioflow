# ADR 0007: Proposal documents as validated JSON, edited in a local reducer

- **Status:** Accepted
- **Date:** 2026-08-17

## Context

A proposal is a document: an ordered list of blocks of four kinds, reordered by
drag or keyboard, edited continuously, and saved without anyone pressing a
button. Two questions had to be answered before any of it could be built.

**Where does the document live in the database?** The obvious relational answer
is a `blocks` table with a `position` column. But blocks are never queried
independently, never referenced from elsewhere, and never edited by two people
at once. Every read wants all of them, every write replaces all of them, and
reordering becomes a rewrite of every row's position.

**Where does the draft live in the browser?** The app already has Redux Toolkit
for server state, and [ADR 0003](0003-redux-toolkit-plus-mobx.md) reserves MobX
for the time-tracking module in Week 6. Neither is obviously right for a
document being typed into.

## Decision

**Store the document as `jsonb`, validated by the shared Zod schema on every
write.** `proposalBlockSchema` is a discriminated union in
`packages/contracts`; it validates the request in NestJS, types the editor's
reducer, and backs the MSW handlers. The column is schemaless to Postgres and
strictly typed to the application.

**Edit it in a local `useReducer`, not in the store.** RTK Query owns the saved
proposal; `documentReducer` owns the draft. Autosave is the only thing that
crosses between them.

MobX stays in Week 6, as promised.

## Consequences

- Positive: reordering is an array move rather than a positional rewrite;
  undo/redo is a pair of stacks over past documents, which fell out of the
  reducer for almost nothing; the editor's logic is pure and its tests need no
  DOM.
- Positive: keystrokes do not reach global state, so nothing outside the editor
  re-renders while someone types.
- Negative: no SQL question can be asked about block contents — "which
  proposals contain a pricing block" would need a scan or a derived column.
  Accepted, because nothing asks it.
- Negative: the document has no per-block history and no merge semantics. A
  proposal has one editor; two people editing one would need a different design
  entirely, and pretending otherwise now would be building for a user who does
  not exist.
- Negative: a stored document that fails validation makes its proposal
  unreadable rather than partially readable. The service parses on read and
  lets that fail loudly, on the grounds that silently substituting an empty
  document would destroy the thing the user came to edit.
- Follow-ups: if proposal templates arrive, they are the same schema stored in
  a second table. If a send/accept flow arrives, `status` becomes writable
  through an explicit transition endpoint rather than the general PATCH — which
  is why the update contract refuses `status` today.
