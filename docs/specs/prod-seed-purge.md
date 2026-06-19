# Spec — Remove the seeded demo curations from production (gate the deploy re-seed + one-time purge)

**Issue:** #75 · **Type:** build (Heavy lane — infra/data, **no user-facing UI**) · **Milestone:** Functional prototype
**Status:** Product spec (Phase 1) — feeds Development (gate + purge + docs) and QA (verify vs. criteria, against a test/throwaway DB, never prod).

> UX is intentionally **not** running for this issue: there is no new screen, flow, or copy. The only
> user-visible consequence is that production's Photosynthesis topic shows **zero** clips until the owner
> hand-builds real ones — which is the intended outcome, not a UI change to design.

---

## Problem

Production (the live Postgres app at `wikiplus.wikiedu.org`) re-seeds **14 fabricated "Photosynthesis"
demo curated clips** — attributed to a stub `@prototype` contributor — on **every deploy**. The deploy
entrypoint (`scripts/migrate.ts` → `await import("./seed")` → `seed(url)` → `seedDatabase`, run by the
compose `migrate` one-shot) calls the same environment-agnostic seed used by tests, and that seed's
idempotency guard (`lib/db/seed.ts:39–52`) only skips when the Photosynthesis topic **already has clips**.
So a plain data-delete of those clips is **silently undone**: the next deploy finds the topic empty and
re-inserts all 14. There is currently no way to make the fakes stay gone in production short of editing
code. This is the seed-on-deploy behavior `docs/design/persistence-postgres.md` (issue #45) introduced as
AC10 ("the deployed app opens NON-EMPTY for everyone") — a decision this issue **deliberately walks back
for production only**.

## User value

The owner is about to hand-build a few robust, **real** curation examples and wants the fabricated demo
clips gone and *staying* gone, so the fakes neither linger nor compete with the real work. The product's
"what good looks like" bar — a reader leaves with 2–5 clips they're glad they watched, each weighable — is
*undermined* by seeded placeholder clips attributed to a non-person `@prototype` stub: they look like
curation but carry no human judgment. Removing them in production (while keeping the seed as a test/local
fixture) means production shows only genuine, human-vouched curation, and an empty topic honestly reads as
"not yet curated" rather than padded with fakes.

## Product decision 1 — purge mechanism: **2a, a documented one-off script** (decided, not deferred)

**Decision: 2a — `scripts/purge-demo-content.ts`, a documented, idempotent one-off script the owner/ops
runs once against the live prod `DATABASE_URL`.** The destructive delete is an explicit, auditable,
human-initiated step — **not** folded into the automatic deploy path.

**Rationale (one line):** a destructive auto-delete that fires on *every* deploy is a sharp edge to bake
into a prototype that is about to hold real, irreplaceable hand-built curations; a one-time, owner-run,
auditable step is safer and more legible, and the gate (decision 2) already prevents re-seeding so 2b's
"automatic cleanup" buys nothing durable.

**Rejected alternative — 2b (fold the purge into the gated deploy path):** when seeding is disabled, the
`migrate` one-shot would also *delete* any previously-seeded demo content, auto-cleaning prod on the next
deploy with no manual step. Rejected because it makes **every** deploy carry a destructive `DELETE` against
the production curation tables. Once the owner's real curations exist, a future bug, a mis-scoped predicate,
or an accidental match (e.g. a real clip that happens to reuse a seeded `watchUrl`) could silently delete
real human work on an ordinary deploy — exactly the data this issue exists to protect. The deletion happens
**once**; making it a permanent fixture of the deploy loop trades a real recurring risk for a one-time
convenience. The gate (decision 2) is what keeps the fakes from coming back; the purge only needs to run
once, so a one-shot script is the right shape. (If the owner later prefers the convenience, 2b can be
revisited — but not as the default for the run holding the first real curations.)

The build-loop run **cannot and must not** reach the live prod DB; the run produces and *verifies* the
script against a test/throwaway DB (pglite/local). The actual prod execution is the owner/ops handoff in the
final section.

## Product decision 2 — the gate

- **Flag name:** `SEED_DEMO_CONTENT` (boolean-ish env string).
- **Default: ON.** Absent or any non-disabling value ⇒ seed runs. This is the key constraint: **tests and
  local dev call `seedDatabase` directly and must keep seeding with no new setup** — they must not have to
  set a flag to get a seeded fixture. (Dev picks the exact truthiness convention — e.g. only the literal
  string `"false"`/`"0"` disables — and records it; the product requirement is "unset ⇒ seeds.")
- **Set OFF in the production deploy path only:** in the compose `migrate` service `environment:` block
  (`deploy/docker-compose.yml`, the `migrate` one-shot currently sets only `DATABASE_URL`) — e.g.
  `SEED_DEMO_CONTENT: "false"`. This is the natural, prod-scoped place; the running `app` service and
  local/test runs are unaffected.
- **Where the check lives (product-level constraint, exact seam left to Dev):** the gate is read at the
  **deploy entrypoint** — `scripts/migrate.ts` and/or `scripts/seed.ts` — and decides *whether to call*
  `seedDatabase`. The check **must NOT** live inside `seedDatabase` itself: that function stays byte-for-byte
  unchanged so the test/local-dev fixture path is untouched and the seam is a single, legible "should we
  seed on this deploy?" decision at the boundary. (When the flag is off, the entrypoint logs that seeding is
  skipped and exits cleanly — a skipped seed is a success, not an error. Recall `migrate.ts` already imports
  the seed lazily, anticipating exactly this `--no-seed`-style skip.)

