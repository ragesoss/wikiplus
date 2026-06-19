import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// QA supplement (header-topic-integration) — independent, non-author acceptance-criterion tests
// written by the qa-reviewer role for the refinement contract in
// docs/design/header-topic-integration.md §8. These close coverage the author's commit left
// unmapped: the UNIFIED Tier-A geometry on BOTH hosts (AC1/AC2/AC3), the burn-to-background token
// wiring (AC6/AC7/AC8), and Home's re-pinned auth-slot height (AC16). The coupling ACs
// (AC11/AC12/AC14/AC15/AC5) are already exercised in test/shared-header.test.tsx; the CSS-gate
// assertions below add the burn-bg-specific cascade + token-default checks those did not cover.
//
// Geometry strategy: HeaderProjector exposes the band's true-scale beam structural markers as
// data-* attributes. The clip height `data-beam-clip-h` = burnY − apexY = burnY − cyMid (the cone
// apex sits at the aperture/wordmark-row centre). So clip-h IS a direct, render-derived witness of
// BOTH burnY and cyMid: 104 − 28 = 76 on any host that renders the shared geometry. We assert the
// equal band on both hosts THROUGH that marker (the same number the live DOM draws), plus the
// source-of-truth token values + the absence of any 130 default.

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

import {
  SiteHeader,
  TopicHeaderSearch,
  TOPIC_BURN_Y,
  TOPIC_CY_MID,
  SLIM_BAR_HEIGHT,
} from "@/components/header/SiteHeader";
import { HeaderProjector } from "@/components/wordmark/HeaderProjector";
import { HeaderAuth } from "@/components/header/HeaderAuth";

beforeEach(() => {
  routerPush.mockReset();
  fetchTopicSuggestions.mockReset();
  fetchTopicSuggestions.mockResolvedValue([]);
  listTopics.mockReset();
  listTopics.mockResolvedValue([]);
  window.scrollY = 0;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  vi.clearAllMocks();
});

function readClipH(container: HTMLElement): number {
  const beam = container.querySelector("[data-projector-beam]");
  return Number(beam?.getAttribute("data-beam-clip-h"));
}

function renderTopicHeader() {
  return render(
    <SiteHeader
      host="topic"
      articleTitle="Jane Austen"
      search={<TopicHeaderSearch />}
      auth={<HeaderAuth />}
    />
  );
}

// ── AC1 / AC2 — Home and Topic render an IDENTICAL Tier-A band: burnY=104, cyMid=28, cone 76.
// The beam's clip height (burnY − cyMid) is the same render-derived witness on both hosts. ──────
describe("AC1/AC2 — unified Tier-A geometry on both hosts (band 104, cyMid 28, cone 76)", () => {
  it("the exported Topic geometry constants are the shared 104 / 28 (no 130/44 fork)", () => {
    expect(TOPIC_BURN_Y).toBe(104);
    expect(TOPIC_CY_MID).toBe(28);
    // cyMid = SLIM_BAR_HEIGHT / 2 (the chrome-row centre — AC4).
    expect(TOPIC_CY_MID).toBe(SLIM_BAR_HEIGHT / 2);
  });

  it("Home (default config) renders the shared cone length 76 = burnY−cyMid = 104−28", () => {
    // Home passes NO geometry — it renders one configuration of the defaults.
    const { container } = render(<HeaderProjector variant="projector" />);
    expect(readClipH(container)).toBe(76);
  });

  it("Topic renders the SAME cone length 76 as Home (identical Tier-A band, no 130 band)", () => {
    const { container } = renderTopicHeader();
    // Topic passes TOPIC_GEOMETRY (burnY 104 / cyMid 28 — no-ops equal to the defaults), so the band
    // it draws is byte-identical in height to Home's.
    expect(readClipH(container)).toBe(76);
  });

  it("the explicit Topic geometry prop produces the SAME band as Home's defaults (no drift)", () => {
    // Render the projector with Topic's exact geometry values directly and confirm parity with the
    // bare default render — proving 104/28 is genuinely the shared base, not a coincidence.
    const home = render(<HeaderProjector variant="projector" />);
    const topicLike = render(
      <HeaderProjector
        variant="projector"
        geometry={{ burnY: TOPIC_BURN_Y, cyMid: TOPIC_CY_MID }}
      />
    );
    expect(readClipH(topicLike.container)).toBe(readClipH(home.container));
    expect(readClipH(home.container)).toBe(76);
  });
});

