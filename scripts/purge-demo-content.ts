import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { PHOTOSYNTHESIS_QID, seedClips } from "@/lib/data/seed";
import { STUB_HANDLE } from "@/lib/curation/curator-attribution";
import type { Db } from "@/lib/db/client";
import { clip, contributor, topic } from "@/lib/db/schema";

// One-time, idempotent purge of the seeded Photosynthesis demo curations from PRODUCTION
// (issue #75, Product decision 2a — a documented, owner/ops-run one-off, NOT folded into the
// automatic deploy path). It removes the fabricated demo clips and the now-orphaned `@prototype`
// stub contributor, leaving the seeded TOPIC rows intact.
//
// WHY a standalone script (not auto-on-deploy): a destructive DELETE that fires on every deploy
// is a sharp edge against the production curation tables that are about to hold real, irreplaceable
// hand-built curations. The gate (SEED_DEMO_CONTENT, scripts/migrate.ts) is what keeps the fakes
// from coming back; the purge only needs to run ONCE, so a one-shot is the right shape.
//
// ─── HOW THE OWNER/OPS RUNS IT (against the LIVE prod DATABASE_URL) ────────────────────────────
// The script is run with `tsx` (the same runner as `yarn db:migrate` / `yarn db:seed`), NOT the
// bundled dist/migrate.cjs — it is deliberately OUTSIDE the deploy bundle. From the repo on a box
// (or any machine with network reach to the prod Postgres):
//
//     DATABASE_URL="postgres://USER:PASS@HOST:5432/wikiplus" yarn tsx scripts/purge-demo-content.ts
//
//   • `yarn tsx …` resolves the project-local tsx (node_modules/.bin/tsx) + the `@/*` path alias.
//   • DATABASE_URL is the live prod connection string — supply it the same way deploys do
//     (the value lives in /opt/wikiplus/.env on the box; export it for this one command).
//   • It is IDEMPOTENT (AC3c): a second run is a safe no-op. So if there is any doubt the first run
//     completed, re-running it is harmless.
//
// Sequence per the spec's owner/ops handoff: (1) merge + deploy so the gate ships and the next
// deploy no longer re-seeds, THEN (2) run this once, THEN (3) confirm Photosynthesis shows zero
// clips and `@prototype` is gone and a later deploy leaves it empty.

/** The seeded Photosynthesis demo clips' `watchUrl`s — the STABLE IDENTITY of the seeded set. */
const SEEDED_WATCH_URLS: readonly string[] = seedClips
  .filter((c) => c.topicQid === PHOTOSYNTHESIS_QID)
  .map((c) => c.watchUrl);

export interface PurgeResult {
  /** Number of seeded demo clips deleted on this run (0 on a re-run / already-clean DB). */
  clipsDeleted: number;
  /** True if the orphaned `@prototype` stub contributor was removed on this run. */
  stubRemoved: boolean;
}

/**
 * Purge the seeded Photosynthesis demo clips + the orphaned `@prototype` stub contributor, against
 * any Drizzle Postgres handle (the live VPS Postgres via `purge(url)` on deploy-adjacent ops, AND
 * the in-memory pglite handle in tests — the same dual-target shape as `seedDatabase`).
 *
 * PREDICATE (AC3a) — the MOST SPECIFIC SAFE match, NOT a blind topic-wide delete:
 *   delete `clip` rows WHERE `topic_id` = the Photosynthesis topic AND `watch_url` ∈ the seeded set.
 * Both arms must hold, so a NON-seeded (real) clip on Photosynthesis survives (its watchUrl is not
 * in the seeded set), and a clip on any OTHER topic that happens to reuse a seeded watchUrl also
 * survives (wrong topic). The seeded `watch_url`s are derived from `seedClips` at runtime, so the
 * set is exactly what the seed inserts — it can never drift from the seed.
 *
 * STUB (AC3b) — ORPHAN-ONLY: remove the `@prototype` contributor row ONLY if, AFTER the clip
 * deletes, NO clip still references it (defensive against a real clip that might attribute to the
 * stub — never delete the stub while any clip points at it).
 *
 * IDEMPOTENT (AC3c): a second run deletes nothing further and does not error — the watch-url
 * predicate matches nothing once the seeded clips are gone, and the stub is already absent.
 *
 * TOPICS (AC3d): the three seeded topic rows are LEFT INTACT — this purges demo clips + the
 * orphaned stub contributor, never topics.
 */
export async function purgeDemoContent(db: Db): Promise<PurgeResult> {
  // ── Resolve the Photosynthesis topic (scope the delete to it). ──
  const topicRows = await db
    .select({ id: topic.id })
    .from(topic)
    .where(eq(topic.wikidataQid, PHOTOSYNTHESIS_QID))
    .limit(1);
  const photoTopicId = topicRows[0]?.id;

  // ── (a) Delete the seeded demo clips — topic-scoped AND watch-url-matched. ──
  let clipsDeleted = 0;
  if (photoTopicId !== undefined && SEEDED_WATCH_URLS.length > 0) {
    const deleted = await db
      .delete(clip)
      .where(
        and(
          eq(clip.topicId, photoTopicId),
          inArray(clip.watchUrl, [...SEEDED_WATCH_URLS])
        )
      )
      .returning({ id: clip.id });
    clipsDeleted = deleted.length;
  }

  // ── (b) Remove the `@prototype` stub contributor — ORPHAN-ONLY (no remaining clips). ──
  let stubRemoved = false;
  const stubRows = await db
    .select({ id: contributor.id })
    .from(contributor)
    .where(eq(contributor.handle, STUB_HANDLE))
    .limit(1);
  const stubId = stubRows[0]?.id;
  if (stubId !== undefined) {
    const remaining = await db
      .select({ id: clip.id })
      .from(clip)
      .where(eq(clip.curatorId, stubId))
      .limit(1);
    if (!remaining[0]) {
      const removed = await db
        .delete(contributor)
        .where(eq(contributor.id, stubId))
        .returning({ id: contributor.id });
      stubRemoved = removed.length > 0;
    }
  }

  return { clipsDeleted, stubRemoved };
}

/**
 * Standalone runner: open a short-lived connection to the live Postgres and purge once
 * (mirrors scripts/seed.ts `seed(url?)`). DATABASE_URL is the live prod connection — required.
 */
export async function purge(url?: string): Promise<PurgeResult> {
  const dbUrl = url ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL is required to purge demo content (postgres://user:pass@host:5432/db)."
    );
  }
  const client = postgres(dbUrl, { max: 1 });
  try {
    const db = drizzle(client) as unknown as Db;
    const result = await purgeDemoContent(db);
    console.log(
      `[wiki+ purge] deleted ${result.clipsDeleted} seeded demo clip(s); ` +
        `${STUB_HANDLE} stub ${result.stubRemoved ? "removed (orphaned)" : "left intact / absent"}.`
    );
    if (result.clipsDeleted === 0 && !result.stubRemoved) {
      console.log("[wiki+ purge] nothing to purge — already clean (idempotent no-op).");
    }
    return result;
  } finally {
    await client.end();
  }
}

// Run only when invoked as the entrypoint (`yarn tsx scripts/purge-demo-content.ts`). Importing
// the functions in a test must NOT trigger a live connection — guarded behind VITEST being unset.
if (!process.env.VITEST) {
  purge().catch((err) => {
    console.error("[wiki+ purge] FAILED:", err);
    process.exit(1);
  });
}
