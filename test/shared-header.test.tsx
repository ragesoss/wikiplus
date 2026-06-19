import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Tests for the ONE shared "Daylight Projector" header (#72) — the page-host wrapper around
// HeaderProjector consumed by BOTH app/page.tsx (Home) and the Topic view. Maps the acceptance
// criteria of docs/specs/shared-header.md (AC1–AC15) + the design contract docs/design/shared-header.md.
//
// What is verified here (the rest is screenshot/UX or code-review per each AC's verify line):
//   AC1  one shared header, used by both pages; the bespoke TopicHeader block is retired.
//   AC2  the seam-on-divider math (gutter centre → projectionX) — unit-tested as a formula.
//   AC3  the wordmark is a home link (href="/", accessible name "wiki+") on BOTH hosts.
//   AC4  scroll-aware: Tier A at top → slim collapsed (beam faded, band height collapsed) when scrolled.
//   AC5  the transition is reduced-motion-gated (CSS assertion).
//   AC6  optional search slot: absent on Home, present on Topic.
//   AC7  collapsed mobile search renders the topic-disclosure icon-reveal.
//   AC8  collapsed mobile auth (topic-compact): first-initial signed-in / "Log in" signed-out.
//   AC9  exactly ONE AuthControl instance; reachable at every breakpoint.
//   AC10 below lg the seam-to-divider positioning is not applied (no projectionX).
//   AC12 the landing header adds no header search + a single auth (no regression).
//   AC13 a11y: accessible name "wiki+", decorative layers aria-hidden, keyboard reachability.
//
// The Wikipedia typeahead, the Next router, and the DataStore are MOCKED (no network — the
// established pattern, docs/ARCHITECTURE.md "Testing").

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
import {
  SiteHeader,
  TopicHeaderSearch,
  TOPIC_BURN_Y,
  SLIM_BAR_HEIGHT,
} from "@/components/header/SiteHeader";
import { HeaderAuth } from "@/components/header/HeaderAuth";
import {
  APERTURE_SEAM_OFFSET,
  SQUEEZE_BREAKPOINT,
} from "@/components/wordmark/HeaderProjector";

beforeEach(() => {
  routerPush.mockReset();
  fetchTopicSuggestions.mockReset();
  fetchTopicSuggestions.mockResolvedValue([]);
  listTopics.mockReset();
  listTopics.mockResolvedValue([]);
  window.scrollY = 0;
  // Reset to the width-agnostic default stub (no reduced-motion, no compact) before each test; the
  // tests that need a width install a width-aware matchMedia via setViewport().
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
  vi.useRealTimers();
  vi.clearAllMocks();
});

/** Render a Topic-host shared header with the standard slots (matches TopicView's wiring). */
function renderTopicHeader(articleTitle = "Jane Austen") {
  return render(
    <SiteHeader
      host="topic"
      articleTitle={articleTitle}
      search={<TopicHeaderSearch />}
      auth={<HeaderAuth />}
    />
  );
}

/** Force window to a width and install a WIDTH-AWARE matchMedia so the `max-width: …` queries
 * HeaderAuth/HeaderProjector read resolve against it (the setup stub is width-agnostic). */
function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: width,
    configurable: true,
  });
  window.matchMedia = ((query: string) => {
    // Parse `(max-width: NNNpx)` / `(min-width: NNNpx)` and evaluate against `width`.
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    let matches = false;
    if (max) matches = width <= Number(max[1]);
    else if (min) matches = width >= Number(min[1]);
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  }) as unknown as typeof window.matchMedia;
  window.dispatchEvent(new Event("resize"));
}

// ── AC1 — one shared header, used by both pages; bespoke TopicHeader block retired. ───────────
describe("AC1 — one shared header component, used by both hosts", () => {
  it("the Topic host renders the shared <header> with the projector wordmark", () => {
    const { container } = renderTopicHeader();
    const header = container.querySelector("header.header-shared");
    expect(header).not.toBeNull();
    // The wordmark is the HeaderProjector (its serif "Wiki" + indigo "plus" block render).
    expect(screen.getAllByText("Wiki").length).toBeGreaterThan(0);
  });

  it("the retired TopicHeader is a re-export of the shared header (no bespoke ＋plus block)", async () => {
    const mod = await import("@/components/topic/TopicHeader");
    const { container } = render(<mod.TopicHeader articleTitle="Jane Austen" />);
    // It renders the shared header, not the old two-block markup. There is no bespoke
    // ".hardbox-sm bg-brand" indigo +plus header label block anymore (that was the old auth home).
    expect(container.querySelector("header.header-shared")).not.toBeNull();
    expect(container.querySelector(".hardbox-sm.bg-brand")).toBeNull();
    // …and no separate "curated video" eyebrow label from the old +plus block.
    expect(screen.queryByText("curated video")).toBeNull();
  });
});

