// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { clip, contributor } from "@/lib/db/schema";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { isAuthRequired, isRateLimited } from "@/lib/auth/auth-error";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// ── D5c: moderator removal of abusive clips — soft-removal / tombstone (issue #59). ───────────────
// Drives the REAL `lib/server/actions.ts` boundary (the #45/C/D1/D2/D5a/D5b pattern): the DB is
// pglite (the committed 0007 migration applied), the SESSION is stubbed — INCLUDING a stubbed
// MODERATOR — and BOTH `getDb` usages (the store's and the role/limit resolver's) are mocked to the
// same per-test handle. A live Wikimedia OAuth round-trip cannot run in CI; the whole workflow,
// including the LOAD-BEARING role-gate, is provable at the action with a stubbed contributor —
// which is why the feature ships green WITHOUT a live moderator granted on any box.
//
// The LOAD-BEARING tests are AC2/AC3: a NON-moderator's removal — INCLUDING the clip's OWN CURATOR
// acting as a non-moderator — is rejected AT THE ACTION on the ROLE (not the UI hiding a button)
// and the clip stays; an anonymous removal is rejected by the auth gate. Removal is MODERATOR-ONLY
// with NO own-curator arm (the key contrast with the D5b hold).

let currentDb: Db;
let currentSession:
  | { user: { contributorId?: number; username?: string; isModerator?: boolean } }
  | null = null;

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDb: () => currentDb };
});
vi.mock("@/lib/auth/config", () => ({
  auth: async () => currentSession,
}));

import {
  addClipAction,
  deleteClipAction,
  holdClipAction,
  listClipsAction,
  listClipsByContributorAction,
  removeClipAction,
  upsertTopicAction,
} from "@/lib/server/actions";

let h: TestDb;

const QID = "Q11982";

function baseClip(
  overrides: Partial<Omit<Clip, "id" | "createdAt">> = {}
): Omit<Clip, "id" | "createdAt"> {
  return {
    topicQid: QID,
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "vertical",
    watchUrl: "https://youtu.be/rl-base",
    embedUrl: "https://www.youtube-nocookie.com/embed/rl-base",
    caption: "A curated clip",
    creator: { handle: "@creator", name: "Creator", platform: "youtube" },
    general: false,
    sectionSlug: "light-reactions",
    sectionLabel: "Light reactions",
    contextNote: "Clear walk-through; one dated figure.",
    stance: "explainer",
    accuracyFlag: "accurate_with_caveat",
    ...overrides,
  };
}

/** Sign in as a plain contributor (find-or-create), stub the session. */
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

/** Grant the signed-in contributor the moderator role via the DB column (out-of-band path (a)). */
async function grantModeratorById(contributorId: number) {
  await h.db
    .update(contributor)
    .set({ isModerator: true })
    .where(eq(contributor.id, contributorId));
}

/** The raw soft-removal tombstone for a clip (the server-side removed-state). */
async function tombstoneOf(clipId: string): Promise<{
  removedAt: Date | null;
  removedBy: number | null;
  removedReason: string | null;
  vetted: boolean;
}> {
  const rows = await h.db
    .select({
      removedAt: clip.removedAt,
      removedBy: clip.removedBy,
      removedReason: clip.removedReason,
      vetted: clip.vetted,
    })
    .from(clip)
    .where(eq(clip.id, Number(clipId)))
    .limit(1);
  return rows[0]!;
}

/** Does a clip ROW still exist in the DB (regardless of removed-state)? — the soft vs. hard tell. */
async function rowExists(clipId: string): Promise<boolean> {
  const rows = await h.db
    .select({ id: clip.id })
    .from(clip)
    .where(eq(clip.id, Number(clipId)))
    .limit(1);
  return Boolean(rows[0]);
}

/** Seed a topic + one published clip as `curatorUser`, return the clip. */
async function seedTopicAndClip(curatorUser: string, subject: string) {
  await signInAs(curatorUser, subject);
  await upsertTopicAction({ qid: QID, title: "Photosynthesis" });
  return addClipAction(baseClip(), true);
}

