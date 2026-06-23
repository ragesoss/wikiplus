import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MobilePlayerDock,
  type MobileDockClip,
} from "@/components/topic/MobilePlayerDock";
import type { Clip } from "@/lib/data/types";

// Component-level verification of the SLIM unified mobile dock in isolation
// (docs/design/mobile-player-slim.md). The locked model: a playing mobile video is the frame plus
// ONE 46px control row of four glyph-above-word cells — Close · Move · Curate · See context — and
// nothing else in the default chrome; Curate + See context are inline expander reveals (not
// bottom-sheets), only one open at a time; there is no custom Maximize control. The TopicView
// routing/wiring (the viewport split, swap-in-place, the spacer, dismiss → close + focus-to-band)
// is covered in mobile-player-dock-wiring.test.tsx.

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

describe("MobilePlayerDock — labeled, non-modal region (spec §0.1)", () => {
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

    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    expect(outside).toHaveFocus();
    expect(dock().contains(document.activeElement)).toBe(false);
  });
});

describe("MobilePlayerDock — the slim default chrome (spec §1/§2)", () => {
  it("the default chrome is the frame + exactly ONE row of four glyph-above-word cells, no more", () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    const region = dock();
    // The four cells, each a real button laid out glyph-above-word (word = the accessible name).
    expect(screen.getByRole("button", { name: "Close video player" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Move player to top of screen" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Curate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See context" })).toBeInTheDocument();
    // Exactly four buttons in the default (no fifth control, no Maximize).
    expect(region.querySelectorAll("button")).toHaveLength(4);
  });

  it("renders NO custom Maximize control (fullscreen is the embed's native button — spec §5)", () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /Maximize|Exit full-screen/ })
    ).toBeNull();
    // allowFullScreen stays so the embed's OWN native-fullscreen button works.
    expect(dock().querySelector("iframe")).toHaveAttribute("allowfullscreen");
  });

  it("shows each cell's WORD visibly (never glyph- or sr-only-word alone)", () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    for (const word of ["Close", "Move to top", "Curate", "See context"]) {
      const span = Array.from(dock().querySelectorAll("button span")).find(
        (s) => s.textContent === word
      )!;
      expect(span, `${word} visible`).toBeTruthy();
      expect(span.className).not.toMatch(/sr-only/);
    }
  });

  it("the default carries NO caption / creator / chips / description (all behind reveals)", () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    expect(screen.queryByText(/@amoebasisters/)).toBeNull();
    expect(screen.queryByText("Glycolysis in 2 minutes")).toBeNull();
    expect(screen.queryByText("Mentions glycolysis")).toBeNull();
  });

  it("each cell is a ≥46px target and the four sit in one wrap-capable row (2×2 fallback)", () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    const close = screen.getByRole("button", { name: "Close video player" });
    const see = screen.getByRole("button", { name: "See context" });
    // Same bar container; flex-wrap is the long-locale 2×2 overflow fallback (spec §2.5).
    const bar = close.parentElement!;
    expect(bar).toBe(see.parentElement);
    expect(bar.className).toMatch(/flex-wrap/);
    for (const b of [close, see]) {
      expect(b.className).toMatch(/min-h-\[46px\]/);
      expect(b.className).toMatch(/min-w-\[46px\]/);
    }
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
    expect(iframe).toHaveAttribute("allowfullscreen");
    expect(iframe).toHaveAttribute("title", "Glycolysis in 2 minutes");
  });
});

