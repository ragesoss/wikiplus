---
name: build-loop
description: This skill should be used to build or change a wiki+ application feature — whenever the owner asks to "build", "add", "implement", "redo", "rebuild", or substantially change or fix the behavior of a feature, page, component, or flow of the wiki+ app (including "run the build-loop for issue #N"). It runs the full role pipeline (Product → UX → Development → QA & Review + UX evaluation → Operations) by delegating each stage to the matching `.claude/agents/` role subagent, then commits and deploys the updated prototype to its live host (a push to `main` ships it to the Linode VPS at `wikiplus.wikiedu.org`) — autonomously, from one prompt to a live deploy. Use it instead of doing feature/code work inline. A one-line copy, CI, or doc fix is NOT a feature change — do those inline, do not run this loop.
---

# wiki+ build-loop — the role pipeline, enforced

Run a wiki+ feature or code change through the full role pipeline by delegating each stage to the
matching `.claude/agents/` subagent, committing each role's artifact as the hand-off, and deploying
the result to the project's live host (a push to `main` ships it to the Linode VPS at
`wikiplus.wikiedu.org`) — autonomously, from one prompt to a live updated prototype.

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
  and keep going — do not stop to ask. The **one** exception is a genuine **owner action the loop
  cannot perform** (provision a host, register an OAuth consumer, flip a cloud-console setting, add a
  DNS record) — see *Human action required* below: surface it and pause **without marking the run
  failed**, then resume when it's done. That is not the same as pausing to ask a product question.
- **A subagent that returns nothing is a failure, not a pass.** If a spawned role dies with an internal
  error or hands back an empty/garbled result, **re-spawn it** — never close a gate on a missing result.
  This matters most at the Phase-4 verify gate: a silently-dead re-verify once let a gate go unchecked.
  Confirm you actually have each reviewer's substantive result before proceeding.
