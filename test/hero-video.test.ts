// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { topic, writeEvent } from "@/lib/db/schema";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { seedClips } from "@/lib/data/seed";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// ── Hero video — the data-layer + boundary half (issue #158, Product spec §5). ──────────────────
//   - AC1/AC2: a curator can set and clear the hero (the store persists `hero_clip_id`).
//   - AC3:     AT MOST ONE — marking a second clip the hero leaves only the second (one atomic
//              UPDATE replaces the prior; no window with two heroes).
//   - AC4:     a LOGGED-OUT caller cannot set or clear it — the Server Action rejects server-side.
//   - AC5:     durable in shared Postgres — a SECOND store instance reads the same hero.
//   - AC10/11: ELIGIBILITY — a section-anchored clip is rejected server-side; a clip from another
//              topic is rejected; an unknown id (a candidate is not a clip row) is rejected.
//   - AC12:    deleting the hero clip clears the reference (FK ON DELETE SET NULL — no dangling hero).
// Mirrors test/topic-complete.test.ts: pglite DB via a mocked getDb, a controllable session.

let currentDb: Db;
let currentSession:
  | { user: { contributorId?: number; username?: string } }
  | null = null;

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDb: () => currentDb };
});

vi.mock("@/lib/auth/config", () => ({
  auth: async () => currentSession,
}));

import { DrizzleDataStore } from "@/lib/db/drizzle-store";
import { setTopicHeroAction, upsertTopicAction } from "@/lib/server/actions";

let h: TestDb;

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

const clip0 = () => seedClips[0] as Omit<Clip, "id" | "createdAt">;

/** Add a general clip to a topic and return its id. */
async function addGeneral(
  store: DrizzleDataStore,
  qid: string,
  caption: string
): Promise<string> {
  const c = await store.addClip({
    ...clip0(),
    topicQid: qid,
    caption,
    general: true,
    sectionSlug: undefined,
    sectionLabel: undefined,
    watchUrl: `https://www.youtube.com/watch?v=${caption}`,
  });
  return c.id;
}

describe("DrizzleDataStore.setTopicHero", () => {
  it("defaults to no hero, then sets and clears it (AC1/AC2)", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const a = await addGeneral(store, "Q11982", "a");

    expect((await store.getTopic("Q11982"))?.heroClipId).toBeUndefined();

    const marked = await store.setTopicHero("Q11982", a);
    expect(marked.heroClipId).toBe(a);
    expect((await store.getTopic("Q11982"))?.heroClipId).toBe(a);

    const cleared = await store.setTopicHero("Q11982", null);
    expect(cleared.heroClipId).toBeUndefined();
    expect((await store.getTopic("Q11982"))?.heroClipId).toBeUndefined();
  });

  it("AC3 — at most one hero: marking a second clip replaces the first", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const a = await addGeneral(store, "Q11982", "a");
    const b = await addGeneral(store, "Q11982", "b");

    await store.setTopicHero("Q11982", a);
    const after = await store.setTopicHero("Q11982", b);
    expect(after.heroClipId).toBe(b);
    expect(after.heroClipId).not.toBe(a);
    // Exactly one topic row carries a hero, and it is b.
    expect((await store.getTopic("Q11982"))?.heroClipId).toBe(b);
  });

  it("AC11 — rejects a section-anchored clip (hero must be general)", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const section = await store.addClip({
      ...clip0(),
      topicQid: "Q11982",
      caption: "anchored",
      general: false,
      sectionSlug: "light-reactions",
      sectionLabel: "Light reactions",
    });
    await expect(store.setTopicHero("Q11982", section.id)).rejects.toThrow(
      /section-anchored|general/i
    );
    expect((await store.getTopic("Q11982"))?.heroClipId).toBeUndefined();
  });

  it("rejects a clip belonging to a different topic", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    await store.upsertTopic({ qid: "Q146", title: "Cat" });
    const other = await addGeneral(store, "Q146", "x");
    await expect(store.setTopicHero("Q11982", other)).rejects.toThrow(
      /does not belong/i
    );
  });

  it("rejects an unknown clip id (a candidate is not a clip row — AC10 at the data layer)", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    await expect(store.setTopicHero("Q11982", "999999")).rejects.toThrow(
      /not found/i
    );
  });

  it("AC5 — durable: a second store instance over the same DB reads the same hero", async () => {
    const writer = new DrizzleDataStore(h.db);
    await writer.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const a = await addGeneral(writer, "Q11982", "a");
    await writer.setTopicHero("Q11982", a);

    const reader = new DrizzleDataStore(h.db);
    expect((await reader.getTopic("Q11982"))?.heroClipId).toBe(a);
  });

  it("AC12 — deleting the hero clip clears the reference (ON DELETE SET NULL)", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const a = await addGeneral(store, "Q11982", "a");
    await store.setTopicHero("Q11982", a);
    expect((await store.getTopic("Q11982"))?.heroClipId).toBe(a);

    await store.deleteClip(a);
    expect((await store.getTopic("Q11982"))?.heroClipId).toBeUndefined();
  });

  it("touches ONLY the hero reference — title/description unchanged", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q146", title: "Cat", description: "the species" });
    const a = await addGeneral(store, "Q146", "a");
    await store.setTopicHero("Q146", a);
    const t = await store.getTopic("Q146");
    expect(t?.title).toBe("Cat");
    expect(t?.description).toBe("the species");
  });
});

describe("setTopicHeroAction (the curator-gated boundary)", () => {
  let clipId: string;
  beforeEach(async () => {
    await signInAs("Setup", "seed-subject");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    clipId = await addGeneral(new DrizzleDataStore(h.db), "Q11982", "a");
    currentSession = null; // logged out for the AC4 assertions
  });

  it("AC4 — rejects a logged-out caller and leaves the hero unchanged", async () => {
    await expect(setTopicHeroAction("Q11982", clipId)).rejects.toThrow(
      /AUTH_REQUIRED/
    );
    const rows = await h.db
      .select()
      .from(topic)
      .where(eq(topic.wikidataQid, "Q11982"));
    expect(rows[0]?.heroClipId).toBeNull();
  });

  it("AC1 — a signed-in curator can mark a hero; it persists", async () => {
    await signInAs("Curator", "curator-subject");
    const result = await setTopicHeroAction("Q11982", clipId);
    expect(result.heroClipId).toBe(clipId);
    const rows = await h.db
      .select()
      .from(topic)
      .where(eq(topic.wikidataQid, "Q11982"));
    expect(String(rows[0]?.heroClipId)).toBe(clipId);
  });

  it("AC2 — any signed-in curator can clear it (no ownership lock)", async () => {
    await signInAs("CuratorOne", "one-subject");
    await setTopicHeroAction("Q11982", clipId);
    await signInAs("CuratorTwo", "two-subject");
    const result = await setTopicHeroAction("Q11982", null);
    expect(result.heroClipId).toBeUndefined();
  });

  it("records a counted write_event (kind 'hero') so the write is rate-limit-budgeted", async () => {
    await signInAs("Curator", "curator-subject");
    await setTopicHeroAction("Q11982", clipId);
    const events = await h.db
      .select()
      .from(writeEvent)
      .where(eq(writeEvent.kind, "hero"));
    expect(events.length).toBe(1);
  });
});
