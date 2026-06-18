// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { clip, contributor } from "@/lib/db/schema";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { isAuthRequired, isRateLimited } from "@/lib/auth/auth-error";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// ── D5b: the `vetted` review-hold workflow + the moderator/reviewer role model (issue #58). ───────
// Drives the REAL `lib/server/actions.ts` boundary (the #45/C/D1/D2/D5a pattern): the DB is pglite
// (the committed 0006 migration applied), the SESSION is stubbed — INCLUDING a stubbed MODERATOR —
// and BOTH `getDb` usages (the store's and the role/limit resolver's) are mocked to the same per-
// test handle. A live Wikimedia OAuth round-trip cannot run in CI; the whole workflow, including
// the LOAD-BEARING role-gate, is provable at the action with a stubbed contributor — which is why
// the feature ships green WITHOUT a live moderator granted on any box.
//
// The role is granted out-of-band two ways (lib/auth/moderators.ts): the DB column
// `contributor.is_moderator`, OR the `WIKIPLUS_MODERATORS` env allowlist. These tests exercise BOTH
// grant paths. The LOAD-BEARING tests are AC4/AC5: a non-moderator approve (incl. the clip's own
// curator), an unauthorized hold, and an anonymous hold/approve are each rejected AT THE ACTION on
// the ROLE — not the UI hiding a button — and write nothing.

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
  holdClipAction,
  listClipsAction,
  reviewClipAction,
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

/** The raw `vetted` column for a clip (the server-side review-state). */
async function vettedOf(clipId: string): Promise<boolean> {
  const rows = await h.db
    .select({ vetted: clip.vetted })
    .from(clip)
    .where(eq(clip.id, Number(clipId)))
    .limit(1);
  return rows[0]!.vetted;
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
  // A high cap so the per-test setup writes never trip the D5a rate limit (D5b slots into it).
  process.env.WRITE_RATE_LIMIT_MAX = "1000";
});
afterEach(async () => {
  await h.close();
  delete process.env.WRITE_RATE_LIMIT_MAX;
  delete process.env.WIKIPLUS_MODERATORS;
  vi.restoreAllMocks();
});

// ── AC6 — new adds publish by default; existing/seeded clips backfill published. ──────────────────
describe("AC6 — new adds publish by default; the column backfills existing clips published", () => {
  it("a freshly added clip is vetted=true and reads back NOT held", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    expect(await vettedOf(c.id)).toBe(true);
    expect(c.held).toBeUndefined(); // published → no held marking
    const listed = await listClipsAction(QID);
    expect(listed[0]!.held).toBeUndefined();
  });

  it("a row inserted WITHOUT setting vetted defaults to published (the migration default)", async () => {
    await seedTopicAndClip("Marcus", "sub-marcus");
    // Read the raw row: the NOT NULL DEFAULT true column means the backfill state is published.
    const rows = await h.db.select({ vetted: clip.vetted }).from(clip);
    expect(rows.every((r) => r.vetted === true)).toBe(true);
  });
});

// ── AC1 — a clip can be held; it reads back as the distinct held state. ───────────────────────────
describe("AC1 — a hold sets vetted=false and a held clip reads back held (distinct from published)", () => {
  it("a moderator holds a clip → vetted=false, returned clip is held, rides listClips", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // A separate moderator account holds it (any clip).
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);

    const updated = await holdClipAction(c.id);
    expect(updated.held).toBe(true); // AC1: returned clip is held
    expect(await vettedOf(c.id)).toBe(false); // persisted
    // AC7: the held flag rides listClips (a property of the clip, no per-user work).
    const listed = await listClipsAction(QID);
    expect(listed[0]!.held).toBe(true);
  });

  it("the held clip KEEPS its note, chips, and curator — it is not stripped (AC2 data-level)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    const held = await holdClipAction(c.id);
    // A held clip is a REAL curated clip — distinct from a §6 candidate (which has none of these).
    expect(held.contextNote).toBe(c.contextNote);
    expect(held.stance).toBe(c.stance);
    expect(held.accuracyFlag).toBe(c.accuracyFlag);
    expect(held.curatorId).toBe(c.curatorId);
    expect(held.held).toBe(true);
  });
});

