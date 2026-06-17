// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzleDataStore,
  _resetStubContributorCache,
} from "@/lib/db/drizzle-store";
import { seedDatabase } from "@/lib/db/seed";
import { seedClips } from "@/lib/data/seed";
import type { Clip } from "@/lib/data/types";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// DrizzleDataStore contract tests against in-memory Postgres (pglite) — issue #45.
// Carries forward the localStorage store's DataStore contract (the same behaviors data.test.ts
// asserts) PLUS the new shared dismissals + multi-user behavior, with NO live DB (AC3/AC16).
// Each test gets a FRESH migrated DB so the committed migrations are exercised every run (AC1).

let h: TestDb;
let store: DrizzleDataStore;

function clip0(): Omit<Clip, "id" | "createdAt"> {
  return seedClips[0] as Omit<Clip, "id" | "createdAt">;
}

beforeEach(async () => {
  _resetStubContributorCache();
  h = await makeTestDb();
  store = new DrizzleDataStore(h.db);
});
afterEach(async () => {
  await h.close();
});

describe("migrations + schema (AC1)", () => {
  it("applies the committed migrations to a fresh DB and the tables are usable", async () => {
    // If migrate() failed, makeTestDb would have thrown; prove the tables exist + are empty.
    expect(await store.listTopics()).toEqual([]);
  });
});

describe("topics (DataStore contract — round-trip + title lookup)", () => {
  it("round-trips topics by QID; upsert updates, not duplicates (unique wikidata_qid, AC1)", async () => {
    await store.upsertTopic({ qid: "Q1", title: "One" });
    await store.upsertTopic({ qid: "Q1", title: "One (updated)" });
    const all = await store.listTopics();
    expect(all).toHaveLength(1);
    expect((await store.getTopic("Q1"))?.title).toBe("One (updated)");
  });

  it("resolves a title → topic, normalizing _/space/case (AC5/AC23 parity)", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    expect((await store.getTopicByTitle("Photosynthesis"))?.qid).toBe("Q11982");
    expect((await store.getTopicByTitle("photosynthesis"))?.qid).toBe("Q11982");
    await store.upsertTopic({ qid: "Q189603", title: "Cellular respiration" });
    expect((await store.getTopicByTitle("Cellular_respiration"))?.qid).toBe(
      "Q189603"
    );
    expect(await store.getTopicByTitle("Quagga")).toBeNull();
  });
});

describe("clips (DataStore contract — scoped list, add, update, delete)", () => {
  beforeEach(async () => {
    await store.upsertTopic({ qid: clip0().topicQid, title: "Photosynthesis" });
  });

  it("lists only the clips for the requested topic, newest first", async () => {
    const a = await store.addClip({ ...clip0(), caption: "first" });
    const b = await store.addClip({ ...clip0(), caption: "second" });
    const got = await store.listClips(clip0().topicQid);
    expect(got).toHaveLength(2);
    // newest first (createdAt desc) — b was inserted after a
    expect(got[0].id).toBe(b.id);
    expect(got[1].id).toBe(a.id);
    expect(await store.listClips("Q-other")).toHaveLength(0);
  });

  it("a topic with zero clips returns [] (the empty-state trigger)", async () => {
    expect(await store.listClips("Q-empty")).toEqual([]);
  });

  it("preserves every Clip field through add → list (AC2 — no data loss)", async () => {
    const added = await store.addClip(clip0());
    const got = (await store.listClips(clip0().topicQid))[0];
    expect(got.contextNote).toBe(clip0().contextNote);
    expect(got.stance).toBe(clip0().stance);
    expect(got.accuracyFlag).toBe(clip0().accuracyFlag);
    expect(got.accuracyModifier).toBe(clip0().accuracyModifier);
    expect(got.creator.handle).toBe(clip0().creator.handle);
    expect(got.embedUrl).toBe(clip0().embedUrl);
    expect(got.general).toBe(clip0().general);
    expect(got.id).toBe(added.id);
    expect(typeof got.createdAt).toBe("string"); // ISO string, like the localStorage store
  });

  it("updateClip patches only named fields; deleteClip removes the row", async () => {
    const added = await store.addClip(clip0());
    const patched = await store.updateClip(added.id, { caption: "edited" });
    expect(patched.caption).toBe("edited");
    expect(patched.contextNote).toBe(clip0().contextNote); // untouched
    await store.deleteClip(added.id);
    expect(await store.listClips(clip0().topicQid)).toHaveLength(0);
  });
});

