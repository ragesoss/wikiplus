// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  findOrCreateContributor,
  WIKIMEDIA_PROVIDER,
} from "@/lib/auth/contributor";
import { account, contributor } from "@/lib/db/schema";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// Login → find-or-create identity-mapping tests (issue C — AC2/AC3), against in-memory
// Postgres (pglite). NO live Wikimedia round-trip (AC13): the "login" is just the identity
// object Auth.js's jwt callback would pass after a successful authorization; we assert the
// resulting contributor/account rows. The same committed #45 migrations apply (AC9).

let h: TestDb;

beforeEach(async () => {
  h = await makeTestDb();
});
afterEach(async () => {
  await h.close();
});

const RAGESOSS = {
  subject: "12345", // Wikimedia stable subject id (profile.sub)
  username: "Ragesoss",
  email: null,
};

describe("findOrCreateContributor (AC2 — first login)", () => {
  it("creates exactly one contributor + one account keyed by (provider, subject)", async () => {
    const resolved = await findOrCreateContributor(RAGESOSS, h.db);

    // The header shows the Wikimedia username (AC2) — not @prototype, not anonymous.
    expect(resolved.handle).toBe("Ragesoss");
    expect(typeof resolved.contributorId).toBe("number");

    const contributors = await h.db
      .select()
      .from(contributor)
      .where(eq(contributor.handle, "Ragesoss"));
    expect(contributors).toHaveLength(1);
    expect(contributors[0].displayName).toBe("Ragesoss");

    const accounts = await h.db
      .select()
      .from(account)
      .where(
        and(
          eq(account.provider, WIKIMEDIA_PROVIDER),
          eq(account.providerAccountId, "12345")
        )
      );
    expect(accounts).toHaveLength(1);
    expect(accounts[0].contributorId).toBe(resolved.contributorId);
    expect(accounts[0].provider).toBe("wikimedia");
  });
});

describe("findOrCreateContributor (AC3 — repeat login = same rows, no duplicates)", () => {
  it("a second login by the same Wikimedia subject resolves to the SAME contributor", async () => {
    const first = await findOrCreateContributor(RAGESOSS, h.db);
    const second = await findOrCreateContributor(RAGESOSS, h.db);

    expect(second.contributorId).toBe(first.contributorId);

    // No duplicate contributor or account rows were created.
    const contributors = await h.db
      .select()
      .from(contributor)
      .where(eq(contributor.handle, "Ragesoss"));
    expect(contributors).toHaveLength(1);

    const accounts = await h.db
      .select()
      .from(account)
      .where(
        and(
          eq(account.provider, WIKIMEDIA_PROVIDER),
          eq(account.providerAccountId, "12345")
        )
      );
    expect(accounts).toHaveLength(1);
  });

  it("distinct Wikimedia subjects map to distinct contributors", async () => {
    const a = await findOrCreateContributor(RAGESOSS, h.db);
    const b = await findOrCreateContributor(
      { subject: "67890", username: "Another", email: null },
      h.db
    );
    expect(b.contributorId).not.toBe(a.contributorId);

    const accounts = await h.db.select().from(account);
    expect(accounts).toHaveLength(2);
  });

  it("a Wikimedia rename updates the handle in place — same identity, no new row (AC3)", async () => {
    const first = await findOrCreateContributor(RAGESOSS, h.db);
    // Same subject id, new username (a Wikimedia rename).
    const renamed = await findOrCreateContributor(
      { subject: "12345", username: "Sage_Ross", email: null },
      h.db
    );
    expect(renamed.contributorId).toBe(first.contributorId);
    expect(renamed.handle).toBe("Sage_Ross");

    const accounts = await h.db
      .select()
      .from(account)
      .where(eq(account.providerAccountId, "12345"));
    expect(accounts).toHaveLength(1); // still one account for the subject
    const c = await h.db
      .select()
      .from(contributor)
      .where(eq(contributor.id, first.contributorId));
    expect(c[0].handle).toBe("Sage_Ross");
  });
});
