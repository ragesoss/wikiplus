// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { clip, topic } from "@/lib/db/schema";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { seedDatabase } from "@/lib/db/seed";
import { NOTE_LICENSE } from "@/lib/curation/note-license";
import { identityKey, videoIdOf } from "@/lib/candidates/dismissals";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// ── D1 persistence + CC BY-SA note-license agreement capture (issue #52). ───────────────────
// Drives the REAL `lib/server/actions.ts` boundary (the same #45/C pattern): the DB is pglite,
// the SESSION is stubbed (no live Wikimedia round-trip), `getDb` is mocked to the per-test
// handle. Covers: a signed-in promote/add writes a clip with the right fields + boundary
// attribution (AC1/AC4); the note-license agreement is persisted on a D1 clip and ABSENT on a
// non-agreed / seed path (AC7); an unauthenticated add/upsert writes nothing + rejects (AC9);
// a promoted candidate's `platform:videoId` no longer matches the live-suggestion set (AC3).

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

import { addClipAction, upsertTopicAction } from "@/lib/server/actions";

let h: TestDb;

function baseClip(): Omit<Clip, "id" | "createdAt"> {
  return {
    topicQid: "Q11982",
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "vertical",
    watchUrl: "https://youtu.be/promoteid",
    embedUrl: "https://www.youtube-nocookie.com/embed/promoteid",
    caption: "A promoted candidate",
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

describe("AC1 — a signed-in promote persists a clip with the right fields + boundary attribution", () => {
  it("writes one clip from the candidate-derived fields, attributed to the signed-in contributor", async () => {
    const me = await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });

    const added = await addClipAction(baseClip(), true);

    // Returned shape carries the curate values + boundary attribution.
    expect(added.contextNote).toBe("Clear walk-through; one dated figure.");
    expect(added.stance).toBe("explainer");
    expect(added.accuracyFlag).toBe("accurate_with_caveat");
    expect(added.sectionSlug).toBe("light-reactions");
    expect(added.curatedBy).toBe("Marcus");

    const rows = await h.db.select().from(clip).where(eq(clip.id, Number(added.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0].curatorId).toBe(me.contributorId);
    expect(rows[0].curatedBy).toBe("Marcus");
    expect(rows[0].contextNote).toBe("Clear walk-through; one dated figure.");
  });
});

describe("AC4 — a signed-in add-by-link persists (upsert-then-add), attributed", () => {
  it("upserts the topic then writes the clip from the parsed link", async () => {
    await signInAs("Marcus", "sub-marcus");
    // Topic not yet present → the add flow upserts it first (the client does this).
    await upsertTopicAction({ qid: "Q42", title: "Foobar" });
    const linkClip: Omit<Clip, "id" | "createdAt"> = {
      ...baseClip(),
      topicQid: "Q42",
      watchUrl: "https://youtu.be/addedbylink",
      embedUrl: "https://www.youtube-nocookie.com/embed/addedbylink",
      caption: "Pasted clip (mock preview)",
      general: true,
      sectionSlug: undefined,
      sectionLabel: undefined,
    };
    const added = await addClipAction(linkClip, true);
    expect(added.curatedBy).toBe("Marcus");
    expect(added.watchUrl).toBe("https://youtu.be/addedbylink");

    const topics = await h.db.select().from(topic).where(eq(topic.wikidataQid, "Q42"));
    expect(topics).toHaveLength(1);
    const rows = await h.db.select().from(clip).where(eq(clip.id, Number(added.id)));
    expect(rows[0].general).toBe(true);
  });
});

describe("AC7 — the note-license agreement is captured, not just displayed", () => {
  it("persists license version + timestamp on a D1 clip when the curator agreed", async () => {
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });

    const before = Date.now();
    const added = await addClipAction(baseClip(), true);
    const after = Date.now();

    const rows = await h.db.select().from(clip).where(eq(clip.id, Number(added.id)));
    expect(rows[0].noteLicense).toBe(NOTE_LICENSE); // "CC-BY-SA-4.0" (version string, not a bool)
    expect(rows[0].noteLicenseAgreedAt).toBeTruthy();
    const ts = rows[0].noteLicenseAgreedAt!.getTime();
    // The timestamp is server-stamped at write time (within the call window).
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
    expect(ts).toBeLessThanOrEqual(after + 1000);

    // The returned domain shape also surfaces the capture (read-side, for QA).
    expect(added.noteLicense).toBe(NOTE_LICENSE);
    expect(added.noteLicenseAgreedAt).toBeTruthy();
  });

  it("records NO license when the client did not signal agreement (the non-agreed path)", async () => {
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    // noteLicenseAgreed omitted/false → no license recorded.
    const added = await addClipAction(baseClip(), false);
    const rows = await h.db.select().from(clip).where(eq(clip.id, Number(added.id)));
    expect(rows[0].noteLicense).toBeNull();
    expect(rows[0].noteLicenseAgreedAt).toBeNull();
  });

  it("a client-smuggled noteLicense/noteLicenseAgreedAt on the input is NOT trusted", async () => {
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    const spoof = {
      ...baseClip(),
      // A forged backdated agreement under a fake license — must never reach the row.
      noteLicense: "WTFPL",
      noteLicenseAgreedAt: "1999-01-01T00:00:00.000Z",
    } as Omit<Clip, "id" | "createdAt">;
    // Agreed=false: even with a smuggled license, no agreement → no license.
    const added = await addClipAction(spoof, false);
    const rows = await h.db.select().from(clip).where(eq(clip.id, Number(added.id)));
    expect(rows[0].noteLicense).toBeNull();
    expect(rows[0].noteLicenseAgreedAt).toBeNull();
  });

  it("a seed clip carries no captured agreement (distinguishable from a D1 clip — AC7)", async () => {
    await seedDatabase(h.db);
    const seeded = await h.db.select().from(clip);
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((c) => c.noteLicense === null)).toBe(true);
    expect(seeded.every((c) => c.noteLicenseAgreedAt === null)).toBe(true);
  });
});

