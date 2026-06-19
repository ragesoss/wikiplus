import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// QA supplement (header-topic-integration) — independent, non-author acceptance-criterion tests
// written by the qa-reviewer role for the refinement contract in
// docs/design/header-topic-integration.md §8. These close coverage the author's commit left
// unmapped: the UNIFIED Tier-A geometry on BOTH hosts (AC1/AC2/AC3), the WHITE-beam token wiring +
// the Topic white→grey illumination falloff (AC6/AC7/AC8/AC8b), and Home's re-pinned auth-slot
// height (AC16). The coupling ACs
// (AC11/AC12/AC14/AC15/AC5) are already exercised in test/shared-header.test.tsx; the CSS-gate
// assertions below add the burn-bg-default + falloff-token checks those did not cover.
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

// ── AC6 / AC7 / AC8 / AC8b — REVISED contract (owner reversal 2026-06-19): the beam is BRIGHT WHITE
// LIGHT on BOTH hosts (--projector-burn-bg resolves to #FFFFFF everywhere — NO host override), and
// the Topic page (not the beam) carries the grey via the white→grey illumination FALLOFF
// (.topic-illum, --topic-illum-falloff) at the top of the page content. These tests REPLACE the
// prior burn-to-grey assertions (Topic burn-bg = #F7F7F7) the earlier build asserted. ────────────
describe("AC6/AC7/AC8/AC8b — white beam on both hosts + Topic white→grey illumination falloff", () => {
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

  it("AC6 — --projector-burn-bg is #FFFFFF and NO host overrides it (the Topic grey override is gone)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    // The token default declared on .header-projector is #ffffff (the beam is bright white light).
    expect(css).toMatch(/\.header-projector\s*\{[\s\S]*--projector-burn-bg:\s*#ffffff/);
    // The reverted contract: NO host (no `.header-shared .header-projector`) overrides the token to
    // a non-white value — the beam is white on Home AND Topic. The prior grey override is removed.
    expect(css).not.toMatch(/--projector-burn-bg:\s*var\(--color-body-grey\)/);
    expect(css).not.toMatch(
      /\.header-shared\s+\.header-projector\s*\{[\s\S]*?--projector-burn-bg/
    );
  });

  it("AC7 — Home keeps the #FFFFFF default for --projector-burn-bg (no gradient added)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    // The token default declared on .header-projector is #ffffff (Home — no .header-shared).
    expect(css).toMatch(/\.header-projector\s*\{[\s\S]*--projector-burn-bg:\s*#ffffff/);
  });

  it("AC8 — the Topic illumination falloff is white→grey over 96px (--topic-illum-falloff)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    // The falloff distance token (96px is in the spec build range 64–120).
    expect(css).toMatch(/--topic-illum-falloff:\s*96px/);
    // .topic-illum paints a white→grey vertical gradient over the falloff distance, on a grey base
    // (so any region taller than the falloff stays the body grey — flat #F7F7F7 below). Anchor on
    // the RULE selector (`.topic-illum {`), not a `.topic-illum` mention inside an earlier comment.
    const ruleStart = css.search(/^\.topic-illum\s*\{/m);
    expect(ruleStart).toBeGreaterThan(-1);
    const block = css.slice(ruleStart, css.indexOf("}", ruleStart) + 1);
    expect(block).toMatch(/linear-gradient/);
    expect(block).toMatch(/var\(--color-content-white\)/); // top = #FFFFFF (= the beam interior)
    expect(block).toMatch(/var\(--color-body-grey\)/); // bottom + base = #F7F7F7 (= the body)
    expect(block).toMatch(/background-size:\s*100%\s*var\(--topic-illum-falloff\)/);
    expect(css).toMatch(/--color-content-white:\s*#ffffff/i);
    expect(css).toMatch(/--color-body-grey:\s*#f7f7f7/i);
  });

  it("AC8b — the falloff is page content (a background paint) beneath the sticky header, not in the band", () => {
    // The .topic-illum field is rendered by TopicView as the first page-content block AFTER the
    // SiteHeader — it is NOT inside the .header-shared band (so it adds no header height and scrolls
    // away with the page). The header render alone carries no .topic-illum node.
    const { container } = renderTopicHeader();
    expect(container.querySelector(".topic-illum")).toBeNull();
    expect(container.querySelector(".header-shared .topic-illum")).toBeNull();
  });

  it("AC8 — the Topic host renders the projector inside .header-shared (the white-beam scope)", () => {
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

// ── AC11 (#96 — supersedes #89 Decision 3) — coupling: ONE normalized progress `p` drives BOTH the
// band height (104→56) and the beam/lockup/border opacities, in lockstep, every frame — so a faded
// beam can never sit over a full band. The #89 180ms boolean tween is REMOVED (a CSS transition
// would fight the scroll — #96 §6); the coupling is now structural (one `p`, no per-property
// clock), not a matched-duration tween. ─────────────────────────────────────────────────────────
describe("AC11/AC15 (#96) — coupled collapse driven by ONE progress p, no tween", () => {
  it("the band height + the layer opacities are var-driven (one source), with NO transition", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    // The opacities read the host's `p`-derived vars (one source of truth).
    expect(css).toMatch(/opacity:\s*var\(--beam-opacity/);
    expect(css).toMatch(/opacity:\s*var\(--flat-opacity/);
    expect(css).toMatch(/border-bottom:\s*2px solid rgb\([^)]*var\(--border-opacity/);
    // No per-property transition in the .header-shared cross-fade block (the scroll is the
    // animation). The old 180ms height/opacity tweens are gone.
    const start = css.indexOf("\n.header-shared .projector-beamfade");
    const end = css.search(/^\.topic-illum\s*\{/m);
    expect(css.slice(start, end)).not.toMatch(/transition\s*:/);
    expect(css).not.toMatch(/transition:\s*height\s*180ms/);
  });

  it("the band height is driven by the live --topic-burn-y var (same value as the burn boundary)", () => {
    // The band edge and the projector's internal burn boundary read the SAME --topic-burn-y, so
    // they are one edge at every p (#96 §4.2). At scrollY=0 the mount value is the full Tier-A 104.
    const { container } = renderTopicHeader();
    const band = container.querySelector(".header-band") as HTMLElement;
    expect(band.style.height).toBe("var(--topic-burn-y)");
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
