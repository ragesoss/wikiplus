// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, lt } from "drizzle-orm";
import {
  clip,
  clipVote,
  dismissedCandidate,
  topic,
  writeEvent,
} from "@/lib/db/schema";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { isAuthRequired, isRateLimited } from "@/lib/auth/auth-error";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// ── D5a: per-identity write rate-limit enforcement (issue #57). ───────────────────────────────
// Drives the REAL `lib/server/actions.ts` boundary (the #45/C/D1/D2/D3/D4 pattern): the DB is
// pglite, the SESSION is stubbed (no live Wikimedia round-trip — a live OAuth flood cannot run in
// CI; the limit is fully provable at the action with a stubbed contributor), and BOTH `getDb`
// usages (the store's and the limiter's) are mocked to the same per-test handle so the window
// COUNT and the write share one DB.
//
// The limit is N=`WRITE_RATE_LIMIT_MAX` writes per W=`WRITE_RATE_LIMIT_WINDOW_SECONDS` per
// `contributor.id`, defaults 60/60. These tests pin a SMALL cap (env override) so the (N+1)th is
// reachable without 60 writes, and pin a short window — the limiter reads both env vars lazily per
// call. The LOAD-BEARING test is AC2: the over-limit write is rejected AND writes nothing (no
// clip/topic/vote row), asserted at the action — not the UI hiding a click.

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

import {
  addClipAction,
  deleteClipAction,
  dismissedKeysAction,
  getTopicAction,
  listClipsAction,
  listTopicsAction,
  recordDismissalAction,
  toggleUpvoteAction,
  updateClipAction,
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

function clipRows() {
  return h.db.select().from(clip);
}
function topicRows() {
  return h.db.select().from(topic);
}
function voteRows() {
  return h.db.select().from(clipVote);
}
function dismissalRows() {
  return h.db.select().from(dismissedCandidate);
}
function eventRows(contributorId: number) {
  return h.db
    .select()
    .from(writeEvent)
    .where(eq(writeEvent.contributorId, contributorId));
}

beforeEach(async () => {
  _resetStubContributorCache();
  h = await makeTestDb();
  currentDb = h.db;
  currentSession = null;
  // A small, fast, deterministic window for these tests (the limiter reads env lazily per call).
  process.env.WRITE_RATE_LIMIT_MAX = "3";
  process.env.WRITE_RATE_LIMIT_WINDOW_SECONDS = "60";
});
afterEach(async () => {
  await h.close();
  delete process.env.WRITE_RATE_LIMIT_MAX;
  delete process.env.WRITE_RATE_LIMIT_WINDOW_SECONDS;
  vi.restoreAllMocks();
});

// ── AC1 — under-limit writes by a signed-in contributor pass unchanged. ───────────────────────
describe("AC1 — writes at/below the per-identity cap all succeed", () => {
  it("the upsert + every clip add up to the cap succeeds; the rows are written", async () => {
    // Cap = 3 shared writes. upsert (1) + 2 adds (2,3) = exactly 3 → all succeed.
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: QID, title: "Photosynthesis" });
    const a = await addClipAction(
      baseClip({ watchUrl: "https://youtu.be/a" }),
      true
    );
    const b = await addClipAction(
      baseClip({ watchUrl: "https://youtu.be/b" }),
      true
    );

    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(await clipRows()).toHaveLength(2);
    // Three counted events recorded (1 upsert + 2 adds) — all under the cap of 3.
    const me = currentSession!.user.contributorId!;
    expect(await eventRows(me)).toHaveLength(3);
  });

  it("the Nth upvote within the window succeeds (the cap is inclusive of N)", async () => {
    // Seed a clip cheaply with a HIGHER cap so the setup writes don't consume the test budget.
    process.env.WRITE_RATE_LIMIT_MAX = "100";
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: QID, title: "Photosynthesis" });
    const c = await addClipAction(baseClip(), true);

    // Now pin the cap to 3 and clear the ledger so the toggle budget is exactly 3.
    process.env.WRITE_RATE_LIMIT_MAX = "3";
    const me = currentSession!.user.contributorId!;
    await h.db.delete(writeEvent).where(eq(writeEvent.contributorId, me));

    // Three toggles within the window (on/off/on) — all at/below the cap → all succeed.
    await toggleUpvoteAction(c.id); // 1 (voted)
    await toggleUpvoteAction(c.id); // 2 (un-voted)
    const third = await toggleUpvoteAction(c.id); // 3 (voted)
    expect(third.voted).toBe(true);
    expect(await voteRows()).toHaveLength(1);
    expect(await eventRows(me)).toHaveLength(3);
  });
});