> **Reach note (informational, no AC):** `dist/migrate.cjs` is the bundled artifact esbuild produces from
> `scripts/migrate.ts`; whatever seam Dev picks must survive bundling (`scripts/build-migrate.mjs`) and be
> exercisable from the compose `migrate` command. The purge script (2a) is run with plain `tsx`/node by
> owner/ops against the live `DATABASE_URL` and need not be in the migrate bundle — Dev decides its runner
> and documents the exact invocation.

## Acceptance criteria (testable — each verified against a test/throwaway DB, e.g. pglite/local; never prod)

1. **Gated deploy path seeds zero demo clips.** Running the deploy entrypoint (`scripts/migrate.ts` /
   `scripts/seed.ts` path) with `SEED_DEMO_CONTENT` set OFF against a fresh, migrated test DB results in
   **zero** curated clips and **no** `@prototype` contributor row inserted. Migrations still apply; the run
   exits 0 (a skipped seed is a clean success, with a log line indicating the seed was skipped).
2. **Re-running the gated deploy path does not reintroduce them.** Re-running the entrypoint with the flag
   OFF (the every-deploy case) against the same DB still yields **zero** demo clips and no `@prototype`
   row — including after a prior purge has run (no re-seed of the fakes ever occurs while the flag is off).
3. **The purge removes the fakes and the orphaned stub, and is idempotent.** Against a test DB seeded with
   the 14 demo clips + the `@prototype` stub:
   - (a) `scripts/purge-demo-content.ts` deletes the **14 seeded Photosynthesis clips** (it targets the
     seeded demo set — matched on the stable identity Dev chooses, e.g. the seed `watchUrl`s and/or the
     stub-curator attribution — **not** by blindly deleting all clips on the topic, so any non-seeded clip
     on Photosynthesis would survive);
   - (b) it removes the `@prototype` stub **contributor row only if it has no remaining clips** after the
     deletes (orphan-only — it must not delete the stub if any clip still references it);
   - (c) **idempotent:** running it a second time is safe and a no-op — it deletes nothing further, errors
     not, and leaves the DB in the same state (so a re-run on an already-clean prod is harmless);
   - (d) it leaves the **three seeded topic rows** (`Photosynthesis`, `Cellular respiration`, `Cat`) intact —
     the purge removes demo *clips* + the orphaned stub *contributor*, not topics (topics created on demand
     are valid and may already carry real curation).
4. **`seedDatabase` still seeds when the flag is default-on; `yarn test` stays green with the seed
   exercised.** With `SEED_DEMO_CONTENT` unset (the test/local-dev default), the deploy entrypoint **does**
   call `seedDatabase`, which seeds the three topics + the 14 clips + the stub exactly as today; `seedDatabase`
   itself is unchanged; and `yarn test` passes with the seed still exercised in CI (the existing seed/store
   tests that depend on a seeded fixture remain green).
5. **Docs updated.** The production-seed policy change is recorded by **Development** in `docs/ARCHITECTURE.md`
   and `docs/design/persistence-postgres.md`: production no longer seeds demo curations (the #45 AC10
   "opens NON-EMPTY for everyone" is walked back for **production**), the seed is now a **test/local-dev
   fixture only**, the `SEED_DEMO_CONTENT` flag (default-on, off in the prod `migrate` env) is documented,
   and the one-time `scripts/purge-demo-content.ts` + its owner/ops execution step are recorded. (Product
   does not edit those docs; this AC verifies Dev did.)

## Out of scope (from the issue)

