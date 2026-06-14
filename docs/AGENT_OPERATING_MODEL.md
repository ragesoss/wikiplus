# wiki+ — Agent Operating Model

wiki+ is **built and operated by AI agents** (Claude) acting in distinct, named roles. This
document describes that operating model. It is a **specification, not an implementation** —
the actual subagent definitions, slash commands, and workflows are scaffolded in a later
session (see "Bootstrap" at the end).

## Premise

Rather than one undifferentiated assistant, the project is run by a small "team" of agent
roles, each with a clear charter, the artifacts it owns, and defined hand-offs to the
others. This keeps work legible (every change traces to a role and an artifact), lets roles
run in parallel, and makes the project's process itself versioned and reviewable.

A human (the project owner) sets direction, approves plans, and arbitrates — agents do the
production work within their charters.

## Roles

### Product Management
- **Owns:** the vision, the roadmap, and per-feature specs. Translates owner intent into
  concrete, buildable specs with acceptance criteria.
- **Produces:** `docs/VISION.md`, roadmap, feature specs.
- **Hands off to:** UX (for flows) and Development (to build).

### UX Design
- **Owns:** information architecture, user flows, page layouts, and component/interaction
  design for the read and contribute loops.
- **Produces:** flow descriptions, wireframe/layout notes, component specs grounded in
  Tailwind + shadcn/ui.
- **Hands off to:** Development.

### Development
- **Owns:** the application code — Next.js app, Drizzle schema/queries, Wikipedia + oEmbed
  integration, the ISR/caching setup.
- **Produces:** code, migrations, and the technical docs in `docs/ARCHITECTURE.md`.
- **Hands off to:** Testing.

### Testing / QA
- **Owns:** correctness verification — unit/integration tests, end-to-end checks of the core
  loop, regression checks, and validation against PM acceptance criteria.
- **Produces:** test suites, test reports, bug write-ups routed back to Development.
- **Hands off to:** Operations (once green).

### Operations
- **Owns:** deployment and runtime — Docker Compose, the VPS, Caddy/Cloudflare config,
  Postgres/Redis, backups, secrets, monitoring, and Wikimedia-API etiquette (User-Agent,
  rate limits).
- **Produces:** deploy runbooks, infra config, incident notes.
- **Hands off to:** Analytics (telemetry available) and back to PM (operational constraints).

### Analytics
- **Owns:** understanding usage and curation quality — what topics are viewed, contribution
  rates, which annotations get watched, funnel health.
- **Produces:** metric definitions, dashboards/reports, insights that feed PM's roadmap.
- **Hands off to:** Product Management.

## How work flows

The default loop, with the owner approving at the plan boundary:

```
Owner intent
   → PM (spec + acceptance criteria)
      → UX (flows + layouts)
         → Development (implement)
            → Testing (verify vs. criteria)
               → Operations (deploy)
                  → Analytics (measure)
                     → PM (next iteration)
```

Roles are not strictly sequential — UX and early Dev exploration can overlap, and Analytics
feeds PM continuously. The artifact each role produces is the hand-off contract: the next
role works from the document/code, not from conversation.

## How roles will map to tooling (described, not built this session)

- **Subagent definitions** — one per role, each with a focused system prompt encoding its
  charter, the artifacts it owns, and its hand-off rules.
- **Slash commands** — for common cross-role actions (e.g. "spec a feature," "review the
  diff," "deploy," "report metrics").
- **Workflows** — for multi-role pipelines that should run deterministically (e.g. the
  spec → build → test → deploy loop, or a periodic analytics report).
- **Shared artifacts / source of truth** — `docs/` holds vision, architecture, and specs;
  code holds the implementation; a `CLAUDE.md` at the repo root will encode shared
  conventions all roles follow.

## Bootstrap

1. ✅ A root **`CLAUDE.md`** capturing shared conventions (orientation, stack, principles,
   commit format) — **done**.
2. **Role subagent definitions** (`.claude/agents/`) for the six roles above — *next session.*
   Planned approach: **draft each role one at a time**, then **review them as a set** to confirm
   they compose into a coherent system — clear ownership, clean hand-offs, no gaps or overlaps.
3. A first **workflow** for the core build loop (PM spec → Dev → Testing).

Everything else (slash commands, analytics pipelines, ops runbooks) follows as the
application itself comes into existence.

> The application is not yet scaffolded. Node is on **24.16.0 LTS**, so the build will start
> from **Next.js 15 / React 19** per `docs/ARCHITECTURE.md`.
