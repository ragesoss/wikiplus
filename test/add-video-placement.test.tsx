import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import type { Clip } from "@/lib/data/types";

// ── ＋ Add video / find-more placement (the curator controls ride the scroll row, never a toolbar
// above the hero; absent when the band is suppressed/marked-complete). ────────────────────────────

function makeClip(over: Partial<Clip> = {}): Clip {
  return {
    id: "c1",
    topicQid: "Q11982",
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "horizontal",
    watchUrl: "https://www.youtube.com/watch?v=abc",
    embedUrl: "https://www.youtube-nocookie.com/embed/abc",
    thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
    caption: "A curated overview",
    creator: { handle: "@cc", name: "CrashCourse", platform: "youtube" },
    contextNote: "A clear whole-topic introduction.",
    stance: "explainer",
    accuracyFlag: "accurate",
    general: true,
    upvotes: 3,
    curatedBy: "@sage",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function renderStrip(
  props: Partial<React.ComponentProps<typeof GeneralStrip>> = {}
) {
  return render(
    <GeneralStrip
      topicTitle="Photosynthesis"
      generalClips={[makeClip()]}
      generalCandidates={[]}
      onPlay={vi.fn()}
      onPromote={vi.fn()}
      onDismiss={vi.fn()}
      onAdd={vi.fn()}
      signedIn
      {...props}
    />
  );
}

describe("GeneralStrip — ＋ Add video / find-more placement", () => {
  it("signed-in, not suppressed: ＋ Add video renders INSIDE the scroll row (not a toolbar above)", () => {
    renderStrip();
    const addBtn = screen.getByRole("button", { name: /Add video/i });
    // It's a descendant of the horizontal scroll row <ul role="list"> — i.e. it rides the row after
    // the videos, never its own band-padding row above the hero.
    expect(addBtn.closest("ul[role='list']")).not.toBeNull();
  });

  it("logged-out: no curator controls (＋ Add video / Search) — a reader-calm band", () => {
    renderStrip({ signedIn: false });
    expect(screen.queryByRole("button", { name: /Add video/i })).toBeNull();
    expect(screen.queryByText("Search TikTok ↗")).toBeNull();
  });

  it("marked complete (suppressed): NO ＋ Add video and NO Search links at all", () => {
    renderStrip({ suppressed: true });
    expect(screen.queryByRole("button", { name: /Add video/i })).toBeNull();
    expect(screen.queryByText("Search TikTok ↗")).toBeNull();
    expect(screen.queryByText("Search YouTube ↗")).toBeNull();
  });

  it("fully-curated: only ＋ Add video (no Search links — they're the empty/mixed discovery aid)", () => {
    renderStrip(); // 1 curated general clip, no candidates → fully-curated
    expect(screen.getByRole("button", { name: /Add video/i })).toBeInTheDocument();
    expect(screen.queryByText("Search TikTok ↗")).toBeNull();
  });

  it("with a hero set, ＋ Add video comes after the hero block (it rides the scroll row below)", () => {
    renderStrip({ heroClipId: "c1" });
    const hero = screen.getByRole("article", { name: /Hero video:/ });
    const addBtn = screen.getByRole("button", { name: /Add video/i });
    expect(
      hero.compareDocumentPosition(addBtn) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
