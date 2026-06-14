import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VideoThumb, type ThumbVideo } from "@/components/topic/VideoThumb";

// AC10 (aspect by orientation) + AC11 (click-to-load, no autoload; YouTube→onPlay,
// other→new tab) + embed-never-host facade.

const yt: ThumbVideo = {
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  caption: "YT clip",
  watchUrl: "https://www.youtube.com/watch?v=abc",
  thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
};
const tiktok: ThumbVideo = {
  platform: "tiktok",
  platformLabel: "TikTok",
  orientation: "vertical",
  caption: "TT clip",
  watchUrl: "https://www.tiktok.com/@u/video/123",
};

afterEach(() => vi.restoreAllMocks());

describe("VideoThumb — aspect ratio by orientation (AC10)", () => {
  it("renders a horizontal clip at 16:9 (aspect-video)", () => {
    render(<VideoThumb video={yt} onPlay={vi.fn()} />);
    expect(screen.getByRole("button").className).toMatch(/aspect-video/);
  });

  it("renders a vertical clip at 9:16 (aspect-[9/16])", () => {
    render(<VideoThumb video={tiktok} />);
    expect(screen.getByRole("button").className).toMatch(/aspect-\[9\/16\]/);
  });
});

describe("VideoThumb — click-to-load, no autoload (AC11)", () => {
  it("loads NO iframe/embed on initial render (it's a button, not an iframe)", () => {
    const { container } = render(<VideoThumb video={yt} onPlay={vi.fn()} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("button")).not.toBeNull();
  });

  it("a YouTube clip calls onPlay (parent opens the embedded player modal)", async () => {
    const onPlay = vi.fn();
    render(<VideoThumb video={yt} onPlay={onPlay} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Play: YT clip" })
    );
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("a TikTok clip opens its watch URL in a new tab (embed-never-host)", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<VideoThumb video={tiktok} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Open on TikTok: TT clip" })
    );
    expect(open).toHaveBeenCalledWith(
      "https://www.tiktok.com/@u/video/123",
      "_blank",
      "noopener"
    );
  });

  it("names the platform in words on the tag (never icon-only, CURATION §5.2)", () => {
    render(<VideoThumb video={tiktok} />);
    expect(screen.getByText("TikTok")).toBeInTheDocument();
  });
});
