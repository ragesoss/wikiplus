// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { seedClips } from "@/lib/data/seed";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { clip as clipTable } from "@/lib/db/schema";
import { parseVideoUrl } from "@/lib/embed/facade";
import {
  instagramTitle,
  isInstagramImageUrl,
  parseInstagramEmbed,
  resolveInstagram,
} from "@/lib/embed/instagram";
import {
  __resetInstagramThumbCache,
  instagramThumbResponse,
} from "@/lib/embed/instagram-thumb";

/** Every shortcode counts as a stored wiki+ clip (the route's DB check, stubbed). */
const curated = async () => true;
import { backfillInstagramPlaceholders } from "@/lib/db/backfill-instagram";
import { makeTestDb, type TestDb } from "./helpers/pglite-db";

// Instagram details resolve from Instagram's public embed page (docs/specs/instagram-resolve.md).

// An excerpt of a real `/reel/<code>/embed/captioned/` page — the fragments the parser reads.
const IMG =
  "https://instagram.fyxd4-1.fna.fbcdn.net/v/t51.82787-15/7687_n.jpg?stp=dst-jpg_e15_tt6&amp;_nc_cat=110&amp;oe=6ABEF6B4";
const EMBED_HTML = `<div class="Header"><a class="Avatar" href="https://www.instagram.com/tailbitpets/?utm_source=ig_embed"></a>
<a class="HeaderText" href="https://www.instagram.com/tailbitpets/"><span class="UsernameText">tailbitpets</span></a></div>
<div class="EmbeddedMedia"><img class="EmbeddedMediaImage" alt="Instagram post shared by &#064;tailbitpets" src="${IMG}" srcset="${IMG} 1080w" /></div>
<div class="Caption"><a class="CaptionUsername" href="https://www.instagram.com/tailbitpets/?utm_source=ig_embed" target="_blank">tailbitpets</a><br /><br />That face says, &quot;Maybe if I freeze, they&#039;ll forget I&#039;m here.&quot; 🤣<br /> <a href="/explore/tags/doginstagram/?utm_source=ig_embed">#doginstagram</a> <a href="/explore/tags/dogs/?utm_source=ig_embed">#dogs</a><div class="CaptionComments"><a class="CaptionCommentsExpand" href="#">View all 4,601 comments</a></div></div>`;
const BROKEN_HTML = `<div class="_aa4c"><div class="EmbedBrokenMedia"><div class="ebmLogo"></div></div></div>`;

function htmlResponse(body: string, ok = true) {
  return { ok, text: async () => body } as unknown as Response;
}

afterEach(() => vi.restoreAllMocks());

describe("parseInstagramEmbed", () => {
  it("reads the username, flattened caption, and the CDN thumbnail", () => {
    const embed = parseInstagramEmbed(EMBED_HTML);
    expect(embed).toEqual({
      username: "tailbitpets",
      caption:
        `That face says, "Maybe if I freeze, they'll forget I'm here." 🤣 #doginstagram #dogs`,
      imageUrl: IMG.replace(/&amp;/g, "&"),
    });
  });

  it("returns null for Instagram's unavailable embed and for a missing/invalid username", () => {
    expect(parseInstagramEmbed(BROKEN_HTML)).toBeNull();
    expect(parseInstagramEmbed("<html></html>")).toBeNull();
    expect(
      parseInstagramEmbed('<span class="UsernameText">no spaces allowed</span>')
    ).toBeNull();
  });

  it("drops a thumbnail that is not https on Instagram's CDN", () => {
    const html = EMBED_HTML.replace(IMG, "https://evil.example/x.jpg").replaceAll(IMG, "");
    expect(parseInstagramEmbed(html)?.imageUrl).toBeUndefined();
    expect(isInstagramImageUrl("http://scontent.cdninstagram.com/x.jpg")).toBe(false);
    expect(isInstagramImageUrl("https://cdninstagram.com.evil.example/x.jpg")).toBe(false);
    expect(isInstagramImageUrl("https://scontent.cdninstagram.com/x.jpg")).toBe(true);
  });
});

