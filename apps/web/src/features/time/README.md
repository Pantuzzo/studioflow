# Time tracking: where MobX ends and Redux begins

[ADR 0003](../../../../../docs/adr/0003-redux-toolkit-plus-mobx.md) chose Redux
Toolkit for server state and MobX for this module, and promised a written
boundary before the module existed. This is that boundary.

## The split

| Owned by RTK Query                             | Owned by `TimerStore` (MobX)             |
| ---------------------------------------------- | ---------------------------------------- |
| The list of entries the server holds           | Which entry is running _right now_       |
| Starting and stopping (ordinary mutations)     | The current second (`now`)               |
| Editing and deleting an entry                  | The description being typed, before save |
| Caching, invalidation, loading and error state | Nothing that touches the network         |

`TimerStore` never calls `fetch`. RTK Query never learns what second it is.

## The seam

One method, `adopt(entry)`. Server state enters the store there and nowhere
else: after a start or stop mutation resolves, and once on mount from
`GET /time-entries/running`, which is what lets a page refresh pick a running
timer back up instead of losing it.

## Why MobX earns its place here, and only here

A running timer changes once a second, forever, and nothing outside this module
cares. In Redux that is an action, a reducer pass and a subscription
notification every second so that one label can count.

MobX makes it a single observable field with a computed reading off it. The
component that shows the clock re-renders; nothing else does. Two properties
that fell out of the design and are asserted in `timerStore.test.ts`:

- **Elapsed time is derived, not accumulated.** It is `now - startedAt`. Adopting
  an entry that started ten minutes ago reads ten minutes immediately, with no
  ticks having happened, and a tab that was asleep is never behind.
- **A recomputation that produces the same value notifies nobody.** Adopting a
  running entry does not emit a redundant zero.

## What this is not

It is not a second place to keep server data. If the store starts holding
entries the list also holds, the boundary has failed and the two will disagree.
The store holds exactly one entry, and only because the clock has to point at
something.
