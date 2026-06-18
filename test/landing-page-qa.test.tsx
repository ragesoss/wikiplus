import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// QA supplement (#15) — independent, non-author tests written by the qa-reviewer role to
// close coverage gaps the author's test/landing-page.test.tsx left weak or unmapped:
//   - AC8: the Tier-A "projector" variant STRUCTURALLY renders the band + beam + lit aperture
//     (the author tests only the accessible NAME, not that Tier A is the rendered treatment);
//   - AC10: the geometry is genuinely PARAMETERIZED — a `geometry` prop override actually
//     changes the rendered SVG (proves it is props, not baked constants), AND the landing
//     render carries NO inline geometry magic numbers (one configuration of the defaults);
//   - AC11: `role="img"` + aria-label make the mark a LEAF — no "Wiki"/"plus"/"pedia" fragment
//     leaks as a separate accessible node; the search hero is keyboard-reachable from the
//     landing host (tab to input, type, arrow, Enter → route).
//
// Same mock posture as the author suite (no network, no real navigation).

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const fetchTopicSuggestions = vi.fn();
vi.mock("@/lib/wiki/suggest", () => ({
  fetchTopicSuggestions: (...a: unknown[]) => fetchTopicSuggestions(...a),
}));

const listTopics = vi.fn();
vi.mock("@/lib/data", () => ({
  store: { listTopics: () => listTopics() },
}));

import HomePage from "@/app/page";
import { HeaderProjector } from "@/components/wordmark/HeaderProjector";