describe("instagramTitle", () => {
  it("drops the trailing hashtag run", () => {
    expect(instagramTitle({ username: "u", caption: "Look #cute at this #dog #pets" })).toBe(
      "Look #cute at this"
    );
  });

  it("strips only real hashtags (start of text or after whitespace)", () => {
    expect(instagramTitle({ username: "u", caption: "foo#bar" })).toBe("foo#bar");
    expect(instagramTitle({ username: "u", caption: "We're #1" })).toBe("We're");
  });

  it("labels a captionless (or hashtag-only) post from the resolved username", () => {
    expect(instagramTitle({ username: "tailbitpets", caption: "" })).toBe(
      "Instagram post by @tailbitpets"
    );
    expect(instagramTitle({ username: "tailbitpets", caption: "#a #b" })).toBe(
      "Instagram post by @tailbitpets"
    );
  });

  it("caps a long caption at 300 chars with an ellipsis", () => {
    const title = instagramTitle({ username: "u", caption: "word ".repeat(200).trim() });
    expect(title.length).toBeLessThanOrEqual(300);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("resolveInstagram", () => {
  it("maps the embed page to a credited, thumbnailed resolve", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(htmlResponse(EMBED_HTML));
    const meta = await resolveInstagram("https://www.instagram.com/tailbitpets/reel/DbtdaXkjXsL/?igsh=x");
    expect(meta).toEqual({
      title: `That face says, "Maybe if I freeze, they'll forget I'm here." 🤣`,
      authorName: "tailbitpets",
      authorUrl: "https://www.instagram.com/tailbitpets/",
      // The live CDN image, for the add-modal preview only (the server stores the stable path).
      thumbnailUrl: IMG.replace(/&amp;/g, "&"),
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://www.instagram.com/reel/DbtdaXkjXsL/embed/captioned/");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(/^wiki\+\//);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("fails honestly on an unavailable post, a non-2xx, or a network error", async () => {
    const url = "https://www.instagram.com/p/DbtdaXkjXsL/";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(htmlResponse(BROKEN_HTML));
    expect(await resolveInstagram(url)).toBeNull();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(htmlResponse(EMBED_HTML, false));
    expect(await resolveInstagram(url)).toBeNull();
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    expect(await resolveInstagram(url)).toBeNull();
  });
});

describe("parseVideoUrl — Instagram thumbnail path", () => {
  it("every Instagram share form yields the stable redirect path", () => {
    expect(parseVideoUrl("https://www.instagram.com/reels/C9xYz_1-Ab/?igsh=a")?.thumbnailUrl).toBe(
      "/api/thumb/instagram/C9xYz_1-Ab"
    );
    expect(parseVideoUrl("https://instagram.com/p/C9xYz_1-Ab")?.thumbnailUrl).toBe(
      "/api/thumb/instagram/C9xYz_1-Ab"
    );
  });
});

describe("instagramThumbResponse (GET /api/thumb/instagram/<code>)", () => {
  beforeEach(() => __resetInstagramThumbCache());

  it("302s to the current CDN thumbnail with a public cache header, memoized per shortcode", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(htmlResponse(EMBED_HTML));
    const res = await instagramThumbResponse("DbtdaXkjXsL", curated);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(IMG.replace(/&amp;/g, "&"));
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=21600");
    expect(fetchSpy.mock.calls[0][0]).toBe("https://www.instagram.com/p/DbtdaXkjXsL/embed/");
    await instagramThumbResponse("DbtdaXkjXsL", curated);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("404s a shortcode that no stored clip uses, without fetching Instagram", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await instagramThumbResponse("NotCurated1", async () => false);
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await instagramThumbResponse("NotCurated2", async () => {
      throw new Error("db down");
    })).status).toBe(404);
  });

  it("404s an invalid shortcode without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const code of ["../etc", "a b", "x%2F", "", "a".repeat(65)]) {
      expect((await instagramThumbResponse(code, curated)).status).toBe(404);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("404s (never redirects) when the post is unavailable or the image is off-CDN", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse(BROKEN_HTML));
    const broken = await instagramThumbResponse("Broken1", curated);
    expect(broken.status).toBe(404);
    expect(broken.headers.get("Location")).toBeNull();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      htmlResponse(EMBED_HTML.replaceAll(IMG, "https://evil.example/x.jpg"))
    );
    expect((await instagramThumbResponse("OffCdn1", curated)).status).toBe(404);
  });
});

// ── Persistence: server derivation, read-time fallback, deploy-time backfill ──────────────────
let currentDb: Db;
let currentSession: { user: { contributorId?: number; username?: string } } | null = null;

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDb: () => currentDb };
});
vi.mock("@/lib/auth/config", () => ({ auth: async () => currentSession }));