- **You own the task list.** Track the phases — and the Phase-4 fix-round count — yourself. Tell each
  subagent to keep its *own* internal todos out of the shared task list, so phase tracking stays legible
  (a Dev subagent once interleaved its breakdown into the orchestrator's list).
- **Autonomy does not mean shipping red.** Drive to a *green* deploy. If QA or UX defects can't be
  cleared within the bounded fix loop in Phase 4, **stop and report — do not deploy** known-broken
  code. The Phase-6 report must then **lead with `BLOCKED`** so the owner notices, since the live site
  won't change. When working from an issue, a BLOCKED stop also **comments the reason on the issue and
  sets `status: blocked`** (removing `status: in-progress`), leaving it open.
- **Right-size the model per stage.** The judgment-heavy stages run on **Opus**: the orchestrator's
  lane/gate decisions (below), the **UX design contract**, and **QA's correctness + security review**.
  The mechanical stages run on **Sonnet** — Operations' deploy mechanics, a *cosmetic* fix round, a
  one-paragraph Curation §5.x append, and Express-lane single-file Dev. (This replaces the old
  "everything on Opus" rule, which was the bootstrap default when correctness mattered more than
  throughput; now that the loop runs often, spend Opus where judgment compounds and Sonnet where the
  step is rote. When unsure, use Opus.)
- **Skip the loop for trivial, process-neutral changes** (CI bump, typo, doc tweak, one-line copy
  fix) — do those inline. This loop is for feature/behavior work on the app.

## Prototype scope (read the live reality — don't assert it from here)

The runtime moves fast, so this skill must **not** hard-code a snapshot of it. **`docs/ARCHITECTURE.md`
— its *Prototype phase* and *Still deferred* sections — is the source of truth for what's built.** Read
it in Phase 0 and hand each role the scope relevant to its stage, rather than trusting a paragraph here.
If this paragraph ever disagrees with ARCHITECTURE, trust ARCHITECTURE and fix this.

As of this writing the app is a **Next.js App Router Node SSR server** (no longer a static `output:
"export"`), running **live on a Linode VPS at `https://wikiplus.wikiedu.org`**, auto-deployed by a push
to `main` (`.github/workflows/deploy.yml`: build the image in CI → push to GHCR → SSH to the box →
`docker compose pull && up`). Persistence is **shared Postgres via Drizzle, reached through a Server
Actions data-access boundary** (`lib/data/index.ts` → `lib/server/actions.ts` → `lib/db/drizzle-store.ts`),
so the deployed app is **multi-user and durable**. **Server Actions and migrations are live.** **Still
ahead:** real auth (Wikimedia OAuth — issue C) and the production read-path (ISR + the Redis shared
`cacheHandler`). So: a feature *may* legitimately add server infra (a Server Action, a schema change +
its migration) — don't block a role on "no migration written" when the change has no schema delta; but
don't let a role build the deferred read-path caching or auth speculatively either.

The build/verify commands that exist: **`yarn build`** (a *server* build in `.next/`, no static `out/`),
**`yarn start`** (serves that build), **`yarn typecheck`**, **`yarn test`** (Vitest + React Testing
Library — unit/integration, config in `vitest.config.ts`, specs under `test/`), and **`yarn test:e2e`**
(Playwright against `next build` + `next start`, specs under `e2e/`). There is **no `lint` script**
(eslint is ignored during builds). The harness is already committed; deps install with `yarn install
--frozen-lockfile` (as CI does). New work adds `test/*.test.ts` to the existing suite — do **not**
re-scaffold a runner.

**Helper scripts (use them — they're allowlisted, so they don't prompt; prefer them over raw
`ssh`/`curl`/`docker`).** `scripts/ops/verify-live.sh` — post-deploy live health check (read path
+ auth endpoints; Operations should run it in Phase 5). `scripts/ops/box-status.sh` /
`box-logs.sh` / `box-secrets-check.sh` — read-only box inspection (local sessions with the SSH key
only). `scripts/dev/test-db.sh up|down` — a local Postgres for integration tests (the normal suite
uses in-process pglite). `scripts/dev/qa-gate.sh` — the pre-PR `typecheck + test + build` gate in one
command (Dev's Phase-3 self-check; `--no-build` for a faster inner loop). `scripts/dev/shoot.sh
<file.html|/route> [--montage] [--crop WxH+X+Y]` — render mockups or live routes to PNG for UX design
+ Phase-4 evaluation evidence, replacing the chrome-screenshot + ImageMagick ritual. `scripts/ops/
wait-deploy.sh [sha]` — poll the `main` deploy run to completion, then chain `verify-live.sh`
(Operations, Phase 5). `scripts/ops/box-sync-compose.sh` mutates the live box and is deliberately
**not** allowlisted (keep one confirmation). **Invoke each script directly** (e.g.
`scripts/ops/verify-live.sh`), **never** wrapped in `bash` — the allowlist keys them by their literal
path, so `bash <script>` makes `bash` the matched command, defeats the allowlist, and prompts on every
call. The committed `.claude/settings.json` allowlists the
common `yarn`/`npx`/`git`/`gh` loop commands so **cloud sessions don't re-prompt** — see
`scripts/ops/README.md`.

**Known gap — the e2e gate is not green on `main`.** `yarn test:e2e` has **pre-existing failures** on
`main` (fixture/locator debt — tracked by the e2e-fixture-repair issue). Until that's fixed, an e2e run
can only verify **"no new failures vs. `main`,"** never a clean "e2e passes" acceptance criterion — QA
should baseline `main` first and **not** charge pre-existing reds to the change under review.

## The pipeline

**Tier the run by change size/risk — don't apply the maximum to the minimum.** The orchestrator
classifies the change in Phase 0 into one of three lanes; the lane decides how many roles run. The
two things that justify the loop — **independent review by non-author eyes** and **a design contract
written before code** — are preserved in *every* lane; what shrinks is the front of the pipeline and
the reviewer count, scaled to risk.

| Lane | When | Roles that run |
|---|---|---|
| **Express** | cosmetic / copy / single-component / a self-contained fix — **no** schema, auth, Server-Action, policy, or data-model change | Dev + **one** reviewer (UX if visual, QA if logic). Issue body is the spec; **no** separate Product or Curation spawn. |
| **Standard** | a feature touching UI + logic, no infra/policy | issue-as-spec (Product spawn only if it needs decomposition) → UX → Dev → QA **and** UX evaluation |
| **Heavy** | schema/migration, auth, deploy/infra, moderation·rate-limit·abuse policy, or a **new** context-note/stance/accuracy/attribution rule | the **full** pipeline below + Curation + the Phase-5 stateful-deploy discipline |

When unsure between two lanes, pick the heavier one. A lane is a *floor on rigor*, not a cap: if an
Express change surprises you (touches a boundary you didn't expect), **promote it mid-run**.

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
- **Classify the lane** (Express / Standard / Heavy — see the table above) from the issue body + a
  glance at the touched surface, and record it. The lane sets which phases run and the per-stage model.
- Note any assumption made from an ambiguous prompt (hand it to Product to refine). Do not ask the
  owner.
- **If other agents or worktrees share this repo** (parallel work — a separate branch/worktree, another
  build), identify the off-limits path/branch up front and pass a standing **"do not touch
  `<path-or-branch>`"** line to *every* subagent. The loop has no built-in awareness of concurrent work;
  a parallel agent's cleanup once made session files appear to vanish. Don't merge another agent's
  in-progress PR without confirming it's owner-authorized and conflict-free.

### 1 — Product → `docs/specs/<slug>.md` (or the issue body)
**A `status: ready` issue groomed by `/prepare-issue` already carries problem, value, scope, and
acceptance hints — that *is* the spec on the Express and Standard lanes.** Use the issue body directly
and skip the spawn. Spawn **`product-manager`** (Opus) only when the work needs **decomposition**, a
**success metric**, or has **genuine product ambiguity** — and **always** on the **Heavy** lane. When
spawned, require it to produce and **commit** `docs/specs/<slug>.md`: problem, user value, scope,
**testable acceptance criteria**, explicit out-of-scope, and the success metric.
**Gate:** there is a verifiable acceptance basis — either an **Acceptance criteria** section in a
committed spec (≥1 testable, numbered item) **or** the issue's "Done when" hints — that Phase 4 can
check against. If neither is testable, spawn Product to produce one — do not proceed.

### 2 — UX / Design → `docs/design/<slug>.md`
**Curation is conditional — and usually cheap.** Only when the change introduces or alters a
context-note, `stance`/`accuracy_flag`, **attribution/creator-credit, or contribution/moderation/
rate-limit** rule: first **check `docs/CURATION_STANDARD.md` yourself** — if it already covers the
case, note that and move on (no spawn). Spawn **`curation-editorial`** only to set a **new** rule (or
to **create** the file if it doesn't exist yet and the feature needs it); a one-paragraph §5.x append
runs on **Sonnet**. When both Curation and UX run, spawn them **in parallel** — both read the spec,
neither depends on the other.

**UX scales with the lane:**
- **Express lane** — a visual change on the now-stable Indigo Press system: **no** separate design-spec
  agent. Dev follows the existing `docs/TOPIC_PAGE_DESIGN.md` + design tokens, and UX runs **once** as
  the Phase-4 evaluation. (Skip Phase 2 entirely for an Express *logic* change.)
- **Standard / Heavy / any novel UI** — spawn **`ux-designer`** (Opus). Inputs (paths): the spec/issue,
  `docs/TOPIC_PAGE_DESIGN.md`, `mockups/`, and the curation standard if relevant. Require it to produce
  and **commit** `docs/design/<slug>.md`: the personas/stories served, flows, **every state**
  (empty/loading/error/populated), microcopy, responsive behavior, and accessibility — the buildable
  contract, written **before** code.
**Gate (when a design spec is required):** read it; confirm it covers all states + a11y. The
design-spec commit must exist **before** any Phase-3 code commit (check `git log`); a design spec
written after code is the 2026-06-14 fraud — stop if that's happening. **Novel UI always gets a design
spec first** — the Express skip is only for changes on the established system.

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

### 4 — Verify — fresh, non-author eyes (never skipped)
**Independent review is the one thing every lane keeps.** Who runs depends on the lane:
- **Express:** spawn the **one** reviewer the change demands — `ux-designer` for a visual change, or
  `qa-reviewer` for a logic change.
- **Standard / Heavy:** spawn **both** in parallel.

The reviewer charters (fresh, non-author eyes):
- **`qa-reviewer`** (Opus): verify each acceptance criterion with tests, review the code, and run a
  security review **scoped to the surface that actually exists in this change** — for the prototype
  that's the **DOMPurify allowlist on Wikipedia HTML (XSS)** and the **oEmbed click-to-load facade**;
  Server-Action / Auth.js / rate-limit review applies only once those land, and "surface not present"
  is **not** a defect. The Vitest + Playwright harness is **already committed** (`vitest.config.ts`,
  `test/`, `e2e/`, `yarn test`); QA runs and extends it — adding the acceptance-criterion tests as
  `test/*.test.ts` — rather than standing one up. The report must map **each acceptance-criterion ID to
  pass/fail with a test reference**; an unmapped criterion = fail. "No tests written" = fail, not pass.
- **`ux-designer`** (Opus): evaluate the built UI against the design spec + user stories — fidelity,
  interaction, usability, accessibility-in-practice.

**Round handling:** if either reports defects, spawn **`developer`** with the specific defects routed
to it, then re-spawn only the failing reviewer(s). Bound this to **2** fix→re-verify rounds; track the
count as a todo item. A red caused by **missing test tooling** is a Phase-3/tooling deficiency — route
it to Development to fix and it does **not** consume a fix round. A purely **cosmetic** fix round (copy,
contrast, spacing) runs Dev on **Sonnet** (per the model rule); re-spawn UX on a fix round only when the
defect was visual.
**Gate to proceed:** QA green on every acceptance criterion, no high-severity security finding, and a
UX-evaluation pass (minor cosmetic notes may pass with a logged follow-up). If still red after 2 rounds
→ **stop, commit what exists, and report `BLOCKED` with the unresolved defects — do not deploy.**

### 5 — Deploy (Operations) → live on the VPS
Spawn **`operations`** (Opus). Its job: land the committed work on **`main`** (the only branch
`.github/workflows/deploy.yml` deploys from) and confirm the **live result** at
`https://wikiplus.wikiedu.org`. A push/merge **to `main`** fires the deploy workflow (build image → GHCR
→ SSH to the box → `docker compose pull && up`); a feature branch fires nothing. Operations picks the
right mechanism for the environment, in this preference order:
1. **Already on `main` with push rights** (typical local session) → push `main`.
2. **On a feature/cloud branch, merge permitted** → push the branch and merge it to `main` (e.g.
   `gh pr merge`) so the workflow fires — fully automatic.
3. **Landing on `main` is blocked** (cloud sessions often restrict push to the current branch) → push
   the branch, **open a PR to `main`, and report it for a one-tap mobile merge**. This is the expected
   cloud fallback, not an error.

**Stateless change vs. stateful/infra change — they deploy differently.** Decide which this is and hand
it to Operations:
- A **stateless app change** (UI, client logic, a pure code path) deploys cleanly on the push — git is
  the rollback, nothing else to stage. This is the common case and the only one the old "push and it's
  green" doctrine fit.
- A **stateful or infra change** (a DB migration, a new secret / `.env` var, a compose or host change —
  anything the box must already have *before* the new image runs) can **take the live site down** if
  shipped naively: a missing secret fails `docker compose up`; `app depends_on migrate` means a bad
  migration blocks startup. Operations must then **stage the prerequisites on the box before the merge**,
  keep a **rollback image/plan** ready, **verify the live site post-deploy** (a green Actions run is not
  proof the site is healthy), and flag in the report that this deploy carried downtime risk.

Operations owns these git mechanics — do not hand-roll them in the orchestrator. When working from an
issue, the landing commit or PR carries **`Closes #N`** so the issue closes when the work merges to
`main`. **If bundling several issues, repeat the keyword per number** — `Closes #24, closes #25, closes
#26` — or GitHub auto-closes only the first.
**Gate:** **not deployed** until a commit actually lands on `main`, the Actions run goes green, **and**
(for a stateful change) the live site is verified healthy — **or** a PR to `main` is open and reported
(case 3). Pushing only a feature branch is **not** a deploy; never report "deployed" on a branch push
that fired no `main` workflow run.

### 6 — Report
Summarize for the owner, mobile-legibly: what was built, the artifact paths (spec, design, tests if
present), the per-role commits, the **live URL** (`https://wikiplus.wikiedu.org`) **or** the
open PR to merge, and any assumption made or follow-up logged. If the loop stopped at a gate, **lead
with `BLOCKED`** and the reason. When working from an issue, post this summary as an **issue comment** (the durable,
mobile-visible report): a green run closes the issue via the `Closes #N` merge; a blocked run leaves it
open with `status: blocked`. Mark the todos done. The next round starts from the owner's reaction to
the **live site**.

## Human action required (infra / credentials / cloud console)

Some issues — especially **A.2-class** infra/host work and **C** auth — need an action only the owner
can perform, outside any subagent's reach: provisioning a Linode + DNS A record + SSH-key authorization,
registering a Wikimedia OAuth consumer (external lead time), flipping a cloud-console setting (the
YouTube key's HTTP-referrer allowlist silently 403'd on the host cutover), GHCR package visibility, etc.
The loop can't do these, and a `BLOCKED` stop is the wrong signal — the work isn't broken, it's *waiting*.

When you hit one:
- **Pause without failing.** Surface a clearly-labeled **`OWNER ACTION REQUIRED`** block: exactly what to
  do, why, and what the loop will do once it's done. Don't mark the issue failed/blocked-as-broken; when
  working from an issue, comment the requested action and set `status: blocked-on-owner` (leave it open).
- **Resume cleanly** from the owner's "done," re-verifying the prerequisite actually landed (e.g. the DNS
  record resolves, the referrer allowlist includes the live origin) before continuing — don't assume.
- **Groom for it.** An A.2-class issue should be scoped *expecting* one or more owner-action pauses, not
  as a fully-autonomous run. Stage the human steps as an explicit checklist in the issue from the start.

## If a role can't proceed
A role that hits a genuine fork it can't resolve within its charter reports back rather than guessing.
Surface that to the owner with the blocker and a recommended resolution — do **not** silently
substitute the orchestrator's judgment for the role's. That substitution is the hat-wearing this loop
exists to prevent.
