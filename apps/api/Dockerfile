# Build context is the repository root, because this is a pnpm workspace and
# the API depends on @studioflow/contracts, which lives beside it.
#
#   docker build -f apps/api/Dockerfile -t studioflow-api .

# --- dependencies -----------------------------------------------------------
# Debian rather than Alpine: argon2 and Prisma both ship prebuilt binaries for
# glibc, and chasing musl builds of a password hasher is not a fight worth
# picking on a deployment day.
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/

# Both packages run install scripts that need more than a manifest: the API
# generates its Prisma client, and the contracts package builds itself in
# `prepare`. So the schema and the contracts source arrive before install
# rather than after it. The API's own source stays out, which keeps an ordinary
# code change from reinstalling the world.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
COPY packages/contracts packages/contracts

RUN pnpm install --frozen-lockfile --filter @studioflow/api... --filter @studioflow/contracts...

# --- build ------------------------------------------------------------------
FROM deps AS build
WORKDIR /repo
COPY apps/api apps/api

RUN pnpm --filter @studioflow/api exec prisma generate \
  && pnpm --filter @studioflow/api build

# `pnpm deploy` rather than `pnpm prune`: pruning a workspace root leaves the
# symlink farm pnpm relies on in pieces, and the container then cannot resolve
# its own dependencies. This writes a self-contained /app holding the
# production tree with the workspace package folded into it.
RUN CI=true pnpm --filter @studioflow/api deploy --prod --legacy /app

# The deployed tree is installed from the lockfile, so the client generated
# earlier does not come with it. Generating again inside /app puts it where the
# runtime looks; the URL is a placeholder, because generate reads the schema and
# never the database.
#
# Then the CLI goes, and with it Prisma Studio, pglite, TypeScript and effect:
# 166 MB of tooling a running server never touches. It was only ever here to
# generate. Migrations do not run from this image at all, so nothing else needs
# it either — see the deployment guide.
RUN cd /app   && DATABASE_URL="postgresql://generate:generate@localhost:5432/generate"      ./node_modules/.bin/prisma generate   && rm -rf node_modules/prisma node_modules/.bin/prisma*      node_modules/.pnpm/prisma@*      node_modules/.pnpm/@prisma+studio-core@*      node_modules/.pnpm/@electric-sql+pglite@*      node_modules/.pnpm/effect@*      node_modules/.pnpm/typescript@*   && rm -rf src Dockerfile eslint.config.mjs jest.config.js nest-cli.json test

# --- runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Not root. A process that never needs to write to its own image should not be
# able to.
RUN useradd --system --create-home --shell /usr/sbin/nologin studioflow

COPY --from=build --chown=studioflow:studioflow /app ./

USER studioflow
EXPOSE 3000

# The container starts the server and nothing else.
#
# Migrations are a deploy step, not a start step. Running them here would mean
# every replica racing the same migration on every restart, and a container
# that cannot reach the database yet failing for two reasons at once. The
# platform runs them once, before traffic moves:
#
#   pnpm --filter @studioflow/api db:deploy
#
# run from a checkout of this repository. Nothing in this image can apply a
# migration, by design: the CLI was deleted after it generated the client.
CMD ["node", "dist/main"]