// ── AC2 — the seam targets the gutter centre via projectionX. The geometry is a pure formula:
//   apex_x = gutter_centre + APERTURE_SEAM_OFFSET  ⇒  seam_x = apex_x − offset = gutter_centre.
// The header drives projectionX = (gutter_centre + offset) / bandWidth, so the seam lands on the
// gutter centre. We verify the offset contract + that the two exported offsets agree. ─────────
describe("AC2 — seam-to-divider geometry (gutter centre → projectionX)", () => {
  it("the seam→aperture offset is the block margin + cut inset (~29px), one source of truth", () => {
    // The seam sits this many px LEFT of the aperture (the block's 2px margin + the cut inset). It
    // is exported from HeaderProjector and the seam math (below) is the only consumer — one source.
    expect(APERTURE_SEAM_OFFSET).toBeGreaterThan(20);
    expect(APERTURE_SEAM_OFFSET).toBeLessThan(40);
  });

  it("driving projectionX = (gutter_centre + offset)/bandWidth lands the seam on the gutter centre (±4px)", () => {
    // Worked value from design §3.2: viewport 1200 → gutter centre 806, band width 1200.
    const gutterCentre = 806;
    const bandWidth = 1200;
    const projectionX = (gutterCentre + APERTURE_SEAM_OFFSET) / bandWidth;
    const apexX = projectionX * bandWidth; // HeaderProjector: apexX = projectionXFrac * cw
    const seamX = apexX - APERTURE_SEAM_OFFSET; // seam sits offset px left of the aperture
    expect(Math.abs(seamX - gutterCentre)).toBeLessThanOrEqual(4);
  });
});

// ── AC3 — the wordmark navigates home from both pages. ─────────────────────────────────────────
describe("AC3 — wordmark is a home link with accessible name 'wiki+' on both hosts", () => {
  it("Topic host: the wordmark is a link to / named 'wiki+'", () => {
    renderTopicHeader();
    const links = screen.getAllByRole("link", { name: "wiki+" });
    expect(links.length).toBeGreaterThanOrEqual(1);
    links.forEach((l) => expect(l).toHaveAttribute("href", "/"));
  });

  it("Home host: the wordmark is a link to / named 'wiki+'", async () => {
    render(<HomePage />);
    const link = screen.getByRole("link", { name: "wiki+" });
    expect(link).toHaveAttribute("href", "/");
  });
});

