# ADR 0002: Vite SPA over Next.js

- **Status:** Accepted
- **Date:** 2026-07-17

## Context

The target role emphasizes **complex client-side data flows** and both **Redux and
MobX**. The product is an authenticated internal tool, not a content/SEO surface.

## Decision

Build a client-rendered SPA with Vite instead of a Next.js app. A thin standalone
backend (Hono + Prisma) is introduced later purely for persistence and Stripe.

## Consequences

- Positive: keeps the spotlight on client-side state architecture, caching, and
  performance — the exact skills being demonstrated. Fast dev loop.
- Negative: no SSR/RSC story; SEO and first-paint of public pages aren't showcased.
- Follow-ups: if a marketing/public surface is ever needed, revisit with a separate
  Next.js target rather than converting this app.
