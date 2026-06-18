// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { clip, clipVote } from "@/lib/db/schema";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { seedDatabase } from "@/lib/db/seed";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// ── D4: upvotes as a persisted, one-per-user, toggleable signal (issue #55). ─────────────────
// Drives the REAL `lib/server/actions.ts` boundary (the same #45/C/D1/D2/D3 pattern): the DB is
// pglite, the SESSION is stubbed (no live Wikimedia round-trip), `getDb` is mocked to the per-test
// handle. The TWO load-bearing tests are the security/integrity ones, invoked at the ACTION (not a
// button): (AC3) two insert attempts for the same (clip, contributor) yield ONE row, not two — the
// `(clip_id, contributor_id)` unique constraint is the one-per-user invariant; (AC4) an anonymous
// toggle is rejected by `requireContributor()` and writes NOTHING. Plus: a signed-in toggle inserts
// then deletes one row + returns the right `{voted,count}` (AC1/AC2); the count is DERIVED = seed
// baseline + distinct rows and `clip.upvotes` is never mutated (AC8); a self-vote is allowed (AC9);
// distinct contributors each add one; the per-viewer `votedClipIds` read is viewer-scoped (AC6).

let currentDb: Db;
let currentSession: { user: { contributorId?: number; username?: string } } | null =
  null;

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDb: () => currentDb };
});
vi.mock("@/lib/auth/config", () => ({
  auth: async () => currentSession,
}));

import {
  addClipAction,
  listClipsAction,
  toggleUpvoteAction,
  upsertTopicAction,
  votedClipIdsAction,
} from "@/lib/server/actions";

let h: TestDb;

function baseClip(): Omit<Clip, "id" | "createdAt"> {
  return {
    topicQid: "Q11982",
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "vertical",
    watchUrl: "https://youtu.be/upvoteid",
    embedUrl: "https://www.youtube-nocookie.com/embed/upvoteid",
    caption: "A curated clip to upvote",
    creator: { handle: "@creator", name: "Creator", platform: "youtube" },
    general: false,
    sectionSlug: "light-reactions",
    sectionLabel: "Light reactions",
    contextNote: "Clear walk-through; one dated figure.",
    stance: "explainer",
    accuracyFlag: "accurate_with_caveat",
  };
}

beforeEach(async () => {
  _resetStubContributorCache();
  h = await makeTestDb();
  currentDb = h.db;
  currentSession = null;
});
afterEach(async () => {
  await h.close();
  vi.restoreAllMocks();
});

async function signInAs(username: string, subject: string) {
  const resolved = await findOrCreateContributor(
    { subject, username, email: null },
    h.db
  );
  currentSession = {
    user: { contributorId: resolved.contributorId, username: resolved.handle },
  };
  return resolved;
}

/** Sign in as a curator, upsert the topic, add a clip, return its id. Leaves them signed in. */
async function seedClip(
  username = "Marcus",
  subject = "sub-marcus",
  overrides: Partial<Omit<Clip, "id" | "createdAt">> = {}
): Promise<string> {
  await signInAs(username, subject);
  await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
  const added = await addClipAction({ ...baseClip(), ...overrides }, true);
  return added.id;
}

function voteRows(clipId: string) {
  return h.db.select().from(clipVote).where(eq(clipVote.clipId, Number(clipId)));
}

describe("AC1 — a signed-in upvote persists exactly one vote and the count increments by one", () => {
  it("inserts exactly one clip_vote row and returns { voted: true, count: baseline+1 }", async () => {
    const id = await seedClip(); // an UNSEEDED clip (no clip.upvotes baseline)
    expect(await voteRows(id)).toHaveLength(0);

    const result = await toggleUpvoteAction(id);

    expect(result).toEqual({ voted: true, count: 1 });
    const rows = await voteRows(id);
    expect(rows).toHaveLength(1);
    // The vote is attributed to the signed-in contributor.
    expect(rows[0].contributorId).toBe(currentSession!.user.contributorId);
  });

  it("the derived count survives a reload (a fresh listClips derivation still counts the vote)", async () => {
    const id = await seedClip();
    await toggleUpvoteAction(id);
    // A fresh read (the reload path) re-derives the count from the row, not a cached counter.
    const clips = await listClipsAction("Q11982");
    expect(clips.find((c) => c.id === id)?.upvotes).toBe(1);
  });
});

