import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClipCard } from "@/components/topic/ClipCard";
import {
  HELD_ACCESSIBLE_NAME,
  HELD_EXPLAINER,
} from "@/components/topic/HeldMarking";
import type { Clip } from "@/lib/data/types";

// ── D5b (issue #58): the held "in review" marking + the reviewer Hold/Approve affordances on the
// ClipCard (design §3 / §4, CURATION §7.1). Component-level coverage of the AC1/AC2 RENDER (the
// verbatim §7.1 strings, chips/note/curator kept) and the §4.1 affordance matrix. The SERVER-SIDE
// role-gate (AC4/AC5) is verified at the action in test/vetted-review-hold.test.ts — these are the
// affordance side only (a hidden button never authorizes anything).

const baseClip: Clip = {
  id: "c1",
  topicQid: "Q11982",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=abc",
  embedUrl: "https://www.youtube-nocookie.com/embed/abc",
  caption: "Photosynthesis explained",
  creator: {
    handle: "@crashcourse",
    name: "CrashCourse",
    platform: "youtube",
    url: "https://youtube.com/@crashcourse",
  },
  contextNote: "An accurate, energetic overview; pairs well with the article.",
  stance: "explainer",
  accuracyFlag: "accurate",
  general: false,
  sectionSlug: "calvin-cycle",
  sectionLabel: "Calvin cycle",
  curatedBy: "@bio_teacher",
  createdAt: new Date().toISOString(),
};

function renderCard(over: Partial<Clip> = {}, props: Partial<Parameters<typeof ClipCard>[0]> = {}) {
  return render(
    <ClipCard
      clip={{ ...baseClip, ...over }}
      active={false}
      onPlay={vi.fn()}
      onGoToSection={vi.fn()}
      {...props}
    />
  );
}

describe("ClipCard — held marking (AC1/AC2)", () => {
  it("a PUBLISHED clip shows NO held marking (byte-for-byte its pre-D5b self)", () => {
    renderCard({ held: undefined });
    expect(screen.queryByText("In review · not yet vouched")).toBeNull();
    expect(screen.queryByText(HELD_EXPLAINER)).toBeNull();
  });

  it("a HELD clip shows the verbatim eyebrow, explainer, and accessible name", () => {
    renderCard({ held: true });
    expect(screen.getByText("In review · not yet vouched")).toBeInTheDocument();
    expect(screen.getByText(HELD_EXPLAINER)).toBeInTheDocument();
    expect(screen.getByText(HELD_ACCESSIBLE_NAME)).toBeInTheDocument();
  });

  it("a held clip KEEPS its chips, curator note, and curator attribution (distinct from a candidate)", () => {
    renderCard({ held: true });
    // The held marking is additive — the curated content is all still there (unlike a §6 candidate).
    expect(screen.getByText("Curator note")).toBeInTheDocument();
    expect(screen.getByText(/An accurate, energetic overview/)).toBeInTheDocument();
    expect(screen.getByText("Explainer")).toBeInTheDocument();
    expect(screen.getByText("Accurate")).toBeInTheDocument();
    // It uses "In review", never the §6 candidate word "Suggested · uncurated".
    expect(screen.queryByText(/Suggested · uncurated/)).toBeNull();
  });
});

describe("ClipCard — reviewer Hold/Approve affordances (design §4.1 matrix)", () => {
  it("a non-reviewer / logged-out viewer sees NO Hold or Approve (default off)", () => {
    renderCard({ held: undefined });
    expect(screen.queryByRole("group", { name: "Review this clip" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Hold for review/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Approve this clip/ })).toBeNull();
  });

  it("a published clip + canHold shows 'Hold for review' (moderator OR own-curator)", async () => {
    const onHold = vi.fn();
    renderCard({ held: undefined }, { canHold: true, onHold });
    expect(
      screen.getByRole("group", { name: "Review this clip" })
    ).toBeInTheDocument();
    const btn = screen.getByRole("button", {
      name: "Hold for review: Photosynthesis explained",
    });
    await userEvent.click(btn);
    expect(onHold).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
    // A published clip never shows Approve.
    expect(screen.queryByRole("button", { name: /Approve this clip/ })).toBeNull();
  });

  it("a held clip + canApprove shows 'Approve' (moderator only)", async () => {
    const onApprove = vi.fn();
    renderCard({ held: true }, { canApprove: true, onApprove });
    const btn = screen.getByRole("button", {
      name: "Approve this clip: Photosynthesis explained",
    });
    await userEvent.click(btn);
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
  });

  it("in flight shows the busy WORD and disables the control (no double-submit)", () => {
    renderCard({ held: undefined }, { canHold: true, reviewInFlight: true });
    const btn = screen.getByRole("button", { name: /Hold for review/ });
    expect(btn).toHaveTextContent("Holding…");
    expect(btn).toBeDisabled();
  });

  it("the reviewer row is a DISTINCT group from the D2 owner row", () => {
    renderCard({ held: undefined }, { owned: true, canHold: true });
    expect(
      screen.getByRole("group", { name: "Manage your curated clip" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Review this clip" })
    ).toBeInTheDocument();
  });
});
