// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { account, clip, contributor } from "@/lib/db/schema";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { seedDatabase } from "@/lib/db/seed";
import { STUB_HANDLE } from "@/lib/curation/curator-attribution";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// ── D3: contributor profiles + public "context by <curator>" attribution (issue #54). ────────
// Drives the REAL `lib/server/actions.ts` boundary (the #45/C/D1/D2 pattern): DB is pglite, the
// SESSION is stubbed for the signed-in/owner cases, `getDb` is mocked to the per-test handle.
// Covers the ACs the spec marks load-bearing:
//   - AC1: `listClipsByContributor` returns exactly a contributor's clips, with topic context,
//          and excludes others'.
//   - AC2/AC3: `getContributorByUsername` resolves a known username to a public-safe projection
//          WITHOUT `email`, and returns null for an unknown username.
//   - AC4: the `@prototype` stub does NOT resolve to a browsable profile.
//   - AC7/AC8: an owner can edit AND delete a GENERAL-FILED clip; a non-owner / anonymous edit or
//          delete of a General-filed clip is rejected and writes nothing (the security re-test).

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
  getContributorByUsernameAction,
  listClipsByContributorAction,
  updateClipAction,
  upsertTopicAction,
} from "@/lib/server/actions";

let h: TestDb;

function baseClip(
  overrides: Partial<Omit<Clip, "id" | "createdAt">> = {}
): Omit<Clip, "id" | "createdAt"> {
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
    accuracyFlag: "accurate_with_caveat",
    ...overrides,
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

/** Sign in as a contributor (find-or-create), optionally with a granted email. */
async function signInAs(
  username: string,
  subject: string,
  email: string | null = null
) {
  const resolved = await findOrCreateContributor(
    { subject, username, email },
    h.db
  );
  currentSession = {
    user: { contributorId: resolved.contributorId, username: resolved.handle },
  };
  return resolved;
}

describe("AC1 — listClipsByContributor returns exactly a contributor's clips, with topic context", () => {
  it("scopes to the contributor's curatorId, carries the topic title + QID, newest-first, and excludes others'", async () => {
    // Owner curates two clips on Photosynthesis (one section, one General).
    const owner = await signInAs("Owner", "sub-owner");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    await addClipAction(baseClip({ caption: "older section clip" }), true);
    await new Promise((r) => setTimeout(r, 5)); // ensure distinct createdAt ordering
    await addClipAction(
      baseClip({ caption: "newer general clip", general: true, sectionSlug: undefined }),
      true
    );

    // A DIFFERENT contributor curates a clip on the SAME topic — must be excluded.
    await signInAs("Other", "sub-other");
    await addClipAction(baseClip({ caption: "other's clip" }), true);

    const list = await listClipsByContributorAction(owner.contributorId);
    expect(list).toHaveLength(2);
    // Newest-first.
    expect(list[0].caption).toBe("newer general clip");
    expect(list[1].caption).toBe("older section clip");
    // Every row is the owner's; none is the other contributor's.
    expect(list.every((c) => c.curatorId === owner.contributorId)).toBe(true);
    expect(list.some((c) => c.caption === "other's clip")).toBe(false);
    // Topic context for the "On <Topic>" link rides along.
    expect(list[0].topicTitle).toBe("Photosynthesis");
    expect(list[0].topicQid).toBe("Q11982");
  });

  it("returns an empty list for a real contributor with zero curated clips (the empty profile)", async () => {
    const lonely = await signInAs("Lonely", "sub-lonely");
    // Sign in alone resolves a contributor row but curates nothing.
    expect(await listClipsByContributorAction(lonely.contributorId)).toEqual([]);
  });
});

describe("AC2/AC3 — getContributorByUsername is public-safe (never email) and null for unknown", () => {
  it("resolves a known username to id/username/avatar ONLY — no email, no non-public field", async () => {
    // The login granted an email; it lives on `account`, never on the public projection.
    await signInAs("Marcus", "sub-marcus", "marcus@example.com");
    // Sanity: the email IS stored on the account row (so the assertion below is meaningful).
    const acct = await h.db
      .select()
      .from(account)
      .where(eq(account.providerAccountId, "sub-marcus"));
    expect(acct[0].email).toBe("marcus@example.com");

    const pub = await getContributorByUsernameAction("Marcus");
    expect(pub).not.toBeNull();
    expect(pub!.username).toBe("Marcus");
    expect(typeof pub!.id).toBe("number");
    // The privacy boundary (AC2): no `email` (or any non-public field) on the projection.
    expect(Object.keys(pub!).sort()).toEqual(["avatarUrl", "id", "username"]);
    expect(JSON.stringify(pub)).not.toContain("marcus@example.com");
    expect(JSON.stringify(pub)).not.toMatch(/email/i);
  });

  it("returns null for a username that matches no contributor (drives the not-found state)", async () => {
    expect(await getContributorByUsernameAction("NoSuchUser")).toBeNull();
  });

  it("resolves a NON-UNIQUE handle to a single identity deterministically (lowest contributor.id)", async () => {
    // Two DISTINCT Wikimedia subjects present the SAME username string (issue C reality).
    const first = await signInAs("Twin", "sub-twin-1");
    const second = await signInAs("Twin", "sub-twin-2");
    expect(first.contributorId).not.toBe(second.contributorId);

    const pub = await getContributorByUsernameAction("Twin");
    // Deterministic: the lowest/earliest contributor.id wins (Decision 1).
    expect(pub!.id).toBe(Math.min(first.contributorId, second.contributorId));
  });
});

describe("AC4 — the @prototype stub has no browsable public profile", () => {
  it("getContributorByUsername(@prototype) is null even though the seeded stub contributor exists", async () => {
    await seedDatabase(h.db);
    // The seed creates the @prototype stub contributor.
    const stub = await h.db
      .select()
      .from(contributor)
      .where(eq(contributor.handle, STUB_HANDLE));
    expect(stub.length).toBeGreaterThan(0);
    // ...but it never resolves to a browsable profile (Decision 4 / AC4).
    expect(await getContributorByUsernameAction(STUB_HANDLE)).toBeNull();
  });

  it("a real contributor who somehow shared the stub string would never resolve the stub", async () => {
    // Defensive: the lookup excludes the stub handle, so a stub row can't be the resolved id.
    await seedDatabase(h.db);
    expect(await getContributorByUsernameAction(STUB_HANDLE)).toBeNull();
  });
});

describe("AC7/AC8 — owner edit/delete reaches GENERAL-filed clips; non-owner/anon is rejected", () => {
  /** Sign in as Owner, upsert the topic, add a GENERAL-filed clip → its id (the D2-gap surface). */
  async function seedOwnedGeneralClip(): Promise<string> {
    await signInAs("Owner", "sub-owner");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    const added = await addClipAction(
      baseClip({ general: true, sectionSlug: undefined, sectionLabel: undefined }),
      true
    );
    return added.id;
  }

  it("AC7 — an owner can EDIT a General-filed clip (the action is section-agnostic)", async () => {
    const id = await seedOwnedGeneralClip();
    const updated = await updateClipAction(
      id,
      { contextNote: "Edited my general clip." },
      true
    );
    expect(updated.general).toBe(true);
    expect(updated.contextNote).toBe("Edited my general clip.");
    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row.contextNote).toBe("Edited my general clip.");
  });

  it("AC7 — an owner can DELETE a General-filed clip", async () => {
    const id = await seedOwnedGeneralClip();
    await deleteClipAction(id);
    expect(
      await h.db.select().from(clip).where(eq(clip.id, Number(id)))
    ).toHaveLength(0);
  });

  it("AC8 — a NON-OWNER edit/delete of a General-filed clip is rejected and writes nothing", async () => {
    const id = await seedOwnedGeneralClip();
    await signInAs("Mallory", "sub-mallory");
    await expect(
      updateClipAction(id, { contextNote: "not my general clip" }, true)
    ).rejects.toThrow(/Not your clip/);
    await expect(deleteClipAction(id)).rejects.toThrow(/Not your clip/);
    // Untouched + still present.
    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row).toBeTruthy();
    expect(row.contextNote).toBe(
      "Original note: clear walk-through; one dated figure."
    );
  });

  it("AC8 — an ANONYMOUS edit/delete of a General-filed clip is rejected and writes nothing", async () => {
    const id = await seedOwnedGeneralClip();
    currentSession = null; // logged out
    await expect(
      updateClipAction(id, { contextNote: "anon general edit" }, true)
    ).rejects.toThrow(/AUTH_REQUIRED/);
    await expect(deleteClipAction(id)).rejects.toThrow(/AUTH_REQUIRED/);
    const row = (await h.db.select().from(clip).where(eq(clip.id, Number(id))))[0];
    expect(row).toBeTruthy();
    expect(row.contextNote).toBe(
      "Original note: clear walk-through; one dated figure."
    );
  });
});
