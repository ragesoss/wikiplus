// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { maybeSeed, seedDemoContentEnabled } from "@/scripts/migrate";
import { purgeDemoContent } from "@/scripts/purge-demo-content";
import { seedDatabase } from "@/lib/db/seed";
import { PHOTOSYNTHESIS_QID, seedClips } from "@/lib/data/seed";
import { STUB_HANDLE } from "@/lib/curation/curator-attribution";
import { clipToInsert } from "@/lib/db/mappers";
import { clip, contributor, topic } from "@/lib/db/schema";
import { DrizzleDataStore } from "@/lib/db/drizzle-store";
import type { Clip } from "@/lib/data/types";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// Issue #75 — remove the seeded demo curations from production: the deploy-time seed gate
// (SEED_DEMO_CONTENT, scripts/migrate.ts) + the one-time idempotent purge
// (scripts/purge-demo-content.ts). Verified against a fresh, migrated pglite DB — the same
// in-memory-Postgres harness `seedDatabase` is tested with; NEVER against prod.

const SEEDED_PHOTO_COUNT = seedClips.filter(
  (c) => c.topicQid === PHOTOSYNTHESIS_QID
).length;

let h: TestDb;
let store: DrizzleDataStore;

beforeEach(async () => {
  h = await makeTestDb();
  store = new DrizzleDataStore(h.db);
});
afterEach(async () => {
  await h.close();
});

/** Count clip rows on the Photosynthesis topic (raw, bypassing read-path filters). */
async function photoClipRowCount(): Promise<number> {
  const t = await h.db
    .select({ id: topic.id })
    .from(topic)
    .where(eq(topic.wikidataQid, PHOTOSYNTHESIS_QID))
    .limit(1);
  if (!t[0]) return 0;
  const rows = await h.db
    .select({ id: clip.id })
    .from(clip)
    .where(eq(clip.topicId, t[0].id));
  return rows.length;
}

/** Does the `@prototype` stub contributor row exist? */
async function stubExists(): Promise<boolean> {
  const rows = await h.db
    .select({ id: contributor.id })
    .from(contributor)
    .where(eq(contributor.handle, STUB_HANDLE))
    .limit(1);
  return Boolean(rows[0]);
}

describe("gate truthiness convention — seedDemoContentEnabled (default ON)", () => {
  it("seeds when unset / empty / any non-disabling value", () => {
    expect(seedDemoContentEnabled(undefined)).toBe(true);
    expect(seedDemoContentEnabled("")).toBe(true);
    expect(seedDemoContentEnabled("true")).toBe(true);
    expect(seedDemoContentEnabled("1")).toBe(true);
    expect(seedDemoContentEnabled("on")).toBe(true);
    expect(seedDemoContentEnabled("yes")).toBe(true);
  });

  it('disables ONLY for the literal "false"/"0" (trimmed, case-insensitive)', () => {
    expect(seedDemoContentEnabled("false")).toBe(false);
    expect(seedDemoContentEnabled("FALSE")).toBe(false);
    expect(seedDemoContentEnabled(" false ")).toBe(false);
    expect(seedDemoContentEnabled("0")).toBe(false);
    expect(seedDemoContentEnabled(" 0 ")).toBe(false);
  });
});

describe("AC1 — gated deploy path (flag OFF) seeds zero demo clips", () => {
  it("inserts NO clips and NO @prototype contributor when the gate is off", async () => {
    const ran = await maybeSeed(h.db, false);
    expect(ran).toBe(false); // skipped — a clean success, not an error
    expect(await store.listTopics()).toEqual([]); // migrations applied, but nothing seeded
    expect(await photoClipRowCount()).toBe(0);
    expect(await stubExists()).toBe(false);
  });
});

describe("AC2 — re-running the gated path (flag OFF) never reintroduces them", () => {
  it("stays zero across repeated gated-off runs", async () => {
    await maybeSeed(h.db, false);
    await maybeSeed(h.db, false);
    expect(await photoClipRowCount()).toBe(0);
    expect(await stubExists()).toBe(false);
  });

  it("stays zero after a prior purge has run (no re-seed of the fakes while off)", async () => {
    // Seed first (as a default-on deploy would have), then purge, then run the gated-off path:
    // the every-deploy case must not bring the fakes back.
    await maybeSeed(h.db, true);
    await purgeDemoContent(h.db);
    await maybeSeed(h.db, false);
    expect(await photoClipRowCount()).toBe(0);
    expect(await stubExists()).toBe(false);
  });
});

