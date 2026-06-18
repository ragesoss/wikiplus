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

  it("AC6 / D-TikTok — TikTok is 'unsupported' (placeholder arm), with NO fetch made", async () => {
    const fetchSpy = mockFetch(async () => ({ ok: true, json: async () => ({}) }));
    expect(
      await resolveOEmbedAction(
        "tiktok",
        "https://www.tiktok.com/@u/video/123"
      )
    ).toEqual({ ok: false, reason: "unsupported" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("AC6 — Instagram/other also route to the placeholder arm (unsupported), no fetch", async () => {
    const fetchSpy = mockFetch(async () => ({ ok: true, json: async () => ({}) }));
    expect(
      await resolveOEmbedAction("instagram", "https://instagram.com/reel/x/")
    ).toEqual({ ok: false, reason: "unsupported" });
    expect(fetchSpy).not.toHaveBeenCalled();
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
