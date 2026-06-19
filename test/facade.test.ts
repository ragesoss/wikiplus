import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "@/lib/embed/facade";

// AC11 (click-to-load / embed-never-host) + AC18 (Add-by-link platform detection).
// The facade parses a pasted URL into the minimal metadata we store ourselves.

describe("parseVideoUrl — YouTube (AC11 youtube-nocookie embed)", () => {
  it("parses a youtu.be short link", () => {
    const p = parseVideoUrl("https://youtu.be/sQK3Yr4Sc_k");
    expect(p?.platform).toBe("youtube");
    expect(p?.videoId).toBe("sQK3Yr4Sc_k");
    expect(p?.embedUrl).toBe(
      "https://www.youtube-nocookie.com/embed/sQK3Yr4Sc_k"
    );
  });

  it("parses a watch?v= link", () => {
    const p = parseVideoUrl("https://www.youtube.com/watch?v=CMiPYHNNg28");
    expect(p?.platform).toBe("youtube");
    expect(p?.embedUrl).toContain("youtube-nocookie.com/embed/CMiPYHNNg28");
  });

  it("parses a /shorts/ link", () => {
    const p = parseVideoUrl("https://www.youtube.com/shorts/K5HAWlTJsgk");
    expect(p?.videoId).toBe("K5HAWlTJsgk");
  });

  it("always uses the privacy-preserving youtube-nocookie host (never youtube.com embed)", () => {
    const p = parseVideoUrl("https://youtu.be/abc123");
    expect(p?.embedUrl).toContain("youtube-nocookie.com");
    expect(p?.embedUrl).not.toContain("www.youtube.com/embed");
  });

  it("derives the thumbnail from i.ytimg.com (no extra network call)", () => {
    const p = parseVideoUrl("https://youtu.be/abc123");
    expect(p?.thumbnailUrl).toBe("https://i.ytimg.com/vi/abc123/hqdefault.jpg");
  });
});

describe("parseVideoUrl — TikTok / Instagram (AC18)", () => {
  it("parses a TikTok video link and captures the URL @handle (D1)", () => {
    const p = parseVideoUrl(
      "https://www.tiktok.com/@theactionlabshorts/video/7183824397071846699"
    );
    expect(p?.platform).toBe("tiktok");
    expect(p?.videoId).toBe("7183824397071846699");
    expect(p?.creatorHandle).toBe("@theactionlabshorts");
  });

  it("captures the @junglygarden handle from the motivating-case URL (D1/AC3)", () => {
    const p = parseVideoUrl(
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    );
    expect(p?.creatorHandle).toBe("@junglygarden");
  });

  it("leaves creatorHandle undefined for a TikTok form without an @segment", () => {
    const p = parseVideoUrl("https://www.tiktok.com/video/7183824397071846699");
    expect(p?.platform).toBe("tiktok");
    expect(p?.creatorHandle).toBeUndefined();
  });

  it("leaves creatorHandle undefined for YouTube (no clean URL handle — AC12)", () => {
    expect(parseVideoUrl("https://youtu.be/abc123")?.creatorHandle).toBeUndefined();
  });

  it("parses an Instagram reel link", () => {
    const p = parseVideoUrl("https://www.instagram.com/reel/ABC123/");
    expect(p?.platform).toBe("instagram");
    expect(p?.videoId).toBe("ABC123");
  });
});

describe("parseVideoUrl — rejection (AC18 error state)", () => {
  it("returns null for a non-URL string", () => {
    expect(parseVideoUrl("not a url")).toBeNull();
  });

  it("returns null for an unrecognized host", () => {
    expect(parseVideoUrl("https://evil.test/watch?v=x")).toBeNull();
  });

  it("returns null for a YouTube URL with no video id", () => {
    expect(parseVideoUrl("https://www.youtube.com/")).toBeNull();
  });
});
