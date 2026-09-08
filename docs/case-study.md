# Building a mini-Bonsai in ten weeks

A case study of the decisions, written at the end, with the parts that did not
work left in.

## What this is

An operations app for agencies and freelancers: clients, projects, proposals,
time tracking, invoices, payments. It was built in the open, one feature a week,
to a fixed bar: typed, tested, accessible, documented, and secure by default.

It is deliberately modelled on a product that already exists. That was the
point. A portfolio project invents its own requirements and therefore never has
to make a hard trade; borrowing a real domain means the hard trades come to you.

Ten weeks, seven architecture decision records, and 361 tests: 70 over the
shared contract, 191 in the web app, 11 in the API's units, 83 end to end
against a real Postgres, and 6 driving an actual browser. The interesting part
is none of those numbers.

## The decision everything else rests on

There is one definition of every shape the system exchanges, and it lives in a
package that both sides import.

The same Zod schema validates the request in NestJS, drives the react-hook-form
resolver in the browser, generates the Swagger documentation, and backs the
mock server the frontend tests run against. Not four descriptions kept in
agreement by discipline. One, imported four times.

The effect shows up in what stops being possible. A field cannot be renamed on
one side only. A mock cannot answer with a shape the real API would not return.
An endpoint cannot document a response it does not send. Whole categories of
"works locally, breaks in staging" simply have nowhere to live.

The cost is real and worth naming: the contract package becomes a coupling
point, and a change there ripples immediately into three consumers. Several
times that meant a small feature turning into a wider edit than expected. That
is the trade, and I would take it again.

## Security decisions, and what they cost

**No token ever reaches the browser.** The session is an opaque random id in an
`HttpOnly` cookie, stored server-side as a SHA-256 digest. JWT was considered
and rejected for one reason: a JWT cannot be revoked, so "log out" becomes a
promise the server cannot keep.

That choice creates its own problem. Cookie authentication is what CSRF attacks
exist for, so anything that changes data now passes three independent checks.
Removing one risk created another; pretending otherwise would have been the real
mistake.

**Ownership lives in the WHERE clause**, not in an `if` after the query. Every
read and every write is scoped by the owner at the database level, so a
forgotten check cannot leak another account's rows. Records belonging to someone
else answer 404 rather than 403, because 403 confirms that the record exists,
which is exactly what an id-guessing probe wants to learn.

**Ids that arrive from the browser are verified before they are trusted.** A
project carries a client id; a proposal carries an optional project id; an
invoice's amounts are read from the database and never from the request. There
are e2e tests that attempt each of those attacks and require them to fail.

## Two state managers, and a boundary in writing

The app uses Redux Toolkit for server state and MobX for exactly one module: the
running timer.

That sounds like indulgence, and it would have been if the boundary were vague.
It is one field. A running timer changes once a second, forever, and nothing
outside that module cares. In Redux that is an action, a reducer pass and a
subscription notification every second so that one label can count. In MobX it
is an observable and a computed, and the one component displaying a clock
re-renders.

The boundary is written down in the module's own README, and it is narrower than
the ADR that promised it: MobX owns which entry is running, what second it is,
and the description being typed before it is saved. It never touches the
network. One method is the only place server state crosses.

Elapsed time is derived rather than accumulated. A tab that was asleep is never
behind, and a timer adopted mid-flight reads correctly with no ticks having
happened.

## Money

Every amount in the system is an integer number of minor units, from the
proposal's pricing block through the invoice to the Stripe line item. Rounding
happens once, in one file, and totals are rounded per line before summing
because that is what makes the printed lines add up to the printed total.

The i18n work found a bug in that: the currency formatter divided by 100
unconditionally. Yen has no minor unit and dinar has three, so the function now
asks `Intl` for the exponent. Nobody was billing in yen. It was still wrong.

Formatting is never assembled by concatenation. `Intl.PluralRules` decides "1
hour" against "1.5 hours", because the plural category for 1.5 is "other" even
in English, and a hand-rolled `n === 1` gets it wrong in a way that is invisible
until someone reads the invoice in Polish.

## The week the plan was wrong

