import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import type { Candidate, Clip } from "@/lib/data/types";

// ── QA coverage companion to add-video-placement.test.tsx. Locks the requirement edges the
// authored suite leaves open: the controls LEAD the scroll row (before any video), the
// empty-with-only-controls render (the new `showCuratorTools` term in the <ul> gate), and the
// group label travels inside the row item (a11y). ────────────────────────────────────────────────

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

describe("GeneralStrip — ＋ Add video placement (QA coverage edges)", () => {
  it("Req4: the controls LEAD the scroll row — they precede the first curated peer tile in DOM order", () => {
    // Two curated general clips, no hero → both ride the scroll row as peer tiles. The controls
    // must come BEFORE the first peer tile (leading the row), not after the videos.
    renderStrip({
      generalClips: [
        makeClip({ id: "c1", caption: "First peer" }),
        makeClip({ id: "c2", caption: "Second peer" }),
      ],
    });
    const addBtn = screen.getByRole("button", { name: /Add video/i });
    const firstPeer = screen.getByText("First peer");
    // DOCUMENT_POSITION_FOLLOWING on the Add button means the peer comes AFTER it.
    expect(
      addBtn.compareDocumentPosition(firstPeer) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("Req3/empty: signed-in empty band with NO suggestions still renders the <ul> with ONLY the controls (the showCuratorTools gate term)", () => {
    // 0 curated, 0 candidates, not loading, signed in → the band's zero face. The scroll <ul> must
    // still render (so the controls are reachable) and carry the controls as its sole item.
    renderStrip({ generalClips: [], generalCandidates: [] });
    const addBtn = screen.getByRole("button", { name: /Add video/i });
    const ul = addBtn.closest("ul[role='list']");
    expect(ul).not.toBeNull();
    // No curated/suggestion tile exists, so the controls' <li> is the only list item in the row.
    expect(ul!.querySelectorAll(":scope > li").length).toBe(1);
    // The honest zero line is still shown alongside (no error UI).
    expect(
      screen.getByText(/No videos found for this topic yet/i)
    ).toBeInTheDocument();
  });

  it("a11y: the controls keep their group label inside the row item, and it is INSIDE the <ul>", () => {
    renderStrip();
    const group = screen.getByRole("group", {
      name: "Add videos from a source manually",
    });
    expect(group.closest("ul[role='list']")).not.toBeNull();
    expect(group.closest("li")).not.toBeNull();
  });

  it("a11y: the signed-in zero line no longer says a stale directional 'below'", () => {
    renderStrip({ generalClips: [], generalCandidates: [] });
    const line = screen.getByText(/No videos found for this topic yet/i);
    expect(line.textContent).not.toMatch(/below/i);
  });

  it("Req2 + curated: a marked-complete topic that still HAS curated clips renders the tiles but NO ＋ Add video", () => {
    // The TopicView gate only omits the whole band when suppressed AND nothing to show; a complete
    // topic with curated content still renders GeneralStrip (suppressed=true). Curated content stays
    // (never suppressed); the curator controls are gone.
    renderStrip({ suppressed: true });
    expect(screen.getByText("A curated overview")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add video/i })).toBeNull();
    expect(
      screen.queryByRole("group", { name: "Add videos from a source manually" })
    ).toBeNull();
  });
});
