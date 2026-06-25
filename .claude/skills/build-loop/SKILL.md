---
name: build-loop
description: This skill should be used to build or change a wiki+ application feature — whenever the owner asks to "build", "add", "implement", "redo", "rebuild", or substantially change or fix the behavior of a feature, page, component, or flow of the wiki+ app (including "run the build-loop for issue #N"). It runs the full role pipeline (Product → UX → Development → QA & Review + UX evaluation → Operations) inline in one active session — wearing each role's `.claude/agents/` charter in turn — with Phase-4 verification split between an inline evaluation and a concurrent fresh-eyes background subagent (so the session never sits idle and a cloud container can't freeze it mid-build), then commits and deploys the updated prototype to its live host (a push to `main` ships it to the Linode VPS at `wikiplus.wikiedu.org`) — autonomously, from one prompt to a live deploy. Use it instead of building the feature free-form. A one-line copy, CI, or doc fix is NOT a feature change — do those directly, do not run this loop.
---

# wiki+ build-loop — the role pipeline, run inline with independent verification

Run a wiki+ feature or code change through the full role pipeline **inline, in one active session** —
wearing each role's hat in sequence (reading that role's `.claude/agents/` charter first), committing
each role's artifact as you go, and verifying the result with **genuinely fresh eyes via a concurrent
background subagent** — then deploy to the project's live host (a push to `main` ships it to the
Linode VPS at `wikiplus.wikiedu.org`) — autonomously, from one prompt to a live updated prototype.

**Why inline, not a subagent per stage.** A cloud container freezes the session on main-loop
inactivity. A *foreground* subagent spawn leaves the main loop idle and waiting — so the container
freezes and the working subagent is killed mid-build, and the build dies with no result. The fix: the
main session does the work itself and is **never idle**. The **one** place a subagent still runs is
the verify phase, and it runs **in the background while the main session does the other evaluation
concurrently**, so the main loop stays warm (Phase 4).

**What this loop guarantees:** a committed artifact per stage, the **design spec committed before any
code** (provable by `git log` order), and **independent verification by fresh eyes** on the axis most
prone to author bias. Inline execution drops the *separate context* per stage; it does **not** drop
verification, the artifacts, or the design-before-code gate.

It is realized as a **skill, not the Workflow tool**, on purpose: the loop must run *entirely in the
cloud, drivable from a phone*, and the Workflow tool is local-terminal-only. (Rationale recorded in
`docs/AGENT_OPERATING_MODEL.md`.)

## Operating rules (non-negotiable)

- **Do the work inline; verify with fresh eyes.** Run every stage in this one active session — wear
  each role's hat in sequence, **reading that role's `.claude/agents/<role>.md` charter and the
  relevant `docs/` before the phase** so you bring its standards even though you're not spawning it.
  The **one** stage that must come from outside your own head is Phase-4 verification: spawn the
  fresh-eyes evaluator as a **background** subagent and do the *other* evaluation yourself,
  concurrently (Phase 4). **Never sit idle waiting on a subagent** — that idle is what freezes a
  cloud container and kills the working agent mid-build. If a subagent is running, you are working too.
- **Artifacts are the record — commit each stage as you go.** Commit each role's output (spec,
  design, code, tests) as its own commit, in order, in the project commit format. This keeps the
  build legible and makes the **design-before-code gate provable**: the `docs/design/<slug>.md` commit
  must precede the first code commit in `git log`.
- **Gates are content checks, not box-ticks.** A gate is satisfied only after you **read** the
  artifact (or the diff / test output) and confirm it actually contains what's required — a filename
  existing, or a stage reporting "done," is not enough. Verify substance and ordering yourself.