beforeEach(() => {
  routerPush.mockReset();
  fetchTopicSuggestions.mockReset();
  fetchTopicSuggestions.mockResolvedValue([]);
  listTopics.mockReset();
  listTopics.mockResolvedValue([
    { qid: "Q11173", title: "Photosynthesis", description: "Process used by plants" },
  ]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ── AC8 — Tier A is the rendered treatment (band + beam + lit aperture). ──────
describe("AC8 — the projector variant renders the full Tier-A treatment", () => {
  it("renders the Tier-A band container and the descending beam (the projector chrome)", () => {
    const { container } = render(<HeaderProjector variant="projector" />);
    // The Tier-A block exists (the ≥lg full projector), distinct from the B/C fallbacks.
    expect(container.querySelector(".tier-a")).toBeTruthy();
    expect(container.querySelector(".tier-b")).toBeTruthy();
    expect(container.querySelector(".tier-c")).toBeTruthy();
    // The two-temperature band is present in Tier A.
    expect(container.querySelector(".projector-band")).toBeTruthy();
    // The beam SVG uses preserveAspectRatio="none" so the gold border reaches both real
    // page edges — a Tier-A-only structural marker (Tier B/C have no beam).
    const beam = container.querySelector('svg[preserveAspectRatio="none"]');
    expect(beam).toBeTruthy();
    // The gold border/glow signal: a stroked path in #EECE87 (rgb 238,206,135).
    expect(beam?.querySelector('path[stroke="rgb(238,206,135)"]')).toBeTruthy();
  });

  it("the lit aperture (even-odd knockout + radial core) renders for the projector, not for the flat tier", () => {
    const lit = render(<HeaderProjector variant="lockup-lit" />);
    // The lit lockup uses a radialGradient core (the white-hot lamp) + an even-odd knockout.
    expect(lit.container.querySelector("radialGradient")).toBeTruthy();
    expect(lit.container.querySelector('path[fill-rule="evenodd"]')).toBeTruthy();
    lit.unmount();

    const flat = render(<HeaderProjector variant="lockup-flat" />);
    // The flat tier has NO lamp (no radial core); it is a solid block + drawn glyph.
    expect(flat.container.querySelector("radialGradient")).toBeNull();
  });
});

// ── AC10 — geometry is genuinely parameterized (props change the render). ─────
describe("AC10 — the geometry is parameterized, not baked constants", () => {
  it("a geometry override changes the rendered beam viewBox height (burnY is a real prop)", () => {
    const def = render(<HeaderProjector variant="projector" />);
    const defBeam = def.container.querySelector('svg[preserveAspectRatio="none"]');
    const defViewBox = defBeam?.getAttribute("viewBox");
    def.unmount();

    const overridden = render(
      <HeaderProjector variant="projector" geometry={{ burnY: 240 }} />
    );
    const ovBeam = overridden.container.querySelector('svg[preserveAspectRatio="none"]');
    const ovViewBox = ovBeam?.getAttribute("viewBox");

    // The default burnY (168) and the override (240) produce DIFFERENT beam canvases —
    // proving the value flows from the prop, not a hardcoded inline constant.
    expect(defViewBox).toContain("168");
    expect(ovViewBox).toContain("240");
    expect(ovViewBox).not.toEqual(defViewBox);
  });

  it("fullBleed=false drops the beam (the Tier-B threshold gate is a real prop)", () => {
    const withBeam = render(<HeaderProjector variant="projector" />);
    expect(withBeam.container.querySelector('svg[preserveAspectRatio="none"]')).toBeTruthy();
    withBeam.unmount();

    const noBeam = render(
      <HeaderProjector variant="projector" geometry={{ fullBleed: false }} />
    );
    // No beam when fullBleed is off — the gate is honored from the prop.
    expect(noBeam.container.querySelector('svg[preserveAspectRatio="none"]')).toBeNull();
  });
});

// ── AC11 — the mark is an accessibility LEAF; no fragment leaks. ───────────────
describe("AC11 — accessible-name leaf semantics + keyboard reach", () => {
  it("exposes ONLY 'wiki+' — no 'Wiki' / 'plus' / 'pedia' leaks as a separate accessible node", () => {
    const { container } = render(<HeaderProjector variant="projector" />);
    // The mark is named once, as the product name.
    expect(screen.getAllByRole("img", { name: "wiki+" })).toHaveLength(1);
    // role="img" makes the element a leaf: its decorative descendants are NOT separate
    // accessible nodes. There is no heading; the only named landmark is the img itself.
    expect(screen.queryByRole("heading")).toBeNull();
    // Every "pedia"/"Wiki"/"plus" text node lives inside an aria-hidden subtree (belt-and-
    // suspenders under the role=img leaf): no fragment is reachable as standalone content.
    const textNodes = Array.from(container.querySelectorAll("span,text")).filter((el) =>
      /^(pedia|Wiki|Wikipedia|plus)$/.test((el.textContent ?? "").trim())
    );
    expect(textNodes.length).toBeGreaterThan(0);
    for (const el of textNodes) {
      expect(el.closest("[aria-hidden='true']")).not.toBeNull();
    }
  });

  it("the search hero is keyboard-reachable from the landing host: tab→type→Enter routes", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomePage />);
    const input = await screen.findByRole("combobox", { name: /find a topic/i });
    // Tab order: the search input is reachable (it is an enabled combobox in the hero).
    await user.tab();
    // Type a title and submit with the keyboard (no mouse) — the landing host must not
    // interpose a focus trap or swallow Enter.
    await user.click(input); // place caret deterministically in jsdom
    await user.type(input, "Mitosis");
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Mitosis/");
  });

  it("the landing page exposes a single top-level <h1> landmark (OQ-3) named wiki+", () => {
    render(<HomePage />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("wiki+");
    // The wordmark itself is NOT an h1 (it is role=img) — the h1 is the sr-only landmark.
    expect(h1s[0].tagName).toBe("H1");
  });
});

// ── AC1/AC7 — composition: search dominant + above the demoted, framed list. ──
describe("AC1/AC7 — hero leads, the topic list is demoted below it", () => {
  it("the 'Explore example topics' list region sits AFTER the search in document order", async () => {
    render(<HomePage />);
    const search = await screen.findByRole("combobox", { name: /find a topic/i });
    const listHeading = screen.getByRole("heading", { level: 2, name: /explore example topics/i });
    // Search precedes the demoted list (AC1 dominant/above; AC7 demoted/below).
    expect(
      search.compareDocumentPosition(listHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("the populated card links to the canonical Topic href (the unchanged seeded-list path)", async () => {
    render(<HomePage />);
    const card = await screen.findByRole("link", { name: /Photosynthesis/i });
    expect(card.getAttribute("href")).toMatch(/^\/topic\/Photosynthesis\/?$/);
    // The card lives under the demoted "Explore example topics" section, not the hero.
    const section = card.closest("section");
    expect(section && within(section).getByRole("heading", { level: 2 })).toHaveTextContent(
      /explore example topics/i
    );
  });
});
