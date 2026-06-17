// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { account, clip, contributor, dismissedCandidate } from "@/lib/db/schema";
import { seedDatabase } from "@/lib/db/seed";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { seedClips } from "@/lib/data/seed";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// ── The auth-gated write boundary — AC7/AC8 (issue C). ────────────────────────────────────
// The security crux: a Server Action write with NO session is rejected server-side (no row
// written); a write WITH a session is attributed to the real signed-in contributor. The
// PROVIDER call is fully stubbed (no live Wikimedia round-trip — AC13) and the DB is pglite
// as in #45. We drive the REAL `lib/server/actions.ts` boundary with:
//   - `lib/db/client.getDb` mocked → the per-test pglite handle (so the action's store hits it),
//   - `lib/auth/config.auth` mocked → a controllable session (logged out / signed in).

// The pglite handle the mocked getDb returns; reassigned per test.
let currentDb: Db;
// The session the mocked auth() returns; null = logged out.
let currentSession: { user: { contributorId?: number; username?: string } } | null =
  null;

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDb: () => currentDb };
});

vi.mock("@/lib/auth/config", () => ({
  auth: async () => currentSession,
}));

// Import the boundary AFTER the mocks are registered.
import {
  addClipAction,
  recordDismissalAction,
  upsertTopicAction,
} from "@/lib/server/actions";

let h: TestDb;

function clip0(): Omit<Clip, "id" | "createdAt"> {
  return seedClips[0] as Omit<Clip, "id" | "createdAt">;
}

beforeEach(async () => {
  _resetStubContributorCache(); // each fresh pglite DB needs a clean memoized stub id
  h = await makeTestDb();
  currentDb = h.db;
  currentSession = null; // default: logged out
});
afterEach(async () => {
  await h.close();
  vi.restoreAllMocks();
});

// Sign in as a real contributor (the find-or-create the jwt callback would have run at login).
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

describe("AC7 — unauthenticated writes are rejected at the boundary (no row written)", () => {
  beforeEach(async () => {
    // A topic must exist so a successful add WOULD write — proving the gate (not a missing
    // topic) is what blocks the logged-out write.
    await signInAs("Setup", "seed-subject");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    currentSession = null; // back to logged out for the assertions below
  });

  it("rejects an unauthenticated addClipAction and writes no clip", async () => {
    await expect(
      addClipAction({ ...clip0(), topicQid: "Q11982" })
    ).rejects.toThrow(/AUTH_REQUIRED/);
    const clips = await h.db.select().from(clip);
    expect(clips).toHaveLength(0);
  });

  it("rejects an unauthenticated upsertTopicAction and writes no NEW topic", async () => {
    await expect(
      upsertTopicAction({ qid: "Q146", title: "Cat" })
    ).rejects.toThrow(/AUTH_REQUIRED/);
    const topics = await h.db.select().from(
      (await import("@/lib/db/schema")).topic
    );
    // Only the one created in setup (signed-in); the logged-out upsert added nothing.
    expect(topics.map((t) => t.wikidataQid)).toEqual(["Q11982"]);
  });

  it("rejects an unauthenticated recordDismissalAction and writes no dismissal row", async () => {
    await expect(
      recordDismissalAction({
        topicQid: "Q11982",
        platform: "youtube",
        videoId: "v1",
      })
    ).rejects.toThrow(/AUTH_REQUIRED/);
    const rows = await h.db.select().from(dismissedCandidate);
    expect(rows).toHaveLength(0);
  });
});

describe("AC6/AC8 — authenticated writes attribute to the REAL contributor (not @prototype)", () => {
  it("an authenticated addClip attributes curatorId + curatedBy to the signed-in contributor", async () => {
    const me = await signInAs("Ragesoss", "12345");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    const added = await addClipAction({ ...clip0(), topicQid: "Q11982" });

    // curatedBy reflects the Wikimedia username (AC6) — overriding any client-supplied value.
    expect(added.curatedBy).toBe("Ragesoss");

    const rows = await h.db
      .select()
      .from(clip)
      .where(eq(clip.id, Number(added.id)));
    expect(rows[0].curatorId).toBe(me.contributorId);
    expect(rows[0].curatedBy).toBe("Ragesoss");

    // It is NOT the @prototype stub.
    const stub = await h.db
      .select()
      .from(contributor)
      .where(eq(contributor.handle, "@prototype"));
    if (stub[0]) expect(rows[0].curatorId).not.toBe(stub[0].id);
  });

  it("a client-supplied curatedBy is OVERRIDDEN by the boundary (attribution is the server's call, AC6)", async () => {
    // Security/correctness: the client must not be able to forge the vouch's displayed name.
    // The boundary stamps `curatedBy` = the signed-in username and `curatorId` = the session
    // contributor regardless of what the caller passes — so a spoofed `curatedBy` is ignored.
    const me = await signInAs("Ragesoss", "12345");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    const added = await addClipAction({
      ...clip0(),
      topicQid: "Q11982",
      curatedBy: "@somebody_else", // attempted spoof — must NOT survive
    });
    expect(added.curatedBy).toBe("Ragesoss");
    const rows = await h.db
      .select()
      .from(clip)
      .where(eq(clip.id, Number(added.id)));
    expect(rows[0].curatedBy).toBe("Ragesoss");
    expect(rows[0].curatorId).toBe(me.contributorId);
  });

  it("an authenticated recordDismissal writes a row with the signed-in contributorId", async () => {
    const me = await signInAs("Ragesoss", "12345");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    await recordDismissalAction({
      topicQid: "Q11982",
      platform: "youtube",
      videoId: "v1",
    });
    const rows = await h.db.select().from(dismissedCandidate);
    expect(rows).toHaveLength(1);
    expect(rows[0].contributorId).toBe(me.contributorId);
  });
});

describe("AC9 — the seeded @prototype stub still exists (backs pre-C clips, D6)", () => {
  it("seeding keeps the stub contributor + its clips; C does not retro-rewrite them", async () => {
    await seedDatabase(h.db);
    const stub = await h.db
      .select()
      .from(contributor)
      .where(eq(contributor.handle, "@prototype"));
    expect(stub).toHaveLength(1);

    // The seeded clips remain attributed to the stub (no real person to reassign to — D6).
    const photo = await h.db.select().from(clip);
    expect(photo.length).toBeGreaterThan(0);
    expect(photo.every((c) => c.curatorId === stub[0].id)).toBe(true);

    // A login does NOT touch the stub's account-less identity (no @prototype account row).
    const stubAccounts = await h.db
      .select()
      .from(account)
      .where(eq(account.contributorId, stub[0].id));
    expect(stubAccounts).toHaveLength(0);
  });
});
