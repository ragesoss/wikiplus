import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CandidateCard } from "@/components/topic/CandidateBits";
import { InlineCandidate } from "@/components/topic/InlineCandidate";
import type { Candidate } from "@/lib/data/types";

const cand: Candidate = {
  id: "cand1",
  topicQid: "Q189603",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=abc",
  thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  caption: "Glycolysis Explained in 2 minutes",
  creator: {
    handle: "@2minuteclassroom",
    name: "2 Minute Classroom",
    platform: "youtube",
    url: "https://youtube.com/@2MinuteClassroom",
  },
  vetted: false,
  source: "YouTube",
  matchReason: "Mentions “glycolysis” in title",
  general: false,
  sectionSlug: "glycolysis",
  sectionLabel: "Glycolysis",
};

describe("CandidateCard — unvetted treatment (AC15 / CURATION §6)", () => {
  function setup() {
    const onPromote = vi.fn();
    const onDismiss = vi.fn();
    const utils = render(
      <CandidateCard candidate={cand} onPromote={onPromote} onDismiss={onDismiss} />
    );
    return { ...utils, onPromote, onDismiss };
  }

  it("renders an outline SUGGESTED badge", () => {
    setup();
    expect(screen.getByText("Suggested")).toBeInTheDocument();
  });

  it("uses the dashed, shadow-less candcard treatment (visually distinct)", () => {
    const { container } = setup();
    expect(container.querySelector(".candcard")).not.toBeNull();
  });

  it("applies the active-pairing highlight when active (D2, design §6.5)", () => {
    const { rerender, container } = render(
      <CandidateCard candidate={cand} onPromote={vi.fn()} onDismiss={vi.fn()} />
    );
    // not highlighted by default
    expect(container.querySelector(".candcard.active")).toBeNull();
    rerender(
      <CandidateCard candidate={cand} active onPromote={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(container.querySelector(".candcard.active")).not.toBeNull();
  });

  it("shows the match reason + 'no context yet' hint in place of a context note", () => {
    setup();
    expect(screen.getByText(/Mentions/)).toBeInTheDocument();
    expect(screen.getByText("Auto-suggested")).toBeInTheDocument();
    expect(
      screen.getByText(/No context yet — a human hasn't reviewed this\./)
    ).toBeInTheDocument();
  });

  it("renders NO stance chip and NO accuracy chip (CURATION §6)", () => {
    setup();
    expect(screen.queryByText("Explainer")).toBeNull();
    expect(screen.queryByText("Accurate")).toBeNull();
    expect(screen.queryByText("Curator note")).toBeNull();
  });

  it("exposes Promote and Not-relevant controls (AC19)", async () => {
    const { onPromote, onDismiss } = setup();
    await userEvent.click(
      screen.getByRole("button", { name: /Promote and curate/ })
    );
    expect(onPromote).toHaveBeenCalledWith(cand);
    await userEvent.click(
      screen.getByRole("button", { name: /Dismiss as not relevant/ })
    );
    expect(onDismiss).toHaveBeenCalledWith(cand);
  });
});

describe("InlineCandidate (AC16 / AC18)", () => {
  it("is an aside labelled for its section (rendered after the section text)", () => {
    render(
      <InlineCandidate
        candidate={cand}
        topicTitle="Cellular respiration"
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(
      screen.getByRole("complementary", { name: /Suggested video for Glycolysis/ })
    ).toBeInTheDocument();
  });

  it("offers a per-section 'Search TikTok' deep link opening in a new tab (AC18)", () => {
    render(
      <InlineCandidate
        candidate={cand}
        topicTitle="Cellular respiration"
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    const link = screen.getByRole("link", { name: /Search TikTok for/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
    expect(link.getAttribute("href")).toContain("tiktok.com/search");
    expect(link.getAttribute("href")).toContain(
      encodeURIComponent("Cellular respiration Glycolysis")
    );
  });
});
