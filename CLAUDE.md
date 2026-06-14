# CLAUDE.md — wiki+

wiki+ is a **curation & contextualization layer over Wikipedia**: a Topic page shows a real
Wikipedia article alongside curated short social videos (creator-driven, vertical-first), each
with a human-written **context note** that separates factual content from the creator's opinion.

## Project status

**Design & spec phase.** What exists today:
- `docs/` — the spec (vision, architecture, topic-page design, agent operating model).
- `mockups/` — interactive HTML design mockups (open `mockups/inline-index.html`; reference
  Topic page: `mockups/inline-indigo-sync.html` curated, `inline-indigo-empty-v2.html` empty).
- `.claude/agents/` — the role subagents that build & operate this project (see below).

The application is **not yet scaffolded**. The committed stack and decisions live in
`docs/ARCHITECTURE.md` — build to that when implementation begins.

## Read first

- `docs/VISION.md` — product vision, core objects, MVP loop, non-goals
- `docs/ARCHITECTURE.md` — **source of truth for stack & data model**
- `docs/TOPIC_PAGE_DESIGN.md` — committed Topic-page UX + the "Indigo Press" plus identity
- `docs/AGENT_OPERATING_MODEL.md` — how this project is built/operated by agents

## How we work — agent roles

This project is built and operated by Claude agents in distinct roles, defined in
`.claude/agents/`: **product-manager, ux-designer, developer, qa-reviewer, operations,
curation-editorial** (Analytics is deferred until there's traffic; its metric-definition work
sits in Product). Default flow: Product spec → UX (personas/stories/design spec) → Dev implements
→ QA & Review verifies + UX evaluates the built UI → Ops ships to staging → back to Product. UX is
user-centered design end to end; Curation/Editorial sets the context-note standard that feeds UX,
Dev, and Product. The build loop is designed to run **entirely in the cloud, drivable from a mobile
Claude Code session**, from prompt to an updated staging deployment. Each role reads `docs/` first
and produces the artifacts named in `docs/AGENT_OPERATING_MODEL.md`. Delegate work to the matching
role.

## Planned stack (see ARCHITECTURE)

Next.js (App Router) + TypeScript, Tailwind, Postgres + Drizzle, Redis, Docker Compose + Caddy
behind Cloudflare, Auth.js OAuth (Wikimedia for the MVP).

## Principles (keep these true)

- **Read path is the scale lever** — Topic pages static/ISR + cached; dynamic work only for
  writes/auth; Redis-backed shared ISR cache handler from day one.
- **Embed, never host video** — oEmbed + click-to-load facade.
- **Topics keyed by Wikidata QID**, created on demand.
- **Wikimedia etiquette** (descriptive User-Agent, rate limits, lazy cache) + **CC BY-SA**
  attribution on every article view.
- **Plus identity = "Indigo Press"** on the Wiki Education Dashboard palette: `brand #676EB4`,
  `sprout #2A8270`, `action #1F6F95`, `ink #2C2C2C`; **gold `#E5AB28` deliberately unused**.
  The Wiki article side keeps a faithful Wikipedia look.
- **Accessibility is baseline** — AA contrast, focus states, keyboard support, text-labeled
  signals (never color alone).

## Commits

Follow the project commit format: subject line, then `## Changes`, then `## Process` (session
provenance, human input, iteration, tests), then `(Commit message written by Claude Code.)` and
the `Co-Authored-By` trailer.