// ── AC2 — over-limit is rejected server-side AND writes nothing (the load-bearing integrity test).
describe("AC2 — the (N+1)th gated write is rejected and writes nothing", () => {
  it("an over-cap addClip throws RateLimitedError and inserts NO clip row", async () => {
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: QID, title: "Photosynthesis" }); // event 1 (upsert)
    await addClipAction(baseClip({ watchUrl: "https://youtu.be/a" }), true); // event 2
    await addClipAction(baseClip({ watchUrl: "https://youtu.be/b" }), true); // event 3 (at cap)

    expect(await clipRows()).toHaveLength(2);

    // The 4th counted write (cap = 3) is rejected BEFORE any persisting write.
    let thrown: unknown;
    try {
      await addClipAction(baseClip({ watchUrl: "https://youtu.be/c" }), true);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).name).toBe("RateLimitedError");
    // The clip table is UNCHANGED by the rejected call — nothing was written (the integrity AC).
    expect(await clipRows()).toHaveLength(2);
  });

  it("an over-cap upvote throws and inserts NO clip_vote row (no existing row mutated)", async () => {
    process.env.WRITE_RATE_LIMIT_MAX = "100";
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: QID, title: "Photosynthesis" });
    const c = await addClipAction(baseClip(), true);
    const me = currentSession!.user.contributorId!;

    // Exhaust the budget to exactly the cap with seeded events, then attempt one more upvote.
    process.env.WRITE_RATE_LIMIT_MAX = "3";
    await h.db.delete(writeEvent).where(eq(writeEvent.contributorId, me));
    await h.db.insert(writeEvent).values([
      { contributorId: me, kind: "upvote" },
      { contributorId: me, kind: "upvote" },
      { contributorId: me, kind: "upvote" },
    ]);

    await expect(toggleUpvoteAction(c.id)).rejects.toThrow(/RATE_LIMITED/);
    // No vote row was written by the rejected toggle.
    expect(await voteRows()).toHaveLength(0);
  });

  it("an over-cap upsertTopic throws and creates NO topic row", async () => {
    await signInAs("Marcus", "sub-marcus");
    const me = currentSession!.user.contributorId!;
    // Fill the budget to the cap with seeded events of any kind (one shared budget).
    await h.db.insert(writeEvent).values([
      { contributorId: me, kind: "add" },
      { contributorId: me, kind: "upvote" },
      { contributorId: me, kind: "dismiss" },
    ]);

    await expect(
      upsertTopicAction({ qid: "Q999999", title: "Brand new topic" })
    ).rejects.toThrow(/RATE_LIMITED/);
    // No topic with that QID exists — the rejected upsert wrote nothing.
    const topics = await topicRows();
    expect(topics.find((t) => t.wikidataQid === "Q999999")).toBeUndefined();
  });

  it("an over-cap dismiss throws and writes NO dismissed_candidate row", async () => {
    process.env.WRITE_RATE_LIMIT_MAX = "100";
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: QID, title: "Photosynthesis" });
    const me = currentSession!.user.contributorId!;

    process.env.WRITE_RATE_LIMIT_MAX = "3";
    await h.db.delete(writeEvent).where(eq(writeEvent.contributorId, me));
    await h.db.insert(writeEvent).values([
      { contributorId: me, kind: "dismiss" },
      { contributorId: me, kind: "dismiss" },
      { contributorId: me, kind: "dismiss" },
    ]);

    await expect(
      recordDismissalAction({ topicQid: QID, platform: "youtube", videoId: "vid1" })
    ).rejects.toThrow(/RATE_LIMITED/);
    expect(await dismissalRows()).toHaveLength(0);
  });

  it("an over-cap delete throws and removes NOTHING (the clip survives)", async () => {
    process.env.WRITE_RATE_LIMIT_MAX = "100";
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: QID, title: "Photosynthesis" });
    const c = await addClipAction(baseClip(), true);
    const me = currentSession!.user.contributorId!;

    process.env.WRITE_RATE_LIMIT_MAX = "3";
    await h.db.delete(writeEvent).where(eq(writeEvent.contributorId, me));
    await h.db.insert(writeEvent).values([
      { contributorId: me, kind: "delete" },
      { contributorId: me, kind: "delete" },
      { contributorId: me, kind: "delete" },
    ]);

    await expect(deleteClipAction(c.id)).rejects.toThrow(/RATE_LIMITED/);
    // The clip is still there — the over-cap delete removed nothing (and never reached the
    // ownership check, which would also have passed here).
    expect(await clipRows()).toHaveLength(1);
  });
});