import { addClipAction, listClipsAction, upsertTopicAction } from "@/lib/server/actions";

describe("Instagram clips in the store", () => {
  let h: TestDb;

  beforeEach(async () => {
    _resetStubContributorCache();
    h = await makeTestDb();
    currentDb = h.db;
    const me = await findOrCreateContributor(
      { subject: "ig-resolve", username: "Curator", email: null },
      h.db
    );
    currentSession = { user: { contributorId: me.contributorId, username: me.handle } };
    await upsertTopicAction({ qid: "Q11982", title: "Photosynthesis" });
  });
  afterEach(async () => {
    await h.close();
  });

  function placeholderReel(overrides: Partial<Clip> = {}): Omit<Clip, "id" | "createdAt"> {
    return {
      ...(seedClips[0] as Omit<Clip, "id" | "createdAt">),
      topicQid: "Q11982",
      platform: "instagram",
      platformLabel: "Instagram",
      orientation: "vertical",
      watchUrl: "https://www.instagram.com/reel/DbtdaXkjXsL/",
      caption: "Unresolved Instagram clip",
      creator: { name: "Creator not resolved", handle: "", platform: "instagram" },
      contextNote: "My note.",
      ...overrides,
    };
  }

  it("addClipAction re-derives the thumbnail path server-side", async () => {
    const added = await addClipAction(
      placeholderReel({ thumbnailUrl: "https://evil.example/x.jpg" }),
      true
    );
    expect(added.thumbnailUrl).toBe("/api/thumb/instagram/DbtdaXkjXsL");
  });

  it("an Instagram clip always reads back with the derived path, whatever the row stores", async () => {
    const added = await addClipAction(placeholderReel(), true);
    await h.db
      .update(clipTable)
      .set({ thumbnailUrl: "https://tracker.example/pixel.gif" })
      .where(eq(clipTable.id, Number(added.id)));
    const [read] = await listClipsAction("Q11982");
    expect(read.thumbnailUrl).toBe("/api/thumb/instagram/DbtdaXkjXsL");
  });

  it("backfill upgrades a placeholder clip's auto-metadata only, and is idempotent", async () => {
    const added = await addClipAction(placeholderReel(), true);
    const resolve = vi.fn(async () => ({
      title: "That face says it all",
      authorName: "tailbitpets",
      authorUrl: "https://www.instagram.com/tailbitpets/",
      thumbnailUrl: "https://scontent.cdninstagram.com/expiring.jpg",
    }));
    expect(await backfillInstagramPlaceholders(h.db, resolve)).toBe(1);
    const [read] = await listClipsAction("Q11982");
    expect(read.id).toBe(added.id);
    expect(read.caption).toBe("That face says it all");
    expect(read.creator).toMatchObject({
      name: "tailbitpets",
      handle: "@tailbitpets",
      url: "https://www.instagram.com/tailbitpets/",
    });
    expect(read.thumbnailUrl).toBe("/api/thumb/instagram/DbtdaXkjXsL");
    const [row] = await h.db.select().from(clipTable).where(eq(clipTable.id, Number(added.id)));
    expect(row.thumbnailUrl).toBe("/api/thumb/instagram/DbtdaXkjXsL");
    expect(read.contextNote).toBe("My note.");
    expect(read.stance).toBe(added.stance);
    expect(read.accuracyFlag).toBe(added.accuracyFlag);
    expect(await backfillInstagramPlaceholders(h.db, resolve)).toBe(0);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("backfill leaves an unresolvable clip as its placeholder and never throws", async () => {
    await addClipAction(placeholderReel(), true);
    expect(await backfillInstagramPlaceholders(h.db, async () => null)).toBe(0);
    expect(
      await backfillInstagramPlaceholders(h.db, async () => {
        throw new Error("boom");
      })
    ).toBe(0);
    const [read] = await listClipsAction("Q11982");
    expect(read.caption).toBe("Unresolved Instagram clip");
    expect(read.creator.url).toBeUndefined();
  });
});
