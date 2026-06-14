# wiki+ — Agent Operating Model

wiki+ is **built and operated by AI agents** (Claude) acting in distinct, named roles. This
document describes that operating model. The role subagent definitions live in
`.claude/agents/`; the build loop that enforces the pipeline is the `/build-loop` skill (see "Bootstrap").

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
orchestrator (the main session running the `/build-loop` skill) drives the sequence, and the durable hand-off
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
- **The build-loop skill** (`.claude/skills/build-loop/`) — the core multi-role pipeline, realizing the
  **cloud, mobile-drivable prompt → deploy cycle**. It is a *skill*, not the deterministic **Workflow**
  tool: that tool is local-terminal-only, and the loop must run in cloud/mobile sessions (skills, slash
  commands, and `.claude/agents/` subagents all load from the repo clone in cloud sessions; the Workflow
  runtime does not). It enforces the sequence by ordered, gated delegation to role subagents rather than
  by a deterministic script.
- **Shared artifacts / source of truth** — `docs/` holds vision, architecture, specs, design, and the
  curation standard; code holds the implementation; `CLAUDE.md` encodes the shared conventions all
  roles follow.

## Issue pipeline — how work is queued and picked up

Tasks live in **GitHub Issues**, not in repo files — so planning, bug-filing, feedback, and idea
capture happen entirely off-git, in parallel with in-flight build sessions, with nothing to merge and
no repo to "mess with." **One issue = one build-loop run.** The durable build artifacts (specs, design,
code, ARCHITECTURE) still live in the repo; Issues hold the **queue and the async human↔build
conversation** — a clean split, not a divided source of truth.

**Labels are the metadata that gates autonomous work.** Two axes:
- **Type** (what it is): `type: build`, `type: bug`, `type: feedback`, `type: idea`. The issue
  templates in `.github/ISSUE_TEMPLATE/` apply these automatically.
- **Status** (build issues only): `status: ready`, `status: in-progress`, `status: blocked`.

**The pickup gate.** A build session works an issue **only if it is `type: build` + `status: ready`**
— the owner's deliberate sign-off — or the owner explicitly invokes the loop on a specific issue.
Bugs, feedback, and raw ideas are **never** auto-picked; groom one into a build task and mark it
`status: ready` to queue it. This is what makes it safe to let a session loose on the backlog.

**Lifecycle.** `status: ready` → a session takes it and swaps the label to `status: in-progress` → on
a green deploy the landing commit/PR carries **`Closes #N`**, so the issue closes exactly when the work
ships → if the session can't reach green or hits an unresolvable fork, it comments the reason, sets
`status: blocked`, and leaves the issue open for the owner. Invariant: **open = backlog / in-flight /
blocked; closed = shipped & live.**

**One-time label setup** (run once with `gh`; the templates' auto-labels need these to exist):

```
gh label create "type: build"        -c 1F6F95 -d "Implementation task for the build-loop"
gh label create "type: bug"          -c B60205 -d "Defect"
gh label create "type: feedback"     -c 0E8A16 -d "User/owner feedback"
gh label create "type: idea"         -c 676EB4 -d "Not yet shaped for implementation"
gh label create "status: ready"       -c 2A8270 -d "Signed off — a build session may pick this up"
gh label create "status: in-progress" -c C5DEF5 -d "A build session is working this"
gh label create "status: blocked"     -c D93F0B -d "Stuck — needs human input"
```

## Bootstrap

1. ✅ A root **`CLAUDE.md`** capturing shared conventions — **done**.
2. ✅ **Role subagent definitions** (`.claude/agents/`) — **done**: `product-manager`, `ux-designer`,
   `developer`, `qa-reviewer`, `operations`, `curation-editorial`. (Analytics deferred; its
   metric-definition work sits in Product until launch.) Drafted one at a time, then reviewed as a set
   for coherent ownership, clean hand-offs, and no gaps or overlaps.
3. ✅ The **build-loop** for the core pipeline (Product → UX → Dev → QA & Review / UX evaluation → Ops),
   whose explicit goal is the **completely-cloud, mobile-drivable cycle from a prompt to an updated
   deployment** — **done**: the `/build-loop` skill (`.claude/skills/build-loop/SKILL.md`). Built as a
   skill, not the deterministic **Workflow** tool, because that tool is local-terminal-only while the
   loop must run in cloud/mobile sessions. It enforces the sequence by ordered, gated delegation to the
   role subagents (an artifact gate per stage), runs autonomously from one prompt to a live deploy, and
   pins Opus for the judgment-heavy roles.

Everything else (more slash commands, analytics pipelines, ops runbooks) follows as the application
itself comes into existence.

### Lesson from 2026-06-14 (why step 3 is the priority)

A cloud session handed the prototype-v1 build did the whole thing in one context — Product spec, the
implementation, and design work all inline — with **no `qa-reviewer`, no UX evaluation**, and the
design spec edited *after* implementation to match what shipped. Zero role subagents were spawned.
The roles existed as files, but nothing made the orchestrator delegate to them, so it defaulted to
solo execution and narrated role names in commit messages instead. That build was **rolled back**.

Two contributing factors, both addressed:
- **No enforcement.** Documented roles aren't self-enforcing. The fix is the build-loop above — now the
  **`/build-loop` skill** — plus the **hard rule in `CLAUDE.md`** ("delegate; don't wear hats"). The
  skill enforces the pipeline by ordered, gated delegation; the rule still holds whenever the loop isn't
  used.
- **Orchestrator model.** That session ran on **Sonnet 4.6**, not Opus. Model choice was not the root
  cause (the missing enforcement was), but the meta-discipline of *resisting just-do-it and delegating*
  is exactly the judgment a stronger orchestrator holds better. **Run the cloud orchestrator on Opus**,
  and the `/build-loop` skill pins models per role (Opus across the board for the prototype build).

> The client-side prototype is scaffolded (Next.js 15 / React 19 on **Node 24.16.0 LTS**) and live on
> GitHub Pages; the production read-path is not. The **staging deploy target** for that read-path —
> automate the single VPS vs. use a managed platform — is an open **Operations** decision; record it
> in ARCHITECTURE.