// ── AC3 — the rejection is the DISTINCT rate-limit signal, not the auth gate, not generic. ────
describe("AC3 — the over-limit rejection is RateLimitedError, distinguishable from AuthRequiredError", () => {
  it("the thrown error is classified rate-limited, not auth-required", async () => {
    await signInAs("Marcus", "sub-marcus");
    const me = currentSession!.user.contributorId!;
    await h.db.insert(writeEvent).values([
      { contributorId: me, kind: "add" },
      { contributorId: me, kind: "add" },
      { contributorId: me, kind: "add" },
    ]);

    let thrown: unknown;
    try {
      await addClipAction(baseClip(), true);
    } catch (err) {
      thrown = err;
    }
    expect((thrown as Error).name).toBe("RateLimitedError");
    expect((thrown as { code?: string }).code).toBe("RATE_LIMITED");
    // The client-safe detectors classify it correctly and EXCLUSIVELY (AC3 distinctness).
    expect(isRateLimited(thrown)).toBe(true);
    expect(isAuthRequired(thrown)).toBe(false);
  });

  it("an ANONYMOUS over-the-(hypothetical)-limit call is auth-required, NOT rate-limited (gate runs first)", async () => {
    // The gate runs before the limit, so an anonymous caller is rejected as AUTH_REQUIRED and the
    // limiter never even sees it — the two signals are mutually exclusive and correctly ordered.
    currentSession = null;
    let thrown: unknown;
    try {
      await addClipAction(baseClip(), true);
    } catch (err) {
      thrown = err;
    }
    expect(isAuthRequired(thrown)).toBe(true);
    expect(isRateLimited(thrown)).toBe(false);
  });
});

// ── AC4 — the window resets; an aged-out budget lets the contributor write again. ─────────────
describe("AC4 — after the window passes the contributor can write again", () => {
  it("events older than W age out of the count, so the next write succeeds", async () => {
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: QID, title: "Photosynthesis" });
    const me = currentSession!.user.contributorId!;

    // Fill the budget to the cap, THEN backdate all of this identity's events to BEFORE the window
    // (W=60s → set them ~120s ago). The `created_at > now() - W` filter then ignores them.
    await h.db.delete(writeEvent).where(eq(writeEvent.contributorId, me));
    await h.db.insert(writeEvent).values([
      { contributorId: me, kind: "add" },
      { contributorId: me, kind: "add" },
      { contributorId: me, kind: "add" },
    ]);
    const old = new Date(Date.now() - 120_000);
    await h.db
      .update(writeEvent)
      .set({ createdAt: old })
      .where(eq(writeEvent.contributorId, me));

    // With the cap exhausted ONLY by aged-out rows, the next add succeeds (the window reset).
    const added = await addClipAction(
      baseClip({ watchUrl: "https://youtu.be/after" }),
      true
    );
    expect(added.id).toBeTruthy();
    expect(await clipRows()).toHaveLength(1);
  });

  it("a write WHILE the window is still full is rejected (the reset is real, not unconditional)", async () => {
    await signInAs("Marcus", "sub-marcus");
    const me = currentSession!.user.contributorId!;
    // Recent (in-window) events at the cap → rejected. (Contrast with the aged-out case above.)
    await h.db.insert(writeEvent).values([
      { contributorId: me, kind: "add" },
      { contributorId: me, kind: "add" },
      { contributorId: me, kind: "add" },
    ]);
    await expect(addClipAction(baseClip(), true)).rejects.toThrow(/RATE_LIMITED/);
    // Sanity: the events used for the window were genuinely IN-window (not aged out).
    const aged = await h.db
      .select()
      .from(writeEvent)
      .where(lt(writeEvent.createdAt, new Date(Date.now() - 60_000)));
    expect(aged).toHaveLength(0);
  });
});

