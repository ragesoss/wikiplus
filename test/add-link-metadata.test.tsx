import { describe, expect, it, vi } from "vitest";

// Issue #64 — resolve real video metadata on add-by-link (PART 1). Covers the oEmbed resolver (the
// recorded server-action CORS decision, exercised against a MOCKED `fetch`) and the pure
// media-source helpers (the C10 credit contract). The AddModal state-machine component tests live
// in test/add-modal-resolve.test.tsx — they `vi.mock` the resolver module, which (being hoisted)
// can't coexist in the SAME file as these tests that import the REAL resolver.

import {
  deriveHandle,
  placeholderMediaSource,
  resolvedMediaSource,
} from "@/components/topic/add-media";
import { parseVideoUrl } from "@/lib/embed/facade";
import { resolveOEmbedAction } from "@/lib/embed/oembed";

// ── 1. The oEmbed resolver server action (D-YouTube, AC8/AC10, the failure contract) ──────────
describe("resolveOEmbedAction (issue #64 — server-action oEmbed resolve)", () => {
  function mockFetch(impl: () => Partial<Response> | Promise<Partial<Response>>) {
    return vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(impl as unknown as typeof fetch);
  }

  it("AC1/AC2 — a 200 with title + author_name resolves to real metadata", async () => {
    const fetchSpy = mockFetch(async () => ({
      ok: true,
      json: async () => ({
        title: "Knife Sharpening 101",
        author_name: "Sharp Channel",
        author_url: "https://www.youtube.com/@sharpchannel",
        thumbnail_url: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
      }),
    }));
    const res = await resolveOEmbedAction(
      "youtube",
      "https://youtu.be/abc"
    );
    expect(res).toEqual({
      ok: true,
      meta: {
        title: "Knife Sharpening 101",
        authorName: "Sharp Channel",
        authorUrl: "https://www.youtube.com/@sharpchannel",
        thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
      },
    });
    // AC8 — a descriptive User-Agent identifying wiki+ is sent on the server-side fetch.
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const ua = (init.headers as Record<string, string>)["User-Agent"];
    expect(ua).toMatch(/wiki\+/);
  });

  it("AC4 — a non-2xx response is a failure (never a fabricated success)", async () => {
    mockFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    expect(await resolveOEmbedAction("youtube", "https://youtu.be/x")).toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("AC4 — a 200 missing the load-bearing fields (title/author) is a failure, not a half-empty resolve", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ thumbnail_url: "https://i.ytimg.com/x.jpg" }),
    }));
    expect(await resolveOEmbedAction("youtube", "https://youtu.be/x")).toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("AC4 — a network/parse error is a failure, never throws (the modal relies on this)", async () => {
    mockFetch(async () => {
      throw new Error("offline");
    });
    await expect(
      resolveOEmbedAction("youtube", "https://youtu.be/x")
    ).resolves.toEqual({ ok: false, reason: "failed" });
  });

  it("AC8 — Instagram/other route to the placeholder arm (unsupported), no fetch", async () => {
    const fetchSpy = mockFetch(async () => ({ ok: true, json: async () => ({}) }));
    expect(
      await resolveOEmbedAction("instagram", "https://instagram.com/reel/x/")
    ).toEqual({ ok: false, reason: "unsupported" });
    expect(
      await resolveOEmbedAction("other", "https://example.com/x")
    ).toEqual({ ok: false, reason: "unsupported" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── 1b. The TikTok oEmbed resolver arm (D-TikTok: D2/D3/D4, AC1/AC2/AC6/AC8) ──────────────────
describe("resolveOEmbedAction — TikTok (D-TikTok reversal)", () => {
  function mockFetch(impl: () => Partial<Response> | Promise<Partial<Response>>) {
    return vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(impl as unknown as typeof fetch);
  }

  const TIKTOK_URL =
    "https://www.tiktok.com/@junglygarden/video/7242553660062944558";

  it("AC1/AC2 — a 200 with title + author_name resolves real TikTok metadata (trimmed)", async () => {
    const fetchSpy = mockFetch(async () => ({
      ok: true,
      json: async () => ({
        title: "  Repotting a Dendrobium  ",
        author_name: "  Jungly Garden  ",
        author_url: "https://www.tiktok.com/@junglygarden",
        thumbnail_url: "https://p16.tiktokcdn.com/thumb.jpg",
      }),
    }));
    const res = await resolveOEmbedAction("tiktok", TIKTOK_URL);
    expect(res).toEqual({
      ok: true,
      meta: {
        title: "Repotting a Dendrobium",
        authorName: "Jungly Garden",
        authorUrl: "https://www.tiktok.com/@junglygarden",
        thumbnailUrl: "https://p16.tiktokcdn.com/thumb.jpg",
      },
    });
    // AC8 — TikTok endpoint, descriptive UA, no key, no-store, server-side.
    const [hitUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(hitUrl).toContain("https://www.tiktok.com/oembed");
    expect(hitUrl).toContain(encodeURIComponent(TIKTOK_URL));
    expect(hitUrl).not.toMatch(/key=|api_key=|token=/i);
    expect(init.cache).toBe("no-store");
    const ua = (init.headers as Record<string, string>)["User-Agent"];
    expect(ua).toMatch(/wiki\+/);
  });

  it("AC4 — missing author_url still resolves (authorUrl undefined), no fabricated link", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({
        title: "Clip",
        author_name: "Jungly Garden",
        thumbnail_url: "https://p16.tiktokcdn.com/thumb.jpg",
      }),
    }));
    const res = await resolveOEmbedAction("tiktok", TIKTOK_URL);
    expect(res).toEqual({
      ok: true,
      meta: {
        title: "Clip",
        authorName: "Jungly Garden",
        authorUrl: undefined,
        thumbnailUrl: "https://p16.tiktokcdn.com/thumb.jpg",
      },
    });
  });

  it("AC5 — missing thumbnail_url still resolves (thumbnailUrl undefined), not a failure", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({
        title: "Clip",
        author_name: "Jungly Garden",
        author_url: "https://www.tiktok.com/@junglygarden",
      }),
    }));
    const res = await resolveOEmbedAction("tiktok", TIKTOK_URL);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.meta.thumbnailUrl).toBeUndefined();
  });

  it("AC6/D2 — a non-200 is a failure (state D), never 'unsupported'", async () => {
    mockFetch(async () => ({ ok: false, status: 403, json: async () => ({}) }));
    expect(await resolveOEmbedAction("tiktok", TIKTOK_URL)).toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("AC6/D3 — a 200 missing the title/author floor is a failure, not a half-empty resolve", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ author_name: "Jungly Garden" }), // no title
    }));
    expect(await resolveOEmbedAction("tiktok", TIKTOK_URL)).toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("AC6/D2 — malformed/empty JSON is a failure, never throws", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    }));
    await expect(resolveOEmbedAction("tiktok", TIKTOK_URL)).resolves.toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("AC6/D4 — a timeout/abort is a failure (state D), never a stuck modal", async () => {
    mockFetch(async () => {
      // Mirror what AbortSignal.timeout triggers: a rejected fetch.
      throw new DOMException("The operation was aborted.", "TimeoutError");
    });
    await expect(resolveOEmbedAction("tiktok", TIKTOK_URL)).resolves.toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("AC8/D4 — the fetch carries an AbortSignal (bounded request)", async () => {
    const fetchSpy = mockFetch(async () => ({
      ok: true,
      json: async () => ({ title: "T", author_name: "A" }),
    }));
    await resolveOEmbedAction("tiktok", TIKTOK_URL);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

// ── 2. The pure media-source helpers (C10 credit contract) ───────────────────────────────────
describe("add-media helpers (C10 credit contract)", () => {
  const parsed = parseVideoUrl("https://youtu.be/abc123")!;

  it("derives a handle like the candidate pipeline (@ + name lowercased, spaces removed)", () => {
    expect(deriveHandle("Sharp Channel")).toBe("@sharpchannel");
    // Name-only when no handle derives (C10) — never an empty/fake '@'.
    expect(deriveHandle("   ")).toBeUndefined();
    expect(deriveHandle("")).toBeUndefined();
  });

  it("RESOLVED — maps oEmbed metadata to real caption/creator/thumb; no mock strings (AC2/C10)", () => {
    const m = resolvedMediaSource(
      parsed,
      {
        title: "Real Title",
        authorName: "Sharp Channel",
        authorUrl: "https://www.youtube.com/@sharpchannel",
        thumbnailUrl: "https://i.ytimg.com/vi/abc123/hq.jpg",
      },
      "YouTube",
      "Q1",
      "https://youtu.be/abc123"
    );
    expect(m.caption).toBe("Real Title");
    expect(m.thumbnailUrl).toBe("https://i.ytimg.com/vi/abc123/hq.jpg");
    expect(m.creator.name).toBe("Sharp Channel");
    expect(m.creator.handle).toBe("@sharpchannel");
    expect(m.creator.url).toBe("https://www.youtube.com/@sharpchannel");
    // The mock strings must never appear on a resolved clip (AC2).
    expect(m.caption).not.toBe("Pasted clip (mock preview)");
    expect(m.creator.handle).not.toBe("pasted");
  });

  it("RESOLVED — falls back to the parser thumbnail when oEmbed gives none (D-YouTube)", () => {
    const m = resolvedMediaSource(
      parsed,
      { title: "T", authorName: "A", authorUrl: "https://x" },
      "YouTube",
      "Q1",
      "https://youtu.be/abc123"
    );
    expect(m.thumbnailUrl).toBe(parsed.thumbnailUrl);
  });

  it("AC3 — TikTok resolved handle is the URL @handle, regardless of the author_name slug (D1)", () => {
    const tiktok = parseVideoUrl(
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    )!;
    const m = resolvedMediaSource(
      tiktok,
      {
        // author_name slugifies to "@junglygardenofficial" — DIVERGES from the URL handle.
        title: "Repotting",
        authorName: "Jungly Garden Official",
        authorUrl: "https://www.tiktok.com/@junglygarden",
        thumbnailUrl: "https://p16.tiktokcdn.com/t.jpg",
      },
      "TikTok",
      "Q1",
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    );
    // The URL handle wins (D1), not the author-name derivation.
    expect(m.creator.handle).toBe("@junglygarden");
    expect(m.creator.name).toBe("Jungly Garden Official");
    expect(m.creator.url).toBe("https://www.tiktok.com/@junglygarden");
    // Never the mock placeholder on a resolved clip (C10/AC2).
    expect(m.creator.handle).not.toBe("pasted");
  });

  it("AC3 — falls back to deriveHandle when the parse carries no creatorHandle (D1)", () => {
    // YouTube carries no creatorHandle → keeps the derivation (AC12, unchanged).
    expect(parsed.creatorHandle).toBeUndefined();
    const m = resolvedMediaSource(
      parsed,
      { title: "T", authorName: "Sharp Channel", authorUrl: "https://x" },
      "YouTube",
      "Q1",
      "https://youtu.be/abc123"
    );
    expect(m.creator.handle).toBe("@sharpchannel");
  });

  it("AC3 — name-only (handle omitted) when neither a URL handle nor a derivation yields one", () => {
    // A TikTok form with no @segment AND a whitespace author name → no handle at all (never empty @).
    const noHandle = parseVideoUrl("https://www.tiktok.com/video/123")!;
    expect(noHandle.creatorHandle).toBeUndefined();
    const m = resolvedMediaSource(
      noHandle,
      { title: "T", authorName: "   ", authorUrl: "https://x" },
      "TikTok",
      "Q1",
      "https://www.tiktok.com/video/123"
    );
    expect(m.creator.handle).toBe(""); // omitted → name-only, never "pasted", never "@".
  });

  it("AC7 — placeholder (Add-anyway) never fabricates: no name, no link, no handle even for TikTok", () => {
    const tiktok = parseVideoUrl(
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    )!;
    const m = placeholderMediaSource(
      tiktok,
      "TikTok",
      "Q1",
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    );
    expect(m.caption).toBe("Unresolved TikTok clip");
    expect(m.creator.name).toBe("Creator not resolved");
    expect(m.creator.url).toBeUndefined();
    expect(m.creator.handle).toBe(""); // the URL handle is NOT used on the unresolved placeholder.
    expect(m.embedUrl).toBe(tiktok.embedUrl); // the video still plays (AC7).
  });

  it("PLACEHOLDER — honest unresolved credit: no name, no link, no handle (C10/AC4)", () => {
    const m = placeholderMediaSource(parsed, "YouTube", "Q1", "https://youtu.be/abc123");
    expect(m.caption).toBe("Unresolved YouTube clip");
    expect(m.creator.name).toBe("Creator not resolved");
    expect(m.creator.url).toBeUndefined(); // no fake/dead outbound link (C10).
    expect(m.creator.handle).toBe(""); // no "pasted" placeholder handle (C10).
    // The embed/watch (and thumbnail) come from the real parse — the video still plays (AC7).
    expect(m.embedUrl).toBe(parsed.embedUrl);
    expect(m.watchUrl).toBe("https://youtu.be/abc123");
  });
});