- **Removing `seedClips` / `seedDatabase` / the seed from code entirely** (the declined "remove from
  everywhere" path). The seed stays as a working test + local-dev fixture; only its *production deploy
  invocation* is gated off and the existing prod rows purged.
- **The localStorage / GitHub-Pages demo seed** (`lib/data/seed.ts` `seedClips` / `seedCandidates` /
  `SEEDED_TITLES` as used client-side) — untouched. The Cellular respiration "mock candidates" were never
  persisted to prod (candidates are computed/cached, never DB rows — `lib/db/seed.ts:107`,
  `lib/db/drizzle-store.ts:174`), so there is **no prod candidate data to purge**; this issue purges clips
  (+ the orphaned stub) only.
- **Adding the owner's real curation examples** — that is separate, manual owner work *after* this ships.
- **Any change to the live YouTube candidate pipeline.**
- **Removing the `STUB_HANDLE` (`@prototype`) constant from code** — it stays in
  `lib/curation/curator-attribution.ts` (used by `ContextByLink` / the store). Only the DB *contributor row*
  is removed, and only when orphaned.
- **A schema or auth-model change.** This is data + a deploy-env gate, not a migration of structure.

## Success metric

A binary **infra/data correctness gate**, not a traffic number (Analytics deferred):

- **Pass/fail (verified by QA against a test DB):** ACs 1–5 all green — the gated deploy path seeds zero
  demo clips and never reintroduces them, the purge removes the 14 clips + orphaned stub and is idempotent,
  the default-on seed still works and `yarn test` stays green, and the docs reflect the policy.
- **Production "done & stays done" (owner/ops-confirmed, post-deploy):** after the gated deploy + the
  one-time purge, production's Photosynthesis topic shows **zero** seeded clips, the `@prototype` stub
  contributor is gone, and a subsequent deploy leaves it empty (no fakes return). The gate is **not** met if
  any later deploy re-introduces a demo clip, if the purge deletes a non-seeded (real) clip, or if it removes
  a stub that still has clips.

## Assumptions

- **`@prototype` is created idempotently by the seed** (read-first / insert-if-absent — `lib/db/seed.ts:59–69`),
  so in production exactly **one** stub contributor row exists and, once the 14 clips are deleted, it is
  orphaned and safe to remove. (The purge nonetheless guards on "no remaining clips" rather than assuming
  this, per AC3b — defensive against any real clip that might attribute to the stub.)
- **In production the demo data reduces to the 14 Photosynthesis clips + the one `@prototype` row** — the
  Cellular respiration mock candidates were never persisted to prod (per the out-of-scope note). The owner's
  "all fake demo content" therefore maps, in prod, to exactly these rows.
- **The seeded clips are identifiable as a set** by a stable property Dev selects (the seed `watchUrl`s from
  `lib/data/seed.ts` and/or attribution to the stub curator). If, before the purge runs in prod, the owner
  had already hand-added a real clip that happens to collide on that property, the AC3a "don't blind-delete
  the whole topic" guard protects it; Dev should pick the most specific safe predicate.
- The build-loop run **has no network path to the live prod Postgres** and must not attempt one; all
  verification is against pglite/local (consistent with how `seedDatabase` is already tested).

## Owner / ops handoff (decision 2a ⇒ explicit one-time prod step)

Because the purge is **not** automated into the deploy (decision 2a), removing the existing fakes from the
**live VPS Postgres** is a one-time **owner/ops** step **after** this change merges and deploys:

1. **Merge + deploy** so the gate ships: the compose `migrate` service now carries `SEED_DEMO_CONTENT`
   off, and the next deploy no longer re-seeds. (Gating first means even if step 2 is delayed, the fakes
   can't multiply or be re-seeded after deletion.)
2. **Run the purge once** against the live prod `DATABASE_URL` — the owner/ops executes
   `scripts/purge-demo-content.ts` against the VPS Postgres (Dev documents the **exact** invocation —
   e.g. the `tsx`/node command and how `DATABASE_URL` is supplied — in `docs/ARCHITECTURE.md` /
   `docs/design/persistence-postgres.md` and/or the ops runbook). The script is idempotent (AC3c), so a
   re-run is harmless if there is any doubt it completed.
3. **Confirm** production's Photosynthesis topic now shows zero clips and the `@prototype` contributor is
   gone, and that a subsequent deploy leaves it empty.

This handoff is flagged here so it is not forgotten: **the build-loop run ships the gate + the verified
script; the owner/ops runs the one-time prod purge.**

## Hand-off

- **Development (next):** implement the `SEED_DEMO_CONTENT` gate at the deploy entrypoint (leaving
  `seedDatabase` unchanged), set it OFF in the compose `migrate` env, write the idempotent
  `scripts/purge-demo-content.ts`, ensure the seam survives the `dist/migrate.cjs` bundle, and record the
  policy + the exact purge invocation in `docs/ARCHITECTURE.md` + `docs/design/persistence-postgres.md`
  (AC5). No schema/auth change; do not touch `lib/db/seed.ts`'s seeding logic or the localStorage demo seed.
- **QA & Review:** verify ACs 1–5 against a test/throwaway DB (pglite/local), **never** prod — covering the
  gated-off deploy (zero clips, idempotent across re-runs), the purge (deletes the 14 + orphaned stub,
  idempotent, spares non-seeded clips and the topics), the default-on seed still working with `yarn test`
  green, and the doc updates. Route any defect back to Development.
- **UX / Design:** not running for this issue (no user-facing surface).