// ── AC3 — a moderator approves a held clip back to live; AC3a — a curator may hold but not approve.
describe("AC3 / AC3a — approve flips vetted=true (moderator); a curator may hold own but not approve", () => {
  it("a moderator approve flips a held clip back to published and returns the updated clip", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await holdClipAction(c.id);
    expect(await vettedOf(c.id)).toBe(false);

    const approved = await reviewClipAction(c.id);
    expect(approved.held).toBeUndefined(); // AC3: marking gone, full vouch restored
    expect(await vettedOf(c.id)).toBe(true); // survives a fresh read (the server write)
    const listed = await listClipsAction(QID);
    expect(listed[0]!.held).toBeUndefined();
  });

  it("AC3a — the clip's OWN curator can HOLD their own clip (vetted=false)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // Marcus is still the signed-in session (the clip's curator) and is NOT a moderator.
    const held = await holdClipAction(c.id);
    expect(held.held).toBe(true);
    expect(await vettedOf(c.id)).toBe(false);
  });

  it("AC3a — the clip's own curator CANNOT approve (no self-approve) — rejected, clip stays held", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // Curator holds their own clip (allowed), then tries to approve it (must reject).
    await holdClipAction(c.id);
    await expect(reviewClipAction(c.id)).rejects.toThrow(/Not authorized/);
    expect(await vettedOf(c.id)).toBe(false); // unchanged — still held
  });
});

// ── AC4 — a NON-moderator's approve is rejected SERVER-SIDE and writes nothing (load-bearing). ─────
describe("AC4 — a non-moderator approve is rejected server-side (incl. the clip's own curator)", () => {
  it("a signed-in NON-moderator non-curator approve is rejected and changes nothing", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // Hold it first (as a moderator) so there is a held clip to attempt approving.
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await holdClipAction(c.id);

    // A different signed-in contributor, NOT a moderator, NOT the curator, tries to approve.
    await signInAs("Random", "sub-random");
    await expect(reviewClipAction(c.id)).rejects.toThrow(/Not authorized/);
    expect(await vettedOf(c.id)).toBe(false); // still held — the rejected approve wrote nothing
  });

  it("the clip's OWN curator approve is rejected — no self-approve (the load-bearing AC4 case)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // A moderator holds Marcus's clip.
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await holdClipAction(c.id);

    // Marcus (the curator) signs back in and tries to approve their own held clip → rejected.
    await signInAs("Marcus", "sub-marcus");
    await expect(reviewClipAction(c.id)).rejects.toThrow(/Not authorized/);
    expect(await vettedOf(c.id)).toBe(false);
  });
});

// ── AC5 — an unauthorized hold + a logged-out hold/approve are rejected server-side. ──────────────
describe("AC5 — unauthorized hold + anonymous hold/approve rejected server-side (gate→limit→role)", () => {
  it("a signed-in NON-moderator NON-curator hold is rejected and the clip stays published", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    await signInAs("Random", "sub-random"); // not a moderator, not the curator
    await expect(holdClipAction(c.id)).rejects.toThrow(/Not authorized/);
    expect(await vettedOf(c.id)).toBe(true); // unchanged — still published
  });

  it("an ANONYMOUS hold is rejected by the auth gate (AuthRequired, not the role error)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    currentSession = null; // logged out
    let thrown: unknown;
    try {
      await holdClipAction(c.id);
    } catch (err) {
      thrown = err;
    }
    expect(isAuthRequired(thrown)).toBe(true);
    expect(isRateLimited(thrown)).toBe(false);
    expect(await vettedOf(c.id)).toBe(true); // unchanged
  });

  it("an ANONYMOUS approve is rejected by the auth gate and changes nothing", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // Hold it as a moderator first so the clip is held.
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await holdClipAction(c.id);

    currentSession = null;
    await expect(reviewClipAction(c.id)).rejects.toThrow();
    expect(await vettedOf(c.id)).toBe(false); // still held — nothing changed
  });

  it("the auth gate runs FIRST: an anonymous call is AuthRequired even when the role would also fail", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    currentSession = null;
    let thrown: unknown;
    try {
      await reviewClipAction(c.id);
    } catch (err) {
      thrown = err;
    }
    // gate→limit→role order: the anonymous caller never reaches the role check.
    expect(isAuthRequired(thrown)).toBe(true);
  });
});

// ── The env-allowlist grant path (out-of-band mechanism (b)) also confers moderator. ──────────────
describe("grant mechanism — the WIKIPLUS_MODERATORS env allowlist confers the role server-side", () => {
  it("an allowlisted username can approve a held clip WITHOUT the DB column being set", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    // Hold it via a DB-column moderator so there is a held clip.
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await holdClipAction(c.id);

    // A DIFFERENT contributor whose handle is on the env allowlist (no DB column set) approves.
    process.env.WIKIPLUS_MODERATORS = "AllowedReviewer, SomeoneElse";
    await signInAs("AllowedReviewer", "sub-allowed");
    const approved = await reviewClipAction(c.id);
    expect(approved.held).toBeUndefined();
    expect(await vettedOf(c.id)).toBe(true);
  });

  it("the allowlist is case-insensitive and a non-listed user is still rejected", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await holdClipAction(c.id);

    process.env.WIKIPLUS_MODERATORS = "allowedreviewer";
    // Listed (case-insensitive) → allowed.
    await signInAs("AllowedReviewer", "sub-allowed");
    await reviewClipAction(c.id);
    expect(await vettedOf(c.id)).toBe(true);

    // Re-hold, then a non-listed signed-in user is rejected.
    await signInAs("Mod", "sub-mod");
    await holdClipAction(c.id);
    await signInAs("NotListed", "sub-notlisted");
    await expect(reviewClipAction(c.id)).rejects.toThrow(/Not authorized/);
    expect(await vettedOf(c.id)).toBe(false);
  });
});

