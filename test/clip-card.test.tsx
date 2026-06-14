import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClipCard } from "@/components/topic/ClipCard";
import type { Clip } from "@/lib/data/types";

const baseClip: Clip = {
  id: "c1",
  topicQid: "Q11982",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=abc",
  embedUrl: "https://www.youtube-nocookie.com/embed/abc",
  thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  caption: "Photosynthesis explained",
  creator: {
    handle: "@crashcourse",
    name: "CrashCourse",
    platform: "youtube",
    url: "https://youtube.com/@crashcourse",
  },
  contextNote: "An accurate, energetic overview; pairs well with the article.",
  stance: "explainer",
  stanceModifier: "conceptual",
  accuracyFlag: "accurate",
  general: false,
  sectionSlug: "calvin-cycle",
  sectionLabel: "Calvin cycle",
  upvotes: 42,
  curatedBy: "@bio_teacher",
  curatedAt: "2 days ago",
  createdAt: new Date().toISOString(),
};

describe("ClipCard — anchored clip content (AC9)", () => {
  function setup(over: Partial<Clip> = {}) {
    const onPlay = vi.fn();
    const onGoToSection = vi.fn();
    render(
      <ClipCard
        clip={{ ...baseClip, ...over }}
        active={false}
        onPlay={onPlay}
        onGoToSection={onGoToSection}
      />
    );
    return { onPlay, onGoToSection };
  }

  it("shows the creator name, handle, and platform named in words", () => {
    setup();
    expect(screen.getByText("CrashCourse")).toBeInTheDocument();
    expect(screen.getByText(/@crashcourse · YouTube/)).toBeInTheDocument();
  });

  it("renders BOTH a stance chip and an accuracy chip (text-labeled)", () => {
    setup();
    expect(screen.getByText("Explainer · conceptual")).toBeInTheDocument();
    expect(screen.getByText("Accurate")).toBeInTheDocument();
  });

  it("renders the curator context note", () => {
    setup();
    expect(screen.getByText(/An accurate, energetic overview/)).toBeInTheDocument();
    expect(screen.getByText("Curator note")).toBeInTheDocument();
  });

  it("links to the article section via the section button (AC13)", async () => {
    const { onGoToSection } = setup();
    const link = screen.getByRole("button", { name: /Calvin cycle/ });
    await userEvent.click(link);
    expect(onGoToSection).toHaveBeenCalledWith("calvin-cycle");
  });

  it("exposes a keyboard-operable thumbnail with an accessible Play label (AC11/AC21)", async () => {
    const { onPlay } = setup();
    const thumb = screen.getByRole("button", {
      name: "Play: Photosynthesis explained",
    });
    thumb.focus();
    await userEvent.keyboard("{Enter}");
    expect(onPlay).toHaveBeenCalledWith(baseClip);
  });

  it("applies the active-pairing highlight class when active (AC12)", () => {
    const { container } = render(
      <ClipCard
        clip={baseClip}
        active
        onPlay={vi.fn()}
        onGoToSection={vi.fn()}
      />
    );
    expect(container.querySelector(".vcard")?.className).toMatch(/active-glow/);
  });
});