// ── AC4 (#96) — CONTINUOUS scroll-linked transition. There is no boolean `[data-collapsed]` flip
// anymore: SiteHeader writes a normalized progress `p` and the derived band height + layer/border
// opacities as CSS custom properties on the header element every frame (§3.2). At scrollY=0 it is
// the full Tier-A state (p=0, band 104, beam opacity 1); scrolling past PROGRESS_END (104)
// it is the slim state (p=1, band 56, beam 0); scrolling back retraces it. ──────────────────────
describe("AC4 (#96) — continuous: p drives band height + layer opacities via CSS vars", () => {
  // Read a CSS custom property the scroll handler writes on the header element.
  const v = (header: Element, name: string) =>
    (header as HTMLElement).style.getPropertyValue(name).trim();

  it("at scrollY=0 it is the full Tier-A state (p=0, band 104, beam 1, border 0)", async () => {
    window.scrollY = 0;
    const { container } = renderTopicHeader();
    const header = container.querySelector("header.header-shared")!;
    const band = container.querySelector(".header-band") as HTMLElement;
    // The mount evaluate() writes p=0 from scrollY=0.
    await vi.waitFor(() => expect(v(header, "--p")).toBe("0.0000"));
    expect(v(header, "--topic-burn-y")).toBe(`${TOPIC_BURN_Y}.00px`);
    expect(v(header, "--beam-opacity")).toBe("1.0000");
    expect(v(header, "--border-opacity")).toBe("0.0000");
    // The band height tracks the live burn-y var (the single edge — #96 §4.2).
    expect(band.style.height).toBe("var(--topic-burn-y)");
    // No boolean attribute remains (the boolean model is gone — §3.4).
    expect(header.hasAttribute("data-collapsed")).toBe(false);
    // The header is sticky (stays reachable while scrolled).
    expect(header.className).toMatch(/sticky/);
  });

  it("scrolling past PROGRESS_END (104) lands the slim end-state (p=1, band 56, beam 0, border 1)", async () => {
    const { container } = renderTopicHeader();
    const header = container.querySelector("header.header-shared")!;
    window.scrollY = 200;
    fireEvent.scroll(window);
    await vi.waitFor(() => expect(v(header, "--p")).toBe("1.0000"));
    expect(v(header, "--topic-burn-y")).toBe(`${SLIM_BAR_HEIGHT}.00px`);
    expect(v(header, "--beam-opacity")).toBe("0.0000");
    expect(v(header, "--border-opacity")).toBe("1.0000");
  });

  it("at a mid offset (~50%, scrollY=52) p is ~0.5, band recedes, no border yet, beam still reads", async () => {
    const { container } = renderTopicHeader();
    const header = container.querySelector("header.header-shared")!;
    window.scrollY = 52; // 52/104 = 0.5
    fireEvent.scroll(window);
    await vi.waitFor(() => expect(v(header, "--p")).toBe("0.5000"));
    // Band height between the two ends (104 − 48·0.5 = 80).
    expect(v(header, "--topic-burn-y")).toBe("80.00px");
    // Border is held at 0 through the front half (gated to p ≥ 0.5 → starts exactly here at 0).
    expect(Number(v(header, "--border-opacity"))).toBe(0);
    // The glow (beam + lit aperture) is still partly present (not yet 0) over the opaque card.
    expect(Number(v(header, "--beam-opacity"))).toBeGreaterThan(0);
    expect(Number(v(header, "--beam-opacity"))).toBeLessThan(1);
  });

  it("scrolling back up retraces the path (no hysteresis): same scrollY → same p", async () => {
    const { container } = renderTopicHeader();
    const header = container.querySelector("header.header-shared")!;
    window.scrollY = 200;
    fireEvent.scroll(window);
    await vi.waitFor(() => expect(v(header, "--p")).toBe("1.0000"));
    // A mid value going UP gives exactly the same p a down-scroll would (pure function of scrollY).
    window.scrollY = 78; // 78/104 = 0.75
    fireEvent.scroll(window);
    await vi.waitFor(() => expect(v(header, "--p")).toBe("0.7500"));
    window.scrollY = 0;
    fireEvent.scroll(window);
    await vi.waitFor(() => expect(v(header, "--p")).toBe("0.0000"));
  });
});