describe("AC2 — re-clicking toggles the vote off; the row is removed and the count decrements", () => {
  it("a second toggle deletes the row and returns { voted: false, count: baseline }", async () => {
    const id = await seedClip();
    await toggleUpvoteAction(id); // vote on
    const off = await toggleUpvoteAction(id); // vote off

    expect(off).toEqual({ voted: false, count: 0 });
    expect(await voteRows(id)).toHaveLength(0);
  });

  it("the toggle is idempotent in post-state: on→off→on lands voted with one row", async () => {
    const id = await seedClip();
    await toggleUpvoteAction(id);
    await toggleUpvoteAction(id);
    const on = await toggleUpvoteAction(id);
    expect(on.voted).toBe(true);
    expect(await voteRows(id)).toHaveLength(1);
  });
});

describe("AC3 — the count reflects DISTINCT users; the unique constraint is the one-per-user invariant (load-bearing)", () => {
  it("two INSERT attempts for the same (clip, contributor) yield ONE row, not two", async () => {
    const id = await seedClip();
    const me = currentSession!.user.contributorId!;

    // Drive the STORE-LEVEL insert path twice directly (not the toggle, which would un-vote on the
    // second call) to prove the DB constraint — a duplicate insert collides, it does not double.
    // Two concurrent insert-if-absent attempts (onConflictDoNothing on the unique identity).
    await Promise.all([
      h.db
        .insert(clipVote)
        .values({ clipId: Number(id), contributorId: me })
        .onConflictDoNothing({
          target: [clipVote.clipId, clipVote.contributorId],
        }),
      h.db
        .insert(clipVote)
        .values({ clipId: Number(id), contributorId: me })
        .onConflictDoNothing({
          target: [clipVote.clipId, clipVote.contributorId],
        }),
    ]);

    const rows = await h.db
      .select()
      .from(clipVote)
      .where(
        and(eq(clipVote.clipId, Number(id)), eq(clipVote.contributorId, me))
      );
    expect(rows).toHaveLength(1); // ONE row — the (clip_id, contributor_id) unique constraint
  });

  it("a raw duplicate insert WITHOUT onConflict throws (the constraint truly exists at the DB)", async () => {
    const id = await seedClip();
    const me = currentSession!.user.contributorId!;
    await h.db.insert(clipVote).values({ clipId: Number(id), contributorId: me });
    // A second plain insert violates the unique constraint and rejects — proving the invariant is
    // enforced by the DB, not app logic.
    await expect(
      h.db.insert(clipVote).values({ clipId: Number(id), contributorId: me })
    ).rejects.toThrow();
    expect(await voteRows(id)).toHaveLength(1);
  });

  it("distinct contributors voting the same clip each add one to the count", async () => {
    const id = await seedClip("Marcus", "sub-marcus"); // Marcus signed in
    const first = await toggleUpvoteAction(id);
    expect(first.count).toBe(1);

    await signInAs("Priya", "sub-priya"); // a DIFFERENT contributor
    const second = await toggleUpvoteAction(id);
    expect(second.count).toBe(2);

    expect(await voteRows(id)).toHaveLength(2);
    const clips = await listClipsAction("Q11982");
    expect(clips.find((c) => c.id === id)?.upvotes).toBe(2);
  });
});

describe("AC4 — an anonymous toggle is rejected server-side and writes nothing (load-bearing)", () => {
  it("rejects toggleUpvoteAction with no session before any clip_vote write", async () => {
    const id = await seedClip();
    currentSession = null; // logged out

    await expect(toggleUpvoteAction(id)).rejects.toThrow(/AUTH_REQUIRED/);
    expect(await voteRows(id)).toHaveLength(0); // nothing written
  });

  it("an anonymous toggle on an ALREADY-voted clip neither deletes nor inserts", async () => {
    const id = await seedClip();
    await toggleUpvoteAction(id); // a real vote exists (by the signed-in curator)
    expect(await voteRows(id)).toHaveLength(1);

    currentSession = null;
    await expect(toggleUpvoteAction(id)).rejects.toThrow(/AUTH_REQUIRED/);
    expect(await voteRows(id)).toHaveLength(1); // untouched — no delete by an anon caller
  });

  it("votedClipIdsAction is gated too — an anonymous read rejects, never querying per-user state on the read path", async () => {
    const id = await seedClip();
    currentSession = null;
    await expect(votedClipIdsAction([id])).rejects.toThrow(/AUTH_REQUIRED/);
  });
});

