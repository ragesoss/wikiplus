// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { clip } from "@/lib/db/schema";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { seedDatabase } from "@/lib/db/seed";
import { NOTE_LICENSE } from "@/lib/curation/note-license";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// ── D2: owner-only edit / delete of your own curated clips (issue #53). ──────────────────────
// Drives the REAL `lib/server/actions.ts` boundary (the same #45/C/D1 pattern): the DB is pglite,
// the SESSION is stubbed (no live Wikimedia round-trip), `getDb` is mocked to the per-test handle.
// The load-bearing tests are the SECURITY ones — the server-side, id-based ownership gate is the
// only thing between a non-owner/anonymous request and a destructive write, so they invoke the
// ACTION directly (not a button): a non-owner edit/delete (AC4/AC5), an anonymous edit/delete
// (AC6), and a legacy `@prototype`-owned clip (AC8) must each be rejected and write nothing.
// Plus: an owner edit persists each editable field + leaves non-editable fields unchanged incl.
// a forged out-of-set patch (AC1); an owner delete removes the row (AC3); a material note-text
// edit re-stamps `noteLicenseAgreedAt` (AC9) and a chip-only edit does NOT (AC10).

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
  deleteClipAction,
  updateClipAction,
  upsertTopicAction,
} from "@/lib/server/actions";

let h: TestDb;

function baseClip(): Omit<Clip, "id" | "createdAt"> {
  return {
    topicQid: "Q11982",
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "vertical",
    watchUrl: "https://youtu.be/clipvid",
    embedUrl: "https://www.youtube-nocookie.com/embed/clipvid",
    caption: "A curated clip",
    creator: { handle: "@creator", name: "Creator", platform: "youtube" },
    general: false,
    sectionSlug: "light-reactions",
    sectionLabel: "Light reactions",
    contextNote: "Original note: clear walk-through; one dated figure.",
    stance: "explainer",
    stanceModifier: "intro-level",
    accuracyFlag: "accurate_with_caveat",
    accuracyModifier: "as of 2020",
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

/** Sign in as the owner, upsert the topic, and add a clip → return its id (owned by the owner). */
async function seedOwnedClip(
  overrides: Partial<Omit<Clip, "id" | "createdAt">> = {}
): Promise<string> {
  await signInAs("Owner", "sub-owner");
  await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
  const added = await addClipAction({ ...baseClip(), ...overrides }, true);
  return added.id;
}

describe("AC1 — an owner can edit each editable field; each persists; non-editable unchanged", () => {
  it("persists contextNote / stance / accuracy / section and leaves identity fields untouched", async () => {
    const id = await seedOwnedClip();
    const before = await h.db.select().from(clip).where(eq(clip.id, Number(id)));
    const orig = before[0];

    const updated = await updateClipAction(
      id,
      {
        contextNote: "Revised note: tighter, still accurate.",
        stance: "myth_busting",
        accuracyFlag: "accurate",
        general: true, // re-file General
        sectionSlug: undefined,
        sectionLabel: undefined,
      },
      true
    );

    expect(updated.contextNote).toBe("Revised note: tighter, still accurate.");
    expect(updated.stance).toBe("myth_busting");
    expect(updated.accuracyFlag).toBe("accurate");
    expect(updated.general).toBe(true);

    const rows = await h.db.select().from(clip).where(eq(clip.id, Number(id)));
    const row = rows[0];
    // Editable fields written.
    expect(row.contextNote).toBe("Revised note: tighter, still accurate.");
    expect(row.stance).toBe("myth_busting");
    expect(row.accuracyFlag).toBe("accurate");
    expect(row.general).toBe(true);
    // Non-editable identity / attribution / provenance UNCHANGED.
    expect(row.watchUrl).toBe(orig.watchUrl);
    expect(row.platform).toBe(orig.platform);
    expect(row.creatorHandle).toBe(orig.creatorHandle);
    expect(row.topicId).toBe(orig.topicId);
    expect(row.curatorId).toBe(orig.curatorId);
    expect(row.curatedBy).toBe(orig.curatedBy);
    expect(row.createdAt.getTime()).toBe(orig.createdAt.getTime());
    // Modifiers PRESERVED (D2 adds no modifier UI; an absent patch key must not clear them).
    expect(row.stanceModifier).toBe("intro-level");
    expect(row.accuracyModifier).toBe("as of 2020");
  });

  it("IGNORES a forged out-of-editable-set patch (cannot change curatorId/curatedBy/video/upvotes)", async () => {
    const id = await seedOwnedClip();
    const orig = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];

    // A forged patch trying to smuggle attribution/identity/vote changes through the action.
    await updateClipAction(
      id,
      {
        contextNote: "Just editing my note.",
        // none of these are on ClipEditPatch — TS would reject named props, so cast to slip
        // arbitrary keys past the type and prove the runtime narrowing drops them.
        ...({
          curatorId: 99999,
          curatedBy: "@attacker",
          watchUrl: "https://evil.test/x",
          platform: "tiktok",
          topicQid: "Q1",
          upvotes: 9999,
          createdAt: "1999-01-01T00:00:00.000Z",
          noteLicense: "WTFPL",
        } as Record<string, unknown>),
      },
      true
    );

    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row.contextNote).toBe("Just editing my note."); // the one editable change took
    // Everything forged is rejected.
    expect(row.curatorId).toBe(orig.curatorId);
    expect(row.curatedBy).toBe(orig.curatedBy);
    expect(row.watchUrl).toBe(orig.watchUrl);
    expect(row.platform).toBe("youtube");
    expect(row.topicId).toBe(orig.topicId);
    expect(row.upvotes).toBe(orig.upvotes);
    expect(row.createdAt.getTime()).toBe(orig.createdAt.getTime());
  });

  it("rejects an out-of-vocabulary stance/accuracy in a patch and writes nothing (AC2 closed-enum guard)", async () => {
    const id = await seedOwnedClip();
    await expect(
      updateClipAction(id, { stance: "documentary" as Clip["stance"] }, false)
    ).rejects.toThrow(/Unknown stance/);
    await expect(
      updateClipAction(
        id,
        { accuracyFlag: "anecdotal" as Clip["accuracyFlag"] },
        false
      )
    ).rejects.toThrow(/Unknown accuracy/);
    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row.stance).toBe("explainer"); // unchanged
    expect(row.accuracyFlag).toBe("accurate_with_caveat"); // unchanged
  });
});