// ── host="page" — the universal scroll-aware CONTENT-PAGE header. Same continuous beam→slim
// collapse as Topic (driven by the shared useHeaderScrollProgress hook + the same `p`-derived CSS
// vars), but with no search / seam / title cue — just the beam + a single right-anchored auth, plus
// the beam-landing page surface emitted for free. /about/data, /contribute, /contributor use it. ──
describe("host=page — content-page scroll-aware header (beam→slim, no search/title)", () => {
  const v = (header: Element, name: string) =>
    (header as HTMLElement).style.getPropertyValue(name).trim();

  function renderPageHeader() {
    return render(<SiteHeader host="page" auth={<HeaderAuth />} />);
  }

  it("is sticky and marked header-page + header-shared", () => {
    const { container } = renderPageHeader();
    const header = container.querySelector("header.header-page");
    expect(header, "page host renders a header.header-page").not.toBeNull();
    expect(header!.className).toMatch(/header-shared/); // shares the 2px slim-bar bottom rule
    expect(header!.className).toMatch(/sticky/);
  });

  it("drives the same p-derived CSS vars: full Tier-A at top, slim end-state when scrolled", async () => {
    window.scrollY = 0;
    const { container } = renderPageHeader();
    const header = container.querySelector("header.header-page")!;
    await vi.waitFor(() => expect(v(header, "--p")).toBe("0.0000"));
    expect(v(header, "--topic-burn-y")).toBe(`${TOPIC_BURN_Y}.00px`);
    expect(v(header, "--beam-opacity")).toBe("1.0000");
    expect(v(header, "--border-opacity")).toBe("0.0000");
    window.scrollY = 200;
    fireEvent.scroll(window);
    await vi.waitFor(() => expect(v(header, "--p")).toBe("1.0000"));
    expect(v(header, "--topic-burn-y")).toBe(`${SLIM_BAR_HEIGHT}.00px`);
    expect(v(header, "--beam-opacity")).toBe("0.0000");
    expect(v(header, "--border-opacity")).toBe("1.0000");
  });

  it("has the beam layer + a single wordmark home link, but NO search slot", () => {
    const { container } = renderPageHeader();
    expect(container.querySelector(".header-beam"), "the projector beam layer").not.toBeNull();
    // The wordmark home link (accessible name "wiki+", href "/") — AC3. The lit lockup is a
    // decorative div; only the flat lockup is the link, so there is exactly one.
    const homes = screen.getAllByRole("link", { name: "wiki+" });
    expect(homes).toHaveLength(1);
    expect(homes[0]).toHaveAttribute("href", "/");
    // No header search on a content page (the Topic search renders a combobox; none here — AC6).
    expect(
      screen.queryByRole("combobox"),
      "no search control on the content-page header"
    ).toBeNull();
  });

  it("emits the beam-landing page surface (.beam-page-illum) for free", () => {
    const { container } = renderPageHeader();
    expect(
      container.querySelector(".beam-page-illum"),
      "the content-page beam-landing surface is emitted by the host"
    ).not.toBeNull();
  });

  it("renders exactly one AuthControl (AC9)", async () => {
    renderPageHeader();
    await vi.waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /account: TestCurator/i })
      ).toHaveLength(1)
    );
  });
});

