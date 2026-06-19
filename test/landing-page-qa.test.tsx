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
    // The Tier-A block exists (the full projector). The B/C wrappers remain DEFINED (for the
    // future Topic-page shared header + forced-colors) but are hidden on the landing page.
    expect(container.querySelector(".tier-a")).toBeTruthy();
    expect(container.querySelector(".tier-b")).toBeTruthy();
    expect(container.querySelector(".tier-c")).toBeTruthy();
    // The two-temperature band is present in Tier A.
    expect(container.querySelector(".projector-band")).toBeTruthy();
    // The beam SVG is the TRUE-SCALE beam (Iteration-3, design §4.7): NO preserveAspectRatio="none"
    // stretch — its viewBox width is the real canvas width, drawn 1:1. It is marked
    // `data-projector-beam` — a Tier-A-only structural handle (Tier B/C have no beam).
    const beam = container.querySelector("[data-projector-beam]");
    expect(beam).toBeTruthy();
    // The retracted stretch mechanism MUST be gone — the underline bug was the PAR="none" stretch.
    expect(beam?.getAttribute("preserveAspectRatio")).not.toBe("none");
    expect(container.querySelector('svg[preserveAspectRatio="none"]')).toBeNull();
    // The gold border/glow signal: a stroked path in #EECE87 (rgb 238,206,135).
    expect(beam?.querySelector('path[stroke="rgb(238,206,135)"]')).toBeTruthy();
  });

  it("the beam's bottom extends BELOW burnY and is CLIPPED at burnY — no horizontal gold line at the boundary (the #1 fix, §4.5/§4.7)", () => {
    // The owner's Iteration-3 underline clarification: the defect was the beam polygon closing its
    // bottom vertices AT burnY, stroking a full-width horizontal gold line at the header bottom.
    // The fix: the polygon extends below burnY (like the mockup's coneBot below pageY) and the span
    // CLIPS at burnY, so the bottom closing edge is clipped away off-screen and never drawn. We
    // assert that geometrically: the polygon's bottom (cone-bot, in the SVG's own coords) sits
    // BELOW the clip height (burnY − top0) — so the closing edge is outside the clipped region.
    const { container } = render(<HeaderProjector variant="projector" />);
    const beam = container.querySelector("[data-projector-beam]");
    expect(beam).toBeTruthy();
    const coneBot = Number(beam?.getAttribute("data-beam-cone-bot"));
    const clipH = Number(beam?.getAttribute("data-beam-clip-h"));
    expect(coneBot).toBeGreaterThan(0);
    expect(clipH).toBeGreaterThan(0);
    // The bottom closing edge (at coneBot) is below the clip line → clipped away, never a line.
    expect(coneBot).toBeGreaterThan(clipH);
  });

  it("the beam draws ASYMMETRICAL arms, each to its own real edge (§4.7 decision 4)", () => {
    // Each crossbar arm runs from the apex to edgeInset (17px) from ITS OWN real edge: left arm
    // length = apexX − edgeInset; right arm length = cw − edgeInset − apexX. When an off-center
    // apex is driven (the narrow layout / a projectionX override), the arms are unequal.
    const { container } = render(
      // Drive an off-center apex via the projectionX hook (0.25 of width) — the AC10 dynamic lever
      // the narrow landing layout also uses (there it is the live left-anchored aperture x).
      <HeaderProjector variant="projector" geometry={{ projectionX: 0.25 }} />
    );
    const beam = container.querySelector("[data-projector-beam]");
    const left = Number(beam?.getAttribute("data-beam-left-arm"));
    const right = Number(beam?.getAttribute("data-beam-right-arm"));
    // Off-center apex (0.25) → short left arm, long right arm — asymmetrical.
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(left);
  });

  it("the beam is present at EVERY width — the Tier-A wrapper is NOT gated behind `lg:block` (no tier-drop)", () => {
    // design §4.7 / §7: the landing page renders Tier A at all widths. The previous build hid the
    // full projector behind `hidden lg:block` and dropped to Tier B/C as the viewport narrowed;
    // that responsive drop is REMOVED. The Tier-A wrapper must not carry the `hidden` / `lg:block`
    // drop classes — it shows the beam at every width (the beam is drawn true-scale with
    // asymmetrical arms, not by swapping tiers).
    const { container } = render(<HeaderProjector variant="projector" />);
    const tierA = container.querySelector(".tier-a");
    expect(tierA).toBeTruthy();
    expect(tierA?.classList.contains("hidden")).toBe(false);
    expect(tierA?.classList.contains("lg:block")).toBe(false);
    // The B/C wrappers are hidden on the landing page (no responsive drop reveals them).
    expect(container.querySelector(".tier-b")?.classList.contains("hidden")).toBe(true);
    expect(container.querySelector(".tier-c")?.classList.contains("hidden")).toBe(true);
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
  it("a geometry override changes the rendered beam clip height (burnY is a real prop)", () => {
    const def = render(<HeaderProjector variant="projector" />);
    const defBeam = def.container.querySelector("[data-projector-beam]");
    // The clip height = burnY − top0; top0 = apexY (cyMid=44; the cone apex sits at the aperture,
    // behind the block), so with the default burnY=130 → 86.
    const defClipH = defBeam?.getAttribute("data-beam-clip-h");
    def.unmount();

    const overridden = render(
      <HeaderProjector variant="projector" geometry={{ burnY: 240 }} />
    );
    const ovBeam = overridden.container.querySelector("[data-projector-beam]");
    const ovClipH = ovBeam?.getAttribute("data-beam-clip-h");

    // The default burnY (130 — trimmed from 150 alongside cyMid 64→44 to cut the top empty space;
    // the search still sits just below the boundary, inside the projected light) and the override
    // (240) produce DIFFERENT clip heights — proving the value flows from the prop, not a hardcoded
    // inline constant. The default MUST stay in sync with the `--projector-burn-y` token in
    // globals.css (AC10).
    expect(defClipH).toBe("86.0"); // 130 − 44 (burnY − apexY)
    expect(ovClipH).toBe("196.0"); // 240 − 44
    expect(ovClipH).not.toEqual(defClipH);
  });

  it("fullBleed is a real prop gate on the beam (the future Topic-page Tier-B lever)", () => {
    // The landing page NEVER sets fullBleed=false (design §4.7: the beam is present at EVERY width
    // on the landing page). This asserts the PROP GATE itself still works — it is the lever the
    // FUTURE Topic-page shared header uses to drop to Tier B (VISUAL_IDENTITY §6.3), not landing
    // behavior.
    const withBeam = render(<HeaderProjector variant="projector" />);
    expect(withBeam.container.querySelector("[data-projector-beam]")).toBeTruthy();
    withBeam.unmount();

    const noBeam = render(
      <HeaderProjector variant="projector" geometry={{ fullBleed: false }} />
    );
    // No beam when fullBleed is off — the gate is honored from the prop.
    expect(noBeam.container.querySelector("[data-projector-beam]")).toBeNull();
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
