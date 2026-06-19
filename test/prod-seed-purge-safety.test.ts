// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { purgeDemoContent } from "@/scripts/purge-demo-content";
import { seedDatabase } from "@/lib/db/seed";
import { PHOTOSYNTHESIS_QID, seedClips } from "@/lib/data/seed";
import { STUB_HANDLE } from "@/lib/curation/curator-attribution";
import { clipToInsert } from "@/lib/db/mappers";
import { clip, contributor, topic } from "@/lib/db/schema";
import { DrizzleDataStore } from "@/lib/db/drizzle-store";
import type { Clip } from "@/lib/data/types";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// Issue #75 — INDEPENDENT QA purge-SAFETY coverage (a destructive DELETE against the curation
// tables is the security-relevant surface of this change). These cases isolate the predicate's
// two AND-arms — topic-scope AND seeded-watch_url — that the Dev suite does not separately pin,
// proving the purge can NEVER delete real human curation. Verified against pglite; NEVER prod.

const SEEDED_PHOTO_COUNT = seedClips.filter(
  (c) => c.topicQid === PHOTOSYNTHESIS_QID
).length;
const FIRST_SEEDED_WATCH_URL = seedClips.find(
  (c) => c.topicQid === PHOTOSYNTHESIS_QID
)!.watchUrl;

let h: TestDb;
let store: DrizzleDataStore;

beforeEach(async () => {
  h = await makeTestDb();
  store = new DrizzleDataStore(h.db);
  await seedDatabase(h.db); // prod-like state: the seed has run.
});
afterEach(async () => {
  await h.close();
});

async function topicId(qid: string): Promise<number> {
  const t = await h.db
    .select({ id: topic.id })
    .from(topic)
    .where(eq(topic.wikidataQid, qid))
    .limit(1);
  return t[0]!.id;
}
async function clipRowCountOnTopic(qid: string): Promise<number> {
  const id = await topicId(qid);
  const rows = await h.db
    .select({ id: clip.id })
    .from(clip)
    .where(eq(clip.topicId, id));
  return rows.length;
}
async function stubExists(): Promise<boolean> {
  const rows = await h.db
    .select({ id: contributor.id })
    .from(contributor)
    .where(eq(contributor.handle, STUB_HANDLE))
    .limit(1);
  return Boolean(rows[0]);
}
async function stubId(): Promise<number> {
  const rows = await h.db
    .select({ id: contributor.id })
    .from(contributor)
    .where(eq(contributor.handle, STUB_HANDLE))
    .limit(1);
  return rows[0]!.id;
}

describe("QA purge-safety — the topic-scope arm of the predicate (AC3a)", () => {
  it("SPARES a clip on a DIFFERENT topic that reuses a SEEDED watch_url (wrong topic survives)", async () => {
    // The spec names this exact case: a clip with a seeded watch_url on a non-Photosynthesis
    // topic must survive — the topic arm of the AND must hold, so the watch_url match alone
    // can't reach it.
    await store.upsertTopic({ qid: "Q146", title: "Cat" });
    const catId = await topicId("Q146");
    const inserted = await h.db
      .insert(clip)
      .values({
        ...clipToInsert(
          {
            ...(seedClips[0] as Omit<Clip, "id" | "createdAt">),
            topicQid: "Q146",
            watchUrl: FIRST_SEEDED_WATCH_URL, // a SEEDED url, but on the WRONG topic
            caption: "A real Cat-topic clip that happens to reuse a seeded URL",
          },
          catId,
          null
        ),
      })
      .returning({ id: clip.id });

    const before = await clipRowCountOnTopic("Q146");
    expect(before).toBe(1);

    const result = await purgeDemoContent(h.db);
    // Only the Photosynthesis seeded set is deleted; the Cat clip is untouched.
    expect(result.clipsDeleted).toBe(SEEDED_PHOTO_COUNT);
    expect(await clipRowCountOnTopic("Q146")).toBe(1);
    const survivors = await h.db
      .select({ id: clip.id })
      .from(clip)
      .where(eq(clip.id, inserted[0].id));
    expect(survivors).toHaveLength(1);
  });
});

describe("QA purge-safety — the stub is orphan-only, even with a SAME-TOPIC survivor (AC3b)", () => {
  it("KEEPS the @prototype stub when a real Photosynthesis clip (non-seeded url) still attributes to it", async () => {
    // The Dev suite's orphan-guard test puts the surviving clip on a DIFFERENT topic. Here the
    // surviving stub-attributed clip is on Photosynthesis itself (non-seeded url) — it survives
    // the clip delete, so the stub is NOT orphaned and must be kept.
    const stub = await stubId();
    const photoId = await topicId(PHOTOSYNTHESIS_QID);
    await h.db.insert(clip).values({
      ...clipToInsert(
        {
          ...(seedClips[0] as Omit<Clip, "id" | "createdAt">),
          watchUrl: "https://www.youtube.com/watch?v=REAL_on_photo_topic",
          caption: "A real human clip on Photosynthesis, attributed to the stub",
        },
        photoId,
        stub // still references the stub
      ),
    });

    const result = await purgeDemoContent(h.db);
    expect(result.clipsDeleted).toBe(SEEDED_PHOTO_COUNT); // only seeded set
    expect(result.stubRemoved).toBe(false); // still referenced → not orphaned
    expect(await stubExists()).toBe(true);
    // The real survivor remains on Photosynthesis.
    expect(await clipRowCountOnTopic(PHOTOSYNTHESIS_QID)).toBe(1);
  });
});

describe("QA purge-safety — deleting demo clips does NOT cascade to the topic (AC3d)", () => {
  it("leaves the Photosynthesis topic row present after all its seeded clips are deleted", async () => {
    await purgeDemoContent(h.db);
    const t = await h.db
      .select({ id: topic.id })
      .from(topic)
      .where(eq(topic.wikidataQid, PHOTOSYNTHESIS_QID))
      .limit(1);
    expect(t).toHaveLength(1); // topic survives; only its clips were removed
    expect(await clipRowCountOnTopic(PHOTOSYNTHESIS_QID)).toBe(0);
  });
});
