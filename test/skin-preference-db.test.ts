// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { contributor } from "@/lib/db/schema";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import {
  findOrCreateContributor,
  getSkinPreference,
} from "@/lib/auth/contributor";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// Per-user skin preference — DB round-trip + the auth-gated boundary (issue #143, AC6/AC7).
// Drives the REAL lib/server/actions.setSkinPreferenceAction against pglite, with getDb + auth()
// mocked exactly as test/auth-boundary.test.ts does, so the gate→write contract and the
// DB→cookie-seed read (getSkinPreference) are verified end to end without live OAuth or a live DB.

let currentDb: Db;
let currentSession: { user: { contributorId?: number; username?: string } } | null =
  null;

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDb: () => currentDb };
});
vi.mock("@/lib/auth/config", () => ({ auth: async () => currentSession }));

import { setSkinPreferenceAction } from "@/lib/server/actions";

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

describe("setSkinPreferenceAction — gate (AC7)", () => {
  it("rejects an anonymous call and writes nothing (the cookie-only logged-out path)", async () => {
    await expect(setSkinPreferenceAction("zine-dark")).rejects.toThrow();
  });

  it("rejects an out-of-vocabulary skin value (the column never stores an unknown skin)", async () => {
    await signInAs("Ragesoss", "sub-1");
    await expect(setSkinPreferenceAction("neon" as string)).rejects.toThrow(
      /unknown skin/i
    );
  });
});

describe("setSkinPreferenceAction — DB round-trip (AC6)", () => {
  it("persists the chosen skin on the signed-in contributor's row", async () => {
    const me = await signInAs("Ragesoss", "sub-1");
    await setSkinPreferenceAction("zine-dark");
    const rows = await h.db
      .select({ skin: contributor.skinPreference })
      .from(contributor)
      .where(eq(contributor.id, me.contributorId));
    expect(rows[0]?.skin).toBe("zine-dark");
  });

  it("clearing the preference (null) writes back to 'no stored preference'", async () => {
    const me = await signInAs("Ragesoss", "sub-1");
    await setSkinPreferenceAction("zine-dark");
    await setSkinPreferenceAction(null);
    const rows = await h.db
      .select({ skin: contributor.skinPreference })
      .from(contributor)
      .where(eq(contributor.id, me.contributorId));
    expect(rows[0]?.skin).toBeNull();
  });

  it("only touches the acting contributor's row, never another user's", async () => {
    const me = await signInAs("Ragesoss", "sub-1");
    const other = await findOrCreateContributor(
      { subject: "sub-2", username: "Other", email: null },
      h.db
    );
    await setSkinPreferenceAction("zine-dark");
    expect(await getSkinPreference(me.contributorId, h.db)).toBe("zine-dark");
    // The other contributor is untouched (no stored preference).
    expect(await getSkinPreference(other.contributorId, h.db)).toBeNull();
  });
});

describe("getSkinPreference — the DB→cookie seed read (AC7)", () => {
  it("defaults to null for a fresh contributor (no stored preference)", async () => {
    const me = await signInAs("Ragesoss", "sub-1");
    expect(await getSkinPreference(me.contributorId, h.db)).toBeNull();
  });

  it("restores a stored dark preference for the login mirror (cross-session)", async () => {
    const me = await signInAs("Ragesoss", "sub-1");
    await setSkinPreferenceAction("zine-dark");
    // A fresh "login" (a later jwt callback) would call getSkinPreference and find the stored skin —
    // which the client SkinSync then mirrors DB→cookie so the next paint is correct (AC6/AC8).
    expect(await getSkinPreference(me.contributorId, h.db)).toBe("zine-dark");
  });
});
