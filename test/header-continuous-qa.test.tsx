import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

// QA supplement (continuous header transition #96) — independent, non-author acceptance-criterion
// tests written by the qa-reviewer role for the contract in
// docs/design/continuous-header-transition.md. These close coverage the author's commit left
// unmapped against the issue's "Done when" 1–6:
//
//   • AC#1 (the crux — no mid-scroll color seam): the STRUCTURAL invariant of §4.2 — the outer band
//     height, the beam-clip layer, the projector's internal cool-field height, AND the
//     content-white top ALL read the SAME `--topic-burn-y` custom property. If every burn-boundary
//     edge resolves from one variable, only ONE edge can exist, so no independently-scrolling
//     grey/white seam can form by construction. (Pixel-level absence of the seam is UX's screenshot
//     job — jsdom cannot render the gradient; this asserts the var wiring that makes it impossible.)
//   • AC#6 (reduced motion): the RUNTIME path — under `prefers-reduced-motion: reduce` the header
//     only ever holds the two end-state var sets (p quantized to {0,1}), never an intermediate frame.
//   • Code quality: the passive scroll listener is REMOVED on unmount (no leak).
//
// The pure math (§3.1–§3.3) is covered in test/header-progress.test.ts; the CSS-var end-states and
// the mid-offset values in test/shared-header.test.tsx. This file adds the structural seam witness,
// the reduced-motion runtime path, and the listener-cleanup check those did not cover.

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/wiki/suggest", () => ({
  fetchTopicSuggestions: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/data", () => ({
  store: { listTopics: () => Promise.resolve([]) },
}));

import {
  SiteHeader,
  TopicHeaderSearch,
  TOPIC_BURN_Y,
  SLIM_BAR_HEIGHT,
} from "@/components/header/SiteHeader";
import { HeaderAuth } from "@/components/header/HeaderAuth";

// matchMedia stub — `reduced` toggles the prefers-reduced-motion match. Default: no preference.
function stubMatchMedia(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && /prefers-reduced-motion:\s*reduce/.test(query),
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
  window.scrollY = 0;
  stubMatchMedia(false);
});
afterEach(() => {
  vi.clearAllMocks();
  window.scrollY = 0;
});

function renderTopic() {
  return render(
    <SiteHeader
      host="topic"
      articleTitle="Photosynthesis"
      search={<TopicHeaderSearch />}
      auth={<HeaderAuth />}
    />
  );
}

const v = (el: HTMLElement, name: string) =>
  el.style.getPropertyValue(name).trim();

