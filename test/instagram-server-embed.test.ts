// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { seedClips } from "@/lib/data/seed";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// Instagram Reels play in-app, so addClipAction re-derives an Instagram clip's iframe source from
// its watch URL server-side (docs/design/instagram-reels.md AC3): a client can never choose what an
// Instagram clip frames, and a non-Instagram watch URL is rejected.

let currentDb: Db;
let currentSession: { user: { contributorId?: number; username?: string } } | null = null;

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDb: () => currentDb };
});
vi.mock("@/lib/auth/config", () => ({ auth: async () => currentSession }));

import { addClipAction, upsertTopicAction } from "@/lib/server/actions";

let h: TestDb;

beforeEach(async () => {
  _resetStubContributorCache();
  h = await makeTestDb();
  currentDb = h.db;
  const me = await findOrCreateContributor(
    { subject: "ig-1", username: "Curator", email: null },
    h.db
  );
  currentSession = { user: { contributorId: me.contributorId, username: me.handle } };
  await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
});
afterEach(async () => {
  await h.close();
  vi.restoreAllMocks();
});

function reel(overrides: Partial<Clip>): Omit<Clip, "id" | "createdAt"> {
  return {
    ...(seedClips[0] as Omit<Clip, "id" | "createdAt">),
    topicQid: "Q11982",
    platform: "instagram",
    platformLabel: "Instagram",
    orientation: "vertical",
    ...overrides,
  };
}

describe("addClipAction — Instagram embed is server-derived", () => {
  it("overwrites a client-supplied embedUrl and canonicalizes the watch URL", async () => {
    const added = await addClipAction(
      reel({
        watchUrl: "https://www.instagram.com/reels/C9xYz_1-Ab/?igsh=abc",
        embedUrl: "https://evil.example/phish",
      }),
      true
    );
    expect(added.embedUrl).toBe("https://www.instagram.com/reel/C9xYz_1-Ab/embed/");
    expect(added.watchUrl).toBe("https://www.instagram.com/reel/C9xYz_1-Ab/");
  });

  it("rejects an Instagram clip whose watch URL is not an Instagram Reel/post", async () => {
    await expect(
      addClipAction(
        reel({
          watchUrl: "https://evil.example/reel/abc/",
          embedUrl: "https://evil.example/phish",
        }),
        true
      )
    ).rejects.toThrow("Unrecognized Instagram link.");
  });
});