beforeEach(async () => {
  _resetStubContributorCache();
  h = await makeTestDb();
  currentDb = h.db;
  currentSession = null;
  delete process.env.WIKIPLUS_MODERATORS;
  // A high cap so the per-test setup writes never trip the D5a rate limit (D5c slots into it).
  process.env.WRITE_RATE_LIMIT_MAX = "1000";
});
afterEach(async () => {
  await h.close();
  delete process.env.WRITE_RATE_LIMIT_MAX;
  delete process.env.WIKIPLUS_MODERATORS;
  vi.restoreAllMocks();
});

// ── AC1 — a moderator removes ANY clip and it stops showing. ──────────────────────────────────────
describe("AC1 — a moderator removes another contributor's clip; it leaves listClips", () => {
  it("a moderator removes a DIFFERENT contributor's clip → removed_at set, excluded from listClips", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // A separate moderator account removes it (any clip).
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);

    const removed = await removeClipAction(c.id, null);
    expect(removed.id).toBe(c.id);
    const t = await tombstoneOf(c.id);
    expect(t.removedAt).not.toBeNull(); // AC1/AC6: tombstone set
    expect(t.removedBy).toBe(mod.contributorId); // AC6: who removed it (the moderator)

    // AC1: a fresh listClips no longer returns the clip — gone from the page/band/counts.
    const listed = await listClipsAction(QID);
    expect(listed).toHaveLength(0);
  });

  it("a moderator removing THEIR OWN clip works identically (the trivial subset)", async () => {
    // Mod is the curator AND a moderator: removing their own clip is allowed (the moderator-only
    // gate does not exclude an own clip; it simply does not REQUIRE ownership).
    const own = await seedTopicAndClip("Mod", "sub-mod");
    await grantModeratorById(own.curatorId!); // Mod is the signed-in session

    const removed = await removeClipAction(own.id, null);
    expect(removed.id).toBe(own.id);
    expect((await tombstoneOf(own.id)).removedAt).not.toBeNull();
    expect(await listClipsAction(QID)).toHaveLength(0);
  });

  it("removal survives a reload: a fresh listClips still excludes the removed clip", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await removeClipAction(c.id, null);

    // Re-read with a fresh anonymous session — the server-side filter is the durable truth.
    currentSession = null;
    expect(await listClipsAction(QID)).toHaveLength(0);
  });
});

// ── AC2 — a NON-moderator's removal is rejected SERVER-SIDE and the clip stays (load-bearing). ─────
describe("AC2 — a non-moderator removal is rejected server-side; the clip stays (incl. own curator)", () => {
  it("a signed-in NON-moderator non-curator removal is rejected and changes nothing", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // A different signed-in contributor, NOT a moderator, NOT the curator.
    await signInAs("Random", "sub-random");
    await expect(removeClipAction(c.id, null)).rejects.toThrow(/Not authorized/);

    const t = await tombstoneOf(c.id);
    expect(t.removedAt).toBeNull(); // unchanged — the rejected removal wrote nothing
    expect(await listClipsAction(QID)).toHaveLength(1); // still shows
  });

  it("the clip's OWN CURATOR (a non-moderator) removal is rejected — NO own-curator arm (load-bearing)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // Marcus is the signed-in curator and is NOT a moderator. Unlike the D5b hold, removal has NO
    // own-curator arm — the curator cannot remove even their own clip (they have D2 Delete).
    await expect(removeClipAction(c.id, null)).rejects.toThrow(/Not authorized/);
    const t = await tombstoneOf(c.id);
    expect(t.removedAt).toBeNull(); // unchanged — still live
    expect(await listClipsAction(QID)).toHaveLength(1);
  });

  it("a forged session.isModerator=true does NOT let a non-moderator remove (server re-resolves)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const random = await signInAs("Random", "sub-random");
    // The (client-derived) session falsely asserts the moderator claim; the action re-resolves the
    // role server-side via isModeratorContributor (DB OR env), never the session claim.
    currentSession = {
      user: {
        contributorId: random.contributorId,
        username: random.handle,
        isModerator: true, // forged — never set server-side for this contributor
      },
    };
    await expect(removeClipAction(c.id, null)).rejects.toThrow(/Not authorized/);
    expect((await tombstoneOf(c.id)).removedAt).toBeNull(); // unchanged
  });
});