// ── AC#1 (issue #96 "Done when" 1) — the seam-killing structural invariant (§4.2). Every edge that
// could form a grey/white boundary is driven from ONE custom property `--topic-burn-y`. We assert
// the four consumers all read that SAME var verbatim — so they are one edge at every `p` and a
// disjoint mid-transition seam is structurally impossible. ───────────────────────────────────────
describe("AC#1 — one --topic-burn-y drives every burn-boundary edge (no seam by construction)", () => {
  it("the outer band height, the beam-clip layer, the cool field, and the content-white top all read var(--topic-burn-y)", () => {
    const { container } = renderTopic();

    // 1) The OUTER band height — the visible header box bottom edge.
    const band = container.querySelector(".header-band") as HTMLElement;
    expect(band.style.height).toBe("var(--topic-burn-y)");

    // 2) The beam CLIP layer — clips the projector to the live band height (not a fixed 104).
    const beamClip = container.querySelector(".header-beam") as HTMLElement;
    expect(beamClip.style.height).toBe("var(--topic-burn-y)");

    // 3) + 4) The projector's INTERNAL cool→white edge: the cool fluorescent field's HEIGHT and the
    // content-white fill's TOP both sit on the same boundary. On the scroll-aware host both must be
    // the live var — if either were a fixed px the cool/white edge could scroll independently of the
    // band edge and reveal the seam (the exact defect #1 mechanism, §4.1).
    const spans = Array.from(
      container.querySelectorAll<HTMLElement>(".projector-band > span")
    );
    // The cool field is the burn-to-page-surface field on the scroll-aware host
    // (`.projector-coolfield-burn` — its bottom edge resolves to the page colour it meets, tracking
    // `--p`, so the full-width band bottom matches the page with no step, killing the temperature
    // hairline; #96 fix round).
    const coolField = spans.find((s) =>
      s.className.includes("projector-coolfield-burn")
    );
    const contentWhite = spans.find((s) =>
      s.className.includes("--projector-burn-bg")
    );
    expect(coolField, "cool fluorescent field span present").toBeTruthy();
    expect(contentWhite, "content-white fill span present").toBeTruthy();
    expect(coolField!.style.height).toBe("var(--topic-burn-y)");
    expect(contentWhite!.style.top).toBe("var(--topic-burn-y)");

    // The invariant, stated as one assertion: all four edge-defining values are byte-identical, so
    // there is exactly ONE burn boundary. No second, differently-clocked edge exists to form a seam.
    const edges = [
      band.style.height,
      beamClip.style.height,
      coolField!.style.height,
      contentWhite!.style.top,
    ];
    expect(new Set(edges).size).toBe(1);
    expect(edges[0]).toBe("var(--topic-burn-y)");
    // NOTE for UX: the pixel-level confirmation that no grey/white line is visible mid-scroll is a
    // screenshot check (scripts/dev/shots.sh + the ~25/50/75% offsets). This test proves the wiring
    // that makes a seam impossible; it cannot render the gradient.
  });

  it("--topic-burn-y is a single continuous value (104 at top, 80 at mid, 56 slim) — the band recedes WITH it", async () => {
    const { container } = renderTopic();
    const header = container.querySelector("header.header-shared") as HTMLElement;
    // Top: full Tier-A boundary.
    await vi.waitFor(() => expect(v(header, "--topic-burn-y")).toBe(`${TOPIC_BURN_Y}.00px`));
    // Mid (~50%): the boundary has receded continuously — 104 − 48·0.5 = 80.
    window.scrollY = 52;
    fireEvent.scroll(window);
    await vi.waitFor(() => expect(v(header, "--topic-burn-y")).toBe("80.00px"));
    // Slim: the boundary equals the slim bar height.
    window.scrollY = 200;
    fireEvent.scroll(window);
    await vi.waitFor(() => expect(v(header, "--topic-burn-y")).toBe(`${SLIM_BAR_HEIGHT}.00px`));
  });
});

// ── #96 fix round (owner-reported) — kill the front-half temperature hairline at the band bottom.
// The cool field's bottom edge meeting a DIFFERENTLY-coloured page top rendered a faint full-width
// line whenever the 2px ink border was at opacity 0 (the front half, p < 0.5). The page surface at
// the seam drifts content-white → body-grey as `p` rises (the seam sits deeper into the illum
// falloff), so a fixed-`#ffffff` band bottom over-shot once the page greyed and read as a bright
// hairline. The fix burns the cool field to a `--p`-tracked colour so the band bottom matches the
// page it meets at every front-half `p` (still content-white at p=0). We assert the WIRING: the
// Topic cool field carries the burn class, and Home does NOT (AC12 — Home keeps the flat cool fill
// and is untouched). Pixel-absence of the line is the screenshot proof. ────────────────────────────
describe("#96 fix round — no header/page temperature hairline in the front half", () => {
  it("the Topic cool field burns to the page surface at its bottom edge (`.projector-coolfield-burn`)", () => {
    const { container } = renderTopic();
    const spans = Array.from(
      container.querySelectorAll<HTMLElement>(".projector-band > span")
    );
    const coolField = spans.find((s) =>
      s.className.includes("projector-coolfield-burn")
    );
    expect(
      coolField,
      "Topic cool field seals to the page surface at the band bottom"
    ).toBeTruthy();
    // It still spans to the live burn boundary (the seam invariant) and is not a flat cool fill.
    expect(coolField!.style.height).toBe("var(--topic-burn-y)");
    expect(coolField!.className).not.toContain("--color-header-field");
  });

  it("Home keeps the flat cool fill — no burn-to-white seal (AC12 untouched)", () => {
    const { container } = render(<SiteHeader host="home" auth={<HeaderAuth />} />);
    const spans = Array.from(
      container.querySelectorAll<HTMLElement>(".projector-band > span")
    );
    expect(
      spans.some((s) => s.className.includes("projector-coolfield-burn")),
      "Home must NOT use the burn-to-white seal"
    ).toBe(false);
    expect(
      spans.some((s) => s.className.includes("--color-header-field")),
      "Home keeps the flat cool fluorescent fill"
    ).toBe(true);
  });
});

