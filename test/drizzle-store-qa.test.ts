// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

// The three write actions are auth-gated (they call `auth()` BEFORE validation — gate-first is
// the security order). These tests exercise the input-validation rejection paths, so they must be
// past the gate: mock `auth()` to a signed-in session. The gate itself (reject-when-anonymous) is
// covered by test/auth-boundary.
vi.mock("@/lib/auth/config", () => ({
  auth: async () => ({ user: { contributorId: 1, username: "QaCurator" } }),
}));

// The write actions run a per-identity rate-limit check (gate → LIMIT → validation → write) that
// touches the DB via `getDb()` BEFORE the input validation. So the boundary's DB must resolve to
// the per-test pglite handle here. Mock `getDb` to the current handle, assigned per test.
let currentDb: import("@/lib/db/client").Db | undefined;
vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDb: () => currentDb ?? actual.getDb() };
});

import {
  DrizzleDataStore,
  getStubContributorId,
  _resetStubContributorCache,
} from "@/lib/db/drizzle-store";
import { seedDatabase } from "@/lib/db/seed";
import { seedClips } from "@/lib/data/seed";
import { clip, contributor, topic } from "@/lib/db/schema";
import { deriveStats } from "@/lib/data";
import type { Clip } from "@/lib/data/types";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// Independent (non-author) coverage that COMPLEMENTS test/drizzle-store.test.ts — it does not
// duplicate it. Focus areas:
//   - AC11: shared persistence proven THROUGH the same DB by two store instances, for the
//           TOPICS LIST + the infobox counts (deriveStats), not just one clip.
//   - AC13: interim attribution is wired to the curator_id FK (points at @prototype), not
//           only the decorative `curatedBy` display string.
//   - Security posture: the destructive `updateClip` / `deleteClip` live on `DrizzleDataStore`
//     as raw, unguarded methods (D's foundation), while the boundary exports them as auth-gated,
//     owner-only Server Actions — the gate is the protection (see the SECURITY block below).
//   - addClip against an unknown topic is rejected (the topic-resolution guard).
//   - Free-text inputs are length-capped at the boundary; the store itself stays unbounded by
//     design.
//
// pglite is a real Postgres (WASM): the committed migrations + real unique/FK/ON CONFLICT
// semantics are exercised with no live DB (AC16). A second `new DrizzleDataStore(h.db)` over
// the SAME handle models a second browser/session on the one shared Postgres.

let h: TestDb;
let store: DrizzleDataStore;

function clip0(): Omit<Clip, "id" | "createdAt"> {
  return seedClips[0] as Omit<Clip, "id" | "createdAt">;
}

beforeEach(async () => {
  _resetStubContributorCache();
  h = await makeTestDb();
  store = new DrizzleDataStore(h.db);
  currentDb = h.db; // the rate-limit check (D5a) reads getDb() — point it at this handle.
});
afterEach(async () => {
  await h.close();
  currentDb = undefined;
});