// ── AC5 — the limit is PER-IDENTITY; one contributor at the cap does not block another. ───────
describe("AC5 — per-identity isolation: A at the cap does not block B", () => {
  it("contributor A is rejected while contributor B (distinct id) writes freely", async () => {
    // A is signed in and exhausts A's budget.
    const a = await signInAs("Marcus", "sub-marcus");
    await h.db.insert(writeEvent).values([
      { contributorId: a.contributorId, kind: "add" },
      { contributorId: a.contributorId, kind: "add" },
      { contributorId: a.contributorId, kind: "add" },
    ]);
    // A's next write is rejected.
    await expect(
      upsertTopicAction({ qid: QID, title: "Photosynthesis" })
    ).rejects.toThrow(/RATE_LIMITED/);

    // B signs in (a DIFFERENT contributor.id) with an empty budget → B's writes succeed.
    const b = await signInAs("Priya", "sub-priya");
    expect(b.contributorId).not.toBe(a.contributorId);
    const upserted = await upsertTopicAction({ qid: QID, title: "Photosynthesis" });
    expect(upserted.qid).toBe(QID);
    const clipB = await addClipAction(
      baseClip({ watchUrl: "https://youtu.be/forB" }),
      true
    );
    expect(clipB.id).toBeTruthy();
    expect(await clipRows()).toHaveLength(1);
    // B's window count is scoped to B — A's three events did not leak into B's budget.
    expect(await eventRows(b.contributorId)).toHaveLength(2); // 1 upsert + 1 add
  });
});

// ── AC6 — reads are never limited and never gated; they write no write_event. ─────────────────
describe("AC6 — reads are unlimited, ungated, and record NO write_event", () => {
  it("an anonymous reader loops reads with no rejection and no ledger row", async () => {
    // Seed a topic + clip as a signed-in curator, then read anonymously many times.
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: QID, title: "Photosynthesis" });
    await addClipAction(baseClip(), true);
    const me = currentSession!.user.contributorId!;
    const ledgerBefore = (await eventRows(me)).length;

    currentSession = null; // anonymous reader
    for (let i = 0; i < 25; i++) {
      await listTopicsAction();
      await getTopicAction(QID);
      await listClipsAction(QID);
      await dismissedKeysAction(QID);
    }
    // No rejection above; and the read loop added ZERO write_event rows (reads are uncounted).
    const allEvents = await h.db.select().from(writeEvent);
    expect(allEvents).toHaveLength(ledgerBefore);
  });

  it("reads never trip the limit even when the writer's budget is exhausted", async () => {
    await signInAs("Marcus", "sub-marcus");
    await upsertTopicAction({ qid: QID, title: "Photosynthesis" });
    await addClipAction(baseClip(), true);
    const me = currentSession!.user.contributorId!;
    // Exhaust the writer's budget far past the cap.
    await h.db.insert(writeEvent).values(
      Array.from({ length: 10 }, () => ({ contributorId: me, kind: "add" }))
    );
    // Reads still work for everyone — they call no limit check.
    expect((await listClipsAction(QID)).length).toBe(1);
    expect(await getTopicAction(QID)).not.toBeNull();
    expect(Array.isArray(await listTopicsAction())).toBe(true);
  });
});

// ── Defaults — the shipped N=60 / W=60s defaults apply with no env override (AC7/AC8). ────────
describe("defaults — without env overrides the cap is the shipped 60/60", () => {
  it("a 60th write succeeds and the 61st is rejected (the default cap)", async () => {
    delete process.env.WRITE_RATE_LIMIT_MAX;
    delete process.env.WRITE_RATE_LIMIT_WINDOW_SECONDS;
    await signInAs("Marcus", "sub-marcus");
    const me = currentSession!.user.contributorId!;
    // Seed 59 in-window events, then a real upsert is the 60th (succeeds), and an add is the 61st.
    await h.db.insert(writeEvent).values(
      Array.from({ length: 59 }, () => ({ contributorId: me, kind: "add" }))
    );
    const upserted = await upsertTopicAction({ qid: QID, title: "Photosynthesis" }); // 60th
    expect(upserted.qid).toBe(QID);
    await expect(addClipAction(baseClip(), true)).rejects.toThrow(/RATE_LIMITED/); // 61st
  });
});