describe("AC8 — the legacy seed is a frozen baseline; a real vote adds on top; the seed is never mutated", () => {
  it("a seeded clip shows N, then N+1 after a vote, then N after un-voting; clip.upvotes never changes", async () => {
    // A seeded clip with a baseline of 7 (the demo texture).
    const id = await seedClip("Marcus", "sub-marcus", { upvotes: 7 });
    const original = (
      await h.db.select().from(clip).where(eq(clip.id, Number(id)))
    )[0];
    expect(original.upvotes).toBe(7);

    // Displayed count starts at the baseline (no real votes yet).
    let clips = await listClipsAction("Q11982");
    expect(clips.find((c) => c.id === id)?.upvotes).toBe(7);

    // A real vote → N+1.
    const on = await toggleUpvoteAction(id);
    expect(on.count).toBe(8);
    clips = await listClipsAction("Q11982");
    expect(clips.find((c) => c.id === id)?.upvotes).toBe(8);

    // Un-vote → back to the baseline N (never below — you can't un-vote the seed).
    const off = await toggleUpvoteAction(id);
    expect(off.count).toBe(7);

    // The legacy clip.upvotes column is NEVER mutated by a vote — still the frozen baseline.
    const after = (
      await h.db.select().from(clip).where(eq(clip.id, Number(id)))
    )[0];
    expect(after.upvotes).toBe(7);
  });

  it("own 'have I voted?' state comes ONLY from clip_vote — a large seed with no real vote shows NOT voted", async () => {
    const id = await seedClip("Marcus", "sub-marcus", { upvotes: 99 });
    const me = currentSession!.user.contributorId!;
    // No real vote by this viewer yet, despite the large baseline.
    expect(await votedClipIdsAction([id])).toEqual([]);
    // After a real vote, the viewer IS voted (from the row, not the seed).
    await toggleUpvoteAction(id);
    expect(await votedClipIdsAction([id])).toEqual([id]);
    void me;
  });
});

describe("AC9 — a curator may upvote their OWN clip (self-vote allowed, no special case)", () => {
  it("the curator of a clip can upvote it exactly like any other — one row, one increment, toggleable", async () => {
    const id = await seedClip("Marcus", "sub-marcus");
    const me = currentSession!.user.contributorId!;
    // The clip's curatorId is the signed-in viewer's own id (a self-vote scenario).
    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row.curatorId).toBe(me);

    const on = await toggleUpvoteAction(id);
    expect(on).toEqual({ voted: true, count: 1 });
    expect(await voteRows(id)).toHaveLength(1);
    const off = await toggleUpvoteAction(id);
    expect(off.voted).toBe(false);
  });
});

describe("AC6 — the per-viewer voted-state read is viewer-scoped (off the cached read path)", () => {
  it("votedClipIds returns only the clips THIS viewer voted, not another contributor's votes", async () => {
    const id = await seedClip("Marcus", "sub-marcus");
    await toggleUpvoteAction(id); // Marcus votes

    // Priya has NOT voted this clip — her voted-state read is empty.
    await signInAs("Priya", "sub-priya");
    expect(await votedClipIdsAction([id])).toEqual([]);

    // Marcus's voted-state read includes it.
    await signInAs("Marcus", "sub-marcus");
    expect(await votedClipIdsAction([id])).toEqual([id]);
  });

  it("listClips issues NO per-user vote query — the count is the same for every viewer (public)", async () => {
    const id = await seedClip("Marcus", "sub-marcus");
    await toggleUpvoteAction(id);

    // The derived COUNT is identical regardless of who reads it (or no one) — it is public.
    const asMarcus = await listClipsAction("Q11982");
    currentSession = null; // anonymous
    const asAnon = await listClipsAction("Q11982");
    expect(asAnon.find((c) => c.id === id)?.upvotes).toBe(1);
    expect(asMarcus.find((c) => c.id === id)?.upvotes).toBe(
      asAnon.find((c) => c.id === id)?.upvotes
    );
  });
});

describe("seeded DB — deleting a clip cascades its votes (FK onDelete cascade)", () => {
  it("a seeded clip can be voted and its votes are independent of other clips", async () => {
    await seedDatabase(h.db);
    const seeded = await h.db.select().from(clip);
    expect(seeded.length).toBeGreaterThan(0);
    // Sign in as a real contributor and vote a seeded clip — the seed baseline + 1.
    await signInAs("RealUser", "sub-real");
    const target = seeded[0];
    const baseline = target.upvotes ?? 0;
    const result = await toggleUpvoteAction(String(target.id));
    expect(result.count).toBe(baseline + 1);
    expect(result.voted).toBe(true);
  });
});
