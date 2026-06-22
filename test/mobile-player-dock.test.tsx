import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MobilePlayerDock,
  type MobileDockClip,
} from "@/components/topic/MobilePlayerDock";
import type { Clip } from "@/lib/data/types";

// Component-level verification of the unified mobile dock in isolation (issue #120,
// docs/design/unified-player-mobile.md §5–§9). The TopicView routing/wiring (the viewport
// split, swap-in-place across kinds, the edge-aware spacer, focus return) is covered in
// mobile-player-dock-wiring.test.tsx; here we pin the dock's own contract.

const NOCOOKIE = "https://www.youtube-nocookie.com/embed/abc123";

function curatedClip(over: Partial<Clip> = {}): Clip {
  return {
    id: "clip1",
    topicQid: "Q189603",
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "horizontal",
    watchUrl: "https://www.youtube.com/watch?v=abc",
    embedUrl: NOCOOKIE,
    caption: "Photosynthesis explained",
    creator: { handle: "@2minuteclassroom", name: "2 Minute Classroom", platform: "youtube" },
    general: true,
    contextNote: "Solid explainer; minor caveat about the light reactions.",
    stance: "explainer",
    accuracyFlag: "accurate",
    curatedBy: "curatorX",
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function curatedPayload(over: Partial<Clip> = {}): MobileDockClip {
  const clip = curatedClip(over);
  return {
    embedUrl: clip.embedUrl,
    caption: clip.caption,
    orientation: clip.orientation,
    creator: { handle: clip.creator.handle },
    platformLabel: clip.platformLabel,
    curated: clip,
  };
}

const candidatePayload: MobileDockClip = {
  embedUrl: NOCOOKIE,
  caption: "Glycolysis in 2 minutes",
  orientation: "horizontal",
  creator: { handle: "@amoebasisters" },
  platformLabel: "YouTube",
  matchReason: "Mentions glycolysis",
};

function dock() {
  return screen.getByRole("region", { name: "Video player" });
}

describe("MobilePlayerDock — labeled, non-modal region (§9)", () => {
  it("is a <section> exposed as a region named 'Video player'", () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    const region = dock();
    expect(region.tagName).toBe("SECTION");
    expect(region).toHaveAttribute("aria-label", "Video player");
  });

  it("is NOT a dialog and applies NO aria-modal / focus trap", () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    const region = dock();
    expect(region).not.toHaveAttribute("role", "dialog");
    expect(region).not.toHaveAttribute("aria-modal");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does NOT steal focus on open — focus stays where it was (no autofocus)", () => {
    render(<button type="button">outside</button>);
    const outside = screen.getByRole("button", { name: "outside" });
    outside.focus();
    expect(outside).toHaveFocus();

    render(
      <MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />
    );
    // The dock mounted but did NOT pull focus to itself (contrast ModalShell).
    expect(outside).toHaveFocus();
    expect(dock().contains(document.activeElement)).toBe(false);
  });
});

describe("MobilePlayerDock — embed facade (verbatim attrs)", () => {
  it("builds the autoplay embed src verbatim (append ?autoplay=1)", () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    const iframe = dock().querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toBe(`${NOCOOKIE}?autoplay=1`);
  });

  it("uses the same allow-list and allowFullScreen as PlayerModal (no extra perms)", () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    const iframe = dock().querySelector("iframe")!;
    expect(iframe.getAttribute("allow")).toBe(
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    );
    // allowFullScreen stays so the embed's OWN native-fullscreen button works (§6.5).
    expect(iframe).toHaveAttribute("allowfullscreen");
    expect(iframe).toHaveAttribute("title", "Glycolysis in 2 minutes");
  });

  it("credits the creator in the title bar on EVERY clip (CC BY-SA, §5.1)", () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    expect(screen.getByText("@amoebasisters · YouTube")).toBeInTheDocument();
  });
});

describe("MobilePlayerDock — Close tears down (§8 dismissed)", () => {
  it("clicking Close fires onClose; the control carries the WORD 'Close' (§9 AC-a11y)", async () => {
    const onClose = vi.fn();
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={onClose} />);
    const close = screen.getByRole("button", { name: "Close video player" });
    expect(close.textContent).toMatch(/Close/);
    await userEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Close is keyboard-operable (Enter then Space)", async () => {
    const onClose = vi.fn();
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={onClose} />);
    const close = screen.getByRole("button", { name: "Close video player" });
    close.focus();
    expect(close).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledOnce();
    onClose.mockClear();
    await userEvent.keyboard(" ");
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("MobilePlayerDock — park toggle (§7)", () => {
  it("defaults to bottom: the button names the destination 'Move to top'", () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Move player to top of screen" })
    ).toBeInTheDocument();
    // Default edge = bottom → the dock root pins to the bottom edge.
    expect(dock().className).toMatch(/bottom-0/);
  });

  it("toggling flips the label to 'Move to bottom' and parks the dock at the top edge", async () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Move player to top of screen" })
    );
    expect(
      screen.getByRole("button", { name: "Move player to bottom of screen" })
    ).toBeInTheDocument();
    expect(dock().className).toMatch(/top-0/);
  });

  it("reports the new edge up via onEdgeChange (drives the page spacer)", async () => {
    const onEdgeChange = vi.fn();
    render(
      <MobilePlayerDock
        kind="candidate"
        clip={candidatePayload}
        onClose={vi.fn()}
        onEdgeChange={onEdgeChange}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Move player to top of screen" })
    );
    expect(onEdgeChange).toHaveBeenLastCalledWith("top");
  });
});