describe("AC9 — unauthenticated writes reject and write nothing (the only gate before a write)", () => {
  beforeEach(async () => {
    await signInAs("Setup", "sub-setup");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    currentSession = null; // logged out for the assertions
  });

  it("rejects an unauthenticated addClipAction and writes no clip — even with agreed=true", async () => {
    await expect(addClipAction(baseClip(), true)).rejects.toThrow(/AUTH_REQUIRED/);
    const rows = await h.db.select().from(clip);
    expect(rows).toHaveLength(0);
  });

  it("rejects an unauthenticated upsertTopicAction (add-by-link's prerequisite) and writes no new topic", async () => {
    await expect(
      upsertTopicAction({ qid: "Q42", title: "Foobar" })
    ).rejects.toThrow(/AUTH_REQUIRED/);
    const topics = await h.db.select().from(topic);
    expect(topics.map((t) => t.wikidataQid)).toEqual(["Q11982"]);
  });
});

describe("AC3 — a promoted candidate's identity no longer matches the live-suggestion set", () => {
  it("the curated clip's platform:videoId equals the candidate's, so curatedVideoKeys dedups it", async () => {
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    const cand = baseClip(); // same media identity the candidate carried
    const added = await addClipAction(cand, true);

    // The promoted candidate and the resulting clip share the same provider-video identity,
    // which is what the live pipeline dedups on (curatedVideoKeys / persistedDismissed).
    const candId = videoIdOf(cand);
    const clipId = videoIdOf(added);
    expect(candId).toBe("promoteid");
    expect(clipId).toBe(candId);
    const key = identityKey(added.platform, clipId!);
    const curatedKeys = new Set([key]);
    // A live suggestion with that identity would be filtered out (no longer suggested).
    expect(curatedKeys.has(identityKey(cand.platform, candId!))).toBe(true);
  });
});
