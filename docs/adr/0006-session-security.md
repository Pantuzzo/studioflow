# ADR 0006: Browser sessions without tokens

- **Status:** Accepted
- **Date:** 2026-08-05

## Context

The product is an authenticated tool, so the session mechanism is the single
most security-sensitive decision in it. The obvious default for a React SPA — a
JWT held in JavaScript — deserved to be argued rather than assumed.

## Decision

**The browser never receives a token of any kind.** Its only credential is an
opaque session id in a cookie it cannot read.

### JWT is rejected for browser sessions

Not because JWT is bad, but because it is the wrong tool here:

- **A JWT cannot be revoked.** It is valid until it expires, by design. "Sign
  out" would then be a client-side courtesy while the token still authenticates
  anyone holding it. Checking a revocation list on every request reintroduces the
  database round-trip that statelessness was supposed to avoid — at which point
  an opaque id is simpler and stronger.
- **Its failure modes are sharp.** Algorithm confusion and `alg: none` have
  produced real, repeated CVEs in real libraries. An opaque random string has no
  parser and therefore no parser bugs.
- **Short expiry is a false comfort.** Making the window small enough to matter
  forces a refresh mechanism, which is more moving parts in the browser — exactly
  where the attacker already is.

JWT keeps its place for stateless service-to-service calls, where revocation is
not the requirement. It is not used for humans in browsers.

### What is used instead

| Concern         | Decision                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session id      | 256 bits from `crypto.randomBytes`, base64url                                                                                                               |
| Storage         | Only the **SHA-256** of the id is persisted. A database dump contains nothing replayable                                                                    |
| Transport       | `HttpOnly; SameSite=Lax; Path=/` cookie, `Secure` and the `__Host-` prefix in production                                                                    |
| Passwords       | **argon2id**                                                                                                                                                |
| Expiry          | Idle timeout **and** absolute timeout — an active session cannot live forever                                                                               |
| Rotation        | The id is replaced periodically; the replacement inherits the family and the absolute deadline                                                              |
| Theft detection | A rotated id replayed later revokes **the entire family**, not just that session                                                                            |
| CSRF            | `SameSite=Lax` + `Origin` check + double-submit token                                                                                                       |
| Brute force     | Rate limiting on the auth routes                                                                                                                            |
| Enumeration     | Login failures are one generic message; a missing account is still verified against a dummy hash so the timing matches; password reset always answers `202` |

### Why cookie auth forces CSRF work

A token in an `Authorization` header is immune to CSRF because browsers do not
attach it automatically. Cookies _are_ attached automatically, so removing the
token moves the risk rather than deleting it. Three independent layers answer it:
`SameSite=Lax` (the browser refuses the cross-site POST), an `Origin` check (an
attacker page cannot forge the header), and double submit (the attacker can cause
the cookie to be sent but cannot read it to produce the matching header).

The CSRF cookie is deliberately **not** `HttpOnly` — the client has to read it to
echo it back. That is the mechanism, not an oversight.

### Revocation carries a reason

Sessions record _why_ they ended: `rotated`, `logout`, or `reuse`.

This exists because of a bug the e2e suite caught. Concurrent requests can race a
rotation — one swaps the id, the other still carries the old one — so a
just-rotated id is honoured for a few seconds. Applied to _every_ revocation,
that grace window also made **logout take ten seconds to take effect**. Only
`rotated` earns grace now; `logout` is immediate and `reuse` is never forgiven.

## Consequences

- Positive: XSS cannot exfiltrate a credential for later use, because there is no
  credential in JavaScript to steal. Sign-out is real. Stolen-cookie replay is
  detected and kills the family.
- Positive: the client is simpler — no token storage, no refresh choreography, no
  single-flight mutex.
- Negative: **CSRF defence is mandatory**, and the client must echo the CSRF
  token on every mutating request.
- Negative: every request costs a session lookup. Acceptable at this scale; a
  cache would be the answer long before a JWT would.
- Negative: rate limiting is **skipped when `NODE_ENV=test`**, since the suite
  would otherwise measure the limiter instead of the behaviour. A unit test
  asserts the skip applies to `test` only, so it cannot quietly reach production.
- Follow-up: password reset currently logs instead of sending mail; delivery
  arrives with the email provider.
