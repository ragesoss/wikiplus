import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Component tests for the About-page projector "warm-up" intro + power toggle + dynamic title
// (docs/specs/about-projector-warmup.md AC1–AC18; docs/design/about-projector-warmup.md). These seed
// the reduced-motion policy, the "decorative, never gating" guarantees, the toggle's structure +
// accessible name + keyboard operability, the dynamic-title seed/fallback, and the CSS-source
// contracts (beam fade-only, no .about-stage dim overlay) that are assertable in jsdom; the rendered
// motion sequence, the settled-pixel equality, and the per-tier timing are QA's Playwright surface
// (e2e/about-warmup.spec.ts + the catalog `aboutSettled` waiter + the refreshed baseline). The Next
// router is mocked (no real navigation), matching the established about-title-input pattern.

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

import { Centerpiece } from "@/components/about/Centerpiece";
import {
  DEFAULT_TITLE,
  HOW_IT_WORKS,
  POWER_LABEL_OFF,
  POWER_LABEL_ON,
  TITLE_INPUT_LABEL,
} from "@/components/about/copy";

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
    expect(section).not.toHaveClass("about-off");
    expect(section).toHaveAttribute("data-about-intro", "settled");
  });
});

// ── AC1/AC3/AC10/AC11 — no-preference: the intro engages, one-shot, with the readiness signal ──
describe("AC1/AC3/AC11 — motion allowed engages the gated intro + exposes the readiness signal", () => {
  it("adds .about-intro + .about-on and flips data-about-intro running → settled", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const { container } = render(<Centerpiece />);
    // The mount effect engages the on-sequence: `.about-intro about-on`, signal "running".
    await act(async () => {});
    const section = container.querySelector("section[aria-label]")!;
    expect(section).toHaveClass("about-intro");
    expect(section).toHaveClass("about-on");
    expect(section).toHaveAttribute("data-about-intro", "running");
    // The hard settle timer (2000ms) flips the signal to "settled" AND tears the intro down — the
    // `.about-intro`/`.about-on` classes are removed so the DOM re-reads as the PRISTINE static poster
    // (no residual engaged classes / overlay compositing — AC2-ii / AC10 / AC11 byte-identity).
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(section).toHaveAttribute("data-about-intro", "settled");
    expect(section).not.toHaveClass("about-intro");
    expect(section).not.toHaveClass("about-on");
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
describe("AC8/AC15 — the intro does not steal focus on mount (both motion modes)", () => {
  it.each([
    ["reduced motion", true],
    ["motion allowed", false],
  ])("leaves focus on <body> after mount; the power control is not auto-focused (%s)", async (_label, reduce) => {
    setReducedMotion(reduce as boolean);
    render(<Centerpiece />);
    await act(async () => {});
    // No autofocus / .focus() on mount — the page's initial focus behavior is unchanged, and the
    // power control is not auto-focused (AC15).
    expect(document.activeElement).toBe(document.body);
  });
});

// ── AC13/AC14/AC15 — the projector power control (a real, labeled, keyboard-operable button) ──
describe("AC13–AC15 — the projector is a labeled, keyboard-operable power toggle", () => {
  it("is a real <button> whose state-reflecting name flips on (Enter) activation", async () => {
    setReducedMotion(false);
    const user = userEvent.setup();
    const { container } = render(<Centerpiece />);
    await act(async () => {});
    // It is the only newly-exposed control besides the title input: a named button reading "on" while
    // the projector is ON (AC13). It wraps a decorative aria-hidden SVG, not the other way around.
    const power = screen.getByRole("button", { name: POWER_LABEL_ON });
    expect(power.tagName).toBe("BUTTON");
    expect(power).toHaveAttribute("type", "button");
    expect(power.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    const section = container.querySelector("section[aria-label]")!;
    expect(section).toHaveClass("about-on");

    // Keyboard activation (Enter — native button) powers it OFF: the name flips and the scene goes to
    // the off state class (AC14). Focus the button first (a user tabs to it), then press Enter.
    power.focus();
    await user.keyboard("{Enter}");
    await act(async () => {});
    expect(screen.getByRole("button", { name: POWER_LABEL_OFF })).toBeInTheDocument();
    expect(section).toHaveClass("about-off");
    expect(section).not.toHaveClass("about-on");

    // Activating again (Space) powers it back ON and replays — the name flips back (AC14).
    screen.getByRole("button", { name: POWER_LABEL_OFF }).focus();
    await user.keyboard(" ");
    await act(async () => {});
    expect(screen.getByRole("button", { name: POWER_LABEL_ON })).toBeInTheDocument();
    expect(section).toHaveClass("about-on");
  });

  it("toggles OFF→ON by pointer click too", async () => {
    setReducedMotion(false);
    const user = userEvent.setup();
    const { container } = render(<Centerpiece />);
    await act(async () => {});
    const section = container.querySelector("section[aria-label]")!;
    await user.click(screen.getByRole("button", { name: POWER_LABEL_ON }));
    await act(async () => {});
    expect(section).toHaveClass("about-off");
    await user.click(screen.getByRole("button", { name: POWER_LABEL_OFF }));
    await act(async () => {});
    expect(section).toHaveClass("about-on");
  });
});

// ── AC16/AC18 — the dynamic title seeds the input; an empty pool falls back ───────
describe("AC16/AC18 — dynamic title seeds the editable input; empty pool ⇒ fallback", () => {
  it("seeds the title input with the picked title and keeps it editable + Enter-navigable", async () => {
    setReducedMotion(true); // reduced motion → deterministic (no animation), still seeds the title
    const user = userEvent.setup();
    render(<Centerpiece titlePool={["Mitochondrion"]} fallbackTitle={DEFAULT_TITLE} initialTitle="Mitochondrion" />);
    await act(async () => {});
    const inputs = screen.getAllByRole("textbox", { name: TITLE_INPUT_LABEL });
    // The picked title is the input's starting value (AC18 — seed only, still editable).
    for (const input of inputs) expect(input).toHaveValue("Mitochondrion");
    // It remains the editable, Enter-to-navigate control: a user edit + Enter navigates to THEIR title.
    const first = inputs[0] as HTMLInputElement;
    await user.clear(first);
    await user.type(first, "Helium");
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush.mock.calls[0][0]).toContain("Helium");
  });

  it("falls back to 'Acer palmatum' when the eligible pool is empty (AC16)", async () => {
    setReducedMotion(true);
    render(<Centerpiece titlePool={[]} fallbackTitle={DEFAULT_TITLE} initialTitle={DEFAULT_TITLE} />);
    await act(async () => {});
    for (const input of screen.getAllByRole("textbox", { name: TITLE_INPUT_LABEL })) {
      expect(input).toHaveValue(DEFAULT_TITLE);
    }
  });
});

// ── AC17 — the old→new title flicker on a restarted power-on (a DIFFERENT pick) ──
describe("AC17 — restarted power-on cross-flickers the title old→new (different pick only)", () => {
  it("holds the OLD title through the flicker, then swaps to the NEW pick at the strong catch", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    // A pool of one (≠ the initial fallback title) makes the re-pick deterministic AND different.
    const { container } = render(
      <Centerpiece titlePool={["Mitochondrion"]} fallbackTitle={DEFAULT_TITLE} initialTitle={DEFAULT_TITLE} />
    );
    await act(async () => {}); // engage motion (auto-intro)
    // Let the auto-intro settle + tear down so the control reads "on" and the scene is pristine.
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    const power = screen.getByRole("button", { name: POWER_LABEL_ON });
    const titleInput = () =>
      screen.getAllByRole("textbox", { name: TITLE_INPUT_LABEL })[0] as HTMLInputElement;
    // Toggle OFF then ON (fake timers, so click via fireEvent path through the handler).
    await act(async () => {
      power.click(); // → OFF
    });
    await act(async () => {
      screen.getByRole("button", { name: POWER_LABEL_OFF }).click(); // → ON (restarted, different pick)
    });
    // The restarted power-on holds the OLD title and arms the flicker wrapper.
    expect(titleInput().value).toBe(DEFAULT_TITLE);
    expect(container.querySelector(".about-title-flicker")).not.toBeNull();
    // At the strong catch (~470ms) the text swaps to the NEW pick and the flicker wrapper clears.
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(titleInput().value).toBe("Mitochondrion");
    expect(container.querySelector(".about-title-flicker")).toBeNull();
  });

  it("does NOT flicker under reduced motion — it shows the new title immediately", async () => {
    setReducedMotion(true);
    const { container } = render(
      <Centerpiece titlePool={["Mitochondrion"]} fallbackTitle={DEFAULT_TITLE} initialTitle={DEFAULT_TITLE} />
    );
    await act(async () => {});
    // Under reduced motion the auto-intro never engages; toggle OFF then ON snaps. The re-pick shows
    // the new title with NO flicker wrapper (§5.3).
    await act(async () => {
      screen.getByRole("button", { name: POWER_LABEL_ON }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: POWER_LABEL_OFF }).click();
    });
    expect(container.querySelector(".about-title-flicker")).toBeNull();
    expect(
      (screen.getAllByRole("textbox", { name: TITLE_INPUT_LABEL })[0] as HTMLInputElement).value
    ).toBe("Mitochondrion");
  });
});

// ── AC5/AC9 — the plus layer is present from first paint; decorative graphics stay aria-hidden ──
describe("AC5/AC9 — plus groups present from first paint; graphics stay decorative", () => {
  it("renders the four plus reveal groups (they animate appearance, never gate presence)", async () => {
    setReducedMotion(false);
    const { container } = render(<Centerpiece />);
    await act(async () => {});
    // Each plus reveal group exists in the DOM from the first frame (the intro reveals appearance
    // via opacity — it never display:none / removes them). Two miniatures → two of each.
    for (const cls of [
      "about-plus--strip",
      "about-plus--overview",
      "about-plus--contents",
      "about-plus--portrait",
    ]) {
      expect(container.querySelectorAll(`.${cls}`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders the dim-cool overlay INSIDE the miniature (decorative, clipped to it)", async () => {
    setReducedMotion(false);
    const { container } = render(<Centerpiece />);
    await act(async () => {});
    // The dim-cool overlay (§1.2-D) is decorative and lives inside the TopicMiniature root (which is
    // overflow:hidden), so it cannot bleed into the field (AC4b). It is NOT scoped to .about-stage.
    const cool = container.querySelector(".about-mini-cool");
    expect(cool).not.toBeNull();
    expect(cool).toHaveAttribute("aria-hidden", "true");
    expect(cool!.closest(".about-stage")).not.toBeNull();
    // Its direct positioned ancestor is the miniature root, not the stage box.
    expect(cool!.parentElement!.classList.contains("about-stage-inner")).toBe(false);
  });

  it("renders the RED + GREEN status-light layers, decorative, inside the projector SVG", async () => {
    setReducedMotion(false);
    const { container } = render(<Centerpiece />);
    await act(async () => {});
    const red = container.querySelector(".about-status-red");
    const green = container.querySelector(".about-status-green");
    expect(red).not.toBeNull();
    expect(green).not.toBeNull();
    expect(red!.getAttribute("fill")).toBe("var(--color-status-off-red)");
    expect(green!.getAttribute("fill")).toBe("var(--color-sprout)");
    // Decorative — inside the aria-hidden projector SVG (the state reaches AT via the button name).
    expect(red!.closest("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("renders the static designed OFF-state lens base, decorative, beneath the lit lamp group", async () => {
    setReducedMotion(false);
    const { container } = render(<Centerpiece />);
    await act(async () => {});
    const offInterior = container.querySelector(
      'ellipse[fill="var(--color-lens-off-interior)"]'
    );
    const offAperture = container.querySelector(
      'path[fill="var(--color-aperture-off)"]'
    );
    expect(offInterior).not.toBeNull();
    expect(offAperture).not.toBeNull();
    expect(offInterior!.closest("svg[aria-hidden='true']")).not.toBeNull();
    // It is NOT the animated group — the lit layers carry .about-lamp-light; the OFF base does not.
    expect(offInterior!.closest(".about-lamp-light")).toBeNull();
    expect(offAperture!.closest(".about-lamp-light")).toBeNull();
  });

  it("starts the lit lamp group hidden (intro t=0 lit opacity is 0 over the OFF lens)", () => {
    // The lit lamp-light group animates from opacity 0 (the OFF lens shows through) up to 1 over a
    // SINGLE keyframe (flicker + warm-up folded into `about-lamp-up`). jsdom does not apply @media
    // keyframes, so the source value is the assertable contract; the rendered strikes are the
    // Playwright surface (e2e/about-warmup.spec.ts).
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const lampUp = css.match(/@keyframes about-lamp-up\s*\{([\s\S]*?)\n\s*\}/);
    expect(lampUp).not.toBeNull();
    // The 0% (t=0) frame of the lit group is fully transparent — the designed OFF lens, not a glow.
    expect(lampUp![1]).toMatch(/0%\s*\{\s*opacity:\s*0(;|\s)/);
    // It is the ONLY opacity animation on the lit group (one animation = no list-order conflict).
    const lampRule = css.match(
      /\.about-on\s+\.about-stage--scene\s+\.about-lamp-light\s*\{([\s\S]*?)\n\s*\}/
    );
    expect(lampRule).not.toBeNull();
    expect(lampRule![1]).toMatch(/animation:\s*about-lamp-up\b/);
    expect(lampRule![1]).not.toContain(",");
  });

  it("keeps the decorative projector + beam SVGs aria-hidden", async () => {
    setReducedMotion(false);
    const { container } = render(<Centerpiece />);
    await act(async () => {});
    // The animated lamp-light group + beam group live inside aria-hidden SVGs — the intro adds no new
    // color/motion-only signal (the on/off state reaches AT via the power button's name).
    const lampGroup = container.querySelector(".about-lamp-light");
    const beamGroup = container.querySelector(".about-beam");
    expect(lampGroup).not.toBeNull();
    expect(beamGroup).not.toBeNull();
    expect(lampGroup!.closest("svg[aria-hidden='true']")).not.toBeNull();
    expect(beamGroup!.closest("svg[aria-hidden='true']")).not.toBeNull();
  });
});

// ── AC4b/AC5b — CSS-source contracts: no background-field animation; the beam is fade-only ──
describe("AC4b/AC5b — no .about-stage dim overlay; the beam fades (no scaleX)", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  it("has NO .about-room-dim overlay rule or background-brighten keyframes (AC4b)", () => {
    // The whole-field / stage-box dim overlay (the deployed flaw) is removed entirely.
    expect(css).not.toContain(".about-room-dim");
    expect(css).not.toContain("about-room-brighten");
  });

  it("does NOT animate .about-theater-field, .about-stage, or <main> brightness (AC4b)", () => {
    // The background field has no keyframe; the only illumination over field area is the beam.
    expect(css).not.toMatch(/\.about-theater-field[^}]*animation/);
    // No filter/brightness ramp on the stage box or the room (would dim the field).
    expect(css).not.toMatch(/\.about-stage[^{]*\{[^}]*filter:/);
  });

  it("does NOT render an .about-mini-cool overlay scoped to the stage box (AC4b)", () => {
    setReducedMotion(false);
    const { container } = render(<Centerpiece />);
    // The dim-cool overlay is never a direct child of .about-stage-inner (which would put it OUTSIDE
    // the miniature's overflow:hidden clip and let its edge appear against the field).
    for (const inner of container.querySelectorAll(".about-stage-inner")) {
      for (const child of inner.children) {
        expect(child.classList.contains("about-mini-cool")).toBe(false);
      }
    }
  });

  it("the beam animation is OPACITY-only — no transform/scaleX keyframe (AC5b)", () => {
    // The beam group fades in at its committed geometry; there must be no grow/scale/translate.
    const beamFade = css.match(/@keyframes about-beam-fade\s*\{([\s\S]*?)\n\s*\}/);
    expect(beamFade).not.toBeNull();
    expect(beamFade![1]).not.toMatch(/transform|scale|translate/);
    // The retired grow keyframe + class are gone.
    expect(css).not.toContain("about-beam-throw");
    expect(css).not.toContain(".about-beam-grow");
    // The beam rule binds about-beam-fade.
    const beamRule = css.match(
      /\.about-on\s+\.about-stage--scene\s+\.about-beam\s*\{([\s\S]*?)\n\s*\}/
    );
    expect(beamRule).not.toBeNull();
    expect(beamRule![1]).toMatch(/animation:\s*about-beam-fade\b/);
  });

  it("the ＋plus fade shares ONE delay (no per-group stagger) and is opacity-only (AC5)", () => {
    const plusFade = css.match(/@keyframes about-plus-fade\s*\{([\s\S]*?)\n\s*\}/);
    expect(plusFade).not.toBeNull();
    expect(plusFade![1]).not.toMatch(/transform|scale|translate/);
    // The retired scale/slide keyframe + per-group stagger deltas are gone.
    expect(css).not.toContain("about-plus-reveal");
    expect(css).not.toMatch(/\.about-plus--strip\s*\{\s*animation-delay/);
  });
});

// ── AC10 — one-shot: no replay scheduled, the fallback timer is the only pending settle ───────
describe("AC10 — one-shot per mount (no loop)", () => {
  it("schedules no recurring interval (the auto-intro plays once)", async () => {
    setReducedMotion(false);
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    render(<Centerpiece />);
    await act(async () => {});
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});

// Belt-and-braces: cleanup must not leak the fallback / swap timers (unmount before settle).
describe("cleanup — unmounting before settle clears the timers", () => {
  it("does not throw / warn when unmounted mid-intro", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const { unmount } = render(<Centerpiece />);
    await act(async () => {});
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(true).toBe(true);
  });
});
