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
    // grammatical count at 1 (defect N3): "1 video", not "1 videos"
    expect(screen.getByText("1 video")).toBeInTheDocument();
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

  it("reads 'Suggested videos · uncurated' and states the kind once (AC16)", () => {
    setup();
    expect(screen.getByText("＋ Suggested videos")).toBeInTheDocument();
    expect(screen.getByText("uncurated")).toBeInTheDocument();
  });

  // #14 AC6: the General band no longer renders a "N candidates" count label
  // (the volume lives once, in the ＋plus panel).
  it("does NOT render a 'N candidates' count label on the band (#14 AC6)", () => {
    setup();
    expect(screen.queryByText(/\d+\s+candidates?/)).toBeNull();
  });

  // #14 AC1: no per-tile "SUGGESTED" badge on the General-strip candidate tiles.
  it("renders NO per-tile 'SUGGESTED' badge (#14 AC1)", () => {
    setup();
    expect(screen.queryByText("Suggested")).toBeNull();
  });

  // #14 AC8: the candidate tile retains the dashed/unvetted candcard distinction.
  it("renders candidate tiles on the dashed candcard surface (#14 AC8)", () => {
    const { container } = render(
      <GeneralStrip
        mode="empty"
        topicTitle="Cellular respiration"
        generalClips={[]}
        generalCandidates={[cand]}
        totalGeneral={1}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(container.querySelector("li.candcard")).not.toBeNull();
  });

  // #14 AC9: the candidate tile CTA reads "Curate" (was "Promote").
  it("labels the candidate-tile CTA 'Curate' with the right aria-label (#14 AC9)", () => {
    setup();
    const curate = screen.getByRole("button", {
      name: `Curate this clip: ${cand.caption}`,
    });
    expect(curate).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("button", { name: /Promote/ })).toBeNull();
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

// New runtime faces from the live source (youtube-autosuggest design §5.2 / §5.4).
describe("GeneralStrip — loading face (design §5.4 / AC2/AC11)", () => {
  it("shows skeleton tiles, the 'Finding videos…' tag, and aria-busy", () => {
    render(
      <GeneralStrip
        mode="empty"
        topicTitle="Cellular respiration"
        generalClips={[]}
        generalCandidates={[]}
        totalGeneral={0}
        loading
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText("Finding videos…")).toBeInTheDocument();
    const skeletonRow = screen.getByRole("list", { name: /Looking for suggested videos/ });
    expect(skeletonRow).toHaveAttribute("aria-busy", "true");
    // The honest zero line must NOT show while loading (no flash of "nothing here").
    expect(screen.queryByText(/No videos found/)).not.toBeInTheDocument();
    // "Find more" stays available during loading.
    expect(screen.getByRole("button", { name: /Add video/ })).toBeInTheDocument();
  });
});

describe("GeneralStrip — zero-results face (design §5.2 / AC2 zero case)", () => {
  it("shows the honest line and keeps 'Find more' (no candidate count — #14 AC6)", () => {
    render(
      <GeneralStrip
        mode="empty"
        topicTitle="Obscurium"
        generalClips={[]}
        generalCandidates={[]}
        totalGeneral={0}
        loading={false}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText(/No videos found for this topic yet/)).toBeInTheDocument();
    // #14 AC6: the band no longer shows a candidate count, even at zero.
    expect(screen.queryByText(/\d+\s+candidates?/)).toBeNull();
    expect(screen.getByRole("link", { name: /Search YouTube/ })).toBeInTheDocument();
  });
});