describe("MobilePlayerDock — Close tears down (spec §2.4)", () => {
  it("clicking Close fires onClose; the control carries the WORD 'Close'", async () => {
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

describe("MobilePlayerDock — Move names the destination (spec §2.3)", () => {
  it("defaults to bottom: the button names the destination 'Move to top'", () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Move player to top of screen" })
    ).toBeInTheDocument();
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

describe("MobilePlayerDock — Curate reveal (spec §3)", () => {
  it("is an inline expander (aria-expanded / aria-controls), collapsed by default", () => {
    render(
      <MobilePlayerDock
        kind="candidate"
        clip={candidatePayload}
        onClose={vi.fn()}
        signedIn
        onCurate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    const cell = screen.getByRole("button", { name: "Curate" });
    expect(cell).toHaveAttribute("aria-expanded", "false");
    const controls = cell.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    // Collapsed: the body (the ✦ Curate action) is not yet in the DOM.
    expect(
      screen.queryByRole("button", { name: /Curate this clip:/ })
    ).toBeNull();
  });

  it("opening / re-activating toggles the reveal and flips aria-expanded; no focus-steal", async () => {
    render(
      <MobilePlayerDock
        kind="candidate"
        clip={candidatePayload}
        onClose={vi.fn()}
        signedIn
        onCurate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    const cell = screen.getByRole("button", { name: "Curate" });
    await userEvent.click(cell);
    expect(cell).toHaveAttribute("aria-expanded", "true");
    // Opening does NOT autofocus into the reveal body — focus stays on the toggling cell.
    expect(cell).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Curate this clip: Glycolysis in 2 minutes" })
    ).toBeInTheDocument();
    await userEvent.click(cell);
    expect(cell).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: /Curate this clip:/ })
    ).toBeNull();
  });

  it("candidate signed in: shows ✦ Curate + ✕ Not relevant with #123 verbatim aria-labels", async () => {
    const onCurate = vi.fn();
    const onDismiss = vi.fn();
    render(
      <MobilePlayerDock
        kind="candidate"
        clip={candidatePayload}
        onClose={vi.fn()}
        signedIn
        onCurate={onCurate}
        onDismiss={onDismiss}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Curate" }));
    const curate = screen.getByRole("button", {
      name: "Curate this clip: Glycolysis in 2 minutes",
    });
    const notRel = screen.getByRole("button", {
      name: "Dismiss as not relevant: Glycolysis in 2 minutes",
    });
    expect(curate).toHaveAttribute("aria-haspopup", "dialog");
    await userEvent.click(curate);
    expect(onCurate).toHaveBeenCalledOnce();
    await userEvent.click(notRel);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("candidate logged out: a single ✦ Curate this video CTA, NO dismiss (spec §3.3)", async () => {
    render(
      <MobilePlayerDock
        kind="candidate"
        clip={candidatePayload}
        onClose={vi.fn()}
        signedIn={false}
        onCurate={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Curate" }));
    expect(
      screen.getByRole("button", {
        name: "Curate this video — log in to write a context note and vouch for it",
      })
    ).toBeInTheDocument();
    // No Not-relevant offered logged out (a logged-out dismiss can't honestly optimistic-hide).
    expect(
      screen.queryByRole("button", { name: /Dismiss as not relevant/ })
    ).toBeNull();
  });

  it("curated logged out: the join nudge occupies the Curate reveal 'act' slot (spec §3.4)", async () => {
    render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload()}
        onClose={vi.fn()}
        signedIn={false}
        onJoin={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Curate" }));
    expect(
      screen.getByRole("button", { name: "Log in to curate videos for this topic" })
    ).toBeInTheDocument();
  });
});

describe("MobilePlayerDock — See context reveal (spec §4)", () => {
  it("is an inline expander, collapsed by default; opening shows caption + creator + Why suggested", async () => {
    render(<MobilePlayerDock kind="candidate" clip={candidatePayload} onClose={vi.fn()} />);
    const cell = screen.getByRole("button", { name: "See context" });
    expect(cell).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Why suggested")).toBeNull();

    await userEvent.click(cell);
    expect(cell).toHaveAttribute("aria-expanded", "true");
    expect(cell).toHaveFocus(); // no focus-steal into the body
    expect(screen.getByText("Glycolysis in 2 minutes")).toBeInTheDocument();
    // Creator credit appears ONLY here (never in the default chrome — spec §4/§9).
    expect(screen.getByText("@amoebasisters · YouTube")).toBeInTheDocument();
    expect(screen.getByText("Why suggested")).toBeInTheDocument();
    expect(screen.getByText("Mentions glycolysis")).toBeInTheDocument();
  });

  it("curated: opening shows caption · creator · chips · Context note · Context by", async () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "See context" }));
    expect(screen.getByText("Photosynthesis explained")).toBeInTheDocument();
    expect(screen.getByText("@2minuteclassroom · YouTube")).toBeInTheDocument();
    expect(screen.getByText("Explainer")).toBeInTheDocument(); // the stance chip
    expect(screen.getByText("Curator note")).toBeInTheDocument();
    expect(screen.getByText(/Solid explainer; minor caveat/)).toBeInTheDocument();
    expect(screen.getByText(/context by/i)).toBeInTheDocument();
  });

  it("curated with an empty note: chips + creator still show, no note panel (empty-note guard)", async () => {
    render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload({ contextNote: "" })}
        onClose={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "See context" }));
    expect(screen.queryByText("Curator note")).toBeNull();
    expect(screen.getByText(/explainer/i)).toBeInTheDocument();
  });
});

describe("MobilePlayerDock — only one reveal open at a time (spec §8)", () => {
  it("opening See context while Curate is open closes Curate, and vice versa", async () => {
    render(
      <MobilePlayerDock
        kind="candidate"
        clip={candidatePayload}
        onClose={vi.fn()}
        signedIn
        onCurate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    const curate = screen.getByRole("button", { name: "Curate" });
    const context = screen.getByRole("button", { name: "See context" });

    await userEvent.click(curate);
    expect(curate).toHaveAttribute("aria-expanded", "true");
    expect(context).toHaveAttribute("aria-expanded", "false");

    // Opening See context closes Curate (only one open).
    await userEvent.click(context);
    expect(context).toHaveAttribute("aria-expanded", "true");
    expect(curate).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: /Curate this clip:/ })
    ).toBeNull();

    // And back the other way.
    await userEvent.click(curate);
    expect(curate).toHaveAttribute("aria-expanded", "true");
    expect(context).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Why suggested")).toBeNull();
  });
});