// ── AC7 — the held flag rides listClips with no per-user work. ────────────────────────────────────
describe("AC7 — the held-state rides listClips; an anonymous read returns the marking", () => {
  it("an anonymous listClips returns each clip's held marking (public, no login)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await holdClipAction(c.id);

    // Anonymous reader — no session — still sees the held marking on the clip read.
    currentSession = null;
    const listed = await listClipsAction(QID);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.held).toBe(true);
  });
});

// ── QA-added: the role-gate ignores a client-FORGED `isModerator` session claim (the security heart).
// The session is client-derived (JWT); the role-gate must NOT trust it. A non-moderator whose stubbed
// session CLAIMS isModerator=true (no DB column, no allowlist) is still rejected — the action
// re-resolves the role server-side via isModeratorContributor (DB OR env), never the session claim.
describe("QA — the role-gate re-resolves server-side and ignores a forged session isModerator claim", () => {
  it("a forged session.isModerator=true does NOT let a non-moderator approve (server re-resolves)", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);
    await holdClipAction(c.id);

    // A different signed-in contributor who is NOT a moderator (no DB column, not on the allowlist),
    // but whose (client-derived) session falsely asserts the moderator claim.
    const random = await signInAs("Random", "sub-random");
    currentSession = {
      user: {
        contributorId: random.contributorId,
        username: random.handle,
        isModerator: true, // forged — never set server-side for this contributor
      },
    };
    await expect(reviewClipAction(c.id)).rejects.toThrow(/Not authorized/);
    expect(await vettedOf(c.id)).toBe(false); // still held — the forged claim authorized nothing
  });

  it("a forged session.isModerator=true does NOT let a non-owner non-moderator hold", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const random = await signInAs("Random", "sub-random");
    currentSession = {
      user: {
        contributorId: random.contributorId,
        username: random.handle,
        isModerator: true, // forged
      },
    };
    await expect(holdClipAction(c.id)).rejects.toThrow(/Not authorized/);
    expect(await vettedOf(c.id)).toBe(true); // unchanged — still published
  });
});

// ── QA-added: AC1+AC3 full round-trip — hold then approve by a moderator lands published. ──────────
describe("QA — AC1/AC3 round-trip: a moderator holds then approves; the clip ends published", () => {
  it("published → hold (held) → approve (published), each step persisted and read back", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    expect(await vettedOf(c.id)).toBe(true);

    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);

    const held = await holdClipAction(c.id);
    expect(held.held).toBe(true);
    expect(await vettedOf(c.id)).toBe(false);

    const approved = await reviewClipAction(c.id);
    expect(approved.held).toBeUndefined();
    expect(await vettedOf(c.id)).toBe(true);
    // The full cycle leaves only the review-state changed — the curated content is intact.
    expect(approved.contextNote).toBe(c.contextNote);
    expect(approved.curatorId).toBe(c.curatorId);
  });
});

// ── QA-added: the limit arm of gate→limit→role — an over-cap hold/approve writes nothing (AC5/D5a). ─
// D5b's two actions are counted gated writes that slot into the D5a gate→limit→role→write order. The
// LIMIT runs BEFORE the role check, so an over-cap call is rejected with RateLimitedError and writes
// nothing — even for an otherwise-authorized actor — and never reaches the role/write step.
describe("QA — hold/approve are counted gated writes: an over-cap call is rate-limited, writes nothing", () => {
  it("a moderator over the per-identity cap is rejected on hold and the clip stays published", async () => {
    const c = await seedTopicAndClip("Marcus", "sub-marcus");
    const mod = await signInAs("Mod", "sub-mod");
    await grantModeratorById(mod.contributorId);

    // Tighten the cap to 1 and burn the budget with one counted write, so the next is over-cap.
    process.env.WRITE_RATE_LIMIT_MAX = "1";
    await holdClipAction(c.id); // counts as one write; clip now held
    expect(await vettedOf(c.id)).toBe(false);

    // The next gated write by this identity is over the cap → RateLimitedError, no role check, no write.
    let thrown: unknown;
    try {
      await reviewClipAction(c.id);
    } catch (err) {
      thrown = err;
    }
    expect(isRateLimited(thrown)).toBe(true);
    expect(isAuthRequired(thrown)).toBe(false);
    expect(await vettedOf(c.id)).toBe(false); // unchanged — the over-cap approve wrote nothing
  });
});