describe("AC11 — shared persistence across store instances (one DB = two sessions)", () => {
  it("a topic upserted in one session appears in another session's listTopics", async () => {
    await store.upsertTopic({ qid: "Q42", title: "Towel" });
    const sessionB = new DrizzleDataStore(h.db);
    const qids = (await sessionB.listTopics()).map((t) => t.qid);
    expect(qids).toContain("Q42");
  });

  // ── #125 recency ordering (homepage-recently-curated.md §4) — listTopics() returns
  //    most-recently-updated first, with a stable `title` tie-breaker. The author's diff changed
  //    `.orderBy(topic.title)` → `.orderBy(desc(topic.updatedAt), topic.title)`; nothing in the
  //    existing suite asserted the ORDER (only set membership / round-trip). This closes that gap.
  it("listTopics orders most-recently-updated first (recency ordering, #125 §4)", async () => {
    // Insert directly with explicit, distinct updated_at values so the order is deterministic and
    // independent of insertion order — middle/oldest/newest deliberately out of recency order.
    await h.db.insert(topic).values([
      { wikidataQid: "Q-mid", title: "Beta", updatedAt: new Date("2026-02-01T00:00:00Z") },
      { wikidataQid: "Q-old", title: "Alpha", updatedAt: new Date("2026-01-01T00:00:00Z") },
      { wikidataQid: "Q-new", title: "Gamma", updatedAt: new Date("2026-03-01T00:00:00Z") },
    ]);
    const order = (await store.listTopics()).map((t) => t.qid);
    // Newest updated_at first, oldest last — NOT alphabetical-by-title (which would be Alpha/Beta/Gamma).
    expect(order).toEqual(["Q-new", "Q-mid", "Q-old"]);
  });

  it("ties on updated_at break by title ascending (stable order across loads, #125 §4)", async () => {
    // Equal timestamps (a single seed batch) must fall back to a deterministic title sort so the
    // grid never reshuffles between renders.
    const sameTs = new Date("2026-04-01T00:00:00Z");
    await h.db.insert(topic).values([
      { wikidataQid: "Q-c", title: "Cherry", updatedAt: sameTs },
      { wikidataQid: "Q-a", title: "Apple", updatedAt: sameTs },
      { wikidataQid: "Q-b", title: "Banana", updatedAt: sameTs },
    ]);
    const titles = (await store.listTopics()).map((t) => t.title);
    expect(titles).toEqual(["Apple", "Banana", "Cherry"]);
  });

  it("infobox counts (deriveStats) reflect the SHARED clip set, not a per-session view", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    // Session A adds two clips from two distinct creators.
    await store.addClip({
      ...clip0(),
      topicQid: "Q11982",
      caption: "a",
      creator: { ...clip0().creator, handle: "@one", name: "One" },
      curatedBy: "@alice",
    });
    await store.addClip({
      ...clip0(),
      topicQid: "Q11982",
      caption: "b",
      creator: { ...clip0().creator, handle: "@two", name: "Two" },
      curatedBy: "@bob",
    });
    // Session B reads the shared set and derives the same infobox numerals (AC11).
    const sessionB = new DrizzleDataStore(h.db);
    const shared = await sessionB.listClips("Q11982");
    const stats = deriveStats(shared);
    expect(stats.videos).toBe(2);
    expect(stats.creators).toBe(2);
    expect(stats.curators).toBe(2);
  });
});

// ── #126 listCuratedTopics — the homepage "Recently curated" read (DB path). ──
// One grouped aggregate delivers per-topic counts AND filters zero-curation topics, with the
// counts mirroring `listClips` + `deriveStats` exactly (CARD PARITY) — non-removed clips, held
// clips still counted; recency-ordered on the surviving set.
describe("#126 — listCuratedTopics (filter + count parity + recency order)", () => {
  it("returns ONLY topics with videos ≥ 1, with deriveStats-parity counts", async () => {
    await store.upsertTopic({ qid: "Q-curated", title: "Curated", description: "d" });
    await store.upsertTopic({ qid: "Q-bare", title: "Bare" }); // zero clips → hidden (§4.1)
    await store.addClip({
      ...clip0(),
      topicQid: "Q-curated",
      caption: "a",
      creator: { ...clip0().creator, handle: "@one", name: "One" },
      curatedBy: "@alice",
    });
    await store.addClip({
      ...clip0(),
      topicQid: "Q-curated",
      caption: "b",
      creator: { ...clip0().creator, handle: "@two", name: "Two" },
      curatedBy: "@bob",
    });

    const curated = await store.listCuratedTopics();
    // The zero-curation topic never appears (§4.1).
    expect(curated.map((t) => t.qid)).toEqual(["Q-curated"]);
    // The card counts equal deriveStats over the SAME set listClips returns (CARD PARITY).
    const overview = deriveStats(await store.listClips("Q-curated"));
    expect(curated[0].stats).toEqual({
      videos: overview.videos,
      creators: overview.creators,
      curators: overview.curators,
    });
    expect(curated[0].stats).toEqual({ videos: 2, creators: 2, curators: 2 });
    // The article-side fields ride along for the card.
    expect(curated[0].title).toBe("Curated");
    expect(curated[0].description).toBe("d");
  });

  it("counts a HELD clip but EXCLUDES a removed clip — exactly the listClips set", async () => {
    await store.upsertTopic({ qid: "Q-mix", title: "Mix" });
    const held = await store.addClip({
      ...clip0(),
      topicQid: "Q-mix",
      caption: "held",
      creator: { ...clip0().creator, handle: "@c", name: "C" },
      curatedBy: "@alice",
    });
    const removed = await store.addClip({
      ...clip0(),
      topicQid: "Q-mix",
      caption: "removed",
      creator: { ...clip0().creator, handle: "@d", name: "D" },
      curatedBy: "@bob",
    });
    await store.setClipVetted(held.id, false); // held — still counts
    await store.removeClip(removed.id, 1, null); // removed — excluded

    const curated = await store.listCuratedTopics();
    const overview = deriveStats(await store.listClips("Q-mix"));
    expect(curated[0].stats.videos).toBe(1); // only the held clip remains
    expect(curated[0].stats).toEqual({
      videos: overview.videos,
      creators: overview.creators,
      curators: overview.curators,
    });
  });

  it("orders the surviving curated topics most-recently-updated first (recency, #125 §4)", async () => {
    // Two curated topics with distinct updated_at; expect newest first.
    await h.db.insert(topic).values([
      { wikidataQid: "Q-old", title: "Alpha", updatedAt: new Date("2026-01-01T00:00:00Z") },
      { wikidataQid: "Q-new", title: "Beta", updatedAt: new Date("2026-03-01T00:00:00Z") },
    ]);
    for (const qid of ["Q-old", "Q-new"]) {
      await store.addClip({ ...clip0(), topicQid: qid, caption: qid, curatedBy: "@alice" });
    }
    const order = (await store.listCuratedTopics()).map((t) => t.qid);
    expect(order).toEqual(["Q-new", "Q-old"]);
  });
});

