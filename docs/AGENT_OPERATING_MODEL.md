# wiki+ — Agent Operating Model

wiki+ is **built and operated by AI agents** (Claude) acting in distinct, named roles. This
document describes that operating model. The role subagent definitions live in
`.claude/agents/`; the first build-loop workflow is scaffolded next (see "Bootstrap").

## Premise

Rather than one undifferentiated assistant, the project is run by a small "team" of agent
roles, each with a clear charter, the artifacts it owns, and defined hand-offs to the
others. This keeps work legible (every change traces to a role and an artifact), lets roles
run in parallel, and makes the project's process itself versioned and reviewable.

A human (the project owner) sets direction, approves plans, and arbitrates — agents do the
production work within their charters. The owner drives the loop from a prompt, **including
from a mobile Claude Code session** (see *How work flows*).

**What a "role" actually is.** Each role is a Claude Code subagent: a focused system prompt
with fresh context, not a persistent process. Roles do **not** invoke each other — the
orchestrator (the main session, or a workflow) drives the sequence, and the durable hand-off
is always an **artifact in the repo**. The value is specialized attention, independent
verification, and legibility — not a literal company simulation.

## Roles

### Product
- **Owns:** the vision, the roadmap, per-feature specs with acceptance criteria, and success-metric
  definitions. Translates owner intent into concrete, buildable specs. Decides *what* and *why*.
- **Produces:** `docs/VISION.md`, `docs/ROADMAP.md`, `docs/specs/<feature>.md`.
- **Hands off to:** UX (flows) and Development (build). Hand-shakes with UX on user stories ↔
  acceptance criteria.

### UX / Design
- **Owns:** user-centered design end to end — **personas, user stories**, information architecture,
  user flows, layouts, component/interaction design, **design specs**, and **design evaluation** of
  the built UI. Decides *who* and *how it feels*.
- **Produces:** `docs/design/` (personas, user stories, flows, component specs) and design-evaluation
  reports.
- **Grounded in:** `docs/TOPIC_PAGE_DESIGN.md` + `mockups/`; the Indigo Press identity; bespoke
  Tailwind components with optional headless primitives (e.g. **Radix**) — **not shadcn's styling**.
- **Hands off to:** Development (design spec); evaluates Development's output and routes design
  defects back.

### Development
- **Owns:** the application code — Next.js app, Drizzle schema/queries/migrations, Wikipedia + oEmbed
  integration, the ISR/caching setup including the Redis `cacheHandler`, Server Actions, Auth.js wiring.
- **Produces:** code, migrations, and the technical docs in `docs/ARCHITECTURE.md`.
- **Hands off to:** QA & Review (correctness + security) and UX / Design (design evaluation).

### QA & Review
- **Owns:** independent verification — unit/integration/e2e tests and validation against PM acceptance
  criteria, **plus code review and security review** with fresh, non-author eyes.
- **Produces:** test suites, test reports, code/security findings, bug write-ups routed back to
  Development.
- **Hands off to:** Operations (once green).

### Operations
- **Owns:** deployment and runtime — Docker Compose, the VPS, Caddy/Cloudflare, Postgres/Redis,
  backups, secrets, monitoring, Wikimedia-API etiquette — **and the cloud, mobile-drivable delivery
  pipeline**: prompt → automated CI/CD → updated **staging** deployment, observable and approvable
  from a phone, with no manual operation of the box.
- **Produces:** the CI/CD pipeline, infra config, deploy runbooks, incident notes.
- **Hands off to:** Analytics (telemetry available) and back to PM (operational constraints).

### Curation / Editorial
- **Owns:** the standards that make curation trustworthy — the **context-note standard** (fact vs.
  opinion), the `stance`/`accuracy_flag` **vocabularies**, **CC BY-SA + creator-credit** norms, and
  the **abuse/moderation policy**. wiki+'s differentiator has an owner.
- **Produces:** `docs/CURATION_STANDARD.md`; decisions recorded into ARCHITECTURE's open questions.
- **Hands off to:** UX (form fields + microcopy), Development (schema enums + enforcement), Product
  (policy → roadmap); later Analytics (curation-quality metrics).

### Analytics — *deferred*
- **Owns (later):** understanding usage and curation quality — topics viewed, contribution rates,
  which annotations get watched, funnel health.
- **Status:** deferred until there's traffic to measure. Its MVP-stage work — *defining* success
  metrics — sits in **Product** for now; it splits out as its own role at launch.
- **Hands off to:** Product Management.

## How work flows

The default loop, with the owner approving at the plan boundary and at PR-merge — **drivable from a
mobile Claude Code session**:

```
Owner intent (a prompt, possibly from mobile)
   → Product           spec + acceptance criteria + success metric
      → UX / Design     personas → user stories → flows → design spec
         → Development   implement
            ├→ QA & Review   verify vs. criteria; code + security review
            └→ UX / Design   evaluate built UI vs. design spec + stories
                  (defects from either route back to Development)
               → Operations   cloud CI/CD → updated staging deployment
                  → back to Product   (Analytics measures, once it exists)
```

**Curation / Editorial** sets the editorial standard that feeds UX (form + microcopy), Development
(schema enums + enforcement), and Product (policy → roadmap) — established early, since it shapes the
contribute loop.

Roles are not strictly sequential — UX and early Dev exploration can overlap, **UX appears both before
Dev** (design spec) **and after** (design evaluation), and Curation feeds in upstream. The artifact each
role produces is the hand-off contract: the next role works from the document/code, not from
conversation. Roles do not invoke each other — the orchestrator drives the sequence.

## Seams to watch

The set-level review surfaced three boundary edges. Here's how each resolves, so nothing is
orphaned or double-owned:

- **Accessibility testing** — split by altitude: **QA & Review** owns *automated* a11y checks
  (part of the test suite); **UX / Design** owns *judgment-based* a11y evaluation (in design
  evaluation). Covered twice on purpose, not dropped.
- **`docs/ARCHITECTURE.md` is co-touched** — **Development** owns the file and the technical
  architecture; **Curation / Editorial** writes *editorial* decisions (the `stance`/`accuracy_flag`
  vocabularies, the context-note license, the moderation policy) into its **Open questions**.
  Coordinate through that section.
- **SEO** has no standing owner — **Product** prioritizes it (a reach/discovery concern on the read
  path) and **Development** implements it (how much to server-render). Already an ARCHITECTURE open
  question.

## How roles map to tooling

- **Subagent definitions** — one per role in `.claude/agents/`, each a focused system prompt encoding
  its charter, owned artifacts, and hand-off rules. Tools and model are inherited; **boundaries are
  charter-enforced**, not sandboxed.
- **Slash commands** — for common cross-role actions (spec a feature, review the diff, deploy, report
  metrics). *Follows as the app comes into existence.*
- **Workflows** — for multi-role pipelines that should run deterministically. The core build-loop
  workflow must realize the **cloud, mobile-drivable prompt → staging cycle**.
- **Shared artifacts / source of truth** — `docs/` holds vision, architecture, specs, design, and the
  curation standard; code holds the implementation; `CLAUDE.md` encodes the shared conventions all
  roles follow.

## Bootstrap

1. ✅ A root **`CLAUDE.md`** capturing shared conventions — **done**.
2. ✅ **Role subagent definitions** (`.claude/agents/`) — **done**: `product-manager`, `ux-designer`,
   `developer`, `qa-reviewer`, `operations`, `curation-editorial`. (Analytics deferred; its
   metric-definition work sits in Product until launch.) Drafted one at a time, then reviewed as a set
   for coherent ownership, clean hand-offs, and no gaps or overlaps.
3. The first **workflow** for the core build loop (Product → UX → Dev → QA & Review / UX evaluation →
   Ops), whose explicit goal is the **completely-cloud, mobile-drivable cycle from a prompt to an
   updated staging deployment**. **Still pending — this is the priority.**

Everything else (more slash commands, analytics pipelines, ops runbooks) follows as the application
itself comes into existence.

### Lesson from 2026-06-14 (why step 3 is the priority)

A cloud session handed the prototype-v1 build did the whole thing in one context — Product spec, the
implementation, and design work all inline — with **no `qa-reviewer`, no UX evaluation**, and the
design spec edited *after* implementation to match what shipped. Zero role subagents were spawned.
The roles existed as files, but nothing made the orchestrator delegate to them, so it defaulted to
solo execution and narrated role names in commit messages instead. That build was **rolled back**.

Two contributing factors, both addressed:
- **No enforcement.** Documented roles aren't self-enforcing. The fix is the build-loop workflow above
  plus the **hard rule in `CLAUDE.md`** ("delegate; don't wear hats") — until the workflow lands, the
  rule holds by convention.
- **Orchestrator model.** That session ran on **Sonnet 4.6**, not Opus. Model choice was not the root
  cause (the missing enforcement was), but the meta-discipline of *resisting just-do-it and delegating*
  is exactly the judgment a stronger orchestrator holds better. **Run the cloud orchestrator on Opus**,
  and let the build-loop workflow pin models per role.

> The client-side prototype is scaffolded (Next.js 15 / React 19 on **Node 24.16.0 LTS**) and live on
> GitHub Pages; the production read-path is not. The **staging deploy target** for that read-path —
> automate the single VPS vs. use a managed platform — is an open **Operations** decision; record it
> in ARCHITECTURE.
