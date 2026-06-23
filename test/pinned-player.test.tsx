import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  PinnedPlayer,
  type PinnedClip,
} from "@/components/topic/PinnedPlayer";

// Component-level verification of the PinnedPlayer surface in isolation (issue #10,
// docs/specs/pinned-player.md AC2/AC5/AC6/AC9/AC11/AC12/AC13; design §8/§9). The
// TopicView wiring (AC1/AC4/AC7/AC8/AC10) is covered end-to-end in
// pinned-player-wiring.test.tsx; here we pin the dock's own contract.

const NOCOOKIE = "https://www.youtube-nocookie.com/embed/abc123";

const clipA: PinnedClip = {
  embedUrl: NOCOOKIE,
  caption: "Glycolysis in 2 minutes",
  orientation: "horizontal",
  creator: { handle: "@2minuteclassroom" },
  platformLabel: "YouTube",
};

const clipB: PinnedClip = {
  embedUrl: "https://www.youtube-nocookie.com/embed/def456",
  caption: "The Calvin cycle, animated",
  orientation: "vertical",
  creator: { handle: "@amoebasisters" },
  platformLabel: "YouTube",
};

function dock() {
  // The whole point of AC9: the dock is a *labeled region* findable by AT.
  return screen.getByRole("region", { name: "Video preview" });
}

describe("PinnedPlayer — embed facade & src construction (AC1/AC5)", () => {
  it("builds the autoplay embed src verbatim from PlayerModal (append ?autoplay=1)", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    const iframe = dock().querySelector("iframe")!;
    // No "?" already present → autoplay appended with "?".
    expect(iframe.getAttribute("src")).toBe(`${NOCOOKIE}?autoplay=1`);
  });

  it("appends autoplay with '&' when the embedUrl already has a query", () => {
    render(
      <PinnedPlayer
        clip={{ ...clipA, embedUrl: `${NOCOOKIE}?start=30` }}
        onClose={vi.fn()}
      />
    );
    const iframe = dock().querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toBe(`${NOCOOKIE}?start=30&autoplay=1`);
  });

  it("never renders a src-less iframe (embedUrl is required — AC7 invariant)", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    const iframe = dock().querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toBeTruthy();
  });
});

describe("PinnedPlayer — fixed position, survives scroll (AC2)", () => {
  it("docks with position:fixed (out of normal flow)", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    // Tailwind `fixed` class → CSS not applied under css:false, so assert the class
    // contract (the project's established way of checking layout intent in jsdom).
    expect(dock().className).toMatch(/(?:^|\s)fixed(?:\s|$)/);
  });

  it("stays mounted and keeps the SAME iframe element after a simulated scroll", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    const before = dock().querySelector("iframe");
    window.dispatchEvent(new Event("scroll"));
    const after = dock().querySelector("iframe");
    // Same node identity → React did not re-create the embed (playback continues).
    expect(after).toBe(before);
    expect(after?.getAttribute("src")).toBe(`${NOCOOKIE}?autoplay=1`);
  });
});

describe("PinnedPlayer — single instance / swap in place (AC4/AC5)", () => {
  it("a rerender with clip B swaps the SAME dock's iframe src (no second dock)", () => {
    const { rerender } = render(
      <PinnedPlayer clip={clipA} onClose={vi.fn()} />
    );
    const iframeA = dock().querySelector("iframe")!;
    expect(iframeA.getAttribute("src")).toBe(`${NOCOOKIE}?autoplay=1`);

    rerender(<PinnedPlayer clip={clipB} onClose={vi.fn()} />);

    // Exactly one region and exactly one iframe after the swap (AC4).
    expect(screen.getAllByRole("region", { name: "Video preview" })).toHaveLength(
      1
    );
    const iframes = document.querySelectorAll("iframe");
    expect(iframes).toHaveLength(1);
    // The single iframe now points at B (AC5) — src changed in place.
    expect(iframes[0].getAttribute("src")).toBe(
      `${clipB.embedUrl}?autoplay=1`
    );
  });
});

