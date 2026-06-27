// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  DrizzleDataStore,
  _resetStubContributorCache,
} from "@/lib/db/drizzle-store";
import { contributor, watchlist } from "@/lib/db/schema";
import { seedClips } from "@/lib/data/seed";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// Watchlist contract (issue #162) — the store AND the auth-gated boundary, against in-memory Postgres
// (pglite). It carries the per-user follow + the watchlist feed:
//   - the store: add/remove (idempotent), isWatching, and the watched-scoped feed that REUSES the
//     #160 keyset query (newest-first, cursor-paged, vouched-only) plus `watchedTopicCount`;
//   - the boundary: the three actions are auth-gated (anonymous rejected, no row), scoped per-viewer.
// Maps to the spec acceptance criteria (docs/specs/watchlist.md) — the AC ids are noted per test.

// ── Boundary harness (mirrors auth-boundary.test.ts): drive the REAL Server Actions with a mocked
//    `getDb` (→ the per-test pglite handle) and a controllable `auth()` session. ──
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

// Import the boundary AFTER the mocks are registered.
import {
  isWatchingAction,
  listWatchlistCurationsAction,
  setWatchAction,
} from "@/lib/server/actions";

let h: TestDb;
let store: DrizzleDataStore;

function clip0(): Omit<Clip, "id" | "createdAt"> {
  return seedClips[0] as Omit<Clip, "id" | "createdAt">;
}

/** Create a real contributor row and return its id (an explicit watcher for the store tests). */
async function makeContributor(handle: string): Promise<number> {
  const rows = await h.db
    .insert(contributor)
    .values({ handle, displayName: handle })
    .returning({ id: contributor.id });
  return rows[0].id;
}

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

beforeEach(async () => {
  _resetStubContributorCache();
  h = await makeTestDb();
  currentDb = h.db;
  currentSession = null;
  store = new DrizzleDataStore(h.db);
});
afterEach(async () => {
  await h.close();
  vi.restoreAllMocks();
});

describe("watchlist store — add / remove / isWatching (AC1/AC2/AC3)", () => {
  beforeEach(async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    await store.upsertTopic({ qid: "Q146", title: "Cat" });
  });

  it("adds a watch that persists; isWatching reads it back true (AC1)", async () => {
    const me = await makeContributor("Ada");
    expect(await store.isWatching("Q11982", me)).toBe(false);
    await store.addWatch("Q11982", me);
    expect(await store.isWatching("Q11982", me)).toBe(true);
  });

  it("removes a watch that persists; isWatching reads it back false (AC2)", async () => {
    const me = await makeContributor("Ada");
    await store.addWatch("Q11982", me);
    await store.removeWatch("Q11982", me);
    expect(await store.isWatching("Q11982", me)).toBe(false);
    // Removing a not-watched topic is an idempotent no-op (does not throw).
    await expect(store.removeWatch("Q146", me)).resolves.toBeUndefined();
  });

  it("re-watching is idempotent — one row, never a duplicate / error (AC3)", async () => {
    const me = await makeContributor("Ada");
    await store.addWatch("Q11982", me);
    await store.addWatch("Q11982", me); // again — must NOT throw or double
    const rows = await h.db
      .select()
      .from(watchlist)
      .where(eq(watchlist.contributorId, me));
    expect(rows).toHaveLength(1);
  });

  it("isWatching is per-viewer + per-topic: another viewer / topic reads false (AC11)", async () => {
    const me = await makeContributor("Ada");
    const other = await makeContributor("Bo");
    await store.addWatch("Q11982", me);
    expect(await store.isWatching("Q11982", other)).toBe(false); // not Bo's watch
    expect(await store.isWatching("Q146", me)).toBe(false); // not this topic
  });

  it("a watch against an unknown topic is a no-op; isWatching of an unknown topic is false", async () => {
    const me = await makeContributor("Ada");
    await expect(store.addWatch("Q-unknown", me)).resolves.toBeUndefined();
    expect(await store.isWatching("Q-unknown", me)).toBe(false);
  });
});

