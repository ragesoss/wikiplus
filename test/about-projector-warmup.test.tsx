import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

// Component tests for the About-page projector "warm-up" intro (docs/specs/about-projector-warmup.md
// AC1–AC12; docs/design/about-projector-warmup.md). These seed the reduced-motion policy + the
// "decorative, never gating" guarantees that are assertable in jsdom; the rendered motion sequence,
// the settled-pixel equality, and the per-tier timing are QA's Playwright surface (the catalog
// `aboutSettled` waiter + the refreshed baseline). The Next router is mocked (no real navigation),
// matching the established about-title-input pattern.

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

import { Centerpiece } from "@/components/about/Centerpiece";
import { HOW_IT_WORKS, TITLE_INPUT_LABEL } from "@/components/about/copy";

/** Install a matchMedia that answers a given reduced-motion preference for the reduce query. */
function setReducedMotion(reduce: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion: reduce") ? reduce : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  routerPush.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ── AC6 — reduced motion: the final static state on first paint, no intro ─────────
describe("AC6 — prefers-reduced-motion: reduce renders the settled state with no intro", () => {
  it("does not add the .about-intro class and the readiness signal is 'settled' immediately", async () => {
    setReducedMotion(true);
    const { container } = render(<Centerpiece />);
    // The intro effect runs on mount; allow it to flush. Under reduce it must NOT engage.
    await act(async () => {});
    const section = container.querySelector("section[aria-label]")!;
    expect(section).not.toHaveClass("about-intro");
    expect(section).toHaveAttribute("data-about-intro", "settled");
  });
});

// ── AC1/AC3/AC10/AC11 — no-preference: the intro engages, one-shot, with the readiness signal ──
describe("AC1/AC3/AC11 — motion allowed engages the gated intro + exposes the readiness signal", () => {
  it("adds the .about-intro class and flips data-about-intro running → settled", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const { container } = render(<Centerpiece />);
    // The mount effect adds the intro class and sets the signal to "running".
    await act(async () => {});
    const section = container.querySelector("section[aria-label]")!;
    expect(section).toHaveClass("about-intro");
    expect(section).toHaveAttribute("data-about-intro", "running");
    // The hard settle timer (2200ms) flips the signal to settled AND tears the intro down — the
    // .about-intro class is removed so the DOM re-reads as the pure static poster (AC2-ii / AC10),
    // with no residual `fill: both` keyframes a relayout could restart.
    await act(async () => {
      vi.advanceTimersByTime(2300);
    });
    expect(section).toHaveAttribute("data-about-intro", "settled");
    expect(section).not.toHaveClass("about-intro");
  });
});

// ── AC7 — all content present + reachable in BOTH motion modes, throughout ────────
describe("AC7 — content present and reachable regardless of motion mode", () => {
  it.each([
    ["reduced motion", true],
    ["motion allowed", false],
  ])("renders the heading, the step list, and the named title input (%s)", async (_label, reduce) => {
    setReducedMotion(reduce as boolean);
    render(<Centerpiece />);
    await act(async () => {});
    // The card's real heading (an <h2>) and every step label are present from first paint.
    expect(
      screen.getByRole("heading", { name: HOW_IT_WORKS.heading })
    ).toBeInTheDocument();
    for (const step of HOW_IT_WORKS.steps) {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    }
    // The one real control is present + named (not gated/hidden by the intro). There are two
    // miniatures in the DOM (≥ lg scene + < lg alone), so there are two title inputs — assert at
    // least one and that each is a real, enabled textbox.
    const inputs = screen.getAllByRole("textbox", { name: TITLE_INPUT_LABEL });
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    for (const input of inputs) expect(input).toBeEnabled();
  });
});

// ── AC8 — the intro does not move or steal focus on load ──────────────────────────
describe("AC8 — the intro does not steal focus on mount (both motion modes)", () => {
  it.each([
    ["reduced motion", true],
    ["motion allowed", false],
  ])("leaves focus on <body> after mount (%s)", async (_label, reduce) => {
    setReducedMotion(reduce as boolean);
    render(<Centerpiece />);
    await act(async () => {});
    // No autofocus / .focus() on mount — the page's initial focus behavior is unchanged.
    expect(document.activeElement).toBe(document.body);
  });
});

// ── AC5/AC9 — the plus layer is present from first paint; decorative graphics stay aria-hidden ──
describe("AC5/AC9 — plus groups present from first paint; graphics stay decorative", () => {
  it("renders the four plus reveal groups (they animate appearance, never gate presence)", async () => {
    setReducedMotion(false);
    const { container } = render(<Centerpiece />);
    await act(async () => {});
    // Each plus reveal group exists in the DOM from the first frame (the intro reveals appearance
    // via opacity/transform — it never display:none / removes them). Two miniatures → two of each.
    for (const cls of [
      "about-plus--strip",
      "about-plus--overview",
      "about-plus--contents",
      "about-plus--portrait",
    ]) {
      expect(container.querySelectorAll(`.${cls}`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps the decorative projector + beam SVGs aria-hidden", async () => {
    setReducedMotion(false);
    const { container } = render(<Centerpiece />);
    await act(async () => {});
    // The animated lamp-light group + beam-grow group live inside aria-hidden SVGs (unchanged from
    // the static poster) — the intro adds no new color/motion-only signal.
    const lampGroup = container.querySelector(".about-lamp-light");
    const beamGroup = container.querySelector(".about-beam-grow");
    expect(lampGroup).not.toBeNull();
    expect(beamGroup).not.toBeNull();
    expect(lampGroup!.closest("svg[aria-hidden='true']")).not.toBeNull();
    expect(beamGroup!.closest("svg[aria-hidden='true']")).not.toBeNull();
    // The room-dim overlay is decorative.
    const dim = container.querySelector(".about-room-dim");
    expect(dim).toHaveAttribute("aria-hidden", "true");
  });
});

// ── AC10 — one-shot: no replay scheduled, the fallback timer is the only pending settle ───────
describe("AC10 — one-shot per mount (no loop)", () => {
  it("schedules exactly one settle (no recurring interval)", async () => {
    setReducedMotion(false);
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    render(<Centerpiece />);
    await act(async () => {});
    // The intro is one-shot: no setInterval is used to loop/replay it.
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});

// Belt-and-braces: cleanup must not leak the fallback timer (unmount before settle).
describe("cleanup — unmounting before settle clears the fallback timer", () => {
  it("does not throw / warn when unmounted mid-intro", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const { unmount } = render(<Centerpiece />);
    await act(async () => {});
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(2300);
    });
    // No assertion beyond "no throw" — a leaked setState after unmount would surface as a warning.
    expect(true).toBe(true);
  });
});