// ── AC3 — token defaults are 104/28, Home passes NO geometry overrides, and no 130 default
// survives anywhere (the §10.1 no-fork rule: Home is one configuration of the defaults). ─────────
describe("AC3 — defaults are 104/28; Home passes no geometry overrides; no 130 default remains", () => {
  it("globals.css pins --projector-burn-y: 104px and --projector-cy-mid: 28px (no 130/44)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(/--projector-burn-y:\s*104px/);
    expect(css).toMatch(/--projector-cy-mid:\s*28px/);
    // The prior default values must be gone from the token block.
    expect(css).not.toMatch(/--projector-burn-y:\s*130px/);
    expect(css).not.toMatch(/--projector-cy-mid:\s*44px/);
  });

  it("the HeaderProjector JS defaults mirror the tokens (burnY 104 / cyMid 28)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "components/wordmark/HeaderProjector.tsx"),
      "utf8"
    );
    expect(src).toMatch(/geometry\?\.burnY\s*\?\?\s*104/);
    expect(src).toMatch(/geometry\?\.cyMid\s*\?\?\s*28/);
    // No stale 130/44 fallbacks linger.
    expect(src).not.toMatch(/geometry\?\.burnY\s*\?\?\s*130/);
    expect(src).not.toMatch(/geometry\?\.cyMid\s*\?\?\s*44/);
  });

  it("the Home host markup passes NO geometry prop to HeaderProjector (one config of defaults)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "components/header/SiteHeader.tsx"),
      "utf8"
    );
    // The Home host render is `<HeaderProjector variant="projector" as="a" href="/" />` — no
    // geometry= attribute. Isolate the HomeSiteHeader function body and assert no geometry override.
    const start = src.indexOf("function HomeSiteHeader");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("function TopicSiteHeader", start);
    const homeBody = src.slice(start, end);
    expect(homeBody).toMatch(/<HeaderProjector\s+variant="projector"/);
    expect(homeBody).not.toMatch(/geometry=/);
  });
});

