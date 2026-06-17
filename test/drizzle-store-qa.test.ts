// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

// Issue C: the three write actions are now auth-gated (they call `auth()` BEFORE validation —
// gate-first is the security order). These #45 characterization tests for the input STOPGAP
// exercise the validation rejection paths, so they must be past the gate: mock `auth()` to a
// signed-in session. The gate itself (reject-when-anonymous) is covered by test/auth-boundary.
vi.mock("@/lib/auth/config", () => ({
  auth: async () => ({ user: { contributorId: 1, username: "QaCurator" } }),
}));

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
//     tests CHARACTERIZE the over-broad capabilities the boundary DOES expose (anonymous
//     arbitrary upsertTopic) so the finding is codified and the test flips when C/D gate it.
//   - The destructive `updateClip` / `deleteClip` are NO LONGER exposed at the boundary
//     (fix round): they have no UI caller and would let an anonymous visitor edit/delete
//     ANY clip with no auth, so they were removed from lib/server/actions.ts. The methods
//     remain on `DrizzleDataStore` (for issue D + the store-level coverage below). This
//     suite now PINS both facts: the store still can update/delete (D's foundation), AND
//     the anonymous boundary does not surface them.
//   - addClip against an unknown topic is rejected (the topic-resolution guard).
//   - Free-text inputs are now length-capped at the boundary (the stopgap before D's full
//     validation); the store itself stays unbounded (D owns real validation).
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
// In epic-B there is NO AUTH (that is issue C). The Server Actions that ARE exposed are
// callable by any anonymous visitor. These tests pin the current security posture so
// (a) the findings are codified for the report and (b) when C/D add auth-gating + ownership
// checks, these tests must be UPDATED — a deliberate trip-wire, not a green-forever assert.
//
// As of the fix round: the destructive `updateClip` / `deleteClip` are NOT exposed at the
// Server-Actions boundary (no UI caller; an anonymous boundary export = edit/delete-any).
// The capability stays on the STORE (issue D needs it). So the two destructive cases below
// now pin BOTH: the store can still update/delete (D's foundation), AND the anonymous
// boundary does not surface those actions.
describe("SECURITY (B has no auth) — boundary surface + store capability", () => {
  it("the Server-Actions boundary does NOT export updateClip/deleteClip (no anonymous edit/delete-any)", async () => {
    const actions = await import("@/lib/server/actions");
    // Removed from the boundary in the fix round — an unauthenticated visitor cannot reach
    // a destructive clip mutation. (D can add gated edit/delete actions once auth lands.)
    expect("updateClipAction" in actions).toBe(false);
    expect("deleteClipAction" in actions).toBe(false);
  });

  it("deleteClip stays on the STORE for issue D (still no ownership/auth check at the store level)", async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const victim = await store.addClip({
      ...clip0(),
      topicQid: "Q11982",
      caption: "not yours",
      curatedBy: "@victim",
    });
    // The store method is intact (D's foundation): a direct store call deletes the row.
    // The protection added in B is that this is NOT reachable anonymously via the boundary.
    const sessionB = new DrizzleDataStore(h.db);
    await sessionB.deleteClip(victim.id);
    expect(await store.listClips("Q11982")).toHaveLength(0);
  });

  it("updateClip stays on the STORE for issue D (still no ownership/auth check at the store level)", async () => {
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
    // The boundary now caps free text (see the boundary-stopgap test below); the store stays
    // unbounded by design — real validation is issue D. This pins the store-level behavior.
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

// ── BOUNDARY INPUT STOPGAP (issue #45 fix round) ──────────────────────────────────────
// A cheap server-side defense on the PUBLIC, unauthenticated write actions before issue D's
// full validation/auth: free-text length cap + closed-set guard on the curation enums. The
// validation runs BEFORE the store is constructed, so these rejection paths are exercised
// with NO DB connection (no DATABASE_URL needed) — they throw at the boundary, not the store.
describe("boundary input stopgap — addClipAction / upsertTopicAction reject out-of-bounds input", () => {
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