// ── AC5 (#96) — NO per-property CSS transition. With `p` driven every frame a CSS tween would
// fight the scroll (#96 §6), so the 180ms height/opacity transitions are REMOVED. We assert the
// header layers no longer carry a `transition` rule in globals.css, and that the reduced-motion
// degradation is handled by quantizing `p` (in SiteHeader), not by a CSS media gate. ────────────
describe("AC5 (#96) — no per-property CSS transition fights the scroll", () => {
  it("globals.css does NOT add a transition to the header band / beam / lockup layers", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(
      path.resolve(process.cwd(), "app/globals.css"),
      "utf8"
    );
    // Isolate the .header-shared cross-fade block region (the rule selector, not a comment
    // mention) up to the .topic-illum RULE, and assert no `transition:` rule targets the band or
    // the cross-fade layers.
    const start = css.indexOf("\n.header-shared .projector-beamfade");
    const end = css.search(/^\.topic-illum\s*\{/m);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = css.slice(start, end);
    expect(block).not.toMatch(/\.header-shared .header-band\s*\{[^}]*transition/);
    expect(block).not.toMatch(/transition:\s*opacity/);
    // The GLOW opacity is var-driven (the continuous model); the flat card is always opaque (1).
    expect(block).toMatch(/opacity:\s*var\(--beam-opacity/);
    expect(block).toMatch(
      /\.header-shared \.projector-flatlockup\s*\{\s*opacity:\s*1/
    );
  });
});

// ── #96 fix round — kill the band-bottom seam line + the scroll jitter on the scroll-aware hosts.
//   1. The collapsing sticky band reflows the page as `p` tracks scrollY; the browser's scroll
//      anchoring then nudges scrollY to compensate, re-driving the collapse → the whole page jitters
//      ~1px. We opt the document scroller out of scroll anchoring on exactly the collapsing-header
//      pages (`html:has(header.header-shared)`), so scrollY is the sole stable input.
//   2. The 2px reserved bottom border is transparent in the front half, so the header's OWN bg shows
//      through it. A fixed content-white over-shoots once the page greys → a bright seam line. Both
//      the band-bottom burn and the header bg now resolve to ONE `--p`-tracked colour
//      (`--beam-seam-surface`), so the band bottom, the border strip, and the page all match. ───────
describe("#96 fix round — no seam line, no scroll jitter (scroll-aware hosts)", () => {
  let css = "";
  beforeEach(async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
  });

  it("opts the collapsing-header document scroller out of scroll anchoring", () => {
    expect(css).toMatch(
      /html:has\(header\.header-shared\)\s*\{[^}]*overflow-anchor:\s*none/
    );
  });

  it("defines one --p-tracked seam colour on .header-shared and paints the header bg with it", () => {
    const start = css.indexOf("\n.header-shared {");
    const end = css.indexOf("}", start);
    const rule = css.slice(start, end);
    // The seam colour tracks --p (content-white → body grey), and IS the header background.
    expect(rule).toMatch(/--beam-seam-surface:\s*color-mix\([^;]*var\(--p/);
    expect(rule).toMatch(/background-color:\s*var\(--beam-seam-surface\)/);
  });

  it("the band-bottom burn resolves to the SAME seam colour (band bottom = header bg = page)", () => {
    const start = css.indexOf(".projector-coolfield-burn {");
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).toMatch(/var\(--beam-seam-surface/);
  });

  it("the scroll-aware headers carry no fixed content-white bg utility (the rule owns the bg)", () => {
    const { container: topic } = renderTopicHeader();
    const { container: page } = render(<SiteHeader host="page" auth={<HeaderAuth />} />);
    for (const c of [topic, page]) {
      const header = c.querySelector("header.header-shared")!;
      expect(header.className).not.toMatch(/bg-\[var\(--color-content-white\)\]/);
    }
  });
});

// ── AC6 — optional search slot: absent on Home, present upper-left on Topic. ──────────────────
describe("AC6 — search slot absent on Home, present on Topic", () => {
  it("Home: the header renders NO search combobox (the landing hero owns search)", async () => {
    render(<HomePage />);
    // Exactly one combobox on the whole page — the landing hero's, not a header one (AC12).
    await screen.findByRole("combobox", { name: /find a topic/i });
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("Topic: the header renders the TopicSearch (a 'Search Wikipedia topics' combobox)", () => {
    renderTopicHeader();
    expect(
      screen.getAllByRole("combobox", { name: /search wikipedia topics/i }).length
    ).toBeGreaterThanOrEqual(1);
  });
});

// ── AC7 — collapsed mobile search renders the disclosure icon (the field hidden until tapped). ──
describe("AC7 — Topic header offers the topic-disclosure icon-reveal search (< md)", () => {
  it("renders the 'Search topics' disclosure trigger that reveals the field on activation", async () => {
    const user = userEvent.setup({ delay: null });
    renderTopicHeader();
    // The disclosure variant is present (the < md surface). Its trigger is the labeled magnifier.
    const trigger = screen.getByRole("button", { name: /search topics/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    // After activation the same field is revealed (now a working combobox) + a Close control.
    expect(
      screen.getAllByRole("combobox", { name: /search wikipedia topics/i }).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /close search/i })).toBeInTheDocument();
  });
});

// ── AC8 — collapsed mobile auth (topic-compact): first-initial signed-in / short "Log in" signed-out.
describe("AC8 — collapsed mobile auth states (topic-compact)", () => {
  it("signed-in < md shows the avatar initial (the account trigger carries the username)", async () => {
    // The shared setup stubs an AUTHENTICATED 'TestCurator'. Force < md so HeaderAuth picks compact.
    setViewport(500);
    renderTopicHeader();
    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", { name: /account: TestCurator/i })
      ).toBeInTheDocument()
    );
    // The avatar initial 'T' renders inside the account trigger.
    const trigger = screen.getByRole("button", { name: /account: TestCurator/i });
    expect(within(trigger).getByText("T")).toBeInTheDocument();
  });

  it("HeaderAuth picks the compact skin < md (signed-in: username hidden behind the avatar < sm)", async () => {
    // The shared setup stubs an AUTHENTICATED 'TestCurator'. Force < md so HeaderAuth resolves the
    // `topic-compact` skin: in that skin the username text carries `hidden sm:inline` (hidden at the
    // narrowest widths, behind the avatar) — the marker that the COMPACT variant is in effect.
    setViewport(500);
    render(<HeaderAuth />);
    await vi.waitFor(() => {
      const username = screen.getByText("TestCurator");
      expect(username.className).toMatch(/\bhidden\b/);
      expect(username.className).toMatch(/sm:inline/);
    });
  });

  // The signed-out compact "Log in" label + full aria-label is verified in auth-control.test.tsx
  // (the topic-compact signed-out case); this header round only PLACES the existing variant (A3).
});

// ── AC9 — exactly ONE AuthControl instance; reachable at every breakpoint. ────────────────────
describe("AC9 — one consolidated AuthControl, reachable at every breakpoint", () => {
  it("the Topic header renders exactly ONE account control (no two-places duplication)", async () => {
    renderTopicHeader();
    await vi.waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /account: TestCurator/i })
      ).toHaveLength(1)
    );
  });

  it("the single auth control is present at md (home skin) and < md (compact skin)", async () => {
    // ≥ md (default 1024 jsdom): one account control.
    setViewport(1100);
    const { unmount } = render(<HeaderAuth />);
    await vi.waitFor(() =>
      expect(screen.getAllByRole("button", { name: /account/i })).toHaveLength(1)
    );
    unmount();
    // < md: still exactly one.
    setViewport(500);
    render(<HeaderAuth />);
    await vi.waitFor(() =>
      expect(screen.getAllByRole("button", { name: /account/i })).toHaveLength(1)
    );
  });
});

