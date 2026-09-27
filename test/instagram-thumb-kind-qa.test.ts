// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { seedClips } from "@/lib/data/seed";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import {
  __resetInstagramThumbCache,
  instagramThumbResponse,
} from "@/lib/embed/instagram-thumb";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// Fresh-eyes QA (thumb kind fix): the REAL route fetches the stored clip's own captioned embed
// form, and the memo short-circuit (hit/miss answered without a DB check; expiry re-checks the DB).

const IMG = "https://scontent.cdninstagram.com/v/t51/x.jpg?oe=6ABEF6B4";
const EMBED_HTML = `<div class="Header"><a class="HeaderText" href="https://www.instagram.com/tailbitpets/"><span class="UsernameText">tailbitpets</span></a></div>
<div class="EmbeddedMedia"><img class="EmbeddedMediaImage" src="${IMG}" /></div>
<div class="Caption"><a class="CaptionUsername" href="https://www.instagram.com/tailbitpets/">tailbitpets</a><br />Hello</div>`;

function htmlResponse(body: string) {
  return { ok: true, text: async () => body } as unknown as Response;
}

let currentDb: Db;
let currentSession: { user: { contributorId?: number; username?: string } } | null = null;
vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDb: () => currentDb };
});
vi.mock("@/lib/auth/config", () => ({ auth: async () => currentSession }));

import { addClipAction, upsertTopicAction } from "@/lib/server/actions";
import { GET } from "@/app/api/thumb/instagram/[code]/route";

const get = (code: string) =>
  GET(new Request(`http://x/api/thumb/instagram/${code}`), { params: Promise.resolve({ code }) });


describe("GET /api/thumb/instagram/<code> — the stored clip's own embed form", () => {
  let h: TestDb;

  beforeEach(async () => {
    __resetInstagramThumbCache();
    _resetStubContributorCache();
    h = await makeTestDb();
    currentDb = h.db;
    const me = await findOrCreateContributor(
      { subject: "ig-kind-qa", username: "Curator", email: null },
      h.db
    );
    currentSession = { user: { contributorId: me.contributorId, username: me.handle } };
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
  });
  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await h.close();
  });

  function ig(watchUrl: string): Omit<Clip, "id" | "createdAt"> {
    return {
      ...(seedClips[0] as Omit<Clip, "id" | "createdAt">),
      topicQid: "Q11982",
      platform: "instagram",
      platformLabel: "Instagram",
      orientation: "vertical",
      watchUrl,
      caption: "Hello",
      creator: { name: "tailbitpets", handle: "@tailbitpets", platform: "instagram" },
      contextNote: "My note.",
    };
  }

  it("fetches /reel/…/embed/captioned/ for reel share forms and /p/…/embed/captioned/ for /p/ and /tv/", async () => {
    const forms: Array<[string, string, string]> = [
      ["https://m.instagram.com/reel/AaaReel01/?igsh=abc", "AaaReel01", "reel"],
      ["https://www.instagram.com/reels/BbbReel02", "BbbReel02", "reel"],
      ["https://www.instagram.com/someuser/reel/DddUser04/", "DddUser04", "reel"],
      ["https://www.instagram.com/p/EeePost05/?igsh=x", "EeePost05", "p"],
      ["https://instagram.com/tv/CccTv03/", "CccTv03", "p"],
    ];
    for (const [url] of forms) await addClipAction(ig(url), true);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse(EMBED_HTML));
    for (const [, code, kind] of forms) {
      fetchSpy.mockClear();
      expect((await get(code)).status, code).toBe(302);
      expect(fetchSpy.mock.calls[0][0]).toBe(`https://www.instagram.com/${kind}/${code}/embed/captioned/`);
    }
  });

  it("answers a memoized hit/miss without a DB check, and re-checks the DB once the entry expires", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const kind = vi.fn(async () => "reel" as const);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse(EMBED_HTML));
    expect((await instagramThumbResponse("MemoHit01", kind)).status).toBe(302);
    expect((await instagramThumbResponse("MemoHit01", kind)).status).toBe(302);
    expect(kind).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // After the 6h hit TTL: the clip was removed — the DB check fails and nothing is fetched.
    vi.setSystemTime(Date.now() + 6 * 60 * 60 * 1000 + 1);
    kind.mockResolvedValueOnce(null as never);
    const gone = await instagramThumbResponse("MemoHit01", kind);
    expect(gone.status).toBe(404);
    expect(gone.headers.get("Cache-Control")).toBe("no-store");
    expect(kind).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // A memoized miss: cached 404, no DB check, no refetch.
    fetchSpy.mockResolvedValue({ ok: false, text: async () => "" } as unknown as Response);
    const miss1 = await instagramThumbResponse("MemoMiss1", kind);
    expect(miss1.status).toBe(404);
    const calls = kind.mock.calls.length;
    const miss2 = await instagramThumbResponse("MemoMiss1", kind);
    expect(miss2.status).toBe(404);
    expect(miss2.headers.get("Cache-Control")).not.toBe("no-store");
    expect(kind).toHaveBeenCalledTimes(calls);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("a DB error on the check is a no-store 404 with no Instagram fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await instagramThumbResponse("DbDown01", async () => {
      throw new Error("db down");
    });
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
