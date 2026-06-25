// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { topic, writeEvent } from "@/lib/db/schema";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// ── "Marked complete" / closed_to_suggestions — issue #159 (Product spec §5). ────────────────────
// The data-layer + boundary half of the feature:
//   - AC1/AC2: a curator can set and clear the flag (the store persists the boolean).
//   - AC3:     the flag is DURABLE in shared Postgres — a SECOND store instance over the SAME DB
//              (a fresh request / another session) reads the topic as complete.
//   - AC4:     a LOGGED-OUT caller cannot set or clear it — the Server Action rejects server-side
//              (the affordance gate is NOT the security control) and the stored value is unchanged.
// Mirrors test/auth-boundary.test.ts: pglite DB via a mocked getDb, a controllable session via a
// mocked auth(). The flag's PRESENTATION suppression is covered in test/topic-complete-view.test.tsx.

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

import { DrizzleDataStore } from "@/lib/db/drizzle-store";
import {
  setTopicClosedToSuggestionsAction,
  upsertTopicAction,
} from "@/lib/server/actions";

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

describe("DrizzleDataStore.setTopicClosedToSuggestions", () => {
  it("defaults to false on a freshly-upserted topic, then sets and clears it", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });

    // Default (AC2 baseline): the column default lands false.
    const initial = await store.getTopic("Q11982");
    expect(initial?.closedToSuggestions).toBe(false);

    // AC1 — mark complete.
    const marked = await store.setTopicClosedToSuggestions("Q11982", true);
    expect(marked.closedToSuggestions).toBe(true);
    expect((await store.getTopic("Q11982"))?.closedToSuggestions).toBe(true);

    // AC2 — un-mark, returns to false.
    const reopened = await store.setTopicClosedToSuggestions("Q11982", false);
    expect(reopened.closedToSuggestions).toBe(false);
    expect((await store.getTopic("Q11982"))?.closedToSuggestions).toBe(false);
  });

  it("touches ONLY the flag — title/description are unchanged", async () => {
    const store = new DrizzleDataStore(h.db);
    await store.upsertTopic({
      qid: "Q146",
      title: "Cat",
      description: "the species",
    });
    await store.setTopicClosedToSuggestions("Q146", true);
    const t = await store.getTopic("Q146");
    expect(t?.title).toBe("Cat");
    expect(t?.description).toBe("the species");
    expect(t?.closedToSuggestions).toBe(true);
  });

  it("throws for an unknown topic (the topic must already exist)", async () => {
    const store = new DrizzleDataStore(h.db);
    await expect(
      store.setTopicClosedToSuggestions("Q-nope", true)
    ).rejects.toThrow(/not found/);
  });

  it("AC3 — the flag is durable: a second store instance over the same DB reads it complete", async () => {
    const writer = new DrizzleDataStore(h.db);
    await writer.upsertTopic({ qid: "Q11982", title: "Photosynthesis" });
    await writer.setTopicClosedToSuggestions("Q11982", true);

    // A fresh store instance models another request/session on the one shared Postgres.
    const reader = new DrizzleDataStore(h.db);
    expect((await reader.getTopic("Q11982"))?.closedToSuggestions).toBe(true);
  });
});

describe("setTopicClosedToSuggestionsAction (the curator-gated boundary)", () => {
  beforeEach(async () => {
    // A topic must exist so a successful mark WOULD write — proving the GATE blocks the logged-out
    // call, not a missing topic.
    await signInAs("Setup", "seed-subject");
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
    currentSession = null; // logged out for the AC4 assertions
  });

  it("AC4 — rejects a logged-out caller and leaves the stored value unchanged", async () => {
    await expect(
      setTopicClosedToSuggestionsAction("Q11982", true)
    ).rejects.toThrow(/AUTH_REQUIRED/);
    const rows = await h.db
      .select()
      .from(topic)
      .where(eq(topic.wikidataQid, "Q11982"));
    expect(rows[0]?.closedToSuggestions).toBe(false);
  });

  it("AC1 — a signed-in curator can mark complete; the flag persists", async () => {
    await signInAs("Curator", "curator-subject");
    const result = await setTopicClosedToSuggestionsAction("Q11982", true);
    expect(result.closedToSuggestions).toBe(true);
    const rows = await h.db
      .select()
      .from(topic)
      .where(eq(topic.wikidataQid, "Q11982"));
    expect(rows[0]?.closedToSuggestions).toBe(true);
  });

  it("AC2 — any signed-in curator can reopen it (no ownership lock)", async () => {
    await signInAs("CuratorOne", "one-subject");
    await setTopicClosedToSuggestionsAction("Q11982", true);
    // A DIFFERENT signed-in curator reopens it.
    await signInAs("CuratorTwo", "two-subject");
    const result = await setTopicClosedToSuggestionsAction("Q11982", false);
    expect(result.closedToSuggestions).toBe(false);
  });

  it("records a counted write_event so the mark is rate-limit-budgeted", async () => {
    await signInAs("Curator", "curator-subject");
    await setTopicClosedToSuggestionsAction("Q11982", true);
    const events = await h.db
      .select()
      .from(writeEvent)
      .where(eq(writeEvent.kind, "topic-complete"));
    expect(events.length).toBe(1);
  });
});