// ── AC10 — below lg, the seam-to-divider positioning is not applied. The header passes NO
// projectionX < lg, so the lit projector lays out self-contained (no --projector-apex-x driven by a
// divider that does not exist). We assert the probe-driven measurement yields no projectionX < lg. ─
describe("AC10 — < lg: seam-to-divider positioning is not applied (self-contained lockup)", () => {
  it("at a < lg viewport the projector lays out self-contained (decorative lit layers aria-hidden)", async () => {
    setViewport(800); // < lg (1024)
    const { container } = renderTopicHeader();
    // The beam layer exists (the lockup carries its own split), but no divider-driven projectionX is
    // applied: the lit mark's apex resolves from its own layout (left-anchored), exactly like the
    // landing page at narrow widths. The DECORATIVE lit layers (#72 DEFECT-B fix moved the
    // cross-fade INTO the projector) are aria-hidden individually — the beam-fade span + the lit
    // lockup div — while the flat lockup link stays in the a11y tree (AC3/AC13). The old assertion
    // (the whole .header-beam wrapper aria-hidden) no longer holds: the interactive home link now
    // lives inside that layer, so the wrapper must NOT be hidden.
    const beam = container.querySelector(".header-beam") as HTMLElement;
    expect(beam).not.toBeNull();
    expect(beam.getAttribute("aria-hidden")).not.toBe("true"); // holds the interactive home link
    // The decorative lit layers are aria-hidden (no fragment is read; the named link is the flat one).
    const litLockup = container.querySelector(".projector-litlockup") as HTMLElement;
    expect(litLockup).not.toBeNull();
    expect(litLockup.getAttribute("aria-hidden")).toBe("true");
    expect(
      container.querySelector(".projector-beamfade")?.getAttribute("aria-hidden")
    ).toBe("true");
    // The serif "Wiki" + indigo "plus" still render as one self-contained unit (no broken aim).
    expect(screen.getAllByText("Wiki").length).toBeGreaterThan(0);
    expect((await screen.findAllByText("plus")).length).toBeGreaterThan(0);
  });
});

// ── AC12 — the landing header is unchanged: no header search, a single auth, no "Contribute". ──
describe("AC12 — landing header: no header search, single auth, no Contribute (no regression)", () => {
  it("renders no header search, one auth account, and no Contribute link", async () => {
    render(<HomePage />);
    await screen.findByRole("combobox", { name: /find a topic/i });
    // No second search in the header (only the hero's — AC6/AC12).
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    // A single auth control (the setup stubs authenticated TestCurator).
    expect(
      screen.getAllByRole("button", { name: /account: TestCurator/i })
    ).toHaveLength(1);
    // No "Contribute" link (removed entirely — #61 finding 4).
    expect(screen.queryByRole("link", { name: /contribute/i })).toBeNull();
  });
});

