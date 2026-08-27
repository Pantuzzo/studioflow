# Week 5 — Proposal Builder (design)

- **Date:** 2026-08-16
- **Status:** Approved 2026-08-17; implementation under way
- **Roadmap:** Week 5 — "🌟 Proposal builder (block editor, dnd-kit, autosave)", focus: complex, accessible DnD.
- **Post:** "A drag-and-drop editor that's actually accessible"

## Goal

A proposal is a document you assemble from blocks, reorder, and never have to
remember to save. The showcase claim is the post's title, so the bar is not
"drag works" — it is **the whole editor is operable without a mouse**, and the
keyboard path is the one under test.

## Decisions

1. **A proposal belongs to a client, and optionally to a project.**
   _Revised 2026-08-17: this decision originally read "not to a project", because
   Projects was unbuilt. Projects has since shipped, so the premise is gone._
   The client stays the required parent — a proposal is always addressed to
   someone, and not every one of them concerns a project that already exists.
   `projectId` is nullable, and the editor offers it as a picker rather than
   demanding it. This is the arrangement the additive-migration note anticipated;
   it just arrived a week earlier than expected.

2. **The document is stored as validated JSON (Postgres `jsonb`), not a blocks
   table.** A proposal is read and written whole, and its blocks have no
   identity worth querying independently. The block schema is a Zod
   discriminated union in `packages/contracts`, so the same definition validates
   the API request, drives the editor's types, and backs the MSW handlers —
   exactly the arrangement that already keeps clients honest. Cost, accepted:
   no SQL question like "which proposals contain a pricing block".

3. **The draft lives in a local `useReducer`; RTK Query owns only what is
   saved.** The document being edited is not server cache and is not shared
   across routes, so putting it in the store would buy nothing and cost the
   render churn of every keystroke reaching global state. A reducer also makes
   undo/redo a past/future stack rather than a feature.
   **MobX stays in Week 6.** [ADR 0003](../adr/0003-redux-toolkit-plus-mobx.md)
   promises a clear module boundary for it; reaching for it here, one week
   early, in a module that does not need observables, would blur the very line
   the ADR exists to draw.