describe("AC3 — an owner can delete their own clip; it is gone", () => {
  it("removes the row (hard delete — Decision 4)", async () => {
    const id = await seedOwnedClip();
    expect(await h.db.select().from(clip).where(eq(clip.id, Number(id)))).toHaveLength(1);
    await deleteClipAction(id);
    expect(await h.db.select().from(clip).where(eq(clip.id, Number(id)))).toHaveLength(0);
  });
});

describe("AC4/AC5 — a NON-OWNER's edit/delete is rejected server-side (the load-bearing security tests)", () => {
  it("rejects a different signed-in contributor's edit and writes nothing", async () => {
    const id = await seedOwnedClip();
    // A DIFFERENT contributor signs in.
    await signInAs("Mallory", "sub-mallory");
    await expect(
      updateClipAction(id, { contextNote: "I am not the owner." }, true)
    ).rejects.toThrow(/Not your clip/);
    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row.contextNote).toBe(
      "Original note: clear walk-through; one dated figure."
    );
  });

  it("rejects a different signed-in contributor's delete and leaves the clip present", async () => {
    const id = await seedOwnedClip();
    await signInAs("Mallory", "sub-mallory");
    await expect(deleteClipAction(id)).rejects.toThrow(/Not your clip/);
    expect(
      await h.db.select().from(clip).where(eq(clip.id, Number(id)))
    ).toHaveLength(1);
  });
});

describe("AC6 — an ANONYMOUS edit/delete is rejected before the ownership check", () => {
  it("rejects an unauthenticated edit (requireContributor gate) and writes nothing", async () => {
    const id = await seedOwnedClip();
    currentSession = null; // logged out
    await expect(
      updateClipAction(id, { contextNote: "anon edit" }, true)
    ).rejects.toThrow(/AUTH_REQUIRED/);
    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row.contextNote).toBe(
      "Original note: clear walk-through; one dated figure."
    );
  });

  it("rejects an unauthenticated delete and leaves the clip present", async () => {
    const id = await seedOwnedClip();
    currentSession = null;
    await expect(deleteClipAction(id)).rejects.toThrow(/AUTH_REQUIRED/);
    expect(
      await h.db.select().from(clip).where(eq(clip.id, Number(id)))
    ).toHaveLength(1);
  });
});