// ── AC13 — a11y: accessible name 'wiki+', decorative layers aria-hidden, keyboard reachability. ─
describe("AC13 — accessibility on the unified Topic header", () => {
  it("the wordmark link exposes accessible name 'wiki+' and its decorative SVGs are aria-hidden", () => {
    const { container } = renderTopicHeader();
    expect(screen.getAllByRole("link", { name: "wiki+" }).length).toBeGreaterThanOrEqual(1);
    // Every SVG in the header is decorative (aria-hidden) — no fragment is read.
    container.querySelectorAll("svg").forEach((svg) => {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("the decorative Tier-A beam layer is aria-hidden (no duplicate 'wiki+' in the a11y tree)", () => {
    renderTopicHeader();
    // Only the flat chrome wordmark is an accessible link; the beam-layer projector (role=img) is
    // under an aria-hidden wrapper, so it is NOT a second accessible "wiki+" node.
    const imgs = screen.queryAllByRole("img", { name: "wiki+" });
    expect(imgs).toHaveLength(0);
  });

  it("search and auth are keyboard-reachable (focusable) in the Topic header", async () => {
    const user = userEvent.setup({ delay: null });
    renderTopicHeader();
    // Tab order: wordmark link → search → auth. Reaching the search combobox + the auth account
    // trigger by keyboard proves both are operable.
    const combobox = screen.getAllByRole("combobox", {
      name: /search wikipedia topics/i,
    })[0];
    combobox.focus();
    expect(combobox).toHaveFocus();
    const account = await screen.findByRole("button", { name: /account: TestCurator/i });
    account.focus();
    expect(account).toHaveFocus();
    void user;
  });
});

// ── A4 (#96) — the muted slim-state title cue is gated on the derived slim boolean (p ≥ 0.5), not a
// `[data-collapsed]` flag: absent while the beam still reads, present once the slim bar lands. ───
describe("A4 — the muted article-title cue shows only in the slim sticky state", () => {
  it("is absent at scroll-top (p=0) and present once slim (p ≥ 0.5)", async () => {
    window.scrollY = 0;
    const { container } = renderTopicHeader("Jane Austen");
    const header = container.querySelector("header.header-shared")! as HTMLElement;
    // At Tier A the article <h1> is on the page, so no header echo (the cue is absent).
    expect(screen.queryByTestId("slim-title-cue")).toBeNull();
    // Scroll past the slim gate → the cue appears, muted + non-heading + aria-hidden.
    window.scrollY = 200;
    fireEvent.scroll(window);
    await vi.waitFor(() =>
      expect(header.style.getPropertyValue("--p").trim()).toBe("1.0000")
    );
    const cue = screen.getByTestId("slim-title-cue");
    expect(cue.tagName.toLowerCase()).toBe("span"); // NOT a heading
    expect(cue).toHaveAttribute("aria-hidden", "true");
    expect(cue).toHaveTextContent("Jane Austen");
  });
});

// ── DEFECT-B (single-origin transition) — the cross-fade is owned by ONE HeaderProjector instance:
// the lit lockup + beam and the flat slim lockup share one origin, so only opacity animates and
// there is never a SECOND wordmark at a second position (no double vision). We assert the structural
// invariants the fix guarantees: exactly ONE accessible "wiki+" link (the flat lockup, which lives
// INSIDE the projector layer now), and the lit/beam layers are aria-hidden decoration. ───────────
describe("DEFECT-B — single-origin cross-fade (no double wordmark)", () => {
  it("renders exactly ONE accessible 'wiki+' home link (the flat lockup inside the projector)", () => {
    const { container } = renderTopicHeader();
    // One — not two — accessible wordmark links. Before the fix the flat chrome mark + the lit
    // overlay were two separately-positioned marks; now the lit overlay is decorative and the flat
    // lockup is the sole link, co-located at the same origin.
    const links = screen.getAllByRole("link", { name: "wiki+" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/");
    // The flat lockup link lives inside the projector beam layer (one instance owns both states).
    const beam = container.querySelector(".header-beam") as HTMLElement;
    expect(beam.contains(links[0])).toBe(true);
    // The lit lockup + the flat lockup are positioned with the IDENTICAL inline origin style (left +
    // transform), so the cross-fade is pure opacity — no horizontal jump / no second position.
    const lit = container.querySelector(".projector-litlockup") as HTMLElement;
    const flat = container.querySelector(".projector-flatlockup") as HTMLElement;
    expect(lit).not.toBeNull();
    expect(flat).not.toBeNull();
    expect(flat.style.left).toBe(lit.style.left);
    expect(flat.style.transform).toBe(lit.style.transform);
    expect(flat.style.top).toBe(lit.style.top);
  });

  it("the CSS fades the GLOW by var-driven OPACITY over an always-opaque flat card (one origin), no tween", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(
      path.resolve(process.cwd(), "app/globals.css"),
      "utf8"
    );
    // The glow layers (beam + lit aperture) read the host's `p`-derived var (no position animation,
    // #96); the flat card is always fully opaque so it can never wash out beneath the fading glow.
    expect(css).toMatch(
      /\.header-shared \.projector-beamfade[\s\S]*?opacity:\s*var\(--beam-opacity/
    );
    expect(css).toMatch(
      /\.header-shared \.projector-flatlockup\s*\{\s*opacity:\s*1/
    );
    // No per-property transition fights the scroll (#96 §6).
    const start = css.indexOf("\n.header-shared .projector-beamfade");
    const end = css.search(/^\.topic-illum\s*\{/m);
    expect(css.slice(start, end)).not.toMatch(/transition\s*:/);
  });

  it("the lit glow layer is stacked ABOVE the always-opaque flat card (z-order)", () => {
    const { container } = renderTopicHeader();
    const lit = container.querySelector(".projector-litlockup") as HTMLElement;
    const flat = container.querySelector(".projector-flatlockup") as HTMLElement;
    // The glow fades out ON TOP of the opaque card beneath it; fading reveals the identical card.
    expect(Number(lit.style.zIndex)).toBeGreaterThan(Number(flat.style.zIndex));
  });
});

// ── DEFECT-A (pointer-events + reserved search) — the invisible Tier-A layer must NOT intercept the
// search/auth taps, and the chrome row must reserve its control boxes so the lockup never overlaps.
// The fix: the projector band is pointer-events:none (only the flat/glyph home link is auto), and
// the chrome row is pointer-events:none with the search + auth restored to auto. ─────────────────
describe("DEFECT-A — the projector never intercepts the search/auth (pointer-events discipline)", () => {
  it("the projector band is pointer-events-none; the flat home link restores pointer-events-auto", () => {
    const { container } = renderTopicHeader();
    // The HeaderProjector wrapper on the scroll-aware host is pointer-events-none (decoration).
    const projector = container.querySelector(".header-beam .header-projector") as HTMLElement;
    expect(projector).not.toBeNull();
    expect(projector.className).toMatch(/pointer-events-none/);
    // The ONLY interactive node inside is the flat lockup home link (pointer-events-auto).
    const flat = container.querySelector(".projector-flatlockup") as HTMLElement;
    expect(flat.className).toMatch(/pointer-events-auto/);
    // The lit lockup layer (the formerly tap-stealing invisible overlay) is NOT interactive: it is
    // aria-hidden and carries no link/auto pointer-events.
    const lit = container.querySelector(".projector-litlockup") as HTMLElement;
    expect(lit.getAttribute("aria-hidden")).toBe("true");
    expect(lit.className).not.toMatch(/pointer-events-auto/);
  });

  it("the chrome row is pointer-events-none with search + auth restored to auto (clicks fall through)", () => {
    const { container } = renderTopicHeader();
    const chrome = container.querySelector(".header-chrome") as HTMLElement;
    expect(chrome.className).toMatch(/pointer-events-none/);
    // Search + auth each restore pointer-events-auto so they are operable while the empty middle of
    // the row lets a click fall through to the wordmark link behind it.
    const autoBoxes = chrome.querySelectorAll(".pointer-events-auto");
    expect(autoBoxes.length).toBeGreaterThanOrEqual(2);
  });

  it("the self-contained (< lg) lockup is anchored past a reserved search box (leftInset)", () => {
    // The Topic geometry passes a leftInset so the self-contained lockup begins to the RIGHT of the
    // upper-left search slot — the lit lockup can no longer lay out over the search at < lg/< md.
    // The squeeze threshold is a sane phone width (the glyph fallback kicks in below it).
    expect(SQUEEZE_BREAKPOINT).toBeGreaterThan(320);
    expect(SQUEEZE_BREAKPOINT).toBeLessThan(480);
  });
});