Week nine promised a Lighthouse score climbing from 62 to 98. Here is what the
measurement actually said.

The first run reported performance 67 with 1.4 seconds of blocking time. As a
"before", that would have made a spectacular story. It was the first run on a
cold machine, and it was false. The median of three runs was 100, and it had
been 100 all along.

So the honest result is that the score did not move and the app still got
meaningfully lighter: a signed-out visitor stopped downloading a drag-and-drop
editor, a list virtualizer and a second state library to look at a login form.
254 kB of JavaScript became 168 kB. Largest contentful paint went from 602 ms to
515 ms.

Two things came out of that week that matter more than the numbers. A score of
100 never meant there was nothing to fix; it meant the test conditions were
generous. And one run is not a measurement — the gap between my first run and my
median was larger than every improvement I made that week.

What shipped alongside is the part I trust: a bundle budget that fails the build
if the entry chunk grows past 185 kB, and an accessibility scan that runs over
six real screens on every push. The accessibility claim had been in the
definition of done since week one and was checked by hand in a panel nobody
reopens, which is another way of saying it had stopped being checked.

## Payments, and the state nobody shows you

`checkout.session.completed` is not a payment. It fires when the customer
finishes the form. For a card that is the same instant the money moves; for a
bank debit it is days earlier. Treating them as one marks unpaid invoices paid.

So there is a state for money in flight, `paid` is terminal so a late event
cannot un-pay an invoice, and every event id is recorded before it is acted on,
which turns "handlers must be idempotent" into "handlers run once".

A person cannot mark an invoice paid. The update contract accepts draft, sent
and void; the money states are absent from it entirely. Without that rule the
payment provider would be scenery.

## What went wrong

**A test suite that lied about itself.** It failed roughly one run in three with
an error while every test passed: Redux batches notifications on an animation
frame, and the test environment tore its window down with one still queued. A
suite that fails at random teaches you to ignore it, which is worse than a suite
that fails.

**Autosave broke test isolation before it broke anything else.** It flushes on
unmount, so a save dispatched during cleanup landed after the fixture had been
rewound, putting one test's document into the next test's database.

**A test that would have expired on its own.** It relied on seeded hours falling
inside the current calendar month, so it would have started failing in CI when
the month rolled over. It did, in front of me.

**A stale note that had become false.** The design system's Select had been
documented since week two as untestable in the test environment. Re-probed
against current versions, it was not, and two form flows had been going
unverified on the strength of a comment nobody rechecked.

**An announcement nobody had ever heard.** The proposal editor tells a screen
reader user which block they picked up and which keys move it. dnd-kit fires an
"is now over" event immediately after the pick-up, React commits both in one
render, and the live region only ever held the second one. The message was
written, reviewed and shipped, and never once spoken. The browser suite found it
on its first run, in the one feature that suite exists for.

The pattern is nearly the same in all five: the thing that was wrong was not the
feature. It was something _about_ the feature that everyone had stopped looking
at — except the last one, which is worse. Nobody had stopped looking at it.
There had never been anything capable of looking.

## What I would do differently

**Write the posts with the code.** The features stayed on schedule and the
writing did not, which is exactly backwards for a project whose purpose is to be
read.

**Decide the deployment target in week one.** Week ten produced a container that
runs and a guide that is honest about what is not configured, but choosing a
platform earlier would have made several decisions concrete instead of
hypothetical.

**Set the Prisma generator's output early.** Leaving it at the default meant the
production image needed the Prisma CLI to generate a client at build time, and
that CLI dragged Prisma Studio, an in-browser Postgres, TypeScript and effect
into a server image: 166 MB of tooling nothing at runtime touches. Stripping it
afterwards works and is not as good as never adding it.

## What is not built

Rich text in the proposal editor, PDF generated server-side, proposal templates,
collaborative editing, subscriptions, refunds, partial payments and Stripe
Elements. Each was a decision rather than an omission, and each is written down
where the decision was made.

The one I would push back on hardest if asked to add it quickly is collaborative
editing. It is not a feature you bolt on; it is a different design of the whole
document layer.