// ── AC3 — a logged-out removal is rejected by the auth gate and the clip stays. ───────────────────
describe("AC3 — an anonymous removal is rejected by the gate (gate→limit→role order)", () => {
  it("an ANONYMOUS removal is rejected (AuthRequired, not the role error) and changes nothing", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    currentSession = null; // logged out
    let thrown: unknown;
    try {
      await removeClipAction(c.id, null);
    } catch (err) {
      thrown = err;
    }
    expect(isAuthRequired(thrown)).toBe(true);
    expect(isRateLimited(thrown)).toBe(false);
    expect((await tombstoneOf(c.id)).removedAt).toBeNull(); // unchanged
    expect(await listClipsAction(QID)).toHaveLength(1); // still shows
  });
});

// ── AC4 — removal is DISTINCT from D2 owner-delete; D2 still works owner-gated + is HARD. ──────────
describe("AC4 — removal is soft (row persists); D2 owner-delete is hard (row gone), still owner-gated", () => {
  it("a moderator removal SOFT-removes: the row PERSISTS with removed_at/removed_by set", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await removeClipAction(c.id, null);

    expect(await rowExists(c.id)).toBe(true); // soft — row still there
    const t = await tombstoneOf(c.id);
    expect(t.removedAt).not.toBeNull();
    expect(t.removedBy).toBe(mod.contributorId);
  });

  it("D2 owner-delete is unchanged: an owner HARD-deletes their own clip (the row is GONE)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // Marcus (the owner, the signed-in session) deletes their own clip via D2.
    await deleteClipAction(c.id);
    expect(await rowExists(c.id)).toBe(false); // hard — the row is gone
    expect(await listClipsAction(QID)).toHaveLength(0);
  });

  it("D2 owner-delete still rejects a non-owner (D2's gate is unchanged by D5c)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // A moderator is NOT an owner — D2 delete is owner-gated, NOT role-gated; the moderator must
    // use removeClipAction (soft), not deleteClipAction (owner-only hard).
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await expect(deleteClipAction(c.id)).rejects.toThrow(/Not your clip/);
    expect(await rowExists(c.id)).toBe(true); // unchanged — still present
  });
});

// ── AC5 — removal is DISTINCT from the D5b hold; they do not collide. ─────────────────────────────
describe("AC5 — vetted (hold) and removed_at are independent; a held clip still lists, a removed clip does not", () => {
  it("a HELD clip (vetted=false, removed_at NULL) STILL lists and reads back held", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await holdClipAction(c.id); // hold, not remove

    const t = await tombstoneOf(c.id);
    expect(t.vetted).toBe(false); // held
    expect(t.removedAt).toBeNull(); // NOT removed
    const listed = await listClipsAction(QID);
    expect(listed).toHaveLength(1); // a held clip STILL shows (shown-but-marked)
    expect(listed[0]!.held).toBe(true);
  });

  it("removing a clip does NOT merely hold it: removed_at set, vetted untouched, NOT listed", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await removeClipAction(c.id, null);

    const t = await tombstoneOf(c.id);
    expect(t.removedAt).not.toBeNull(); // removed
    expect(t.vetted).toBe(true); // vetted UNTOUCHED — removal is not the hold
    expect(await listClipsAction(QID)).toHaveLength(0); // removed clip does NOT show
  });

  it("a HELD clip can be removed; it is removed regardless of its vetted value (no collision)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await holdClipAction(c.id); // held first
    await removeClipAction(c.id, null); // then removed (hold-then-remove)

    const t = await tombstoneOf(c.id);
    expect(t.vetted).toBe(false); // still held value
    expect(t.removedAt).not.toBeNull(); // AND removed
    expect(await listClipsAction(QID)).toHaveLength(0); // a removed clip is excluded regardless
  });
});