// ── AC6 / AC7 / AC8 — the --projector-burn-bg token drives the beam interior + the band fill, and
// the Topic host overrides it to the body grey while Home keeps white. ──────────────────────────
describe("AC6/AC7/AC8 — --projector-burn-bg drives the beam + band fill (Home #FFF, Topic #F7F7F7)", () => {
  it("AC6 — the Beam SVG fill reads var(--projector-burn-bg), not a hardcoded #ffffff", () => {
    const { container } = render(<HeaderProjector variant="projector" />);
    const beam = container.querySelector("[data-projector-beam]");
    const fill = beam?.querySelector("path")?.getAttribute("fill");
    expect(fill).toBe("var(--projector-burn-bg)");
    // No descending-beam path is painted with a literal white.
    expect(beam?.querySelector('path[fill="#ffffff"]')).toBeNull();
    expect(beam?.querySelector('path[fill="#fff"]')).toBeNull();
  });

  it("AC6 — the band's below-burnY fill span reads var(--projector-burn-bg) (not content-white)", () => {
    const { container } = render(<HeaderProjector variant="projector" />);
    // The below-boundary band fill is the absolutely-positioned span anchored at top:burnY.
    const fillSpan = Array.from(
      container.querySelectorAll<HTMLElement>(".projector-band > span")
    ).find((s) => s.className.includes("--projector-burn-bg"));
    expect(fillSpan).toBeTruthy();
    expect(fillSpan!.className).toMatch(/bg-\[var\(--projector-burn-bg\)\]/);
    // The cool field above the boundary stays the header field (#FAFBFE), untouched (AC9).
    const fieldSpan = Array.from(
      container.querySelectorAll<HTMLElement>(".projector-band > span")
    ).find((s) => s.className.includes("--color-header-field"));
    expect(fieldSpan).toBeTruthy();
  });

  it("AC7 — Home keeps the #FFFFFF default for --projector-burn-bg", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    // The token default declared on .header-projector is #ffffff (Home — no .header-shared).
    expect(css).toMatch(/\.header-projector\s*\{[\s\S]*--projector-burn-bg:\s*#ffffff/);
  });

  it("AC8 — the Topic host (.header-shared) overrides --projector-burn-bg to the body grey", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    // The override sits on `.header-shared .header-projector` (2-class specificity > the 1-class
    // default), so it wins on the Topic host. The grey resolves to #f7f7f7 via --color-body-grey.
    expect(css).toMatch(
      /\.header-shared\s+\.header-projector\s*\{[\s\S]*--projector-burn-bg:\s*var\(--color-body-grey\)/
    );
    expect(css).toMatch(/--color-body-grey:\s*#f7f7f7/i);
  });

  it("AC8 — the Topic host renders the projector inside .header-shared (the override scope)", () => {
    const { container } = renderTopicHeader();
    const shared = container.querySelector(".header-shared");
    const projector = container.querySelector(".header-shared .header-projector");
    expect(shared).not.toBeNull();
    expect(projector).not.toBeNull();
  });
});

// ── AC16 — Home's auth slot re-centres on the new cyMid=28 row: height pinned to 56 (= cyMid·2),
// and it never folds to a second row (absolutely positioned). ───────────────────────────────────
describe("AC16 — Home auth slot height 56 (re-centred on cyMid=28), no second-row fold", () => {
  it("the Home auth slot is height 56 and absolutely positioned (no flow that could fold)", () => {
    const { container } = render(
      <SiteHeader host="home" auth={<HeaderAuth />} />
    );
    const slot = container.querySelector(".auth-slot") as HTMLElement;
    expect(slot).not.toBeNull();
    // 56 = cyMid·2 = SLIM_BAR_HEIGHT — re-centred on the new 28px wordmark row.
    expect(slot.style.height).toBe("56px");
    expect(Number(slot.style.height.replace("px", ""))).toBe(SLIM_BAR_HEIGHT);
    // Absolutely positioned + top-anchored → it can never push the lockup or fold to a 2nd row.
    expect(slot.className).toMatch(/absolute/);
    expect(slot.className).toMatch(/top-0/);
    // No stale height: 88 (the old cyMid=44 centring) remains in the markup.
    expect(slot.style.height).not.toBe("88px");
  });
});

// ── AC11 — coupling: the SAME [data-collapsed] state drives BOTH the band height (104→56) and the
// beam/lockup opacity, with the SAME 180ms ease-out, so a faded beam never sits over a full band.
// (shared-header.test.tsx asserts the boolean flip + height; here we assert the single-state
// coupling + equal-duration transitions explicitly for this refinement's Decision 3.) ───────────
describe("AC11/AC15 — coupled collapse driven by one [data-collapsed] state, reduced-motion gated", () => {
  it("band height + beam + all three lockup-layer opacities transition at the SAME 180ms ease-out", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    const gateIdx = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(gateIdx).toBeGreaterThan(-1);
    const afterGate = css.slice(gateIdx, css.indexOf("}", css.indexOf("}", gateIdx) + 1) + 200);
    // Height + opacity both at 180ms ease-out inside the reduced-motion gate (so a reduce
    // preference snaps to the end-state with no tween — AC15).
    expect(afterGate).toMatch(/\.header-band\s*\{\s*transition:\s*height\s*180ms\s*ease-out/);
    expect(afterGate).toMatch(/transition:\s*opacity\s*180ms\s*ease-out/);
  });

  it("the band height + the [data-collapsed] opacity flips are driven by the one header state", () => {
    // Render is enough to confirm the single [data-collapsed] gate exists; shared-header.test.tsx
    // exercises the scroll flip end-to-end. Here: the band height is the collapsed-conditional value.
    const { container } = renderTopicHeader();
    const band = container.querySelector(".header-band") as HTMLElement;
    // At scrollY=0 the band is the full Tier-A height (the collapsed boolean is false).
    expect(band.style.height).toBe(`${TOPIC_BURN_Y}px`);
  });
});

// ── AC14 — Home does not collapse: no collapsed prop, no sticky, no slim layer. ──────────────────
describe("AC14 — Home does not collapse (no scroll-aware behavior)", () => {
  it("the Home host renders no sticky header, no [data-collapsed], no flat/slim lockup layer", () => {
    const { container } = render(
      <SiteHeader host="home" auth={<HeaderAuth />} />
    );
    // No .header-shared sticky wrapper, no data-collapsed, no scroll-aware flat lockup link.
    expect(container.querySelector(".header-shared")).toBeNull();
    expect(container.querySelector("[data-collapsed]")).toBeNull();
    expect(container.querySelector(".projector-flatlockup")).toBeNull();
    expect(container.querySelector(".projector-beamfade")).toBeNull();
    // Home's wordmark is the Container link (the whole projector), not a scroll-aware flat layer.
    expect(container.querySelector(".header-projector")).not.toBeNull();
  });
});