describe("MobilePlayerDock — maximize toggle (§6.5, CSS not native fullscreen)", () => {
  it("offers an explicit Maximize button (keyboard/AT-reachable), flipping to Exit", async () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    const maximize = screen.getByRole("button", {
      name: "Maximize video to fill the screen",
    });
    await userEvent.click(maximize);
    // The same node now reads "Exit"; the dock fills the viewport via CSS (inset-0).
    expect(
      screen.getByRole("button", { name: "Exit full-screen video" })
    ).toBeInTheDocument();
    expect(dock().className).toMatch(/inset-0/);
  });

  it("hides the park toggle while maximized (parking is meaningless — §7)", async () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Maximize video to fill the screen" })
    );
    expect(
      screen.queryByRole("button", { name: /Move player to/ })
    ).toBeNull();
  });

  it("keeps the SAME iframe across maximize/exit (playback never interrupted — §6.6)", async () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    const before = dock().querySelector("iframe");
    await userEvent.click(
      screen.getByRole("button", { name: "Maximize video to fill the screen" })
    );
    const during = dock().querySelector("iframe");
    await userEvent.click(screen.getByRole("button", { name: "Exit full-screen video" }));
    const after = dock().querySelector("iframe");
    expect(during).toBe(before);
    expect(after).toBe(before);
  });
});

describe("MobilePlayerDock — candidate supplemental row (§5.2)", () => {
  it("shows the match reason and the logged-out 'Curate this video' CTA", () => {
    render(
      <MobilePlayerDock
        kind="candidate"
        clip={candidatePayload}
        onClose={vi.fn()}
        signedIn={false}
        onCurate={vi.fn()}
      />
    );
    expect(screen.getByText("Mentions glycolysis")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Curate this video — log in to write a context note and vouch for it",
      })
    ).toBeInTheDocument();
    // Candidates are never expandable (A2 — no curation note to expand to).
    expect(screen.queryByRole("button", { name: /Context/ })).toBeNull();
  });

  it("renders NO CTA when signed in (§5.2)", () => {
    render(
      <MobilePlayerDock
        kind="candidate"
        clip={candidatePayload}
        onClose={vi.fn()}
        signedIn
        onCurate={vi.fn()}
      />
    );
    expect(
      screen.queryByRole("button", { name: /Curate this video/ })
    ).toBeNull();
  });
});

describe("MobilePlayerDock — curated collapsed/expanded curation (§5.3)", () => {
  it("collapsed: shows chips + a 'Context ▸' expander (aria-expanded=false), note hidden", () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    const expander = screen.getByRole("button", { name: /Context/ });
    expect(expander).toHaveAttribute("aria-expanded", "false");
    // The full note is not yet in the DOM (collapsed).
    expect(
      screen.queryByText(/Solid explainer; minor caveat/)
    ).toBeNull();
    // The "Curator note" eyebrow appears only when expanded.
    expect(screen.queryByText("Curator note")).toBeNull();
  });

  it("expanding reveals the full note + 'context by', wires aria-controls, flips aria-expanded", async () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    const expander = screen.getByRole("button", { name: /Context/ });
    const controls = expander.getAttribute("aria-controls");
    expect(controls).toBeTruthy();

    await userEvent.click(expander);
    expect(expander).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Curator note")).toBeInTheDocument();
    expect(
      screen.getByText(/Solid explainer; minor caveat/)
    ).toBeInTheDocument();
    // aria-controls points at the now-present note panel.
    expect(document.getElementById(controls!)).not.toBeNull();
    // "context by <curator>" attribution is present in the expanded state (CURATION §5.4).
    expect(screen.getByText(/context by/i)).toBeInTheDocument();
  });

  it("re-activating collapses the note back (focus stays on the expander)", async () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    const expander = screen.getByRole("button", { name: /Context/ });
    await userEvent.click(expander);
    expect(screen.getByText("Curator note")).toBeInTheDocument();
    await userEvent.click(expander);
    expect(screen.queryByText("Curator note")).toBeNull();
  });

  it("renders NO expander when the note is empty (§5.3 empty-note guard); chips still show", () => {
    render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload({ contextNote: "" })}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /Context/ })).toBeNull();
    // Chips remain (the stance/accuracy signal still shows collapsed).
    expect(screen.getByText(/explainer/i)).toBeInTheDocument();
  });

  it("shows the logged-out join nudge for curated; none when signed in (§5.2)", () => {
    const { rerender } = render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload()}
        onClose={vi.fn()}
        signedIn={false}
        onJoin={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Log in to curate videos for this topic" })
    ).toBeInTheDocument();
    rerender(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload()}
        onClose={vi.fn()}
        signedIn
        onJoin={vi.fn()}
      />
    );
    expect(
      screen.queryByRole("button", { name: "Log in to curate videos for this topic" })
    ).toBeNull();
  });
});