- **Run autonomously — one prompt to a live deploy.** Do **not** pause for human approval between
  stages. The owner's checkpoint is the **deployed site**; git is the rollback safety net. Where the
  prompt is ambiguous, make the most reasonable product assumption, record it as a Product follow-up,
  and keep going — do not stop to ask. The **one** exception is a genuine **owner action the loop
  cannot perform** (provision a host, register an OAuth consumer, flip a cloud-console setting, add a
  DNS record) — see *Human action required* below: surface it and pause **without marking the run
  failed**, then resume when it's done. That is not the same as pausing to ask a product question.
- **The verify subagent returning nothing is a failure, not a pass.** If the background evaluator dies
  with an internal error or hands back an empty/garbled result, **re-spawn it** — never close the
  verify gate on a missing result. Confirm you actually have its substantive result before proceeding.
- **Own a legible task list.** Track the phases — and the Phase-4 fix-round count — yourself. Tell the
  verify subagent to keep its *own* internal todos out of the shared task list.
- **Autonomy does not mean shipping red.** Drive to a *green* deploy. If QA or UX defects can't be
  cleared within the bounded fix loop in Phase 4, **stop and report — do not deploy** known-broken
  code. The Phase-6 report must then **lead with `BLOCKED`** so the owner notices, since the live site
  won't change. When working from an issue, a BLOCKED stop also **comments the reason on the issue and
  sets `status: blocked`** (removing `status: in-progress`), leaving it open.
- **Right-size the model.** Run this session on **Opus** — the judgment now lives here: the lane/gate
  decisions, the design contract, and your inline evaluation. The Phase-4 fresh-eyes verify subagent
  also runs on **Opus** (correctness + security is judgment-heavy). A purely *cosmetic* fix round
  (copy, contrast, spacing) is the one rote step that can drop to **Sonnet**. When unsure, use Opus.
- **Skip the loop for trivial, process-neutral changes** (CI bump, typo, doc tweak, one-line copy
  fix) — do those inline. This loop is for feature/behavior work on the app.

## Prototype scope (read the live reality — don't assert it from here)

The runtime moves fast, so this skill must **not** hard-code a snapshot of it. **`docs/ARCHITECTURE.md`
— its *Prototype phase* and *Still deferred* sections — is the source of truth for what's built.** Read
it in Phase 0 and carry each phase the scope relevant to it, rather than trusting a paragraph here.
If this paragraph ever disagrees with ARCHITECTURE, trust ARCHITECTURE and fix this.

The app is a **Next.js App Router Node SSR server** running **live on a Linode VPS at
`https://wikiplus.wikiedu.org`**, auto-deployed by a push to `main` (`.github/workflows/deploy.yml`:
build the image in CI → push to GHCR → SSH to the box → `docker compose pull && up`). Persistence is
**shared Postgres via Drizzle, reached through a Server Actions data-access boundary**
(`lib/data/index.ts` → `lib/server/actions.ts` → `lib/db/drizzle-store.ts`), so the app is
**multi-user and durable**. **Server Actions, migrations, and Wikimedia OAuth (Auth.js v5, stateless
JWT sessions) are live** — writes are auth-gated and attributed to the signed-in contributor, with the
curation-action write layer built on top. **Still ahead:** the production read-path (ISR + the Redis
shared `cacheHandler`).
So: a feature *may* legitimately add server infra (a Server Action, a schema change +
its migration) — don't block a role on "no migration written" when the change has no schema delta; but
don't let a role build the deferred read-path caching speculatively either.

