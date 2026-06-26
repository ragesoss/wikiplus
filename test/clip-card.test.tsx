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

describe("ClipCard — upvote rides the chips row as a tag (issue #174)", () => {
  it("signed in: the upvote is an interactive aria-pressed toggle IN the chips row, not the footer", () => {
    const onUpvote = vi.fn();
    const { container } = render(
      <ClipCard
        clip={baseClip}
        active={false}
        signedIn
        voted={false}
        onUpvote={onUpvote}
        onPlay={vi.fn()}
        onGoToSection={vi.fn()}
      />
    );
    // It is a real toggle (the `tag` appearance keeps the full state model).
    const btn = screen.getByRole("button", { name: /Upvote this clip — 42 upvotes/ });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveTextContent("42");
    // It shares one row with the stance + accuracy chips (a tag among the chips).
    const chipsRow = btn.parentElement as HTMLElement;
    expect(within(chipsRow).getByText("Explainer · conceptual")).toBeInTheDocument();
    expect(within(chipsRow).getByText("Accurate")).toBeInTheDocument();
    // The footer no longer carries the upvote control.
    const footer = container.querySelector("footer") as HTMLElement;
    expect(within(footer).queryByRole("button")).toBeNull();
  });

  it("voted: the toggle shows aria-pressed=true, the filled ▲, and the visible 'Voted' word", () => {
    render(
      <ClipCard
        clip={baseClip}
        active={false}
        signedIn
        voted
        onUpvote={vi.fn()}
        onPlay={vi.fn()}
        onGoToSection={vi.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: /You upvoted this clip/ });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveTextContent("▲");
    expect(btn).toHaveTextContent("Voted");
  });

  it("invokes onUpvote with the clip when the signed-in viewer activates the tag", async () => {
    const onUpvote = vi.fn();
    render(
      <ClipCard
        clip={baseClip}
        active={false}
        signedIn
        voted={false}
        onUpvote={onUpvote}
        onPlay={vi.fn()}
        onGoToSection={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Upvote this clip/ }));
    expect(onUpvote).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
  });

  it("logged out: the upvote is a non-interactive figure (a span, never a button) with the count", () => {
    render(
      <ClipCard
        clip={baseClip}
        active={false}
        onPlay={vi.fn()}
        onGoToSection={vi.fn()}
      />
    );
    // No upvote button at all logged out (the figure is read-only social proof).
    expect(screen.queryByRole("button", { name: /upvote/i })).toBeNull();
    expect(screen.getByText("42 upvotes")).toBeInTheDocument();
  });

  it("count 0 logged out renders NO upvote figure (no '0 upvotes')", () => {
    render(
      <ClipCard
        clip={{ ...baseClip, upvotes: 0 }}
        active={false}
        onPlay={vi.fn()}
        onGoToSection={vi.fn()}
      />
    );
    expect(screen.queryByText(/upvotes?/)).toBeNull();
  });

  it("the footer keeps the context-by attribution and the relative curatedAt", () => {
    const { container } = render(
      <ClipCard
        clip={baseClip}
        active={false}
        signedIn
        voted={false}
        onUpvote={vi.fn()}
        onPlay={vi.fn()}
        onGoToSection={vi.fn()}
      />
    );
    const footer = container.querySelector("footer") as HTMLElement;
    expect(within(footer).getByText("@bio_teacher")).toBeInTheDocument();
    expect(within(footer).getByText(/2 days ago/)).toBeInTheDocument();
  });
});

describe("ClipCard — owner-only Edit/Delete affordances (issue #53 / D2, AC7)", () => {
  function setup(over: Partial<Clip> = {}, owned = false) {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ClipCard
        clip={{ ...baseClip, ...over }}
        active={false}
        owned={owned}
        onPlay={vi.fn()}
        onGoToSection={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    return { onEdit, onDelete };
  }

  it("shows NO Edit/Delete affordance when not owned (a different contributor / logged out)", () => {
    setup({}, false);
    expect(screen.queryByRole("button", { name: /Edit your curation/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete your curation/ })).toBeNull();
  });

  it("shows text-labeled Edit + Delete buttons when owned, in a labeled group", () => {
    setup({}, true);
    expect(
      screen.getByRole("group", { name: "Manage your curated clip" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit your curation: Photosynthesis explained" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete your curation: Photosynthesis explained" })
    ).toBeInTheDocument();
  });

  it("invokes onEdit / onDelete with the clip when the owner activates them", async () => {
    const { onEdit, onDelete } = setup({}, true);
    await userEvent.click(screen.getByRole("button", { name: /Edit your curation/ }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
    await userEvent.click(screen.getByRole("button", { name: /Delete your curation/ }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
  });
});
