// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { _resetStubContributorCache } from "@/lib/db/drizzle-store";
import { findOrCreateContributor } from "@/lib/auth/contributor";
import { seedClips } from "@/lib/data/seed";
import type { Clip } from "@/lib/data/types";
import type { Db } from "@/lib/db/client";
import { clip as clipTable } from "@/lib/db/schema";
import {
  instagramTitle,
  isInstagramImageUrl,
  MAX_INSTAGRAM_CAPTION,
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

// QA verification (fresh-eyes review) of docs/specs/instagram-resolve.md — edge cases and the
// acceptance-criteria branches the author's suite leaves implicit: the open-redirect allowlist under
// URL-parser bypass attempts, the short-lived 404 cache header (AC4), an empty caption / timeout
// (AC2), caption length-capping without splitting a surrogate pair (AC1), and the backfill's row
// bound + scope (AC6). No live network — fetch is mocked.

function htmlResponse(body: string, ok = true) {
  return { ok, text: async () => body } as unknown as Response;
}

function embedPage({
  username = "tailbitpets",
  caption = "A caption",
  img = "https://scontent.cdninstagram.com/v/x.jpg?oe=1&amp;a=2",
}: { username?: string; caption?: string; img?: string } = {}) {
  return `<span class="UsernameText">${username}</span>
<img class="EmbeddedMediaImage" alt="" src="${img}" />
<div class="Caption"><a class="CaptionUsername" href="#">${username}</a><br />${caption}<div class="CaptionComments"></div></div>`;
}

afterEach(() => vi.restoreAllMocks());

describe("isInstagramImageUrl — redirect allowlist under parser-bypass attempts (AC4)", () => {
  it.each([
    "https://cdninstagram.com@evil.example/x.jpg", // userinfo: host is evil.example
    "https://scontent.cdninstagram.com.@evil.example/x.jpg",
    "https://evil.example\\.cdninstagram.com/x.jpg", // backslash is a path separator for https
    "https://evil.example/.cdninstagram.com/x.jpg",
    "https://evil.example#.cdninstagram.com",
    "https://evil.example?.fbcdn.net",
    "https://evilcdninstagram.com/x.jpg", // no dot boundary
    "https://xfbcdn.net/x.jpg",
    "https://fbcdn.net.evil.example/x.jpg",
    "https://scontent.cdninstagram.com./x.jpg", // trailing-dot FQDN is not on the allowlist
    "https://evil%2Eexample/x.jpg",
    "http://scontent.cdninstagram.com/x.jpg", // not https
    "//scontent.cdninstagram.com/x.jpg", // protocol-relative
    "javascript:alert(1)//.cdninstagram.com",
    "data:text/html,<script>alert(1)</script>",
    "",
  ])("rejects %s", (raw) => {
    expect(isInstagramImageUrl(raw)).toBe(false);
  });

  it.each([
    "https://scontent.cdninstagram.com/x.jpg",
    "https://SCONTENT.CDNINSTAGRAM.COM/x.jpg", // the parser lowercases the host
    "https://instagram.fyxd4-1.fna.fbcdn.net/v/x.jpg?oe=6ABEF6B4",
  ])("accepts %s", (raw) => {
    expect(isInstagramImageUrl(raw)).toBe(true);
  });
});

describe("instagramThumbResponse — failure caching + scraped-src bypasses (AC4)", () => {
  beforeEach(() => __resetInstagramThumbCache());

  it("a failure is a short-lived 404 (15 min), never a redirect", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse("", false));
    const res = await instagramThumbResponse("Missing1", curated);
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=900");
    expect(res.headers.get("Location")).toBeNull();
  });

  it("a scraped userinfo-trick src never becomes the Location", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      htmlResponse(embedPage({ img: "https://scontent.cdninstagram.com@evil.example/x.jpg" }))
    );
    const res = await instagramThumbResponse("Trick1", curated);
    expect(res.status).toBe(404);
    expect(res.headers.get("Location")).toBeNull();
  });

  it("the memo also absorbs a repeated miss (one fetch per shortcode per window)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse("", false));
    await instagramThumbResponse("Missing2", curated);
    await instagramThumbResponse("Missing2", curated);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("resolveInstagram — AC2 branches", () => {
  it("a post with a username but no caption resolves with the §5.5 fallback caption", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse(embedPage({ caption: "" })));
    const meta = await resolveInstagram("https://www.instagram.com/reel/DbtdaXkjXsL/");
    expect(meta).toEqual({
      title: "Instagram post by @tailbitpets",
      authorName: "tailbitpets",
      authorUrl: "https://www.instagram.com/tailbitpets/",
      // The live CDN image, for the add-modal preview only (the server stores the stable path).
      thumbnailUrl: "https://scontent.cdninstagram.com/v/x.jpg?oe=1&a=2",
    });
  });

  it("a timeout (the abort) fails honestly", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("The operation was aborted due to timeout", "TimeoutError")
    );
    expect(await resolveInstagram("https://www.instagram.com/p/DbtdaXkjXsL/")).toBeNull();
  });

  it("a scraped username carrying markup or a path is refused (no fabricated / injected credit URL)", async () => {
    for (const username of ["evil.example/x", "a&quot;onerror=x", "../../x", "&lt;b&gt;x"]) {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(htmlResponse(embedPage({ username })));
      expect(await resolveInstagram("https://www.instagram.com/p/DbtdaXkjXsL/")).toBeNull();
    }
  });

  it("an escaped caption decodes once to plain text (no double-decode into markup)", () => {
    const embed = parseInstagramEmbed(
      embedPage({ caption: "&lt;script&gt;x&lt;/script&gt; &amp;lt;b&amp;gt; &#x1F600;" })
    );
    // Plain text: React renders it as text, never HTML. `&amp;lt;` decodes exactly once.
    expect(embed?.caption).toBe("<script>x</script> &lt;b&gt; 😀");
  });
});

