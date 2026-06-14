---
name: build-loop
description: This skill should be used to build or change a wiki+ application feature — whenever the owner asks to "build", "add", "implement", "redo", "rebuild", or substantially change or fix the behavior of a feature, page, component, or flow of the wiki+ app (including "run the build-loop for issue #N"). It runs the full role pipeline (Product → UX → Development → QA & Review + UX evaluation → Operations) by delegating each stage to the matching `.claude/agents/` role subagent, then commits and deploys the updated prototype to GitHub Pages — autonomously, from one prompt to a live deploy. Use it instead of doing feature/code work inline. A one-line copy, CI, or doc fix is NOT a feature change — do those inline, do not run this loop.
---

# wiki+ build-loop — the role pipeline, enforced

Run a wiki+ feature or code change through the full role pipeline by delegating each stage to the
matching `.claude/agents/` subagent, committing each role's artifact as the hand-off, and deploying
the result to GitHub Pages — autonomously, from one prompt to a live updated prototype.

This skill is the **enforcement mechanism** behind the hard rule in `CLAUDE.md` ("delegate; don't
wear hats"). It exists because a 2026-06-14 cloud session built a feature solo — no QA, no UX
evaluation, the design spec written *after* the fact to match shipped code — and was rolled back.
Running this loop makes the pipeline structural rather than a convention to remember.

It is realized as a **skill, not the Workflow tool**, on purpose: the loop must run *entirely in the
cloud, drivable from a phone*, and the Workflow tool is local-terminal-only. A skill orchestrating
committed `.claude/agents/` subagents runs in cloud sessions; the Workflow tool does not. (Rationale
recorded in `docs/AGENT_OPERATING_MODEL.md`.)

## Operating rules (non-negotiable)

- **Be the orchestrator; never wear a role hat.** Do **not** write specs, designs, code, tests,
  reviews, or deploy config directly. Every stage is a **subagent spawn** (the Task/Agent tool → the
  matching role in `.claude/agents/`) working in its own fresh context. The moment it feels easier to
  "just do this one part," that is the exact failure this loop prevents — spawn the role instead.
- **Artifacts are the hand-off, not this conversation.** Pass each subagent the **paths** to its
  inputs (the prior role's committed artifact + the relevant `docs/`), and require it to **commit**
  its own output in the project commit format. The next role reads the file, never your paraphrase.
- **Gates are content checks, not box-ticks.** A gate is satisfied only after you **read** the
  artifact and confirm it actually contains what's required — existence of a filename is not enough.
  The 2026-06-14 failure passed every existence check; it failed because nobody verified substance or
  ordering.
- **Run autonomously — one prompt to a live deploy.** Do **not** pause for human approval between
  stages. The owner's checkpoint is the **deployed site**; git is the rollback safety net. Where the
  prompt is ambiguous, make the most reasonable product assumption, record it for Product to refine,
  and keep going — do not stop to ask.
- **Autonomy does not mean shipping red.** Drive to a *green* deploy. If QA or UX defects can't be
  cleared within the bounded fix loop in Phase 4, **stop and report — do not deploy** known-broken
  code. The Phase-6 report must then **lead with `BLOCKED`** so the owner notices, since the live site
  won't change. When working from an issue, a BLOCKED stop also **comments the reason on the issue and
  sets `status: blocked`** (removing `status: in-progress`), leaving it open.
- **Pin models.** Run **every** role subagent on **Opus** for the prototype build (Task/Agent tool
  `model: opus`), the orchestrator included. Cost isn't the constraint here; judgment is — Phase 5's
  deploy decision is as failure-prone as the rest, so Operations is on Opus too.
- **Skip the loop for trivial, process-neutral changes** (CI bump, typo, doc tweak, one-line copy
  fix) — do those inline. This loop is for feature/behavior work on the app.

## Prototype scope (today's reality — don't over-build)

The app is a **client-side static SPA** (`output: "export"`, deployed to GitHub Pages). Data access
goes through the **`lib/data/` DataStore seam** (localStorage now; swap point `lib/data/index.ts`).
There are **no** Server Actions, Auth.js, Redis, Drizzle, or migrations yet — the production read-path
(ISR/Redis/Server Actions/Postgres) is **not built**. Those obligations from the role charters and
`docs/ARCHITECTURE.md` apply to the **production read-path, not this static export**. Do not let a role
wire server infra into the SPA, or block on "no migration written," in the prototype phase.

The build/verify commands that actually exist: **`yarn build`** and **`yarn typecheck`**. There is
**no `lint` script** (eslint is ignored during builds) and **no test runner yet** — Phase 4 stands one
up.

## The pipeline

Track the phases — **and the Phase-4 fix-round count** — with a todo list. Proceed in order; do **not**
enter a phase until the previous phase's **gate** is satisfied (read the artifact; confirm substance).

### 0 — Frame
- **If working from a GitHub issue** (`run the build-loop for issue #N`, or picking one off the queue),
  read it with `gh issue view N`. Proceed autonomously **only** if it is `type: build` **and**
  `status: ready` (the owner's sign-off) — or the owner explicitly invoked this run on it. Never
  auto-build a `bug`/`feedback`/`idea` issue that hasn't been groomed into a `ready` build task. On
  pickup, swap its label `status: ready` → `status: in-progress`. Treat the issue body as the **outline
  of the session's work**: it may include a discovery/decision step before building, and its deliverables
  often include **doc updates** (recording design/architecture decisions in `docs/`), not just code —
  honor those as part of "done."
- Restate the ask in one sentence. Choose a short feature **slug** (e.g. `topic-empty-state`) for
  artifact filenames (and an `issue-<N>-<slug>` branch when working from an issue).
- Note any assumption made from an ambiguous prompt (hand it to Product to refine). Do not ask the
  owner.

### 1 — Product → `docs/specs/<slug>.md`
Spawn **`product-manager`** (Opus). Input: the owner's prompt + any Phase-0 assumption.
Require it to produce and **commit** `docs/specs/<slug>.md`: problem, user value, scope, **testable
acceptance criteria**, explicit out-of-scope, and the success metric.
**Gate:** read the spec; confirm it has an **Acceptance criteria** section with ≥1 testable, numbered
item. If absent, re-spawn Product — do not proceed.

### 2 — UX / Design → `docs/design/<slug>.md`
If the feature touches context notes, `stance`/`accuracy_flag`, **attribution/creator-credit, or
contribution/moderation/rate-limit policy**, first spawn **`curation-editorial`** to set or confirm
the standard in `docs/CURATION_STANDARD.md` (it **creates** that file if it doesn't exist yet and the
feature needs it).
Spawn **`ux-designer`** (Opus). Inputs (paths): the spec, `docs/TOPIC_PAGE_DESIGN.md`, `mockups/`, and
the curation standard if relevant.
Require it to produce and **commit** `docs/design/<slug>.md`: the personas/stories served, flows,
**every state** (empty/loading/error/populated), microcopy, responsive behavior, and accessibility
requirements — the buildable contract, written **before** code.
**Gate:** read the design spec; confirm it covers all states + a11y. The design-spec commit must exist
**before** any Phase-3 code commit (check `git log`); a design spec written after code is the
2026-06-14 fraud — stop if that's happening.

### 3 — Development → code
Spawn **`developer`** (Opus). Inputs (paths): the spec, the design spec, `docs/ARCHITECTURE.md`, and
the `lib/data/` DataStore seam.
Require: implementation to the committed architecture *as scoped to the prototype above* (embed-never-host,
Wikidata-QID keys, Wikimedia etiquette + CC BY-SA attribution rendered, Indigo Press palette + AA
accessibility), `docs/ARCHITECTURE.md` updated if a decision changed, and a clean **`yarn build`** +
**`yarn typecheck`**. Commit the code. The dev agent must report **what QA should verify per acceptance
criterion** and **what UX should evaluate**.
**Gate:** `yarn build` and `yarn typecheck` both pass and the dev report is present. (A passing build
by the author is **not** review.)

### 4 — Verify (QA & Review + UX evaluation, in parallel)
Spawn **both** in parallel — fresh, non-author eyes:
- **`qa-reviewer`** (Opus): verify each acceptance criterion with tests, review the code, and run a
  security review **scoped to the surface that actually exists in this change** — for the prototype
  that's the **DOMPurify allowlist on Wikipedia HTML (XSS)** and the **oEmbed click-to-load facade**;
  Server-Action / Auth.js / rate-limit review applies only once those land, and "surface not present"
  is **not** a defect. **If no test runner exists yet, standing one up is the first QA deliverable**
  (Vitest + React Testing Library; Playwright for the core-loop e2e — commit the config + devDeps and
  record the choice in `docs/ARCHITECTURE.md`). The report must map **each acceptance-criterion ID to
  pass/fail with a test reference**; an unmapped criterion = fail. "No tests written" = fail, not pass.
- **`ux-designer`** (Opus): evaluate the built UI against the design spec + user stories — fidelity,
  interaction, usability, accessibility-in-practice.

**Round handling:** if either reports defects, spawn **`developer`** with the specific defects routed
to it, then re-spawn only the failing reviewer(s). Bound this to **2** fix→re-verify rounds; track the
count as a todo item. A red caused by **missing test tooling** is a Phase-3/tooling deficiency — route
it to Development to fix and it does **not** consume a fix round.
**Gate to proceed:** QA green on every acceptance criterion, no high-severity security finding, and a
UX-evaluation pass (minor cosmetic notes may pass with a logged follow-up). If still red after 2 rounds
→ **stop, commit what exists, and report `BLOCKED` with the unresolved defects — do not deploy.**

### 5 — Deploy (Operations) → live on GitHub Pages
Spawn **`operations`** (Opus). Its job: land the committed work on **`main`** (the only branch
`.github/workflows/deploy.yml` deploys from) and confirm the deploy. The Pages run fires on a push/merge
**to `main`**, never on a feature branch. Operations picks the right mechanism for the environment, in
this preference order:
1. **Already on `main` with push rights** (typical local session) → push `main`.
2. **On a feature/cloud branch, merge permitted** → push the branch and merge it to `main` (e.g.
   `gh pr merge`) so the workflow fires — fully automatic.
3. **Landing on `main` is blocked** (cloud sessions often restrict push to the current branch) → push
   the branch, **open a PR to `main`, and report it for a one-tap mobile merge**. This is the expected
   cloud fallback, not an error.

Operations owns these git mechanics — do not hand-roll them in the orchestrator. When working from an
issue, the landing commit or PR carries **`Closes #N`**, so the issue closes automatically when the work
merges to `main` (= deploys).
**Gate:** **not deployed** until a commit actually lands on `main` and the Actions run goes green —
**or** a PR to `main` is open and reported (case 3). Pushing only a feature branch is **not** a deploy;
never report "deployed" on a branch push that fired no `main` workflow run.

### 6 — Report
Summarize for the owner, mobile-legibly: what was built, the artifact paths (spec, design, tests if
present), the per-role commits, the **live URL** (`https://ragesoss.github.io/wikiplus/`) **or** the
open PR to merge, and any assumption made or follow-up logged. If the loop stopped at a gate, **lead
with `BLOCKED`** and the reason. When working from an issue, post this summary as an **issue comment** (the durable,
mobile-visible report): a green run closes the issue via the `Closes #N` merge; a blocked run leaves it
open with `status: blocked`. Mark the todos done. The next round starts from the owner's reaction to
the **live site**.

## If a role can't proceed
A role that hits a genuine fork it can't resolve within its charter reports back rather than guessing.
Surface that to the owner with the blocker and a recommended resolution — do **not** silently
substitute the orchestrator's judgment for the role's. That substitution is the hat-wearing this loop
exists to prevent.