describe("watchlist feed — listWatchlistCurations (AC4/AC5/AC6/AC9/AC10/AC11)", () => {
  beforeEach(async () => {
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    await store.upsertTopic({ qid: "Q146", title: "Cat" });
  });

  it("returns ONLY curations on watched topics, newest first (AC4)", async () => {
    const me = await makeContributor("Ada");
    // Clips across two topics; watch only Q11982.
    const photo1 = await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "p1" });
    await store.addClip({ ...clip0(), topicQid: "Q146", caption: "c1" }); // un-watched topic
    const photo2 = await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "p2" });
    await store.addWatch("Q11982", me);

    const page = await store.listWatchlistCurations({ contributorId: me });
    // Only the watched topic's clips, newest first.
    expect(page.items.map((c) => c.id)).toEqual([photo2.id, photo1.id]);
    expect(page.items.every((c) => c.topicTitle === "Photosynthesis")).toBe(true);
    expect(page.watchedTopicCount).toBe(1);
    expect(page.nextCursor).toBeNull();
  });

  it("EXCLUDES held + removed clips on a watched topic (vouched-only parity, AC6)", async () => {
    const me = await makeContributor("Ada");
    const live = await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "live" });
    const held = await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "held" });
    const gone = await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "gone" });
    await store.setClipVetted(held.id, false); // held → excluded
    await store.removeClip(gone.id, me, null); // removed → excluded
    await store.addWatch("Q11982", me);

    const page = await store.listWatchlistCurations({ contributorId: me });
    expect(page.items.map((c) => c.id)).toEqual([live.id]);
  });

  it("pages by a STABLE cursor over the watched set — no dupes, no gaps (AC5)", async () => {
    const me = await makeContributor("Ada");
    const added = [];
    for (let i = 0; i < 5; i++) {
      added.push(
        await store.addClip({ ...clip0(), topicQid: "Q11982", caption: `p${i}` })
      );
    }
    // A clip on an un-watched topic must never appear (and never shift the watched paging).
    await store.addClip({ ...clip0(), topicQid: "Q146", caption: "noise" });
    await store.addWatch("Q11982", me);
    const expected = [...added].reverse().map((c) => c.id);

    const p1 = await store.listWatchlistCurations({ contributorId: me, limit: 2 });
    expect(p1.items.map((c) => c.id)).toEqual(expected.slice(0, 2));
    const p2 = await store.listWatchlistCurations({
      contributorId: me,
      cursor: p1.nextCursor,
      limit: 2,
    });
    const p3 = await store.listWatchlistCurations({
      contributorId: me,
      cursor: p2.nextCursor,
      limit: 2,
    });
    expect(p3.nextCursor).toBeNull();
    const all = [...p1.items, ...p2.items, ...p3.items].map((c) => c.id);
    expect(all).toEqual(expected);
    expect(new Set(all).size).toBe(all.length); // no dupes
  });

  it("empty — no topics watched → items [] + watchedTopicCount 0 (AC9)", async () => {
    const me = await makeContributor("Ada");
    await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "p1" }); // exists, just not watched
    const page = await store.listWatchlistCurations({ contributorId: me });
    expect(page.items).toEqual([]);
    expect(page.watchedTopicCount).toBe(0);
    expect(page.nextCursor).toBeNull();
  });

  it("empty — watching a topic with no vouched curations → items [] + watchedTopicCount > 0 (AC10)", async () => {
    const me = await makeContributor("Ada");
    await store.addWatch("Q146", me); // Cat has no clips
    const page = await store.listWatchlistCurations({ contributorId: me });
    expect(page.items).toEqual([]);
    expect(page.watchedTopicCount).toBe(1); // distinguishes "no curations" from "no topics"
  });

  it("is scoped per-viewer — one user's feed never returns another's watched set (AC11)", async () => {
    const ada = await makeContributor("Ada");
    const bo = await makeContributor("Bo");
    const photo = await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "p" });
    const cat = await store.addClip({ ...clip0(), topicQid: "Q146", caption: "c" });
    await store.addWatch("Q11982", ada);
    await store.addWatch("Q146", bo);

    const adaPage = await store.listWatchlistCurations({ contributorId: ada });
    const boPage = await store.listWatchlistCurations({ contributorId: bo });
    expect(adaPage.items.map((c) => c.id)).toEqual([photo.id]);
    expect(boPage.items.map((c) => c.id)).toEqual([cat.id]);
  });
});

describe("watchlist boundary — auth-gated (AC7/AC8/AC11)", () => {
  it("rejects an unauthenticated setWatchAction and writes NO watch row (AC8)", async () => {
    // A topic + contributor exist so a successful watch WOULD write — proving the gate blocks it.
    await signInAs("Setup", "seed");
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    currentSession = null; // logged out
    await expect(setWatchAction("Q11982", true)).rejects.toThrow(/AUTH_REQUIRED/);
    const rows = await h.db.select().from(watchlist);
    expect(rows).toHaveLength(0);
  });

  it("rejects an unauthenticated isWatchingAction + listWatchlistCurationsAction (AC7)", async () => {
    currentSession = null;
    await expect(isWatchingAction("Q11982")).rejects.toThrow(/AUTH_REQUIRED/);
    await expect(listWatchlistCurationsAction({})).rejects.toThrow(/AUTH_REQUIRED/);
  });

  it("an authenticated watch attributes the row to the signed-in contributor + the feed is scoped (AC11)", async () => {
    const me = await signInAs("Ragesoss", "123");
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const c = await store.addClip({ ...clip0(), topicQid: "Q11982", caption: "p" });

    await setWatchAction("Q11982", true);
    // The row is attributed to the resolved contributor.
    const rows = await h.db.select().from(watchlist);
    expect(rows).toHaveLength(1);
    expect(rows[0].contributorId).toBe(me.contributorId);
    // The per-viewer reads reflect it.
    expect(await isWatchingAction("Q11982")).toBe(true);
    const page = await listWatchlistCurationsAction({});
    expect(page.items.map((x) => x.id)).toEqual([c.id]);
    expect(page.watchedTopicCount).toBe(1);

    // Un-watch removes it.
    await setWatchAction("Q11982", false);
    expect(await isWatchingAction("Q11982")).toBe(false);
  });
});
