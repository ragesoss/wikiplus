import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Instagram Reels support (docs/design/instagram-reels.md AC1–AC6): every Reel share form parses to
// a canonical embed + watch URL, the shortcode is validated, curated Reels play in-app, and the Add
// modal advertises Reels while keeping the honest unresolved credit (C10). No live network — the
// resolve server action is mocked.

const resolveOEmbed = vi.hoisted(() => vi.fn());
vi.mock("@/lib/embed/oembed", () => ({ resolveOEmbedAction: resolveOEmbed }));

import { parseVideoUrl } from "@/lib/embed/facade";
import { VideoThumb, playsInApp, type ThumbVideo } from "@/components/topic/VideoThumb";
import { AddModal } from "@/components/topic/AddModal";
import type { SubmitOutcome } from "@/components/topic/useCurateSubmit";
import type { Clip } from "@/lib/data/types";

describe("parseVideoUrl — Instagram Reel share forms (AC1/AC2)", () => {
  const cases: [string, string, "reel" | "p"][] = [
    ["https://www.instagram.com/reel/C9xYz_1-Ab/", "C9xYz_1-Ab", "reel"],
    ["https://www.instagram.com/reel/C9xYz_1-Ab", "C9xYz_1-Ab", "reel"],
    ["https://www.instagram.com/reels/C9xYz_1-Ab/", "C9xYz_1-Ab", "reel"],
    ["https://instagram.com/reel/C9xYz_1-Ab/?igsh=MWQ1ZGUxMzBkMA==", "C9xYz_1-Ab", "reel"],
    ["https://m.instagram.com/reel/C9xYz_1-Ab/?utm_source=ig_web_copy_link", "C9xYz_1-Ab", "reel"],
    ["https://www.instagram.com/science.explained/reel/C9xYz_1-Ab/", "C9xYz_1-Ab", "reel"],
    ["https://www.instagram.com/p/C9xYz_1-Ab/", "C9xYz_1-Ab", "p"],
    ["https://www.instagram.com/tv/C9xYz_1-Ab/", "C9xYz_1-Ab", "p"],
    ["https://www.instagram.com/some_user/p/C9xYz_1-Ab/", "C9xYz_1-Ab", "p"],
  ];

  it.each(cases)("parses %s", (url, code, kind) => {
    const p = parseVideoUrl(url);
    expect(p?.platform).toBe("instagram");
    expect(p?.videoId).toBe(code);
    expect(p?.embedUrl).toBe(`https://www.instagram.com/${kind}/${code}/embed/`);
    expect(p?.canonicalUrl).toBe(`https://www.instagram.com/${kind}/${code}/`);
    // No URL-derived creator credit on Instagram (C10 — the credit stays unresolved).
    expect(p?.creatorHandle).toBeUndefined();
  });
});

describe("parseVideoUrl — Instagram rejection (AC3)", () => {
  it.each([
    "https://www.instagram.com/science.explained/",
    "https://www.instagram.com/explore/tags/biology/",
    "https://www.instagram.com/stories/someone/1234567890/",
    "https://www.instagram.com/reel/",
    "https://www.instagram.com/reel/abc%22onload%3D/",
    "https://www.instagram.com/reel/abc/extra/",
    "https://evilinstagram.com/reel/abc/",
    "https://instagram.com.evil.example/reel/abc/",
  ])("rejects %s", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });
});

const reel: ThumbVideo = {
  platform: "instagram",
  platformLabel: "Instagram",
  orientation: "vertical",
  caption: "Reel clip",
  watchUrl: "https://www.instagram.com/reel/C9xYz/",
  embedUrl: "https://www.instagram.com/reel/C9xYz/embed/",
};