describe("AC13 — interim attribution is wired to the curator_id FK (not just the display string)", () => {
  it("addClip stamps curator_id pointing at the single @prototype contributor", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const added = await store.addClip({ ...clip0(), topicQid: "Q11982" });

    const stubId = await getStubContributorId(h.db);
    expect(stubId).not.toBeNull();

    const row = await h.db
      .select({ curatorId: clip.curatorId })
      .from(clip)
      .where(eq(clip.id, Number(added.id)))
      .limit(1);
    expect(row[0]?.curatorId).toBe(stubId);

    const stub = await h.db
      .select({ handle: contributor.handle })
      .from(contributor)
      .where(eq(contributor.id, stubId as number))
      .limit(1);
    expect(stub[0]?.handle).toBe("@prototype");
  });

  it("two adds attribute to the SAME stub contributor (one interim identity, not many)", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "x" });
    await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "y" });
    const rows = await h.db.select({ curatorId: clip.curatorId }).from(clip);
    const distinct = new Set(rows.map((r) => r.curatorId));
    expect(distinct.size).toBe(1);
    // And exactly one contributor row exists (the stub) — no per-write contributor sprawl.
    expect(await h.db.select().from(contributor)).toHaveLength(1);
  });
});

describe("addClip topic-resolution guard", () => {
  it("rejects an addClip against a topic that does not exist (must upsert the topic first)", async () => {
    await expect(
      store.addClip({ ...clip0(), topicQid: "Q-does-not-exist" })
    ).rejects.toThrow(/no topic for QID/);
  });
});

