# CLAUDE.md — wiki+

wiki+ is a **curation & contextualization layer over Wikipedia**: a Topic page shows a real
Wikipedia article alongside curated short social videos (creator-driven, vertical-first), each
with a human-written **context note** that separates factual content from the creator's opinion.

## Project status

**Prototype phase — client-side, live on GitHub Pages.** What exists today:
- `docs/` — the spec (vision, architecture, topic-page design, agent operating model).
- `mockups/` — interactive HTML design mockups (open `mockups/inline-index.html`; reference
  Topic page: `mockups/inline-indigo-sync.html` curated, `inline-indigo-empty-v2.html` empty).
- `.claude/agents/` — the role subagents that build & operate this project (see below).
- The **Next.js 15 app** (`app/`, `components/`, `lib/`) — a client-side SPA shipped to
  **GitHub Pages** at <https://ragesoss.github.io/wikiplus/>, with `localStorage` standing in for
  the server. Push to `main` auto-deploys via `.github/workflows/deploy.yml`.
- Work is tracked as **GitHub Issues** (<https://github.com/ragesoss/wikiplus/issues>) — one issue =
  one build-loop run; see *Issue pipeline* in `docs/AGENT_OPERATING_MODEL.md`.

The production read-path (ISR/Redis/Server Actions/Postgres) is **not yet built**; all data access
goes through the `DataStore` seam in `lib/data/` (localStorage now; swap in `lib/data/index.ts`).
`docs/ARCHITECTURE.md` is the source of truth — see its **Prototype phase** section. **Use `yarn`**
(matches the committed lockfile and CI).

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
and produces the artifacts named in `docs/AGENT_OPERATING_MODEL.md`.

**This is a hard rule, not a suggestion — cloud sessions included:**

- **Delegate; don't wear hats.** The session you're in is the *orchestrator*. For any non-trivial
  feature or code change, **spawn the matching role as a subagent** (the Task tool → `.claude/agents/`)
  and let it work in its own fresh context. Do **not** do Product/UX/Dev/QA work inline and label it
  with a role name in the commit — that defeats the whole point (specialized attention, independent
  verification, legibility).
- **Artifacts are the hand-off.** Each role works from the previous role's committed artifact (spec,
  design spec, code), not from the conversation. A design spec is an **input to Dev**, written *before*
  implementation — never a doc edited afterward to match what shipped.
- **QA & Review is not optional.** Code isn't "done" until a `qa-reviewer` subagent (fresh, non-author
  eyes) has reviewed it and UX has evaluated the built UI against the design spec. A passing `yarn
  build` by the author is not review, even for the client-side prototype.
- **Trivial, process-neutral changes** (a CI version bump, a typo, a doc tweak) can be done inline —
  use judgment; the rule is about feature/code work.
- **Run the cloud orchestrator on Opus.** The discipline of delegating rather than just-doing-it is
  meta-judgment a stronger model holds better; a 2026-06-14 Sonnet cloud session defaulted to solo
  execution (see `docs/AGENT_OPERATING_MODEL.md`). The `/build-loop` skill pins per-role models (Opus for the judgment-heavy roles).

The enforcement of this loop is the **`/build-loop` skill** (`.claude/skills/build-loop/`): it runs the
role pipeline by delegating each stage to the matching `.claude/agents/` subagent, autonomously, from a
prompt to a deployed prototype. (It's a skill, not the deterministic **Workflow** tool, which is
local-terminal-only — the loop must run in cloud/mobile sessions; see `docs/AGENT_OPERATING_MODEL.md`.)
Invoke `/build-loop` — or just describe the feature work and let it trigger — instead of building inline;
the rule above still holds whenever the loop isn't used. Work is queued as **GitHub Issues** — one issue
= one build-loop run, and a session auto-picks up only an issue signed off as `type: build` +
`status: ready` (see *Issue pipeline* in `docs/AGENT_OPERATING_MODEL.md`).

## UI screenshot gallery

A committed **baseline gallery** of the app's UI lives at `docs/design/ui-screenshots/` (open
`index.html` — grouped + filterable). It is generated from the **scene catalog**
`e2e/screenshots/catalog.ts` (the single source of truth) by `scripts/dev/shots.sh`, which drives
the real app across every surface/state × mobile/tablet/desktop × logged-out/logged-in. Logged-in
shots are guarded: a capture fails unless the session truly resolved a contributor (never a silent
logged-out "logged-in" shot).

**Keep the baseline current with the UI** — whenever a change alters how a surface looks, refresh it
in the same PR so it never drifts:
- A few surfaces → **partial refresh**: `scripts/dev/shots.sh --group "<group>" --commit ui` or
  `--scene <id>,<id> --commit ui` (re-renders only those, preserves the rest).
- A broad/shared change (the header, the palette, a shared component) or a **new** surface/state →
  **full refresh**: `scripts/dev/shots.sh --all --commit ui`. Add a new surface/state by adding one
  `Scene` to the catalog — it is then captured and indexed automatically (no edits to the spec/script).
- For a PR, attach a focused subset as a comment gallery with `--scene … --pr <N>`.

Commit the regenerated PNGs + `index.html` alongside the UI change.

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
  `sprout #2A8270`, `action #1F6F95`, `ink #2C2C2C`; **gold `#E5AB28` is an accent / tertiary
  color** — used sparingly (e.g. the header wordmark), never indigo's equal and never a functional
  signal color. The Wiki article side keeps a faithful Wikipedia look.
- **The projector header is universal** — the `HeaderProjector` mark via the `SiteHeader` host
  wrapper is the app's one header. Every view gets it: any new view, or any old view being
  redesigned, that doesn't yet use the projector header should adopt `SiteHeader` (matching or new
  host config) rather than fork the mark or build a bespoke header (see `VISUAL_IDENTITY.md` §10.1).
- **Accessibility is baseline** — AA contrast, focus states, keyboard support, text-labeled
  signals (never color alone).

## Comments & docs — no history cruft

Inline comments and the **timeless docs** (this file, `README.md`, and the `docs/` source-of-truth
docs — `ARCHITECTURE.md`, `VISION.md`, `TOPIC_PAGE_DESIGN.md`, `VISUAL_IDENTITY.md`,
`CURATION_STANDARD.md`) describe the **current state and design intentions** — what the code/design
*is* and *why*. Do **not** narrate code history in them: no "used to / previously / formerly / no
longer / renamed / removed in favor of," no "Iteration N / finding N / PR #N," no before→after value
trails (e.g. "burnY 150→130 to trim the top space"). State the current value and the rationale; when
something changed, just describe what it is now. Git history, commit messages, and the **per-build
`docs/specs/` + `docs/design/` artifacts** are the legitimate record of how it got here — that
exclusion is the point: those files may carry change history; timeless docs and comments may not.
(Runtime-state language is fine: "ignore a superseded request," "the clip no longer shows after
removal" describe behavior, not code history.)

## Commits

Follow the project commit format: subject line, then `## Changes`, then `## Process` (session
provenance, human input, iteration, tests), then `(Commit message written by Claude Code.)` and
the `Co-Authored-By` trailer.