describe("PinnedPlayer — dismiss tears down (AC6/AC11)", () => {
  it("clicking Close fires onClose (the parent unmounts the dock + iframe)", async () => {
    const onClose = vi.fn();
    render(<PinnedPlayer clip={clipA} onClose={onClose} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Close video preview" })
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("unmounting removes the dock + iframe from the DOM (no hidden iframe persists)", () => {
    const { unmount } = render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    expect(document.querySelector("iframe")).not.toBeNull();
    unmount();
    expect(
      screen.queryByRole("region", { name: "Video preview" })
    ).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("the Close control is keyboard-operable: Tab to it, then Enter activates (AC11)", async () => {
    const onClose = vi.fn();
    render(<PinnedPlayer clip={clipA} onClose={onClose} />);
    const close = screen.getByRole("button", { name: "Close video preview" });
    close.focus(); // it is a real <button> in the tab order
    expect(close).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledOnce();
    onClose.mockClear();
    await userEvent.keyboard(" "); // Space also activates a native button
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("PinnedPlayer — labeled, non-modal region (AC9)", () => {
  it("is a <section> exposed as a region named 'Video preview'", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    const region = dock();
    expect(region.tagName).toBe("SECTION");
    expect(region).toHaveAttribute("aria-label", "Video preview");
  });

  it("is NOT a modal dialog and applies NO aria-modal / focus trap", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    const region = dock();
    expect(region).not.toHaveAttribute("role", "dialog");
    expect(region).not.toHaveAttribute("aria-modal");
    expect(screen.queryByRole("dialog")).toBeNull();
    // No backdrop/overlay sibling (non-modal): the only role here is the region.
    expect(region.getAttribute("aria-modal")).toBeNull();
  });
});

describe("PinnedPlayer — reduced motion (AC12)", () => {
  it("applies the motion dock-in class when motion is allowed", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} prefersReduced={false} />);
    expect(dock().className).toMatch(/pinned-dock-in/);
  });

  it("omits the motion dock-in class when prefers-reduced-motion is set", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} prefersReduced />);
    expect(dock().className).not.toMatch(/pinned-dock-in/);
  });
});

describe("PinnedPlayer — AA chrome, never color-alone (AC13)", () => {
  it("the Close control carries the WORD 'Close' (affordance is the label, not hue)", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    const close = screen.getByRole("button", { name: "Close video preview" });
    // Visible text contains the word "Close" (the glyph alone would fail AC13).
    expect(close.textContent).toMatch(/Close/);
  });

  it("chrome is white text on the ink bar (the verified-AA token pairing)", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    const region = dock();
    // The dock root carries the ink background + white text token classes (white-on-ink
    // ≈15:1, clears AA/AAA — design §8 AC13). We assert the token contract, since the
    // numeric ratio is verified by the labels.ts chip-contrast precedent + UX eval.
    expect(region.className).toMatch(/bg-ink/);
    expect(region.className).toMatch(/text-white/);
    // 2px ink border + offset shadow reinforce the boundary (not color alone).
    expect(region.className).toMatch(/border-2/);
    expect(region.className).toMatch(/border-ink/);
  });

  it("credits the creator alongside (handle · platformLabel)", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    expect(
      screen.getByText("@2minuteclassroom · YouTube")
    ).toBeInTheDocument();
    // The iframe accessible name = the caption (the embed's title, per PlayerModal).
    expect(dock().querySelector("iframe")).toHaveAttribute(
      "title",
      "Glycolysis in 2 minutes"
    );
  });
});

