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

// Fresh-eyes QA (fix round 1, M1): the REAL route's curated-clip DB check against how watch URLs
// are actually stored (server-canonicalized on add), plus the in-flight dedupe.

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

describe("GET /api/thumb/instagram/<code> — curated-clip gate against stored watch URLs", () => {
  let h: TestDb;

  beforeEach(async () => {
    __resetInstagramThumbCache();
    _resetStubContributorCache();
    h = await makeTestDb();
    currentDb = h.db;
    const me = await findOrCreateContributor(
      { subject: "ig-route-qa", username: "Curator", email: null },
      h.db
    );
    currentSession = { user: { contributorId: me.contributorId, username: me.handle } };
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await h.close();
  });

  function reel(watchUrl: string): Omit<Clip, "id" | "createdAt"> {
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

  it("serves a clip added from any share form (m., /reels/, /tv/, user-prefixed, ?igsh=)", async () => {
    const forms: Array<[string, string]> = [
      ["https://m.instagram.com/reel/AaaReel01/?igsh=abc", "AaaReel01"],
      ["https://www.instagram.com/reels/BbbReel02", "BbbReel02"],
      ["https://instagram.com/tv/CccTv03/?utm_source=ig", "CccTv03"],
      ["https://www.instagram.com/someuser/reel/DddUser04/?igsh=x", "DddUser04"],
      ["https://www.instagram.com/p/EeePost05/", "EeePost05"],
    ];
    for (const [url] of forms) await addClipAction(reel(url), true);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse(EMBED_HTML));
    for (const [, code] of forms) {
      const res = await get(code);
      expect(res.status, code).toBe(302);
      expect(res.headers.get("Location")).toBe(IMG);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(forms.length);
  });

  it("404s a valid-looking shortcode no clip uses — and a case variant of a stored one — without fetching", async () => {
    await addClipAction(reel("https://www.instagram.com/reel/AaaReel01/"), true);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse(EMBED_HTML));
    expect((await get("ZzzNotHere9")).status).toBe(404);
    expect((await get("aaareel01")).status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("concurrent requests for one curated shortcode share a single Instagram fetch", async () => {
    let release: (r: Response) => void = () => {};
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => new Promise<Response>((r) => (release = r)));
    const curated = async () => "reel" as const;
    const a = instagramThumbResponse("SameCode01", curated);
    const b = instagramThumbResponse("SameCode01", curated);
    const c = instagramThumbResponse("SameCode01", curated);
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    release(htmlResponse(EMBED_HTML));
    const out = await Promise.all([a, b, c]);
    expect(out.map((r) => r.status)).toEqual([302, 302, 302]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