describe("AC8 — a legacy `@prototype`-owned clip rejects for any real contributor (correct, not a bug)", () => {
  it("rejects edit + delete of a seeded stub clip by a real signed-in contributor", async () => {
    await seedDatabase(h.db);
    const seeded = await h.db.select().from(clip);
    expect(seeded.length).toBeGreaterThan(0);
    const stubClip = seeded[0]; // owned by the @prototype stub, no real owner
    const stubId = String(stubClip.id);

    // A real contributor signs in — their id never equals the stub's, so the gate fails.
    await signInAs("RealUser", "sub-real");
    await expect(
      updateClipAction(stubId, { contextNote: "trying to edit a stub clip" }, true)
    ).rejects.toThrow(/Not your clip/);
    await expect(deleteClipAction(stubId)).rejects.toThrow(/Not your clip/);

    // The stub clip is untouched + still present.
    const after = (await h.db.select().from(clip).where(eq(clip.id, stubClip.id)))[0];
    expect(after.contextNote).toBe(stubClip.contextNote);
    expect(after).toBeTruthy();
  });
});

describe("AC9 — a MATERIAL note-text edit re-stamps the CC BY-SA agreement", () => {
  it("re-stamps noteLicense + a fresh noteLicenseAgreedAt when the normalized note text changes", async () => {
    const id = await seedOwnedClip();
    const original = (
      await h.db.select().from(clip).where(eq(clip.id, Number(id)))
    )[0];
    const originalAgreedAt = original.noteLicenseAgreedAt!.getTime();
    expect(original.noteLicense).toBe(NOTE_LICENSE);
    // Ensure the new timestamp is strictly later.
    await new Promise((r) => setTimeout(r, 5));

    const before = Date.now();
    await updateClipAction(
      id,
      { contextNote: "A materially different, rewritten note." },
      true // the client signalled consent (the agreement was revealed + checked)
    );

    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row.noteLicense).toBe(NOTE_LICENSE);
    expect(row.noteLicenseAgreedAt).toBeTruthy();
    expect(row.noteLicenseAgreedAt!.getTime()).toBeGreaterThan(originalAgreedAt);
    expect(row.noteLicenseAgreedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("does NOT re-stamp on a material change when the client did NOT signal consent (belt-and-suspenders)", async () => {
    const id = await seedOwnedClip();
    const original = (
      await h.db.select().from(clip).where(eq(clip.id, Number(id)))
    )[0];
    const originalAgreedAt = original.noteLicenseAgreedAt!.getTime();

    // Material note change but agreed=false → the server refuses to stamp (no silent re-stamp).
    await updateClipAction(
      id,
      { contextNote: "Rewritten without checking the box." },
      false
    );
    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row.noteLicenseAgreedAt!.getTime()).toBe(originalAgreedAt); // untouched
  });
});

describe("AC10 — a chip/section-only or whitespace-only edit does NOT re-stamp the agreement", () => {
  it("a stance/accuracy/section-only edit leaves noteLicense + noteLicenseAgreedAt untouched", async () => {
    const id = await seedOwnedClip();
    const original = (
      await h.db.select().from(clip).where(eq(clip.id, Number(id)))
    )[0];
    const originalAgreedAt = original.noteLicenseAgreedAt!.getTime();
    await new Promise((r) => setTimeout(r, 5));

    // No contextNote in the patch — only chips + section change.
    await updateClipAction(
      id,
      { stance: "opinion", accuracyFlag: "opinion", general: true },
      true // even if the client signals consent, no note change → no re-stamp
    );

    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row.stance).toBe("opinion"); // the chip change took
    expect(row.noteLicense).toBe(NOTE_LICENSE);
    expect(row.noteLicenseAgreedAt!.getTime()).toBe(originalAgreedAt); // NOT re-stamped
  });

  it("a WHITESPACE-only note change (normalized text identical) does NOT re-stamp", async () => {
    const id = await seedOwnedClip();
    const original = (
      await h.db.select().from(clip).where(eq(clip.id, Number(id)))
    )[0];
    const originalAgreedAt = original.noteLicenseAgreedAt!.getTime();
    await new Promise((r) => setTimeout(r, 5));

    // Same text, only internal whitespace collapsed differently + trailing space → normalizes
    // to the same string → NOT material (Decision 3).
    await updateClipAction(
      id,
      {
        contextNote:
          "  Original note:   clear walk-through;  one dated figure.  ",
      },
      true
    );
    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row.noteLicenseAgreedAt!.getTime()).toBe(originalAgreedAt); // untouched (AC10)
  });
});
