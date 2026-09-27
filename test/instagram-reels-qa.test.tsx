import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// QA (fresh-eyes) coverage for Instagram Reels (docs/design/instagram-reels.md AC1–AC4): host/URL
// confusion and encoding attacks on the parse, the in-app consumers (ClipCard, ProfileClipRow,
// PlayerModal vertical frame, hero/stripcard variants), and the YouTube/TikTok no-regression.

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { parseVideoUrl } from "@/lib/embed/facade";
import { VideoThumb, type ThumbVideo } from "@/components/topic/VideoThumb";
import { ClipCard } from "@/components/topic/ClipCard";
import { PlayerModal } from "@/components/topic/PlayerModal";
import { ProfileClipRow } from "@/components/profile/ProfileClipRow";
import type { Clip, ContributorClip } from "@/lib/data/types";

const SAFE_EMBED = /^https:\/\/www\.instagram\.com\/(reel|p)\/[A-Za-z0-9_-]+\/embed\/$/;

describe("parseVideoUrl — Instagram host/URL confusion (security, AC3)", () => {
  it.each([
    "https://instagram.com@evil.example/reel/abc/",
    "https://evil.example/instagram.com/reel/abc/",
    "https://evil.example/?u=https://www.instagram.com/reel/abc/",
    "https://instagram.com.evil.example/reel/abc/",
    "https://l.instagram.com/reel/abc/",
    "https://www.instagram.com/reel/abc%2F..%2Fevil/",
    "https://www.instagram.com/reel/abc%3Cscript%3E/",
    "https://www.instagram.com/reel/ab c/",
    "https://www.instagram.com/reel/abc/embed/",
    "https://www.instagram.com/explore/tags/x/",
    "https://www.instagram.com/stories/u/123/",
    "https://www.instagram.com/reels/audio/123/",
    "https://www.instagram.com/p/",
    "not a url",
  ])("rejects %s", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });

  it.each([
    "https://WWW.INSTAGRAM.COM/reel/Abc_-1/",
    "https://www.instagram.com:8443/reel/Abc_-1/",
    "https://user:pw@www.instagram.com/reel/Abc_-1/",
    "http://instagram.com/reel/Abc_-1/#frag",
    "https://www.instagram.com/reel/Abc_-1/?igsh=a%22b&x=%3Cscript%3E",
  ])("normalizes %s to a fixed-origin embed (no port/userinfo/query/fragment carried)", (url) => {
    const p = parseVideoUrl(url);
    expect(p?.platform).toBe("instagram");
    expect(p?.embedUrl).toBe("https://www.instagram.com/reel/Abc_-1/embed/");
    expect(p?.canonicalUrl).toBe("https://www.instagram.com/reel/Abc_-1/");
    expect(p!.embedUrl).toMatch(SAFE_EMBED);
  });
});

describe("parseVideoUrl — YouTube/TikTok unchanged", () => {
  it("YouTube carries no canonicalUrl and keeps the nocookie embed", () => {
    const p = parseVideoUrl("https://youtu.be/abc123");
    expect(p?.embedUrl).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(p?.canonicalUrl).toBeUndefined();
  });
  it("TikTok carries no canonicalUrl", () => {
    const p = parseVideoUrl("https://www.tiktok.com/@u/video/123");
    expect(p?.embedUrl).toBe("https://www.tiktok.com/embed/v2/123");
    expect(p?.canonicalUrl).toBeUndefined();
  });
});