describe("AC3 — the purge removes the fakes + orphaned stub, idempotently", () => {
  beforeEach(async () => {
    // Arrange a prod-like state: the seed having run (the 14/13 demo clips + the stub).
    await seedDatabase(h.db);
  });

  it("(a) deletes the seeded Photosynthesis demo clips", async () => {
    expect(await photoClipRowCount()).toBe(SEEDED_PHOTO_COUNT);
    const result = await purgeDemoContent(h.db);
    expect(result.clipsDeleted).toBe(SEEDED_PHOTO_COUNT);
    expect(await photoClipRowCount()).toBe(0);
    expect(await store.listClips(PHOTOSYNTHESIS_QID)).toHaveLength(0);
  });

  it("(a) spares a NON-seeded (real) clip on Photosynthesis", async () => {
    // A real clip on the same topic, with a watchUrl NOT in the seeded set, must survive.
    const real = await store.addClip({
      ...(seedClips[0] as Omit<Clip, "id" | "createdAt">),
      watchUrl: "https://www.youtube.com/watch?v=REAL_human_clip",
      caption: "A real, human-curated clip",
    });
    const result = await purgeDemoContent(h.db);
    expect(result.clipsDeleted).toBe(SEEDED_PHOTO_COUNT); // only the seeded set
    const survivors = await store.listClips(PHOTOSYNTHESIS_QID);
    expect(survivors.map((c) => c.id)).toEqual([real.id]);
    expect(survivors[0].watchUrl).toBe("https://www.youtube.com/watch?v=REAL_human_clip");
  });

  it("(b) removes the @prototype stub ONLY when it has no remaining clips (orphan-only)", async () => {
    expect(await stubExists()).toBe(true);
    const result = await purgeDemoContent(h.db);
    expect(result.stubRemoved).toBe(true);
    expect(await stubExists()).toBe(false);
  });

  it("(b) does NOT remove the stub if a clip still references it after the deletes", async () => {
    // A real clip on a DIFFERENT topic, attributed to the stub: the stub is not orphaned, so it
    // must survive the purge (defensive guard, not just an assumption).
    const stubRow = (
      await h.db
        .select({ id: contributor.id })
        .from(contributor)
        .where(eq(contributor.handle, STUB_HANDLE))
        .limit(1)
    )[0];
    await store.upsertTopic({ qid: "Q146", title: "Cat" });
    const catTopic = (
      await h.db
        .select({ id: topic.id })
        .from(topic)
        .where(eq(topic.wikidataQid, "Q146"))
        .limit(1)
    )[0];
    await h.db.insert(clip).values({
      ...clipToInsert(
        {
          ...(seedClips[0] as Omit<Clip, "id" | "createdAt">),
          topicQid: "Q146",
          watchUrl: "https://www.youtube.com/watch?v=stub_attributed_real",
        },
        catTopic.id,
        stubRow.id
      ),
    });

    const result = await purgeDemoContent(h.db);
    expect(result.stubRemoved).toBe(false);
    expect(await stubExists()).toBe(true); // still referenced → not orphaned → kept
  });

  it("(c) is idempotent — a second run deletes nothing further and does not error", async () => {
    const first = await purgeDemoContent(h.db);
    expect(first.clipsDeleted).toBe(SEEDED_PHOTO_COUNT);
    expect(first.stubRemoved).toBe(true);

    const second = await purgeDemoContent(h.db);
    expect(second.clipsDeleted).toBe(0);
    expect(second.stubRemoved).toBe(false);
    expect(await photoClipRowCount()).toBe(0);
    expect(await stubExists()).toBe(false);
  });

  it("(c) is a safe no-op on an already-clean DB (never seeded)", async () => {
    // Wipe to simulate a clean prod that was never seeded (the post-#75 default).
    await purgeDemoContent(h.db); // remove the seed this beforeEach created
    const onClean = await purgeDemoContent(h.db);
    expect(onClean).toEqual({ clipsDeleted: 0, stubRemoved: false });
  });

  it("(d) leaves the three seeded topic rows intact", async () => {
    await purgeDemoContent(h.db);
    const topics = await store.listTopics();
    expect(topics.map((t) => t.qid).sort()).toEqual(["Q11982", "Q146", "Q189603"]);
  });
});

describe("AC4 — default-on deploy path still seeds exactly as today", () => {
  it("calls seedDatabase and seeds the three topics + the demo clips + the stub", async () => {
    const ran = await maybeSeed(h.db, true);
    expect(ran).toBe(true);
    const topics = await store.listTopics();
    expect(topics.map((t) => t.qid).sort()).toEqual(["Q11982", "Q146", "Q189603"]);
    expect(await store.listClips(PHOTOSYNTHESIS_QID)).toHaveLength(SEEDED_PHOTO_COUNT);
    expect(await stubExists()).toBe(true);
    // Cellular respiration + Cat seed EMPTY (the empty-state topics) — unchanged.
    expect(await store.listClips("Q189603")).toHaveLength(0);
  });

  it("the default-on path is idempotent (re-run is a no-op, like the every-deploy case)", async () => {
    expect(await maybeSeed(h.db, true)).toBe(true);
    expect(await maybeSeed(h.db, true)).toBe(true); // maybeSeed returns 'did we attempt', always true when on
    // but the underlying seed no-ops, so the clip count does not double.
    expect(await store.listClips(PHOTOSYNTHESIS_QID)).toHaveLength(SEEDED_PHOTO_COUNT);
  });
});
