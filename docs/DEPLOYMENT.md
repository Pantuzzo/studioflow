# Deploying StudioFlow

Two artefacts: a container that serves the API, and a directory of static files
that is the web client. They are deployed separately and neither knows how the
other is hosted.

Everything below was run against the image built from this repository. Where a
figure appears, it was measured rather than estimated.

## The API

### Build

```bash
docker build -f apps/api/Dockerfile -t studioflow-api .
```

The build context is the repository root, because this is a pnpm workspace and
the API depends on `@studioflow/contracts` next door.

The image is **683 MB**. Most of that is `node_modules` (420 MB before the
trim), and most of _that_ is Prisma: the client and its query engines account
for roughly 110 MB on their own. The Dockerfile removes the Prisma CLI after
generating the client, which took 166 MB of tooling out — Prisma Studio,
pglite, TypeScript and effect, none of which a running server touches.

The remaining fat is the query engine. Prisma 7's custom generator `output`
would let the client ship as ordinary source and shrink this further; it is the
obvious next step and it is not done.

### Run

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/studioflow?schema=public" \
  -e WEB_ORIGIN="https://app.example.com" \
  studioflow-api
```

`GET /api/health` answers `{"status":"ok","database":"up"}` once it is up, and
reports the database honestly rather than always saying ok.

### Environment

| Variable                | Required | Default                 | Notes                                                      |
| ----------------------- | -------- | ----------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`          | yes      | —                       | Boot fails without it, deliberately.                       |
| `WEB_ORIGIN`            | no       | `http://localhost:5173` | The only origin allowed to send credentialed requests.     |
| `PORT`                  | no       | `3000`                  |                                                            |
| `SESSION_IDLE_TTL`      | no       | `1800`                  | Seconds of inactivity before a session is refused.         |
| `SESSION_ABSOLUTE_TTL`  | no       | `604800`                | Seconds after which a session dies regardless of activity. |
| `STRIPE_SECRET_KEY`     | no       | —                       | Absent means the payment endpoints refuse politely.        |
| `STRIPE_WEBHOOK_SECRET` | no       | —                       | Absent means no event can be trusted, so none is acted on. |

The environment is validated by a Zod schema at boot, so a misconfigured server
fails immediately rather than at the first request that needs the missing value.

### Migrations

**The container does not run migrations.** It starts the server and nothing
else. Running them at start would mean every replica racing the same migration
on every restart, and a container that cannot reach the database yet failing
for two reasons at once.

Run them from the deploy pipeline, before traffic moves to the new version:

```bash
pnpm install --frozen-lockfile
pnpm --filter @studioflow/api db:deploy   # prisma migrate deploy
```

The Prisma CLI is a production dependency, but only so that the deployed tree
contains it long enough to generate the client during the build. The Dockerfile
deletes it immediately afterwards. Nothing in the running image can apply a
migration, which is the point: the pipeline has the repository and the server
does not need one.

## The web client

A static build. There is no server.

```bash
pnpm --filter @studioflow/web build   # writes apps/web/dist
```

Three things the host has to do:

1. **Serve `index.html` for unknown paths.** It is a single-page app; without
   that fallback, opening `/invoices/in_001` directly returns 404.
2. **Send `/api/*` to the API.** In development Vite proxies it. In production
   the app calls `${origin}/api` unless `VITE_API_URL` says otherwise, so
   either put both behind one domain or set that variable at build time.
3. **Leave hashed assets cached and `index.html` uncached.** Every file under
   `assets/` carries a content hash; `index.html` is what points at them.

The session cookie is `SameSite` and `HttpOnly`, so **same-origin is the simpler
deployment**: one domain, `/api` routed to the container, everything else to the
static files. Splitting them across domains means cross-site cookies and a
conversation with browser defaults that is not worth having.

### Build-time configuration

| Variable            | Default         | Notes                                              |
| ------------------- | --------------- | -------------------------------------------------- |
| `VITE_ENABLE_MOCKS` | unset (off)     | `true` runs the whole app on MSW, with no backend. |
| `VITE_API_URL`      | `${origin}/api` | Set only when the API is on another origin.        |

`VITE_ENABLE_MOCKS=true` is worth knowing about for a demo: it produces a
deployable build that needs no database and no API at all, seeded with the
fixtures the tests use. It is a demo, not a product; every reload starts over.

That is what is published at <https://pantuzzo.github.io/studioflow/>, by
[demo.yml](../.github/workflows/demo.yml) on every push to `main`.

### What a subdirectory changes

The demo is served from `/studioflow/`, not from a domain root, and three
things have to agree about that:

1. **The build's base.** `pnpm -F @studioflow/web build:demo` passes
   `--base=/studioflow/`, which is what rewrites the asset URLs in
   `index.html`.
2. **The router's `basename`.** It reads `import.meta.env.BASE_URL`. Without
   it every route resolves one level above where the app lives, and the whole
   app renders as a 404 that looks like a routing bug.
3. **The mock worker's URL.** Registering it at `/mockServiceWorker.js` works
   in development and then 404s here. It is registered relative to the base
   instead. The failure mode is an app that loads and then answers nothing,
   which is worse than an app that does not load.

None of the three is visible in development, where the base is `/`.

### Deep links on GitHub Pages

Pages has no history fallback, so the workflow copies `index.html` to
`404.html`. Pages serves that for any unknown path, the app boots and the
router resolves the URL. The status code stays 404. For a demo that is a fair
trade; for a product it would not be, which is why the requirement above is
written as "serve `index.html` for unknown paths" rather than "copy it to
404.html".

Publishing requires **Settings → Pages → Source: GitHub Actions** on the
repository. The workflow does not enable it, deliberately: turning on public
hosting for a repository is not a thing a build script should decide.

## What is not here

No infrastructure as code, no managed Postgres provisioning, no CDN
configuration. Those belong to whichever platform this lands on, and writing
them speculatively for a platform nobody has chosen would be fiction rather
than documentation.