// ── AC#6 (issue #96 "Done when" 6 — reduced motion) — the RUNTIME quantize path. Under
// `prefers-reduced-motion: reduce` the header writes ONLY end-state var sets: full Tier-A (p=0,
// burn-y 104, beam 1, border 0) below the midpoint, slim (p=1, burn-y 56, beam 0, border 1) above
// it — never an intermediate frame. (The continuous-path mid values are asserted in
// shared-header.test.tsx; this is the no-preference≠reduce contrast.) ────────────────────────────
describe("AC#6 — reduced motion snaps to {0,1} end-states (no intermediate frame)", () => {
  it("at a mid scroll offset (scrollY=52, continuous p would be 0.5) the reduced-motion header is a clean end-state", async () => {
    stubMatchMedia(true); // prefers-reduced-motion: reduce
    window.scrollY = 52; // past the 0.55 quantize threshold (52/104 = 0.5 → dead-band holds prev=0)
    const { container } = renderTopic();
    const header = container.querySelector("header.header-shared") as HTMLElement;
    // 52/104 = 0.5 sits in the 0.45–0.55 dead-band; from the initial prev=0 it holds the FULL state.
    await vi.waitFor(() => expect(v(header, "--p")).toBe("0.0000"));
    expect(v(header, "--topic-burn-y")).toBe(`${TOPIC_BURN_Y}.00px`);
    expect(v(header, "--beam-opacity")).toBe("1.0000");
    expect(v(header, "--border-opacity")).toBe("0.0000");

    // Scroll clearly past the threshold → snaps to the SLIM end-state, still no intermediate values.
    window.scrollY = 80; // 80/104 = 0.77 ≥ 0.55 → quantize to 1
    fireEvent.scroll(window);
    await vi.waitFor(() => expect(v(header, "--p")).toBe("1.0000"));
    expect(v(header, "--topic-burn-y")).toBe(`${SLIM_BAR_HEIGHT}.00px`);
    expect(v(header, "--beam-opacity")).toBe("0.0000");
    expect(v(header, "--border-opacity")).toBe("1.0000");
    // Every written burn-y is one of the two end values — no continuous 80px frame ever appears.
  });
});

// ── Code quality — the passive, rAF-gated scroll listener must be removed on unmount (no leak).
// We spy on add/removeEventListener for 'scroll' and assert the unmount cleanup symmetry. ─────────
describe("scroll listener lifecycle — added passive, removed on unmount (no leak)", () => {
  it("adds a passive scroll listener and removes the SAME handler on unmount", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderTopic();

    const scrollAdds = add.mock.calls.filter((c) => c[0] === "scroll");
    expect(scrollAdds.length).toBeGreaterThanOrEqual(1);
    // Registered passive (the §6 perf contract — the handler reads only scrollY, never blocks).
    const opts = scrollAdds[0][2] as AddEventListenerOptions;
    expect(opts).toMatchObject({ passive: true });
    const handler = scrollAdds[0][1];

    unmount();
    const scrollRemoves = remove.mock.calls.filter((c) => c[0] === "scroll");
    // The exact handler instance that was added is the one removed (not a different closure).
    expect(scrollRemoves.some((c) => c[1] === handler)).toBe(true);

    add.mockRestore();
    remove.mockRestore();
  });
});