describe("VideoThumb — Instagram Reels play in-app (AC4)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a Reel with an embed URL calls onPlay, reads 'Play:', and shows no 'opens ↗' tag", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const onPlay = vi.fn();
    render(<VideoThumb video={reel} onPlay={onPlay} />);
    const btn = screen.getByRole("button", { name: "Play: Reel clip" });
    await userEvent.click(btn);
    expect(onPlay).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByText("opens ↗")).toBeNull();
    expect(btn.className).toMatch(/aspect-\[9\/16\]/);
  });

  it("a Reel with no embed URL links out in a new tab", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const onPlay = vi.fn();
    const noEmbed = { ...reel, embedUrl: undefined };
    render(<VideoThumb video={noEmbed} onPlay={onPlay} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Open on Instagram: Reel clip" })
    );
    expect(onPlay).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(noEmbed.watchUrl, "_blank", "noopener");
    expect(screen.getByText("opens ↗")).toBeInTheDocument();
  });

  it("a Reel with no player wired links out", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<VideoThumb video={reel} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Open on Instagram: Reel clip" })
    );
    expect(open).toHaveBeenCalledWith(reel.watchUrl, "_blank", "noopener");
  });

  it("TikTok keeps linking out even with an embed URL", () => {
    expect(
      playsInApp({
        ...reel,
        platform: "tiktok",
        platformLabel: "TikTok",
        embedUrl: "https://www.tiktok.com/embed/v2/1",
      })
    ).toBe(false);
    expect(playsInApp(reel)).toBe(true);
  });
});

type OnSubmit = (
  clip: Omit<Clip, "id" | "createdAt">,
  agreed: boolean
) => Promise<SubmitOutcome>;

describe("AddModal — Instagram Reels copy + canonical placeholder clip (AC5/AC6)", () => {
  beforeEach(() => resolveOEmbed.mockReset());

  function renderAdd() {
    const onSubmit = vi.fn<OnSubmit>(async () => ({ outcome: "added" }));
    render(
      <AddModal
        sections={[{ slug: "s", title: "S" }]}
        topicQid="Q7430"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    return onSubmit;
  }

  it("names Instagram Reels in the label, placeholder, and unrecognized alert", async () => {
    renderAdd();
    expect(
      screen.getByText("Paste a YouTube, TikTok, or Instagram Reels link")
    ).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/instagram\.com\/reel/);
    await userEvent.type(input, "https://www.instagram.com/someone/");
    await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unrecognized link — paste a YouTube, TikTok, or Instagram Reels URL."
    );
    expect(resolveOEmbed).not.toHaveBeenCalled();
  });

  it("a /reels/ share link lands on the honest placeholder and persists canonical URLs", async () => {
    resolveOEmbed.mockResolvedValue({ ok: false, reason: "unsupported" });
    const onSubmit = renderAdd();
    await userEvent.type(
      screen.getByPlaceholderText(/instagram\.com\/reel/),
      "https://www.instagram.com/reels/C9xYz_1-Ab/?igsh=abc123"
    );
    await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));

    expect(await screen.findByText("Unresolved Instagram clip")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Instagram doesn't share video details with wiki+ yet — you can still add and curate this Reel, and it plays from Instagram."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

    await userEvent.type(
      screen.getByPlaceholderText(/Separate fact/),
      "A context note for this Reel."
    );
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "I agree to release my context note under CC BY-SA 4.0.",
      })
    );
    await userEvent.click(screen.getByRole("button", { name: /Add & curate/ }));

    const [clip] = onSubmit.mock.calls[0];
    expect(clip.platform).toBe("instagram");
    expect(clip.platformLabel).toBe("Instagram");
    expect(clip.orientation).toBe("vertical");
    expect(clip.watchUrl).toBe("https://www.instagram.com/reel/C9xYz_1-Ab/");
    expect(clip.embedUrl).toBe("https://www.instagram.com/reel/C9xYz_1-Ab/embed/");
    expect(clip.caption).toBe("Unresolved Instagram clip");
    expect(clip.creator.name).toBe("Creator not resolved");
    expect(clip.creator.handle).toBe("");
    expect(clip.creator.url).toBeUndefined();
  });
});