The build/verify commands that exist: **`yarn build`** (a *server* build in `.next/`, no static `out/`),
**`yarn start`** (serves that build), **`yarn typecheck`**, **`yarn test`** (Vitest + React Testing
Library — unit/integration, config in `vitest.config.ts`, specs under `test/`), and **`yarn test:e2e`**
(Playwright against `next build` + `next start`, specs under `e2e/`). There is **no `lint` script**
(eslint is ignored during builds). The harness is already committed; deps install with `yarn install
--frozen-lockfile` (as CI does). New work adds `test/*.test.ts` to the existing suite — do **not**
re-scaffold a runner. **`yarn typecheck` / `yarn test` / `yarn build` run fully offline** — the suite
mocks the Wikipedia fetch + stubs YouTube and uses in-process pglite, so a cloud session with **no /
limited egress** can still run the whole unit gate (and `pr-ci.yml` now runs typecheck + tests on every
PR, so the merge gate doesn't depend on the cloud session's own environment). Only **live** verification
(`scripts/ops/verify-live.sh`, manual `yarn dev` browsing) and the **screenshot/e2e** harness (chromium)
need more — see *Worktrees & tool hygiene* and Phase 4 for the no-chromium fallback.

**Helper scripts (use them — they're allowlisted, so they don't prompt; prefer them over raw
`ssh`/`curl`/`docker`).** `scripts/ops/verify-live.sh` — post-deploy live health check (read path
+ auth endpoints; Operations should run it in Phase 5). `scripts/ops/box-status.sh` /
`box-logs.sh` / `box-secrets-check.sh` — read-only box inspection (local sessions with the SSH key
only). `scripts/dev/test-db.sh up|down` — a local Postgres for integration tests (the normal suite
uses in-process pglite). `scripts/dev/qa-gate.sh` — the pre-PR `typecheck + test + build` gate in one
command (Dev's Phase-3 self-check; `--no-build` for a faster inner loop). `scripts/dev/worktree.sh
new <name>|rm <name>|list` — make/tear down a build worktree in the standard in-repo location (see
*Worktrees & tool hygiene* below). `scripts/dev/shoot.sh
<file.html|/route> [--montage] [--crop WxH+X+Y]` — render mockups or live routes to PNG for UX design
+ Phase-4 evaluation evidence, replacing the chrome-screenshot + ImageMagick ritual. `scripts/dev/shots.sh
[--all|--home|--topic] [--pr N]` — the **standard PR screenshot matrix** (home + Topic × logged-out/logged-in
× desktop/tablet/mobile × the Tier-A/slim scroll states) rendered through the e2e harness (seeded DB + the
signed-in cookie, no real OAuth); `--pr N` attaches the gallery to a PR (hosted on the never-merged
`screenshots` branch, SHA-pinned). Run it for any **UI-significant** change — see Phases 4–5. `scripts/ops/
wait-deploy.sh [sha]` — poll the `main` deploy run to completion, then chain `verify-live.sh`
(Operations, Phase 5). `scripts/ops/box-sync-compose.sh` mutates the live box and is deliberately
**not** allowlisted (keep one confirmation). **Invoke each script directly** (e.g.
`scripts/ops/verify-live.sh`), **never** wrapped in `bash` — the allowlist keys them by their literal
path, so `bash <script>` makes `bash` the matched command, defeats the allowlist, and prompts on every
call. The committed `.claude/settings.json` allowlists the
common `yarn`/`npx`/`git`/`gh` loop commands + the safe read-only inspection verbs so **cloud sessions
don't re-prompt** — see `scripts/ops/README.md`.

## Worktrees & tool hygiene

**Every build runs in its own worktree, in ONE standard place.** Create it with
`scripts/dev/worktree.sh new issue-<N>-<slug>` — it makes `.claude/worktrees/issue-<N>-<slug>` on a
fresh branch, symlinks `node_modules` from the main checkout, and **prints the worktree's absolute
path**. Because the worktree lives **under the repo root**, every Read/Write/Grep into it inherits the
trusted-directory grant — **no per-worktree permission prompt** (a sibling `../wikiplus-issue-N` is
outside the root and prompts on every access). It is gitignored and parallel-safe (one subdir +
branch per build). Tear down with `scripts/dev/worktree.sh rm <name>`.

Work **in** that printed absolute path for the whole build, and pass it to the Phase-4 verify subagent
as its working location. The rules:
- **Work *in* the worktree — never prefix commands with `cd <worktree> && …`.** The worktree is the
  cwd; a compound `cd` to a non-cwd absolute path defeats the allowlist and prompts on **every** call.
- **Give tools worktree-absolute paths** for any **new** file — a Write otherwise resolves a new
  path to the *main* repo root, landing the file in the wrong tree.
- **Prefer the Read / Grep / Glob tools over `cat` / `grep` / `ls` / `head` via Bash** for inspection
  (the read-only Bash verbs are allowlisted as a fallback, but the dedicated tools never prompt and
  are cheaper).
- **Commit incrementally** during a long run, so an API/spend-limit death leaves recoverable work in
  the worktree rather than an uncommitted tree with no report.

## The pipeline

**Tier the run by change size/risk — don't apply the maximum to the minimum.** Classify the change in
Phase 0 into one of three lanes; the lane decides how many roles run. The two things that justify the
loop — **independent verification by fresh eyes** (Phase 4's background subagent) and **a design
contract written before code** — are preserved in *every* lane; what shrinks is the front of the
pipeline and the reviewer count, scaled to risk.

| Lane | When | Roles that run |
|---|---|---|
| **Express** | cosmetic / copy / single-component / a self-contained fix — **no** schema, auth, Server-Action, policy, or data-model change | Dev + **one** reviewer (UX if visual, QA if logic). Issue body is the spec; **no** separate Product or Curation pass. |
| **Standard** | a feature touching UI + logic, no infra/policy | issue-as-spec (a Product pass only if it needs decomposition) → UX → Dev → QA **and** UX evaluation |
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
- Note any assumption made from an ambiguous prompt (log it as a Product follow-up). Do not ask the
  owner.
- **If other agents or worktrees share this repo** (parallel work — a separate branch/worktree, another
  build), identify the off-limits path/branch up front, stay out of it yourself, and pass a standing
  **"do not touch `<path-or-branch>`"** line to the Phase-4 verify subagent. The loop has no built-in
  awareness of concurrent work. Don't merge another agent's in-progress PR without confirming it's
  owner-authorized and conflict-free.

### 1 — Product → `docs/specs/<slug>.md` (or the issue body)
**A `status: ready` issue groomed by `/prepare-issue` already carries problem, value, scope, and
acceptance hints — that *is* the spec on the Express and Standard lanes.** Use the issue body
directly. Only when the work needs **decomposition**, a **success metric**, or has **genuine product
ambiguity** — and **always** on the **Heavy** lane — wear the **product-manager** hat (read
`.claude/agents/product-manager.md`) and write + **commit** `docs/specs/<slug>.md`: problem, user
value, scope, **testable acceptance criteria**, explicit out-of-scope, and the success metric.
**Gate:** there is a verifiable acceptance basis — either an **Acceptance criteria** section in a
committed spec (≥1 testable, numbered item) **or** the issue's "Done when" hints — that Phase 4 can
check against. If neither is testable, write one (Product hat) before proceeding.

### 2 — UX / Design → `docs/design/<slug>.md`
**Curation is conditional — and usually cheap.** Only when the change introduces or alters a
context-note, `stance`/`accuracy_flag`, **attribution/creator-credit, or contribution/moderation/
rate-limit** rule: first **check `docs/CURATION_STANDARD.md`** — if it already covers the case, note
that and move on. Otherwise wear the **curation-editorial** hat (read its charter) to set the **new**
rule (or to **create** the file if the feature needs it and it doesn't exist yet) — usually a
one-paragraph §5.x append.

**UX scales with the lane:**
- **Express lane** — a visual change on the now-stable Indigo Press system: **no** separate design
  spec. Follow the existing `docs/TOPIC_PAGE_DESIGN.md` + design tokens while building, and UX runs
  **once** as the Phase-4 evaluation. (Skip Phase 2 entirely for an Express *logic* change.)
- **Standard / Heavy / any novel UI** — wear the **ux-designer** hat (read `.claude/agents/ux-designer.md`).
  Inputs: the spec/issue, `docs/TOPIC_PAGE_DESIGN.md`, `mockups/`, and the curation standard if
  relevant. Produce and **commit** `docs/design/<slug>.md`: the personas/stories served, flows,
  **every state** (empty/loading/error/populated), microcopy, responsive behavior, and accessibility
  — the buildable contract, written **before** code.
**Gate (when a design spec is required):** read it; confirm it covers all states + a11y. The
design-spec commit must exist **before** any Phase-3 code commit (check `git log`) — if code is
already committed, stop. **Novel UI always gets a design spec first** — the Express skip is only for
changes on the established system.

### 3 — Development → code
Wear the **developer** hat (read `.claude/agents/developer.md`). Inputs: the spec, the design spec,
`docs/ARCHITECTURE.md`, and the `lib/data/` DataStore seam. Implement to the committed architecture
*as scoped to the prototype above* (embed-never-host, Wikidata-QID keys, Wikimedia etiquette + CC
BY-SA attribution rendered, Indigo Press palette + AA accessibility), update `docs/ARCHITECTURE.md`
if a decision changed, and reach a clean **`yarn build`** + **`yarn typecheck`**. Commit the code.
**Write down — for Phase 4 — what to verify per acceptance criterion and what to evaluate for UX**, so
the fresh-eyes pass has a concrete charter.
**Gate:** `yarn build` and `yarn typecheck` both pass and the per-criterion verify/evaluate notes
exist. (Your own passing build is **not** review — that's Phase 4.)

### 4 — Verify — fresh eyes, kept warm (never skipped)
**Independent verification is the one thing every lane keeps — and the one stage that must come from
outside your own head, because you are the author.** Run it as a **split, never idle** — the axis that
most benefits from truly fresh eyes goes to a **background subagent**; you do the *other* evaluation
**inline, concurrently**, which keeps the container warm (a session left idle waiting on a blocking
subagent gets frozen and killed). Spawn the subagent with the Agent tool and **`run_in_background:
true`**, in the **same worktree**, then immediately start your own evaluation; collect its result when
it returns.

**Which axis goes to the subagent.** Default: **QA (correctness + security) → the background
subagent** — self-reviewing code you just wrote is the weakest review, and security review most needs
an outsider. Your inline pass is then the **UX evaluation**, checked against the *committed* design
spec + screenshots (an external yardstick you can hold yourself to honestly). **Flip it** — UX →
subagent, QA inline — only when the change is **UI-dominant / novel** and the design judgment, not
code correctness, is the crux. Pick the split per change: give the subagent whichever axis would be
most corrupted by author bias.

**By lane:**
- **Standard / Heavy** (both evaluators run): background-spawn one axis, do the other inline,
  concurrently. **Both must come back green.**
- **Express** (one evaluator): background-spawn that sole reviewer (the fresh-eyes gate) **and** stay
  warm with a concurrent inline cross-check of the same change (re-read the diff adversarially, run the
  tests). The subagent's verdict is the gate; your inline pass is the warm-keeper + first filter.

The verification charters (whoever runs each — subagent or you):
- **QA** (`qa-reviewer` charter): verify each acceptance criterion with tests, review the code, and run
  a security review **scoped to the surface that actually exists in this change** — for the prototype
  that's the **DOMPurify allowlist on Wikipedia HTML (XSS)** and the **oEmbed click-to-load facade**;
  Server-Action / Auth.js / rate-limit review applies only once those land, and "surface not present"
  is **not** a defect. The Vitest + Playwright harness is **already committed** (`vitest.config.ts`,
  `test/`, `e2e/`, `yarn test`); run and **extend** it — add the acceptance-criterion tests as
  `test/*.test.ts` — rather than standing one up. Map **each acceptance-criterion ID to pass/fail with
  a test reference**; an unmapped criterion = fail. "No tests written" = fail, not pass.
- **UX** (`ux-designer` charter): evaluate the built UI against the design spec + user stories —
  fidelity, interaction, usability, accessibility-in-practice. For a **UI-significant** change, render
  the **standard screenshot matrix** (`scripts/dev/shots.sh`) as the evidence rather than ad-hoc
  shots — it covers logged-out/logged-in × widths × states across home + Topic, so the evaluation and
  the PR gallery (Phase 5) work from the same reproducible set.

**Commit the background subagent's tests** — a reviewer writes `test/*.test.ts` into the worktree but
may not commit them; commit them yourself before deploy and confirm `git status` is clean of stray
reviewer scratch.

**Screenshots are a default-on expectation for UI-significant changes — the owner should not have to
ask.** A change that alters what the app *looks like* (layout, a component, a page/flow, responsive
behavior) gets the standard gallery attached to its PR (Phase 5) without prompting; a non-visual
logic/infra change skips it. This is an *expectation*, not a hard gate: if the harness genuinely
can't render (a cloud session has **no chromium** — see *Prototype scope*; or an infra-only PR has no
UI), note it, defer the gallery to a local pass, and proceed — do **not** report BLOCKED over a
missing gallery.

**Round handling:** if either axis reports defects, **fix them inline** (developer hat), then re-run
your inline evaluation and **re-spawn the background subagent** for its axis. Bound this to **2**
fix→re-verify rounds; track the count as a todo item. A red caused by **missing test tooling** is a
Phase-3 deficiency — fix it inline and it does **not** consume a fix round.
**Gate to proceed:** QA green on every acceptance criterion, no high-severity security finding, and a
UX-evaluation pass (minor cosmetic notes may pass with a logged follow-up). If still red after 2 rounds
→ **stop, commit what exists, and report `BLOCKED` with the unresolved defects — do not deploy.**

### 5 — Deploy (Operations) → live on the VPS
Wear the **operations** hat (read `.claude/agents/operations.md`). The job: land the committed work on
**`main`** (the only branch `.github/workflows/deploy.yml` deploys from) and confirm the **live result** at
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
  the rollback, nothing else to stage. This is the common case.
- A **stateful or infra change** (a DB migration, a new secret / `.env` var, a compose or host change —
  anything the box must already have *before* the new image runs) can **take the live site down** if
  shipped naively: a missing secret fails `docker compose up`; `app depends_on migrate` means a bad
  migration blocks startup. Operations must then **stage the prerequisites on the box before the merge**,
  keep a **rollback image/plan** ready, **verify the live site post-deploy** (a green Actions run is not
  proof the site is healthy), and flag in the report that this deploy carried downtime risk.

These git mechanics are the Operations charter — follow them exactly rather than improvising. When
working from an issue, the landing commit or PR carries **`Closes #N`** so the issue closes when the work merges to
`main`. **If bundling several issues, repeat the keyword per number** — `Closes #24, closes #25, closes
#26` — or GitHub auto-closes only the first.

**Attach the screenshot gallery (UI-significant changes).** When the change is UI-significant and the
landing path opens a PR (case 2 before merge, or case 3), Operations runs **`scripts/dev/shots.sh --pr
N`** (scope it with `--topic`/`--home` when only one surface changed) so the PR carries the standard
before-your-eyes gallery — the owner should not have to ask for it. This is the default-on expectation
from Phase 4, realized on the PR; skip it only for a non-visual (logic/infra) change.

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
can perform, outside the loop's reach: provisioning a Linode + DNS A record + SSH-key authorization,
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

## If you hit a fork you can't resolve
When a phase hits a genuine fork its charter can't settle — a real product decision, an architecture
trade-off with owner-visible consequences — surface it to the owner with the blocker and a recommended
resolution rather than guessing. (Ambiguity you *can* reasonably resolve, you resolve and log as a
follow-up — see *Run autonomously*. This is for the forks you genuinely can't.)
