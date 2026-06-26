// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { topic, clip as clipTable } from "@/lib/db/schema";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { seedClips } from "@/lib/data/seed";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// ── Hero video — INDEPENDENT QA adversarial probes (issue #158). ────────────────────────────────
// Fresh-eyes coverage of gaps the author's suites do not assert, to try to break the gate / the
// at-most-one invariant / the eligibility boundary / the dangling-reference handling.
//   - AC12 (soft-removal arm): a MODERATOR removeClip (a tombstone, NOT a row delete) does not fire
//     ON DELETE SET NULL — so the stored pointer survives. The display must still resolve to NO clip
//     (the read excludes removed clips) and a re-hero of a removed clip must be REJECTED.
//   - §3.2: a HELD clip IS heroable (allowed), and stays in the hero slot with its held marking.
//   - Forged-boundary eligibility: a removed clip, a fractional/garbage clip id.
//   - The clear-when-none no-op is harmless.

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
import { setTopicHeroAction } from "@/lib/server/actions";

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

describe("hero — AC12 moderator soft-removal (the dangling-reference probe)", () => {
  it("a moderator-removed hero leaves the read with NO visible hero (resolves to no clip)", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const a = await addGeneral(store, "Q11982", "a");
    const mod = await findOrCreateContributor(
      { subject: "mod", username: "Mod", email: null },
      h.db
    );
    await store.setTopicHero("Q11982", a);

    // Soft-remove the hero clip (sets removed_at; the row PERSISTS as the audit trail).
    await store.removeClip(a, mod.contributorId, "policy");

    // The clip no longer lists, so the host derivation (find over listClips) yields no hero block.
    const visible = await store.listClips("Q11982");
    expect(visible.find((c) => c.id === a)).toBeUndefined();
  });

  it("DOCUMENTED behavior: ON DELETE SET NULL does NOT fire on a soft-remove — the stored pointer survives", async () => {
    // This is acceptable per spec AC12 (the '/ resolves to no clip' arm), but worth pinning: a
    // soft-removed hero is invisible in the read yet topic.hero_clip_id still references the dead row.
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const a = await addGeneral(store, "Q11982", "a");
    const mod = await findOrCreateContributor(
      { subject: "mod2", username: "Mod2", email: null },
      h.db
    );
    await store.setTopicHero("Q11982", a);
    await store.removeClip(a, mod.contributorId, "policy");

    const rows = await h.db
      .select()
      .from(topic)
      .where(eq(topic.wikidataQid, "Q11982"));
    // The pointer is NOT cleared by a soft-remove (only a hard delete fires SET NULL).
    expect(String(rows[0]?.heroClipId)).toBe(a);
  });

  it("a removed clip CANNOT be re-heroed (eligibility filters removed_at IS NULL)", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const a = await addGeneral(store, "Q11982", "a");
    const mod = await findOrCreateContributor(
      { subject: "mod3", username: "Mod3", email: null },
      h.db
    );
    await store.removeClip(a, mod.contributorId, "policy");
    await expect(store.setTopicHero("Q11982", a)).rejects.toThrow(/not found/i);
  });
});

describe("hero — §3.2 a held clip is heroable", () => {
  it("a held (unvetted, not removed) general clip can be the hero", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const a = await addGeneral(store, "Q11982", "a");
    await store.setClipVetted(a, false); // held
    const marked = await store.setTopicHero("Q11982", a);
    expect(marked.heroClipId).toBe(a);
  });
});

describe("hero — forged-boundary eligibility & coercion probes", () => {
  it("rejects a fractional clip id (Number.isInteger guard)", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    await expect(store.setTopicHero("Q11982", "1.5")).rejects.toThrow(/invalid/i);
  });

  it("rejects a non-numeric clip id", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    await expect(store.setTopicHero("Q11982", "abc")).rejects.toThrow(/invalid/i);
  });

  it("a forged boundary call with no session cannot hero an eligible clip (gate-first, AC4)", async () => {
    await signInAs("Setup", "seed");
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const a = await addGeneral(store, "Q11982", "a");
    currentSession = null; // logged out

    await expect(setTopicHeroAction("Q11982", a)).rejects.toThrow(/AUTH_REQUIRED/);
    const rows = await h.db
      .select()
      .from(topic)
      .where(eq(topic.wikidataQid, "Q11982"));
    expect(rows[0]?.heroClipId).toBeNull();
  });

  it("clearing when no hero is set is a harmless no-op", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const t = await store.setTopicHero("Q11982", null);
    expect(t.heroClipId).toBeUndefined();
  });

  it("no window with two heroes: only one topic row ever carries a hero (AC3 atomicity)", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    const a = await addGeneral(store, "Q11982", "a");
    const b = await addGeneral(store, "Q11982", "b");
    await store.setTopicHero("Q11982", a);
    await store.setTopicHero("Q11982", b);
    // The column is a single value — by construction at most one. Assert structurally.
    const rows = await h.db.select().from(topic);
    const withHero = rows.filter((r) => r.heroClipId != null);
    expect(withHero).toHaveLength(1);
    expect(String(withHero[0]?.heroClipId)).toBe(b);
    // And the non-hero clip a is untouched / still live.
    const clips = await h.db.select().from(clipTable).where(eq(clipTable.id, Number(a)));
    expect(clips[0]?.removedAt).toBeNull();
  });
});
