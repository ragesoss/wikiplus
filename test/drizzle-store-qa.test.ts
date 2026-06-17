// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  DrizzleDataStore,
  getStubContributorId,
  _resetStubContributorCache,
} from "@/lib/db/drizzle-store";
import { seedDatabase } from "@/lib/db/seed";
import { seedClips } from "@/lib/data/seed";
import { clip, contributor } from "@/lib/db/schema";
import { deriveStats } from "@/lib/data";
import type { Clip } from "@/lib/data/types";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// QA & Review additions for issue #45 (independent, non-author). These COMPLEMENT
// test/drizzle-store.test.ts — they do not duplicate it. Focus areas the AC map and the
// security review surfaced that needed first-class coverage:
//   - AC11: shared persistence proven THROUGH the same DB by two store instances, for the
//           TOPICS LIST + the infobox counts (deriveStats), not just one clip.
//   - AC13: interim attribution is wired to the curator_id FK (points at @prototype), not
//           only the decorative `curatedBy` display string.
//   - The Server-Actions write boundary is UNAUTHENTICATED in B (no auth until C): these
//     tests CHARACTERIZE the over-broad capability (anonymous update/delete of ANY clip,
//     arbitrary upsertTopic) so the finding is codified and the test flips when C/D gate it.
//   - addClip against an unknown topic is rejected (the topic-resolution guard).
//   - No length cap on text inputs today (storage-abuse surface on an open endpoint).
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
});
afterEach(async () => {
  await h.close();
});

describe("AC11 — shared persistence across store instances (one DB = two sessions)", () => {
  it("a topic upserted in one session appears in another session's listTopics", async () => {
    await store.upsertTopic({ qid: "Q42", title: "Towel" });
    const sessionB = new DrizzleDataStore(h.db);
    const qids = (await sessionB.listTopics()).map((t) => t.qid);
    expect(qids).toContain("Q42");
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

// ── SECURITY CHARACTERIZATION ─────────────────────────────────────────────────────────
// In epic-B there is NO AUTH (that is issue C). Every Server Action is callable by any
// anonymous visitor. These tests pin the CURRENT (unauthenticated, no-ownership) behavior
// of the destructive/over-broad capabilities so (a) the finding is codified for the report
// and (b) when C/D add auth-gating + ownership checks, these tests must be UPDATED — a
// deliberate trip-wire, not a green-forever assertion.
describe("SECURITY (B has no auth) — destructive/over-broad capabilities are ungated", () => {
  it("deleteClip removes ANY clip with no ownership/auth check (FINDING: over-broad action)", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    // "Someone else's" clip.
    const victim = await store.addClip({
      ...clip0(),
      topicQid: "Q11982",
      caption: "not yours",
      curatedBy: "@victim",
    });
    // A second, anonymous session deletes it — no identity, no check.
    const attacker = new DrizzleDataStore(h.db);
    await attacker.deleteClip(victim.id);
    expect(await store.listClips("Q11982")).toHaveLength(0);
  });

  it("updateClip edits ANY clip's content with no ownership/auth check (FINDING: over-broad action)", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const victim = await store.addClip({
      ...clip0(),
      topicQid: "Q11982",
      contextNote: "the original, honest note",
      curatedBy: "@victim",
    });
    const attacker = new DrizzleDataStore(h.db);
    const tampered = await attacker.updateClip(victim.id, {
      contextNote: "defaced by anyone",
    });
    expect(tampered.contextNote).toBe("defaced by anyone");
  });

  it("upsertTopic lets any caller overwrite an existing topic's display title (FINDING: mass-mutation)", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const attacker = new DrizzleDataStore(h.db);
    await attacker.upsertTopic({ qid: "Q11982", title: "Vandalized" });
    expect((await store.getTopic("Q11982"))?.title).toBe("Vandalized");
  });

  it("text inputs have NO length cap — an oversized context note is accepted (FINDING: unbounded write on an open endpoint)", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const huge = "x".repeat(200_000); // 200KB note; no validation rejects it in B
    const added = await store.addClip({
      ...clip0(),
      topicQid: "Q11982",
      contextNote: huge,
    });
    const got = (await store.listClips("Q11982")).find((c) => c.id === added.id);
    expect(got?.contextNote.length).toBe(200_000);
  });
});