// ── SECURITY POSTURE ──────────────────────────────────────────────────────────────────
// The split between the store and the boundary is the security boundary. The destructive
// `updateClip` / `deleteClip` are exported at the boundary as AUTH-GATED, OWNER-ONLY Server
// Actions: the gate (requireContributor() then the id-based ownership check) is the protection —
// verified in test/clip-edit-delete.test.ts, the load-bearing security tests. The store itself
// carries the raw, unguarded methods (D's foundation); the gate lives at the boundary, not the
// store. These tests pin both facts.
describe("SECURITY — boundary surface + store capability (gated edit/delete)", () => {
  it("the Server-Actions boundary EXPORTS owner-only updateClip/deleteClip (the gate, not the absence, is the protection)", async () => {
    const actions = await import("@/lib/server/actions");
    // They are auth-gated, owner-only actions (the ownership gate is the security
    // control — see test/clip-edit-delete.test.ts for the non-owner/anonymous rejection tests).
    expect("updateClipAction" in actions).toBe(true);
    expect("deleteClipAction" in actions).toBe(true);
    expect(typeof actions.updateClipAction).toBe("function");
    expect(typeof actions.deleteClipAction).toBe("function");
  });

  it("deleteClip stays on the STORE (no ownership/auth check at the store level)", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const victim = await store.addClip({
      ...clip0(),
      topicQid: "Q11982",
      caption: "not yours",
      curatedBy: "@victim",
    });
    // The store method is unguarded (D's foundation): a direct store call deletes the row. The
    // protection is that this is NOT reachable anonymously — the boundary action is auth-gated.
    const sessionB = new DrizzleDataStore(h.db);
    await sessionB.deleteClip(victim.id);
    expect(await store.listClips("Q11982")).toHaveLength(0);
  });

  it("updateClip stays on the STORE (no ownership/auth check at the store level)", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const victim = await store.addClip({
      ...clip0(),
      topicQid: "Q11982",
      contextNote: "the original, honest note",
      curatedBy: "@victim",
    });
    const sessionB = new DrizzleDataStore(h.db);
    const edited = await sessionB.updateClip(victim.id, {
      contextNote: "edited via the store",
    });
    expect(edited.contextNote).toBe("edited via the store");
  });

  it("upsertTopic lets any caller overwrite an existing topic's display title (FINDING: mass-mutation)", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const attacker = new DrizzleDataStore(h.db);
    await attacker.upsertTopic({ qid: "Q11982", title: "Vandalized" });
    expect((await store.getTopic("Q11982"))?.title).toBe("Vandalized");
  });

  it("the STORE itself has no length cap — an oversized context note is accepted at the store level", async () => {
    // The boundary caps free text (see the boundary length-cap test below); the store stays
    // unbounded by design. This pins the store-level behavior.
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const huge = "x".repeat(200_000); // 200KB note; the store does not reject it
    const added = await store.addClip({
      ...clip0(),
      topicQid: "Q11982",
      contextNote: huge,
    });
    const got = (await store.listClips("Q11982")).find((c) => c.id === added.id);
    expect(got?.contextNote.length).toBe(200_000);
  });
});

// ── BOUNDARY INPUT VALIDATION ─────────────────────────────────────────────────────────
// A cheap server-side defense on the write actions: a free-text length cap + a closed-set guard
// on the curation enums. These rejection paths throw at the boundary, before the store performs
// the write.
describe("boundary input validation — addClipAction / upsertTopicAction reject out-of-bounds input", () => {
  function validClip(): Omit<Clip, "id" | "createdAt"> {
    return clip0();
  }

  it("rejects an oversized context note at the boundary (length cap before the DB)", async () => {
    const { addClipAction } = await import("@/lib/server/actions");
    await expect(
      addClipAction({ ...validClip(), contextNote: "x".repeat(50_000) })
    ).rejects.toThrow(/contextNote exceeds/);
  });

  it("rejects an oversized caption at the boundary", async () => {
    const { addClipAction } = await import("@/lib/server/actions");
    await expect(
      addClipAction({ ...validClip(), caption: "y".repeat(50_000) })
    ).rejects.toThrow(/caption exceeds/);
  });

  it("rejects an out-of-vocabulary stance (closed-set guard)", async () => {
    const { addClipAction } = await import("@/lib/server/actions");
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addClipAction({ ...validClip(), stance: "not-a-stance" as any })
    ).rejects.toThrow(/Unknown stance/);
  });

  it("rejects an out-of-vocabulary accuracy flag (closed-set guard)", async () => {
    const { addClipAction } = await import("@/lib/server/actions");
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addClipAction({ ...validClip(), accuracyFlag: "wildly-wrong" as any })
    ).rejects.toThrow(/Unknown accuracy flag/);
  });

  it("rejects an out-of-vocabulary platform (closed-set guard)", async () => {
    const { addClipAction } = await import("@/lib/server/actions");
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addClipAction({ ...validClip(), platform: "myspace" as any })
    ).rejects.toThrow(/Unknown platform/);
  });

  it("rejects an oversized topic title at the upsertTopic boundary", async () => {
    const { upsertTopicAction } = await import("@/lib/server/actions");
    await expect(
      upsertTopicAction({ qid: "Q1", title: "z".repeat(50_000) })
    ).rejects.toThrow(/title exceeds/);
  });
});