describe("MobilePlayerDock — curated no-embed shows the note (spec §4)", () => {
  it("a curated clip with no embedUrl shows the can't-embed message; See context still reveals the note", async () => {
    render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload({ embedUrl: undefined })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/can't be embedded/i)).toBeInTheDocument();
    expect(dock().querySelector("iframe")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "See context" }));
    expect(screen.getByText("Curator note")).toBeInTheDocument();
  });
});

describe("MobilePlayerDock — frame-first order + sole scroll area (spec §0.1)", () => {
  it("renders the frame BEFORE the control bar", () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    const frame = dock().querySelector("[data-dock-frame]")!;
    const close = screen.getByRole("button", { name: "Close video player" });
    expect(frame.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the collapsed default has NO scroll area; opening a reveal adds exactly one (the reveal region)", async () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    // Collapsed slim default: frame + bar only, nothing scrolls.
    expect(dock().querySelectorAll(".overflow-y-auto.flex-1")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "See context" }));
    const scrollers = dock().querySelectorAll(".overflow-y-auto.flex-1");
    expect(scrollers).toHaveLength(1);
  });

  it("the frame box is shrink-0 (never the element that scrolls)", () => {
    render(<MobilePlayerDock kind="curated" clip={curatedPayload()} onClose={vi.fn()} />);
    expect(dock().querySelector("[data-dock-frame]")!.className).toMatch(/shrink-0/);
  });
});

describe("MobilePlayerDock — measured-height report (spec §6.4)", () => {
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

  it("re-reports (grows) when a reveal opens, inside the observed root", async () => {
    const onDockMetrics = vi.fn();
    render(
      <MobilePlayerDock
        kind="curated"
        clip={curatedPayload()}
        onClose={vi.fn()}
        onDockMetrics={onDockMetrics}
      />
    );
    onDockMetrics.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "See context" }));
    // The layout effect re-runs on reveal change and reports the current edge/docked again.
    expect(onDockMetrics).toHaveBeenCalled();
    expect(onDockMetrics.mock.calls.at(-1)![0]).toMatchObject({ docked: true });
  });
});

describe("MobilePlayerDock — bounded dock + 9:16 frame cap (spec §6.2)", () => {
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

describe("MobilePlayerDock — reduced motion (spec §8)", () => {
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
