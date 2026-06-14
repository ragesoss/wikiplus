import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import type { Candidate, Clip } from "@/lib/data/types";

const clip: Clip = {
  id: "c1",
  topicQid: "Q11982",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=abc",
  embedUrl: "https://www.youtube-nocookie.com/embed/abc",
  thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  caption: "Overview clip",
  creator: { handle: "@cc", name: "CrashCourse", platform: "youtube" },
  contextNote: "note",
  stance: "explainer",
  accuracyFlag: "accurate",
  general: true,
  createdAt: new Date().toISOString(),
};

const cand: Candidate = {
  id: "cand1",
  topicQid: "Q189603",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=def",
  caption: "Suggested overview",
  creator: { handle: "@as", name: "Amoeba Sisters", platform: "youtube" },
  vetted: false,
  source: "YouTube",
  matchReason: "Top result",
  general: true,
};

describe("GeneralStrip — curated (AC8)", () => {
  it("renders general overview tiles with a video count", () => {
    render(
      <GeneralStrip
        mode="curated"
        topicTitle="Photosynthesis"
        generalClips={[clip]}
        generalCandidates={[]}
        totalGeneral={1}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText("＋ General")).toBeInTheDocument();
    expect(screen.getByText("1 videos")).toBeInTheDocument();
    expect(screen.getByText("Overview clip")).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
  });
});

describe("GeneralStrip — empty / Suggested (AC16, AC18)", () => {
  function setup(onAdd = vi.fn()) {
    render(
      <GeneralStrip
        mode="empty"
        topicTitle="Cellular respiration"
        generalClips={[]}
        generalCandidates={[cand]}
        totalGeneral={1}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={onAdd}
      />
    );
    return { onAdd };
  }

  it("reads 'Suggested videos · uncurated' with a candidate count (AC16)", () => {
    setup();
    expect(screen.getByText("＋ Suggested videos")).toBeInTheDocument();
    expect(screen.getByText("uncurated")).toBeInTheDocument();
    expect(screen.getByText("1 candidates")).toBeInTheDocument();
  });

  it("offers Search TikTok / Search YouTube deep-links in a new tab (AC18)", () => {
    setup();
    const tiktok = screen.getByRole("link", { name: /Search TikTok/ });
    const youtube = screen.getByRole("link", { name: /Search YouTube/ });
    for (const a of [tiktok, youtube]) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener");
    }
    expect(tiktok.getAttribute("href")).toContain("tiktok.com/search?q=");
    expect(youtube.getAttribute("href")).toContain(
      "youtube.com/results?search_query="
    );
  });

  it("opens the Add-video modal via its trigger (AC18)", async () => {
    const { onAdd } = setup();
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: /Add video/ }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
