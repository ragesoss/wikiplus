import { describe, expect, it, vi } from "vitest";

// Issue #100 — derive video orientation reliably so a clip's thumbnail/preview is laid out in the
// orientation that matches the actual video. The fix is purely in POPULATING `orientation` on the
// add-by-link path; the rendering (VideoThumb's `aspect-[9/16]` vs `aspect-video`) already branches
// off `orientation` correctly and is out of scope. These exercise the pure helpers directly:
//   - `defaultOrientation(platform)` — the no-signal per-platform default (one source of truth).
//   - `resolvedMediaSource(...)`     — the resolved arm: derive from oEmbed player dims, else default.
//   - `placeholderMediaSource(...)`  — the placeholder arm: always the per-platform default.
// A `ResolvedMeta` always carries the C10 floor (title + authorName); we vary only `width`/`height`.

import {
  defaultOrientation,
  placeholderMediaSource,
  resolvedMediaSource,
} from "@/components/topic/add-media";
import { type ParsedVideo, parseVideoUrl } from "@/lib/embed/facade";
import { type ResolvedMeta, resolveOEmbedAction } from "@/lib/embed/oembed";

const youtube = parseVideoUrl("https://youtu.be/abc123")!;
const tiktok = parseVideoUrl(
  "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
)!;
const instagram = parseVideoUrl("https://www.instagram.com/reel/CxYz/")!;
// `parseVideoUrl` only recognizes youtube/tiktok/instagram, so a generic `"other"` parse is built
// directly — the placeholder arm runs for whatever `parsed.platform` it is handed.
const other: ParsedVideo = {
  platform: "other",
  videoId: "x",
  embedUrl: "https://example.com/embed/x",
};

/** The C10 floor every resolve carries, plus the orientation dims under test. */
function meta(dims: { width?: number; height?: number }): ResolvedMeta {
  return { title: "Real Title", authorName: "Sharp Channel", ...dims };
}

// ── The per-platform default map (the no-signal source of truth) ──────────────────────────────
describe("defaultOrientation (issue #100 — per-platform no-signal default)", () => {
  it("tiktok and instagram default to vertical (vertical-first feeds)", () => {
    expect(defaultOrientation("tiktok")).toBe("vertical");
    expect(defaultOrientation("instagram")).toBe("vertical");
  });

  it("youtube defaults to horizontal (vertical only on a positive signal — candidate-path rule)", () => {
    expect(defaultOrientation("youtube")).toBe("horizontal");
  });

  it("generic 'other' defaults to horizontal", () => {
    expect(defaultOrientation("other")).toBe("horizontal");
  });
});

// ── The resolved arm — derive from the oEmbed player dimensions ────────────────────────────────
describe("resolvedMediaSource orientation (issue #100 — derive from oEmbed dims)", () => {
  it("resolved landscape (width > height) → horizontal", () => {
    const m = resolvedMediaSource(
      youtube,
      meta({ width: 640, height: 360 }),
      "YouTube",
      "Q1",
      "https://youtu.be/abc123"
    );
    expect(m.orientation).toBe("horizontal");
  });

  it("resolved portrait (height > width) → vertical (a Short added by link)", () => {
    const m = resolvedMediaSource(
      youtube,
      meta({ width: 405, height: 720 }),
      "YouTube",
      "Q1",
      "https://youtu.be/abc123"
    );
    expect(m.orientation).toBe("vertical");
  });

  it("derivation is platform-agnostic: a resolved TikTok with portrait dims → vertical", () => {
    const m = resolvedMediaSource(
      tiktok,
      meta({ width: 325, height: 575 }),
      "TikTok",
      "Q1",
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    );
    expect(m.orientation).toBe("vertical");
  });

  it("a square (height === width) is NOT taller-than-wide → horizontal", () => {
    const m = resolvedMediaSource(
      youtube,
      meta({ width: 480, height: 480 }),
      "YouTube",
      "Q1",
      "https://youtu.be/abc123"
    );
    expect(m.orientation).toBe("horizontal");
  });

  it("missing-dimension fallback: resolved meta with no dims → the platform default (youtube ⇒ horizontal)", () => {
    const m = resolvedMediaSource(
      youtube,
      meta({}),
      "YouTube",
      "Q1",
      "https://youtu.be/abc123"
    );
    expect(m.orientation).toBe("horizontal");
  });

  it("missing-dimension fallback respects the platform: a dimensionless TikTok resolve → vertical", () => {
    const m = resolvedMediaSource(
      tiktok,
      meta({}),
      "TikTok",
      "Q1",
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    );
    expect(m.orientation).toBe("vertical");
  });

  it("a partial dim (only one present) is not a signal → falls back to the platform default", () => {
    const onlyHeight = resolvedMediaSource(
      youtube,
      meta({ height: 720 }),
      "YouTube",
      "Q1",
      "https://youtu.be/abc123"
    );
    expect(onlyHeight.orientation).toBe("horizontal");
  });
});

// ── The placeholder arm — always the per-platform default (no dims exist) ──────────────────────
describe("placeholderMediaSource orientation (issue #100 — per-platform default)", () => {
  it("tiktok placeholder → vertical", () => {
    const m = placeholderMediaSource(
      tiktok,
      "TikTok",
      "Q1",
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    );
    expect(m.orientation).toBe("vertical");
  });

  it("instagram placeholder → vertical", () => {
    const m = placeholderMediaSource(
      instagram,
      "Instagram",
      "Q1",
      "https://www.instagram.com/reel/CxYz/"
    );
    expect(m.orientation).toBe("vertical");
  });

  it("'other' placeholder → horizontal", () => {
    const m = placeholderMediaSource(
      other,
      "Video",
      "Q1",
      "https://example.com/embed/x"
    );
    expect(m.orientation).toBe("horizontal");
  });

  it("youtube placeholder → horizontal (a failed-resolve YouTube is not forced vertical)", () => {
    const m = placeholderMediaSource(
      youtube,
      "YouTube",
      "Q1",
      "https://youtu.be/abc123"
    );
    expect(m.orientation).toBe("horizontal");
  });
});

// ── The resolver wires the oEmbed player dims into ResolvedMeta (the signal the arm derives from) ──
describe("resolveOEmbedAction carries the orientation dims (issue #100)", () => {
  function mockFetch(impl: () => Partial<Response> | Promise<Partial<Response>>) {
    return vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(impl as unknown as typeof fetch);
  }

  it("a 200 with numeric width/height puts them on meta", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({
        title: "Clip",
        author_name: "Creator",
        width: 405,
        height: 720,
      }),
    }));
    const res = await resolveOEmbedAction("youtube", "https://youtu.be/abc123");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.meta.width).toBe(405);
      expect(res.meta.height).toBe(720);
    }
  });

  it("non-numeric / non-positive dims are dropped (no false signal) — both undefined", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({
        title: "Clip",
        author_name: "Creator",
        width: "640",
        height: 0,
      }),
    }));
    const res = await resolveOEmbedAction("youtube", "https://youtu.be/abc123");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.meta.width).toBeUndefined();
      expect(res.meta.height).toBeUndefined();
    }
  });
});