describe("MobilePlayerDock — curated no-embed shows the note (§8 no-embed curated)", () => {
  it("a curated clip with no embedUrl shows the 'can't be embedded' message AND the curation block", () => {
    render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload({ embedUrl: undefined })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/can't be embedded/i)).toBeInTheDocument();
    // No src-less iframe is rendered (the message replaces it).
    expect(dock().querySelector("iframe")).toBeNull();
    // The curation affordance still renders — the note is worth reading even when the frame can't play.
    expect(screen.getByRole("button", { name: /Context/ })).toBeInTheDocument();
  });
});

describe("MobilePlayerDock — frame-first launch order (#135 §1.1, AC-1/AC-3)", () => {
  // The corrected launch inversion: the video frame is the FIRST region after the slim title bar,
  // and everything secondary (chips / Context / match reason / CTA / expanded note) comes AFTER the
  // frame in DOM order. This is what makes the frame the hero and fully visible on open; it would
  // fail against the old frame-last layout.
  function frameAndSecondaryOrder(root: HTMLElement) {
    const frame = root.querySelector("[data-dock-frame]")!;
    // The secondary region is the lone overflow-y-auto column under the frame.
    const secondary = root.querySelector(".overflow-y-auto.flex-1");
    return { frame, secondary };
  }

  it("renders the frame BEFORE the secondary region (curated)", () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    const { frame, secondary } = frameAndSecondaryOrder(dock());
    expect(frame).not.toBeNull();
    expect(secondary).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING (4): `secondary` follows `frame` in document order.
    expect(frame.compareDocumentPosition(secondary!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the frame BEFORE the secondary region (candidate)", () => {
    render(
      <MobilePlayerDock
        kind="candidate"
        clip={candidatePayload}
        onClose={vi.fn()}
        signedIn={false}
        onCurate={vi.fn()}
      />
    );
    const { frame, secondary } = frameAndSecondaryOrder(dock());
    expect(frame.compareDocumentPosition(secondary!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The "Curate this video" CTA is inside the secondary region (after the frame), not above it.
    const cta = screen.getByRole("button", { name: /Curate this video/ });
    expect(secondary!.contains(cta)).toBe(true);
  });

  it("marks the frame box and the title bar as shrink-0 (never the element that scrolls)", () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    const frame = dock().querySelector("[data-dock-frame]")!;
    expect(frame.className).toMatch(/shrink-0/);
    // The secondary region — and only it — is the overflow scroll area.
    const scrollers = dock().querySelectorAll(".overflow-y-auto");
    // Exactly the secondary region scrolls when collapsed (the expanded-note panel adds a second
    // only when open — not here).
    expect(scrollers.length).toBe(1);
    expect((scrollers[0] as HTMLElement).className).toMatch(/flex-1/);
  });

  it("the logged-out curated join nudge sits inside the secondary region, after the frame", () => {
    render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload()}
        onClose={vi.fn()}
        signedIn={false}
        onJoin={vi.fn()}
      />
    );
    const secondary = dock().querySelector(".overflow-y-auto.flex-1")!;
    const nudge = screen.getByRole("button", {
      name: "Log in to curate videos for this topic",
    });
    expect(secondary.contains(nudge)).toBe(true);
  });

  it("collapses the title-bar controls into ONE horizontal row, each a separate 44px button (#135 §1.3.1)", () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    const maximize = screen.getByRole("button", { name: "Maximize video to fill the screen" });
    const move = screen.getByRole("button", { name: "Move player to top of screen" });
    const close = screen.getByRole("button", { name: "Close video player" });
    // All three controls share one flex-row container (collapsed, not the old vertical flex-col).
    const row = maximize.parentElement!;
    expect(row).toBe(move.parentElement);
    expect(row).toBe(close.parentElement);
    expect(row.className).toMatch(/flex-row/);
    // Each control keeps its own ≥44px touch target (height AND width, now the words can collapse).
    for (const b of [maximize, move, close]) {
      expect(b.className).toMatch(/min-h-\[44px\]/);
      expect(b.className).toMatch(/min-w-\[44px\]/);
    }
  });

  it("collapses the control WORD to sr-only below sm so the caption/credit keep room (AC-3/AC-4), keeping the accessible name", () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    for (const [glyphLabel, word] of [
      ["Maximize video to fill the screen", "Maximize"],
      ["Move player to top of screen", "Move to top"],
      ["Close video player", "Close"],
    ] as const) {
      const btn = screen.getByRole("button", { name: glyphLabel });
      // The visible word is in the DOM (the accessible name still carries it) but sr-only below sm,
      // restored visibly at sm+ — so it never steals the narrow-width text column.
      const wordSpan = Array.from(btn.querySelectorAll("span")).find((s) =>
        s.textContent === word
      )!;
      expect(wordSpan, `${word} word span present`).toBeTruthy();
      expect(wordSpan.className).toMatch(/sr-only/);
      expect(wordSpan.className).toMatch(/sm:not-sr-only/);
      // The aria-label (the accessible name) is unchanged — text-labeled for AT regardless.
      expect(btn).toHaveAccessibleName(glyphLabel);
    }
  });

  it("shows the control words VISIBLY when maximized (the thin bar has room — no sr-only there)", async () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Maximize video to fill the screen" })
    );
    const close = screen.getByRole("button", { name: "Close video player" });
    const word = Array.from(close.querySelectorAll("span")).find((s) => s.textContent === "Close")!;
    expect(word.className).not.toMatch(/sr-only/);
  });
});