describe("PinnedPlayer — action row (issue #123, in-player-curation §3.3/§3.4/§5)", () => {
  it("signed in (onCurate + onDismiss) renders BOTH actions with the verbatim labels + aria", () => {
    render(
      <PinnedPlayer
        clip={clipA}
        onClose={vi.fn()}
        signedIn
        onCurate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    // Curate: primary, aria-haspopup=dialog, aria-label matches CandidateActions verbatim (§3.3).
    const curate = screen.getByRole("button", {
      name: "Curate this clip: Glycolysis in 2 minutes",
    });
    expect(curate).toHaveAttribute("aria-haspopup", "dialog");
    expect(curate.textContent).toMatch(/Curate/);
    expect(curate.className).toMatch(/bg-brand/);
    expect(curate.className).toMatch(/flex-1/); // grows to dominate the row
    // Not relevant: secondary, the SAME word the card uses, no flex-1 (intrinsic width).
    const dismiss = screen.getByRole("button", {
      name: "Dismiss as not relevant: Glycolysis in 2 minutes",
    });
    expect(dismiss.textContent).toMatch(/Not relevant/);
    expect(dismiss.className).toMatch(/bg-white/);
    expect(dismiss.className).not.toMatch(/flex-1/);
    // Both are 44px touch targets (§3.3).
    expect(curate.className).toMatch(/min-h-\[44px\]/);
    expect(dismiss.className).toMatch(/min-h-\[44px\]/);
  });

  it("fires onCurate / onDismiss when its button is activated (signed in)", async () => {
    const onCurate = vi.fn();
    const onDismiss = vi.fn();
    render(
      <PinnedPlayer
        clip={clipA}
        onClose={vi.fn()}
        signedIn
        onCurate={onCurate}
        onDismiss={onDismiss}
      />
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Curate this clip: Glycolysis in 2 minutes",
      })
    );
    expect(onCurate).toHaveBeenCalledOnce();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Dismiss as not relevant: Glycolysis in 2 minutes",
      })
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("logged out renders the single Curate-this-video CTA and NO Not-relevant button (State J)", () => {
    render(
      <PinnedPlayer
        clip={clipA}
        onClose={vi.fn()}
        signedIn={false}
        onCurate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", {
        name: "Curate this video — log in to write a context note and vouch for it",
      })
    ).toBeInTheDocument();
    // No dismiss button is shown logged out (no false optimistic hide — DW4).
    expect(
      screen.queryByRole("button", { name: /Dismiss as not relevant/ })
    ).toBeNull();
    // The signed-in "Curate" label is also absent (the logged-out CTA is the only action).
    expect(
      screen.queryByRole("button", { name: /^Curate this clip:/ })
    ).toBeNull();
  });

  it("renders no action row at all when onCurate is absent (e.g. a stale dock)", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} signedIn />);
    expect(
      screen.queryByRole("button", { name: /Curate/ })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Not relevant/ })
    ).toBeNull();
  });

  it("the action row is INSIDE the non-modal region and does not auto-focus on open (§7)", () => {
    render(
      <PinnedPlayer
        clip={clipA}
        onClose={vi.fn()}
        signedIn
        onCurate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    const region = dock();
    const curate = screen.getByRole("button", {
      name: "Curate this clip: Glycolysis in 2 minutes",
    });
    const dismissBtn = screen.getByRole("button", {
      name: "Dismiss as not relevant: Glycolysis in 2 minutes",
    });
    // Tabbable, real buttons within the labeled region — but focus is not stolen on open.
    expect(region.contains(curate)).toBe(true);
    expect(region.contains(dismissBtn)).toBe(true);
    expect(region.contains(document.activeElement)).toBe(false);
  });

  it("the action row renders AFTER the frame in DOM order (watch → act; §3.1)", () => {
    render(
      <PinnedPlayer
        clip={clipA}
        onClose={vi.fn()}
        signedIn
        onCurate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    const region = dock();
    const frame = region.querySelector("iframe")!;
    const curate = screen.getByRole("button", {
      name: "Curate this clip: Glycolysis in 2 minutes",
    });
    // Curate comes after the iframe in document order (the action row sits below the frame).
    expect(
      frame.compareDocumentPosition(curate) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe("PinnedPlayer — iframe embed posture (security: facade attrs)", () => {
  it("uses the same allow-list and allowFullScreen as PlayerModal (no extra perms)", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    const iframe = dock().querySelector("iframe")!;
    expect(iframe.getAttribute("allow")).toBe(
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    );
    expect(iframe).toHaveAttribute("allowfullscreen");
  });

  it("only loads the embed host given to it (no untrusted string injection)", () => {
    render(<PinnedPlayer clip={clipA} onClose={vi.fn()} />);
    const src = dock().querySelector("iframe")!.getAttribute("src")!;
    expect(src.startsWith("https://www.youtube-nocookie.com/embed/")).toBe(true);
  });
});