describe("sticky dismissals — shared + durable (AC5)", () => {
  beforeEach(async () => {
    await store.upsertTopic({ qid: "Q189603", title: "Cellular respiration" });
  });

  it("records a dismissal that surfaces in dismissedKeys for its topic only", async () => {
    await store.recordDismissal({
      topicQid: "Q189603",
      platform: "youtube",
      videoId: "v1",
    });
    expect(await store.dismissedKeys("Q189603")).toContain("youtube:v1");
    // not leaked to a different topic
    await store.upsertTopic({ qid: "Q1", title: "Other" });
    expect(await store.dismissedKeys("Q1")).toEqual([]);
  });

  it("is idempotent on the (topic, provider, video) identity — re-dismiss is a no-op (AC5)", async () => {
    await store.recordDismissal({
      topicQid: "Q189603",
      platform: "youtube",
      videoId: "v1",
    });
    // Same identity again must NOT throw on the unique constraint, and must not duplicate.
    await store.recordDismissal({
      topicQid: "Q189603",
      platform: "youtube",
      videoId: "v1",
    });
    expect(await store.dismissedKeys("Q189603")).toEqual(["youtube:v1"]);
  });

  it("a dismissal persists across store instances on the same DB (shared, AC5/AC11)", async () => {
    await store.recordDismissal({
      topicQid: "Q189603",
      platform: "youtube",
      videoId: "v1",
    });
    // A SECOND store over the SAME DB = a second browser/session on the shared Postgres.
    const other = new DrizzleDataStore(h.db);
    expect(await other.dismissedKeys("Q189603")).toContain("youtube:v1");
  });
});

describe("multi-user sharing (AC11) + interim stub attribution (AC13)", () => {
  it("a clip added via one store is visible via another over the same DB", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "shared" });
    const other = new DrizzleDataStore(h.db);
    const got = await other.listClips("Q11982");
    expect(got.map((c) => c.caption)).toContain("shared");
  });

  it("the live YouTube suggest path is a server no-op (AC8 — server never calls YouTube)", async () => {
    const out = await store.suggestCandidates({
      topicQid: "Q1",
      topicTitle: "X",
      sections: [],
      curatedVideoKeys: new Set(),
      dismissedVideoKeys: new Set(),
    });
    expect(out).toBeNull(); // no source enabled server-side → caller falls back
  });

  it("listCandidates is [] server-side (candidates are computed/cached, not DB rows)", async () => {
    expect(await store.listCandidates("Q1")).toEqual([]);
  });
});

describe("seedDatabase (AC10 — non-empty for everyone, idempotent)", () => {
  it("seeds the three demo topics + the curated Photosynthesis clips", async () => {
    const inserted = await seedDatabase(h.db);
    expect(inserted).toBe(true);
    const topics = await store.listTopics();
    expect(topics.map((t) => t.qid).sort()).toEqual(["Q11982", "Q146", "Q189603"]);
    const photo = await store.listClips("Q11982");
    expect(photo.length).toBe(seedClips.length); // all curated clips seeded
    expect(photo.some((c) => c.general)).toBe(true);
    expect(photo.some((c) => !c.general && c.sectionSlug)).toBe(true);
    // Cellular respiration + Cat seed EMPTY (the empty-state topics).
    expect(await store.listClips("Q189603")).toHaveLength(0);
  });

  it("is idempotent — a second seed is a no-op, not a duplicate (re-runs safely on deploy)", async () => {
    expect(await seedDatabase(h.db)).toBe(true);
    expect(await seedDatabase(h.db)).toBe(false);
    expect(await store.listClips("Q11982")).toHaveLength(seedClips.length);
  });

  it("attributes seeded clips to the stub contributor (interim, AC13)", async () => {
    await seedDatabase(h.db);
    // The stub contributor exists and the clips carry curatedBy strings (display) from seed.
    const photo = await store.listClips("Q11982");
    expect(photo[0].curatedBy).toBeTruthy();
  });
});
