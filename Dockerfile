# wiki+ production image (issue A.2 / #42)
#
# Multi-stage build of the Next.js App Router Node SSR server (issue #37) using
# `output: 'standalone'` (next.config.mjs). The final image runs `node server.js` with NO
# Next CLI and only the traced `node_modules`, so it stays small and the 1GB Linode Nanode
# can RUN it. The box never builds Next.js (the deps+build stages run in CI on GitHub-hosted
# runners; the box only `docker compose pull`s the result — see .github/workflows/deploy.yml).
#
# Node 24 LTS (per ARCHITECTURE "Stack"; used locally). Pin a specific minor + the slim
# Debian (bookworm) variant for a small, reproducible base.

# ---- deps: install the full dependency set against the committed lockfile ----------------
FROM node:24.2.0-bookworm-slim AS deps
WORKDIR /app
# Only the manifest + lockfile so this layer caches unless deps change.
COPY package.json yarn.lock ./
# --frozen-lockfile: fail rather than mutate yarn.lock (parity with CI).
RUN yarn install --frozen-lockfile

# ---- build: compile the Next.js standalone server ----------------------------------------
FROM node:24.2.0-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_YOUTUBE_API_KEY is read at BUILD time and inlined into the client bundle
# (search runs client-side this round — see ARCHITECTURE "Prototype phase"). It must be a
# build-arg, not a runtime env var; CI passes it from the YOUTUBE_API_KEY repo secret. Unset
# → the live YouTube search no-ops (falls back to seeded/empty candidates), by design.
ARG NEXT_PUBLIC_YOUTUBE_API_KEY=""
ENV NEXT_PUBLIC_YOUTUBE_API_KEY=${NEXT_PUBLIC_YOUTUBE_API_KEY}
# basePath stays empty (root-served): Caddy reverse-proxies the apex of wikiplus.wikiedu.org
# directly to app:3000, not a subpath. (NEXT_PUBLIC_BASE_PATH left unset on purpose.)
# NOTE: `next build` does NOT connect to Postgres (DB access is lazy, runtime-only) — so no
# DATABASE_URL is needed here, and the build never fails for lack of a DB (issue #45).
RUN yarn build
# Bundle the DB migrate+seed entrypoint (issue #45) into a single self-contained
# dist/migrate.cjs so the runtime image can apply migrations on deploy with plain `node`
# (no tsx / drizzle-kit / full node_modules in the tiny standalone runtime). The migrate
# compose one-shot runs this against the live Postgres — see deploy/docker-compose.yml.
RUN yarn build:migrate

# ---- runtime: tiny image, non-root, just the standalone server ---------------------------
FROM node:24.2.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next reads PORT/HOSTNAME; bind all interfaces inside the container (Caddy reaches it over
# the compose network) on the conventional 3000.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as the unprivileged `node` user that the base image already ships (uid 1000).
# Copy with --chown so the standalone server owns its own files but cannot write the image.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# DB migration assets (issue #45): the bundled migrate+seed entrypoint and the committed
# SQL migrations it applies. Used ONLY by the migrate compose one-shot (which overrides the
# command to `node dist/migrate.cjs`), never by the app server. Cheap to carry (~0.4MB).
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle

USER node
EXPOSE 3000

# The standalone bundle's entrypoint. No `yarn`, no `next` — just Node. (The migrate one-shot
# overrides this with `node dist/migrate.cjs`; see deploy/docker-compose.yml.)
CMD ["node", "server.js"]