describe("MobilePlayerDock — measured-height report (#135 §3, AC-2)", () => {
  it("reports {edge, height, docked} up via onDockMetrics on mount", () => {
    const onDockMetrics = vi.fn();
    render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload()}
        onClose={vi.fn()}
        onDockMetrics={onDockMetrics}
      />
    );
    expect(onDockMetrics).toHaveBeenCalled();
    const m = onDockMetrics.mock.calls.at(-1)![0];
    expect(m).toMatchObject({ edge: "bottom", docked: true });
    expect(typeof m.height).toBe("number");
  });

  it("re-reports the new edge when parked to the top (drives the edge-aware spacer)", async () => {
    const onDockMetrics = vi.fn();
    render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload()}
        onClose={vi.fn()}
        onDockMetrics={onDockMetrics}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Move player to top of screen" })
    );
    expect(onDockMetrics.mock.calls.at(-1)![0]).toMatchObject({ edge: "top", docked: true });
  });

  it("reports docked:false while maximized (no page spacer is reserved then)", async () => {
    const onDockMetrics = vi.fn();
    render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload()}
        onClose={vi.fn()}
        onDockMetrics={onDockMetrics}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Maximize video to fill the screen" })
    );
    expect(onDockMetrics.mock.calls.at(-1)![0]).toMatchObject({ docked: false, height: 0 });
  });
});

describe("MobilePlayerDock — bounded dock + 9:16 frame cap (#135 §2.3/§2.6)", () => {
  it("caps the docked height at 88dvh − insets (never 100dvh)", () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    const style = dock().getAttribute("style") ?? "";
    expect(style).toMatch(/88dvh/);
    expect(style).not.toMatch(/100dvh/);
  });

  it("caps the 9:16 frame at min(46vh,380px), centered + letterboxed", () => {
    render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload({ orientation: "vertical" })}
        onClose={vi.fn()}
      />
    );
    const frameBox = dock().querySelector("[data-dock-frame] > div")!;
    expect(frameBox.className).toMatch(/min\(46vh,380px\)/);
    expect(frameBox.className).toMatch(/mx-auto/);
    expect(frameBox.className).toMatch(/aspect-ratio:9\/16/);
  });

  it("16:9 stays full-width aspect-video", () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    const frameBox = dock().querySelector("[data-dock-frame] > div")!;
    expect(frameBox.className).toMatch(/aspect-video/);
    expect(frameBox.className).toMatch(/w-full/);
  });
});

describe("MobilePlayerDock — reduced motion (§9)", () => {
  it("applies the motion dock-in class when motion is allowed", () => {
    render(
      <MobilePlayerDock
        kind="candidate"
        clip={candidatePayload}
        onClose={vi.fn()}
        prefersReduced={false}
      />
    );
    expect(dock().className).toMatch(/pinned-dock-in/);
  });

  it("omits the dock-in class when prefers-reduced-motion is set", () => {
    render(
      <MobilePlayerDock
        kind="candidate"
        clip={candidatePayload}
        onClose={vi.fn()}
        prefersReduced
      />
    );
    expect(dock().className).not.toMatch(/pinned-dock-in/);
  });
});