4. **dnd-kit, with the keyboard as a first-class path rather than a fallback.**
   `PointerSensor` + `KeyboardSensor` with `sortableKeyboardCoordinates`, a
   `DragOverlay`, and real `announcements` into a live region ("Heading block
   picked up, position 2 of 5"). On top of that, every block carries **Move up /
   Move down** actions in its menu, so reordering never _requires_ a drag at
   all. That last part is what makes the post's title true rather than
   aspirational.

5. **Autosave is debounced, optimistic, and visible.** ~800 ms after the last
   change, `PATCH /proposals/:id` sends the document whole (a document is
   written whole), plus a flush on route change and on unmount. The editor shows
   an explicit `Saving… / Saved / Couldn't save — Retry`. **No conflict
   resolution:** a proposal has one editor, and pretending otherwise would mean
   building merge semantics nothing exercises. The API returns `updatedAt` so a
   later version can detect staleness honestly.

## Data model

```prisma
model Proposal {
  id        String   @id @default(cuid())
  title     String
  /// The document: a validated array of blocks. See contracts/proposal.ts.
  blocks    Json
  status    ProposalStatus @default(DRAFT)
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
  @@index([clientId])
}
```

`status` ships in the model but only `DRAFT` is reachable this week — see
_Out of scope_. Ownership is enforced the same way Clients enforces it: in the
`WHERE`, answering 404 rather than 403 for someone else's row.

## Blocks

Four types, each a variant of a Zod discriminated union:

| Block     | Contents                                  | Why it earns its place                                                          |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| `heading` | text, level (2 or 3)                      | Document structure — and the a11y question of headings inside an editor         |
| `text`    | plain multi-line text                     | The body. **Not** a rich-text editor (see _Out of scope_)                       |
| `pricing` | line items (description, qty, unit price) | Computed totals formatted with `Intl.NumberFormat` in the client's currency     |
| `terms`   | list of clauses                           | Add/remove/reorder within a block — nesting the same interaction one level down |

The `pricing` block is the one carrying real weight: it is where `Intl` lands
early (Week 7's thesis) and where Week 7's "invoice generated from a proposal"
will attach.

## Editor architecture

```
features/proposals/
  ProposalsPage.tsx          list + "New proposal" (picks a client)
  ProposalEditorPage.tsx     /proposals/:id
  editor/
    documentReducer.ts       add / update / remove / move / undo / redo
    documentReducer.test.ts  pure, so the interesting logic is tested without a DOM
    BlockList.tsx            DndContext + SortableContext
    BlockCard.tsx            drag handle, menu, per-type editor
    blocks/                  HeadingBlock, TextBlock, PricingBlock, TermsBlock
    useAutosave.ts           debounce + flush + status
  proposalsApi.ts            RTK Query endpoints
```

Routes join the guarded tree in [routes.tsx](../../apps/web/src/routes.tsx)
under `AppShell`, and "Proposals" joins `NAV_ITEMS` in
[AppShell.tsx](../../apps/web/src/components/layout/AppShell.tsx).

**New design-system component required:** a Radix **DropdownMenu** for the
per-block actions (move, duplicate, delete). It ships to the same bar as the
Week 2 primitives — story, test, both themes — because the block menu is the
keyboard route to reordering and cannot be a bespoke div.

## Accessibility — the marquee

This is the week the a11y claim gets specific:

- Every block is reachable by Tab; the drag handle is a real `button` with an
  accessible name that includes the block ("Reorder Heading block").
- Space/Enter picks up, arrows move, Space drops, Escape cancels — dnd-kit's
  keyboard sensor, with announcements wired to a live region.
- Move up / Move down in the block menu, so reordering works with zero drag.
- Focus survives a move: after reordering, focus stays on the moved block's
  handle rather than resetting to the top of the list.
- axe clean via the Storybook a11y addon and the existing jsx-a11y lint gate.

## Testing

- **Reducer:** pure unit tests — every command, including undo/redo across a
  move. The logic worth testing does not need a DOM.
- **Editor integration:** reordering is driven **by keyboard** in tests. This is
  not a workaround: happy-dom does not implement the pointer APIs dnd-kit needs
  (the same wall Select hit in Weeks 2 and 4), so the accessible path is also
  the testable one — which is the strongest possible argument for building it.
- **Autosave:** fake timers, assert one request after a burst of edits, assert
  the flush on unmount, assert the failure state and its retry.
- **API e2e:** proposal CRUD, ownership isolation (404 for another account),
  and a malformed block array rejected by the shared schema.

## Definition of Done

Proposals list + editor behind the session guard; four block types; reorder by
mouse **and** keyboard with announcements; undo/redo; autosave with visible
status and retry; DropdownMenu in the design system with story + test;
`Proposal` model, endpoints and e2e; ADR 0007 recorded; typecheck, lint, format,
tests, build and Storybook all green.

## Proposed ADR 0007

_"Proposal documents as validated JSON, edited in a local reducer"_ — covering
decisions 2 and 3 above, since both are the kind of choice a reader will
otherwise wonder about.

## Out of scope (YAGNI)

Rich-text editing (a formatting toolbar is a rabbit hole, and plain text plus
structure carries the demo), image upload, PDF export (Week 7 owns PDF),
proposal templates, real-time collaboration or conflict resolution, and
e-signature.

## Open — two calls I would take differently with a word from you

1. **Four blocks or three.** Dropping `terms` would save perhaps a day and lose
   the nested-reorder case. I recommend keeping it: nested reordering is where
   most drag-and-drop implementations quietly break, and surviving it is the
   point of the post.
2. **The send/accept flow.** I have scoped this week as editor-only, with
   `status` present in the model but only `DRAFT` reachable. A client-facing
   read-only proposal link plus accept/decline is a coherent feature — but it is
   a second week's worth of work (public token routes, a separate unauthenticated
   surface, state machine), and it belongs nearer Week 8's payment states than
   here.