// ── AC6 — the tombstone persists who/when/optional-why; existing/seeded clips land live. ───────────
describe("AC6 — the tombstone persists removed_by/removed_at/removed_reason; columns land all-live", () => {
  it("the optional reason persists on the tombstone when supplied (audit-only)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await removeClipAction(c.id, "spam: bulk junk submissions");

    const t = await tombstoneOf(c.id);
    expect(t.removedReason).toBe("spam: bulk junk submissions");
    expect(t.removedBy).toBe(mod.contributorId);
    expect(t.removedAt).not.toBeNull();
  });

  it("a removal with NO reason is valid: removed_reason stays NULL (a reason never gates removal)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await removeClipAction(c.id); // no reason argument

    const t = await tombstoneOf(c.id);
    expect(t.removedReason).toBeNull();
    expect(t.removedAt).not.toBeNull(); // removed regardless — the reason is optional
  });

  it("existing/seeded clips land LIVE (removed_at IS NULL) when the column lands — no clip goes dark", async () => {
    // Two published clips exist; neither was removed → both must be removed_at NULL and listed.
    await seedTopicAndClip("Marcus", "sub-marcus");
    await signInAs("Priya", "sub-priya");
    await addClipAction(baseClip({ caption: "Second clip", watchUrl: "https://youtu.be/two" }), true);

    const liveRows = await h.db.select({ id: clip.id }).from(clip).where(isNull(clip.removedAt));
    const allRows = await h.db.select({ id: clip.id }).from(clip);
    expect(liveRows.length).toBe(allRows.length); // every clip is live (none dark)
    expect(allRows.length).toBe(2);
    expect(await listClipsAction(QID)).toHaveLength(2);
  });
});

// ── AC7 — the removed-state rides the read as an exclusion; anonymous read returns live clips only.
describe("AC7 — removed-state rides the read as an exclusion; an anonymous read excludes removed clips", () => {
  it("an anonymous listClips returns the topic's LIVE clips with removed ones excluded (no per-user work)", async () => {
    // Two clips; a moderator removes one. An anonymous reader sees only the live one.
    const c1 = await seedTopicAndClip("Marcus", "sub-marcus");
    await signInAs("Priya", "sub-priya");
    await addClipAction(baseClip({ caption: "Second clip", watchUrl: "https://youtu.be/two" }), true);
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await removeClipAction(c1.id, null);

    currentSession = null; // anonymous reader — no per-user query
    const listed = await listClipsAction(QID);
    expect(listed).toHaveLength(1);
    expect(listed.some((c) => c.id === c1.id)).toBe(false); // the removed clip is excluded
  });

  it("a removed clip is excluded from its curator's PROFILE read too (listClipsByContributor)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const marcusId = c.curatorId!;
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await removeClipAction(c.id, null);

    const profile = await listClipsByContributorAction(marcusId);
    expect(profile).toHaveLength(0); // gone from the profile read as well
  });
});

// ── The env-allowlist grant path (out-of-band mechanism (b)) also confers the removal capability. ──
describe("grant mechanism — the WIKIPLUS_MODERATORS env allowlist confers removal server-side", () => {
  it("an allowlisted username can remove a clip WITHOUT the DB column being set", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    process.env.WIKIPLUS_MODERATORS = "AllowedMod, SomeoneElse";
    await signInAs("AllowedMod", "sub-allowed");
    await removeClipAction(c.id, null);
    expect((await tombstoneOf(c.id)).removedAt).not.toBeNull();
    expect(await listClipsAction(QID)).toHaveLength(0);
  });
});

// ── The limit arm of gate→limit→role — an over-cap removal writes nothing (AC2/D5a). ──────────────
describe("removal is a counted gated write: an over-cap call is rate-limited, writes nothing", () => {
  it("a moderator over the per-identity cap is rejected on remove and the clip stays live", async () => {
    const c1 = await seedTopicAndClip("Marcus", "sub-marcus");
    await signInAs("Priya", "sub-priya");
    const c2 = await addClipAction(
      baseClip({ caption: "Second clip", watchUrl: "https://youtu.be/two" }),
      true
    );
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);

    // Tighten the cap to 1 and burn the budget with one counted removal, so the next is over-cap.
    process.env.WRITE_RATE_LIMIT_MAX = "1";
    await removeClipAction(c1.id, null); // counts as one write; c1 removed
    expect((await tombstoneOf(c1.id)).removedAt).not.toBeNull();

    // The next gated write by this identity is over the cap → RateLimitedError, no role check, no write.
    let thrown: unknown;
    try {
      await removeClipAction(c2.id, null);
    } catch (err) {
      thrown = err;
    }
    expect(isRateLimited(thrown)).toBe(true);
    expect(isAuthRequired(thrown)).toBe(false);
    expect((await tombstoneOf(c2.id)).removedAt).toBeNull(); // unchanged — the over-cap remove wrote nothing
  });
});