const reelClip: Clip = {
  id: "ig1",
  topicQid: "Q7430",
  platform: "instagram",
  platformLabel: "Instagram",
  orientation: "vertical",
  watchUrl: "https://www.instagram.com/reel/C9xYz/",
  embedUrl: "https://www.instagram.com/reel/C9xYz/embed/",
  caption: "Reel clip",
  creator: { handle: "", name: "Creator not resolved", platform: "instagram" },
  contextNote: "A note.",
  stance: "explainer",
  accuracyFlag: "accurate",
  general: false,
  sectionSlug: "s",
  sectionLabel: "S",
  curatedBy: "curator",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("Instagram Reel — in-app consumers (AC4)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("ClipCard: the Reel thumbnail calls onPlay with the clip, no new tab", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const onPlay = vi.fn();
    render(<ClipCard clip={reelClip} active={false} onPlay={onPlay} onGoToSection={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Play: Reel clip" }));
    expect(onPlay).toHaveBeenCalledWith(reelClip);
    expect(open).not.toHaveBeenCalled();
  });

  it("ProfileClipRow: the Reel thumbnail calls onPlay (profile player)", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const onPlay = vi.fn();
    const pc: ContributorClip = { ...reelClip, topicTitle: "Photosynthesis" };
    render(<ProfileClipRow clip={pc} onPlay={onPlay} />);
    await userEvent.click(screen.getByRole("button", { name: "Play: Reel clip" }));
    expect(onPlay).toHaveBeenCalledWith(pc);
    expect(open).not.toHaveBeenCalled();
  });

  it("PlayerModal: renders the Instagram embed iframe in the 9:16 vertical frame", () => {
    render(<PlayerModal clip={reelClip} onClose={vi.fn()} />);
    const iframe = screen.getByTitle("Reel clip") as HTMLIFrameElement;
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("src")).toBe(
      "https://www.instagram.com/reel/C9xYz/embed/?autoplay=1"
    );
    expect(iframe.parentElement?.className).toMatch(/aspect-\[9\/16\]/);
  });

  it.each(["hero", "stripcard", "strip", "inline"] as const)(
    "variant=%s: a Reel with a player wired reads 'Play:' and has no 'opens ↗'",
    async (variant) => {
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      const onPlay = vi.fn();
      render(<VideoThumb video={reelClip} variant={variant} onPlay={onPlay} />);
      await userEvent.click(screen.getByRole("button", { name: "Play: Reel clip" }));
      expect(onPlay).toHaveBeenCalledOnce();
      expect(open).not.toHaveBeenCalled();
      expect(screen.queryByText("opens ↗")).toBeNull();
    }
  );

  it("a candidate-style Reel (no onPlay passed) links out with the 'Open on' name", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<VideoThumb video={reelClip} candidate />);
    await userEvent.click(screen.getByRole("button", { name: "Open on Instagram: Reel clip" }));
    expect(open).toHaveBeenCalledWith(reelClip.watchUrl, "_blank", "noopener");
    expect(screen.getByText("opens ↗")).toBeInTheDocument();
  });
});

describe("YouTube / TikTok thumbnails — no regression", () => {
  afterEach(() => vi.restoreAllMocks());

  const yt: ThumbVideo = {
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "horizontal",
    caption: "YT clip",
    watchUrl: "https://www.youtube.com/watch?v=abc",
    embedUrl: "https://www.youtube-nocookie.com/embed/abc",
    thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  };

  it("YouTube with a thumbnail plays in-app, no 'opens ↗'", async () => {
    const onPlay = vi.fn();
    render(<VideoThumb video={yt} onPlay={onPlay} />);
    await userEvent.click(screen.getByRole("button", { name: "Play: YT clip" }));
    expect(onPlay).toHaveBeenCalledOnce();
    expect(screen.queryByText("opens ↗")).toBeNull();
  });

  it("TikTok with an embed URL still opens a new tab and shows 'opens ↗'", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const onPlay = vi.fn();
    const tt: ThumbVideo = {
      platform: "tiktok",
      platformLabel: "TikTok",
      orientation: "vertical",
      caption: "TT clip",
      watchUrl: "https://www.tiktok.com/@u/video/1",
      embedUrl: "https://www.tiktok.com/embed/v2/1",
    };
    render(<VideoThumb video={tt} onPlay={onPlay} />);
    await userEvent.click(screen.getByRole("button", { name: "Open on TikTok: TT clip" }));
    expect(onPlay).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(tt.watchUrl, "_blank", "noopener");
    expect(screen.getByText("opens ↗")).toBeInTheDocument();
  });
});