describe("instagramTitle — AC1 length cap", () => {
  const hasLoneSurrogate = (s: string) =>
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

  it("caps a spaceless emoji caption without splitting a surrogate pair", () => {
    const title = instagramTitle({ username: "u", caption: "😀".repeat(200) });
    expect(title.length).toBeLessThanOrEqual(MAX_INSTAGRAM_CAPTION);
    expect(title.endsWith("…")).toBe(true);
    expect(hasLoneSurrogate(title)).toBe(false);
  });

  it("a caption of exactly 300 chars is kept whole", () => {
    const caption = "a".repeat(MAX_INSTAGRAM_CAPTION);
    expect(instagramTitle({ username: "u", caption })).toBe(caption);
  });
});

// ── AC6 — backfill bound + scope ─────────────────────────────────────────────────────────────
let currentDb: Db;
let currentSession: { user: { contributorId?: number; username?: string } } | null = null;

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDb: () => currentDb };
});
vi.mock("@/lib/auth/config", () => ({ auth: async () => currentSession }));

import { addClipAction, upsertTopicAction } from "@/lib/server/actions";

describe("backfillInstagramPlaceholders — bound + scope (AC6)", () => {
  let h: TestDb;

  beforeEach(async () => {
    _resetStubContributorCache();
    h = await makeTestDb();
    currentDb = h.db;
    const me = await findOrCreateContributor(
      { subject: "ig-resolve-qa", username: "Curator", email: null },
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

  const resolved = {
    title: "Resolved caption",
    authorName: "tailbitpets",
    authorUrl: "https://www.instagram.com/tailbitpets/",
    thumbnailUrl: "/api/thumb/instagram/DbtdaXkjXsL",
  };

  it("resolves at most 50 placeholder rows per run", async () => {
    const added = await addClipAction(placeholderReel(), true);
    const [row] = await h.db.select().from(clipTable).where(eq(clipTable.id, Number(added.id)));
    const { id: _id, ...copy } = row;
    await h.db.insert(clipTable).values(Array.from({ length: 54 }, () => ({ ...copy })));
    const resolve = vi.fn(async () => null);
    expect(await backfillInstagramPlaceholders(h.db, resolve)).toBe(0);
    expect(resolve).toHaveBeenCalledTimes(50);
  });

  it("touches only exact Instagram placeholders — resolved Instagram and other-platform rows are left alone", async () => {
    const curated = await addClipAction(
      placeholderReel({
        caption: "A curated caption",
        creator: { name: "someone", handle: "@someone", platform: "instagram" },
      }),
      true
    );
    const other = await addClipAction(
      placeholderReel({
        platform: "other",
        platformLabel: "Video",
        watchUrl: "https://example.com/v",
      }),
      true
    );
    const resolve = vi.fn(async () => resolved);
    expect(await backfillInstagramPlaceholders(h.db, resolve)).toBe(0);
    expect(resolve).not.toHaveBeenCalled();
    const rows = await h.db.select().from(clipTable);
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    expect(byId.get(curated.id)?.caption).toBe("A curated caption");
    expect(byId.get(other.id)?.caption).toBe("Unresolved Instagram clip");
  });

  it("a DB failure is logged, not thrown (never blocks migrate)", async () => {
    const broken = {
      select: () => {
        throw new Error("db down");
      },
    } as unknown as Db;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(backfillInstagramPlaceholders(broken, async () => resolved)).resolves.toBe(0);
    expect(err).toHaveBeenCalled();
  });
});
