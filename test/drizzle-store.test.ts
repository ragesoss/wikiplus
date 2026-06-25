// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzleDataStore,
  _resetStubContributorCache,
} from "@/lib/db/drizzle-store";
import { seedDatabase } from "@/lib/db/seed";
import { seedClips } from "@/lib/data/seed";
import { encodeRecentCursor } from "@/lib/data/recent-cursor";
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

describe("recent-curations feed — listRecentCurations (issue #160)", () => {
  beforeEach(async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    await store.upsertTopic({ qid: "Q146", title: "Cat" });
  });

  // Add N clips across two topics so the feed is genuinely cross-topic. Returns the clips in
  // insertion order (oldest→newest). createdAt may tie within a fast test; the (createdAt, id)
  // keyset + the id-desc tiebreak still gives a total, stable order.
  async function addN(n: number) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(
        await store.addClip({
          ...clip0(),
          topicQid: i % 2 === 0 ? "Q11982" : "Q146",
          caption: `clip ${i}`,
        })
      );
    }
    return out;
  }

  it("returns curated clips across ALL topics, newest first, with topicTitle for the link", async () => {
    const added = await addN(3);
    const page = await store.listRecentCurations({});
    expect(page.items).toHaveLength(3);
    // Newest first — the last inserted is first.
    expect(page.items[0].id).toBe(added[2].id);
    expect(page.items[2].id).toBe(added[0].id);
    // Cross-topic + the parent title rides along for the jump-to-topic link.
    const titles = new Set(page.items.map((c) => c.topicTitle));
    expect(titles).toEqual(new Set(["Photosynthesis", "Cat"]));
    // A small set is exhausted in one page → no further cursor (the end marker).
    expect(page.nextCursor).toBeNull();
  });

  it("EXCLUDES held clips (vetted=false) and removed clips (the public vouched shopfront)", async () => {
    const [a, b, c] = await addN(3);
    await store.setClipVetted(b.id, false); // held → excluded
    await store.removeClip(c.id, 1, null); // removed → excluded
    const page = await store.listRecentCurations({});
    expect(page.items.map((x) => x.id)).toEqual([a.id]);
  });

  it("pages by a STABLE cursor with NO dupes and NO gaps", async () => {
    const added = await addN(5);
    const expectedNewestFirst = [...added].reverse().map((c) => c.id);

    const p1 = await store.listRecentCurations({ limit: 2 });
    expect(p1.items.map((c) => c.id)).toEqual(expectedNewestFirst.slice(0, 2));
    expect(p1.nextCursor).not.toBeNull();

    const p2 = await store.listRecentCurations({ cursor: p1.nextCursor, limit: 2 });
    expect(p2.items.map((c) => c.id)).toEqual(expectedNewestFirst.slice(2, 4));

    const p3 = await store.listRecentCurations({ cursor: p2.nextCursor, limit: 2 });
    expect(p3.items.map((c) => c.id)).toEqual(expectedNewestFirst.slice(4));
    // The last short page exhausts the feed → nextCursor null (the end marker).
    expect(p3.nextCursor).toBeNull();

    // Concatenated pages reproduce the full ordered set exactly — no dupes, no gaps.
    const all = [...p1.items, ...p2.items, ...p3.items].map((c) => c.id);
    expect(all).toEqual(expectedNewestFirst);
    expect(new Set(all).size).toBe(all.length);
  });

  it("a clip curated AFTER a page boundary does not dupe/shift already-returned items", async () => {
    const added = await addN(3);
    const p1 = await store.listRecentCurations({ limit: 2 });
    // A new curation lands at the HEAD between page loads — the offset-drift hazard.
    await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "newest" });
    // Paging past the cursor returns only items strictly OLDER than the boundary — the new head
    // clip is never re-served on page 2, and the oldest original clip is not skipped.
    const p2 = await store.listRecentCurations({ cursor: p1.nextCursor });
    expect(p2.items.map((c) => c.id)).toEqual([added[0].id]);
  });

  it("an empty / exhausted feed returns [] with a null cursor", async () => {
    const page = await store.listRecentCurations({});
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it("ignores a malformed cursor (degrades to the head, never throws)", async () => {
    const added = await addN(2);
    const page = await store.listRecentCurations({ cursor: "not-a-real-cursor" });
    expect(page.items.map((c) => c.id)).toEqual([added[1].id, added[0].id]);
  });

  // ── Adversarial cursor robustness (QA security review, issue #160). A WELL-FORMED cursor whose
  //    contents are forged must reach the SQL keyset without throwing, without injecting, and
  //    without leaking rows the visibility predicate excludes. These probe the production code path:
  //    `decodeRecentCursor` ACCEPTS a string `i` and ANY string `t` (it validates the *types*, not
  //    that `t` is a valid date or `i` a numeric string), and the DrizzleDataStore then coerces
  //    `new Date(cursor.t)` / `Number(cursor.i)` — so a hostile value reaches the bound query param.
  //
  //    DEFECT (issue #160, routed to Development): the documented contract is "a forged/stale cursor
  //    never throws and degrades to the head of the feed" (recent-cursor.ts + the seam doc), but two
  //    well-formed-but-forged cursors THROW out of `listRecentCurations` instead of degrading:
  //      (1) a non-date `t` → `new Date("garbage")` = Invalid Date → the pglite/drizzle param
  //          serializer throws `RangeError: Invalid time value` BEFORE the DB; and
  //      (2) a non-numeric string `i` → `Number(...)` = NaN → Postgres rejects with
  //          `invalid input syntax for type integer: "NaN"`.
  //    It fails CLOSED (no data leak, no SQL injection — the value is correctly parameterized; the
  //    feed surfaces an error state, never the server crashing), so severity is LOW–MEDIUM, but it
  //    violates the stated "never throw / degrade to head" invariant in the issue's security AC.
  //    These are pinned with `it.fails` so the suite stays green AND they flip to RED (alerting QA)
  //    the moment Development hardens the decode (validate `t` is a real date + `i` a finite int, or
  //    null the cursor) — at which point they should become ordinary `it(...)` assertions.
  it.fails(
    "DEFECT: a forged string-id cursor (Number(i) = NaN) THROWS instead of degrading to the head",
    async () => {
      await addN(3);
      const forged = encodeRecentCursor({
        t: "2026-06-25T12:00:00.000Z",
        i: "c_forged_string",
      });
      // Contract: should resolve to a safe page; CURRENTLY throws (invalid integer "NaN").
      await store.listRecentCurations({ cursor: forged });
    }
  );

  it.fails(
    "DEFECT: a forged non-date `t` cursor (Invalid Date) THROWS instead of degrading to the head",
    async () => {
      await addN(3);
      const forged = encodeRecentCursor({ t: "garbage-not-a-date", i: 999999 });
      // Contract: should resolve to a safe page; CURRENTLY throws (RangeError: Invalid time value).
      await store.listRecentCurations({ cursor: forged });
    }
  );

  it("a SQL-injection-shaped cursor value is bound as data, never executed (no DROP TABLE)", async () => {
    const added = await addN(2);
    // The `t` is a parameterized value via drizzle's sql`` — a classic injection payload is treated
    // as DATA, never interpolated/executed. (It is also a non-date string, so per the DEFECT above
    // the coercion path currently throws; we assert here only that the table is NOT dropped — i.e.
    // there is no SQL injection — by confirming the data survives a subsequent head read.)
    const forged = encodeRecentCursor({ t: "2026'); DROP TABLE clip;--", i: 1 });
    await store.listRecentCurations({ cursor: forged }).catch(() => {});
    // The clip table still exists + is intact: a fresh head read returns the two live clips.
    const head = await store.listRecentCurations({});
    expect(head.items.map((c) => c.id).sort()).toEqual(
      [added[0].id, added[1].id].sort()
    );
  });

  it("a huge `limit` is honored as a page size, not an error (no resource blowup on the small set)", async () => {
    const added = await addN(3);
    const page = await store.listRecentCurations({ limit: 1_000_000 });
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
    expect(page.items.map((c) => c.id)).toEqual(
      [...added].reverse().map((c) => c.id)
    );
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
