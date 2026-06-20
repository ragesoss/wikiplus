"use client";

// SiteHeader — the ONE shared "Daylight Projector" header (#72), a thin page-host wrapper around
// the parameterized HeaderProjector (do NOT fork the mark — AC1/A1) plus two slots (search, auth)
// and an opt-in scroll-aware behavior. Used by BOTH hosts:
//
//   • Home  (app/page.tsx)        host="home"  — NO search slot, NO scroll-aware collapse, the
//                                  landing hero unchanged from #61 (AC12). It is exactly today's
//                                  landing header markup, now expressed through this wrapper.
//   • Topic (app/topic/TopicView) host="topic" — search slot upper-left, the lockup seam aligned to
//                                  the real article↔plus column divider at ≥ lg (AC2), scroll-aware
//                                  Tier-A → slim Tier-C bar (AC4/AC5/AC11), one consolidated
//                                  AuthControl (AC9), the slim-state title cue (A4 / §4.4).
//
// Contract: docs/specs/shared-header.md (AC1–AC15) + docs/design/shared-header.md (geometry §3,
// the two compositions + transition §4, every state §5, a11y §7, the build hand-off §8). This
// replaces the bespoke components/topic/TopicHeader.tsx (retired — AC1).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  APERTURE_SEAM_OFFSET,
  HeaderProjector,
  type ProjectorGeometry,
} from "@/components/wordmark/HeaderProjector";
import { TopicSearch } from "@/components/search/TopicSearch";
import {
  computeProgress,
  deriveHeaderProgress,
  quantizeProgress,
} from "@/lib/header/progress";
import { NarrowSearchProvider } from "@/lib/header/narrowSearchContext";

// ── Topic Tier-A geometry. This is the SHARED Tier-A geometry both hosts render (spec Decision 1 /
// §10.1 no-fork): the beam flares over a 104px band with the wordmark row at cyMid=28 (cone length
// burnY − cyMid = 76). These values now EQUAL the --projector-* token defaults, so burnY/cyMid in
// TOPIC_GEOMETRY are no-ops that simply re-assert the shared geometry; the Topic host adds only the
// scroll-collapse layer + the seam-on-divider projectionX + the leftInset on top. ────────────────
export const TOPIC_BURN_Y = 104; // band height / burn boundary — cone length burnY − cyMid = 76
// Wordmark row centre = the chrome-row / slim-bar centre (SLIM_BAR_HEIGHT/2 = 28), so the lit lockup
// aligns with the search + auth cards (which sit centred in the 56px chrome row) and the 56px-tall
// flat lockup fills the slim bar exactly.
export const TOPIC_CY_MID = 28;
// The slim sticky bar height (#72 §4.2). Also the `HEAD` scroll-sync constant in TopicView (§8).
export const SLIM_BAR_HEIGHT = 56;
// The continuous scroll-progress range (#96 §3.1). `p = clamp(scrollY / PROGRESS_END, 0, 1)` drives
// EVERY transitioning property in lockstep (band height, burn boundary, the layer opacities, the
// bottom-border opacity). The transition begins the instant the reader leaves the top (no dead
// zone) and completes exactly as the Tier-A band height of article has scrolled by — so the band
// reads as receding WITH the page, not snapping at a threshold. There is no boolean, no hysteresis,
// no per-property tween: the scroll IS the animation (§3.4).
const PROGRESS_END = TOPIC_BURN_Y; // 104 — p reaches 1 here
// The slim-state gate point: derived booleans (the title cue A4 / §5.1) flip at p ≥ this. A muted
// aria-hidden span, so a hard show at the midpoint is fine — it must never appear while the beam
// still reads and must be present once the slim bar lands.
const SLIM_GATE_P = 0.5;
// `lg` (the Topic grid's side-by-side ↔ stacked breakpoint; #72 decision (a)). Seam-on-divider
// applies ONLY at ≥ lg, where a real divider exists (§3 / AC2 / AC10).
const LG_BREAKPOINT = 1024;
// `md` (Tailwind 768) — the inline ↔ disclosure search handoff (same constant HeaderAuth uses for
// its skin handoff). The narrow-search collapse (topic-mobile-search §3.1) fires ONLY < md.
const MD_BREAKPOINT = 768;

// #72 DEFECT-A — the reserved upper-left search box (px). The chrome row reserves this width for
// the search slot, and the SELF-CONTAINED (< lg) lockup is anchored to START past it (`leftInset`),
// so the lit lockup can never lay out over the search. Roomy enough for the px-5 (20px) page inset
// + the disclosure magnifier / the compact inline field, before the lockup begins.
const SEARCH_RESERVE = 64;

const TOPIC_GEOMETRY: ProjectorGeometry = {
  burnY: TOPIC_BURN_Y,
  cyMid: TOPIC_CY_MID,
  // The self-contained (< lg / narrow) lockup begins past the reserved search slot (DEFECT-A); no
  // effect at ≥ lg where the seam is driven onto the divider via projectionX.
  leftInset: SEARCH_RESERVE,
};

// The Topic search slot — the existing TopicSearch (no new component / variant, A3 / §5.5): an
// inline compact field ≥ md (AC6) and the icon-reveal disclosure < md (AC7), breakpoint-gated by
// CSS so exactly one is interactive at a width. Exported so both consumers (TopicView and the
// TopicHeader compat wrapper) build the slot identically. ─────────────────────────────────────
export function TopicHeaderSearch({
  prefill,
}: {
  /** External prefill + focus signal forwarded to the underlying TopicSearch (issue #19,
   *  article-not-found §7). Both breakpoint variants receive it; the one that is
   *  interactive at the current width focuses + seeds. */
  prefill?: { value: string; nonce: number };
} = {}) {
  return (
    <>
      {/* Inline compact field ≥ md (AC6). */}
      <div className="hidden min-w-0 md:flex">
        <TopicSearch variant="topic-inline" prefill={prefill} />
      </div>
      {/* Icon-disclosure < md (AC7) — reveals the same field on tap. `w-full min-w-0` lets the
          wrapper SHRINK within the chrome search slot and fill it when open, so the disclosure's
          expanded field can flex (topic-mobile-search §3.4) without the wrapper's min-content
          overflowing the slot and pushing the field past the login. When collapsed the magnifier
          button keeps its fixed 44px box at the left — the wrapper spanning the slot is an invisible
          box, so the collapsed appearance is unchanged (AC3). */}
      <div className="flex w-full min-w-0 md:hidden">
        <TopicSearch variant="topic-disclosure" prefill={prefill} />
      </div>
    </>
  );
}

type Host = "home" | "topic" | "page";

interface SiteHeaderProps {
  /** Which host config (design §2). Default "home" (the unchanged landing hero).
   *  - "home"  — the free-standing landing hero: full beam, NOT sticky, no collapse (AC12).
   *  - "topic" — the sticky, scroll-aware, seam-on-divider Topic header (search + title cue).
   *  - "page"  — the sticky, scroll-aware CONTENT-PAGE header: the same continuous beam→slim
   *    collapse as Topic, but with no search / seam / title cue — just the wordmark beam and a
   *    right-anchored auth. Any content page gets the smooth beam transition AND a beam-landing
   *    page-top surface for free by choosing this host (no per-page scroll wiring or illum). */
  host?: Host;
  /** The auth control node (exactly ONE AuthControl per header — AC9). */
  auth: ReactNode;
  /** Optional search slot. Unset on Home/Page (no header search — AC6/AC12); set on Topic. */
  search?: ReactNode;
  /** Topic only — the article display title for the slim-state cue (A4 / §4.4). */
  articleTitle?: string;
}

export function SiteHeader({
  host = "home",
  auth,
  search,
  articleTitle,
}: SiteHeaderProps) {
  if (host === "topic") {
    return (
      <TopicSiteHeader auth={auth} search={search} articleTitle={articleTitle} />
    );
  }
  if (host === "page") {
    return <PageSiteHeader auth={auth} />;
  }
  return <HomeSiteHeader auth={auth} />;
}

// ── The initial CSS-var values written on a scroll-aware header element so SSR/first paint is the
// full Tier-A state (p = 0) before the scroll handler runs; the mount evaluate() immediately
// corrects a deep-linked position (§5). Shared by the Topic and Page hosts. ──────────────────────
const INITIAL_HEADER_VARS = {
  "--p": "0",
  "--topic-burn-y": `${TOPIC_BURN_Y}px`,
  "--beam-opacity": "1",
  "--border-opacity": "0",
} as React.CSSProperties;

// ── The shared scroll-linked progress driver (#96 §6). A passive, rAF-gated scroll listener reads
// ONLY window.scrollY (a cheap read — no layout flush), computes the normalized progress `p`, and
// writes it + the derived band height / layer & border opacities as CSS custom properties on the
// header ELEMENT via its ref — NOT per-frame setState, so a 120Hz scroll never re-renders the tree
// (§6). One value drives every transitioning property in lockstep. Both the Topic and Page hosts
// use it; `onSlim` (optional) is called when p crosses the slim gate so a host can flip a coarse
// derived boolean (the Topic title cue) — the Page host omits it (nothing gated). ────────────────
function useHeaderScrollProgress(
  headerRef: React.RefObject<HTMLElement | null>,
  onSlim?: (slim: boolean) => void
) {
  // Hold the latest callback in a ref so the effect can stay mount-only ([] deps) without going
  // stale — the listener is set up once and never torn down on a callback identity change.
  const onSlimRef = useRef(onSlim);
  onSlimRef.current = onSlim;
  useEffect(() => {
    let raf = 0;
    // Reduced-motion: snap to {0,1} end-states (§7) — the header is either the full projector or
    // the slim bar, no intermediate frames. A tiny dead-band avoids 1px chatter in this quantized
    // path. Read once on mount + react to changes.
    const reduceQuery =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    let quantized: 0 | 1 = 0;

    const evaluate = () => {
      raf = 0;
      const el = headerRef.current;
      if (!el) return;
      const y = window.scrollY;
      let p = computeProgress(y, PROGRESS_END);
      if (reduceQuery?.matches) {
        quantized = quantizeProgress(p, quantized);
        p = quantized; // 0 or 1 — apply the end-state instantly (no intermediate frame)
      }
      const d = deriveHeaderProgress(p, TOPIC_BURN_Y, SLIM_BAR_HEIGHT);
      el.style.setProperty("--p", p.toFixed(4));
      el.style.setProperty("--topic-burn-y", `${d.bandHeight.toFixed(2)}px`);
      el.style.setProperty("--beam-opacity", d.beamOpacity.toFixed(4));
      el.style.setProperty("--border-opacity", d.borderOpacity.toFixed(4));
      onSlimRef.current?.(p >= SLIM_GATE_P);
    };
    const onScroll = () => {
      if (raf) return; // rAF-gate: at most one evaluation per frame
      raf = requestAnimationFrame(evaluate);
    };
    evaluate(); // initial state (a deep-linked scroll position / refresh mid-page — §5)
    window.addEventListener("scroll", onScroll, { passive: true });
    const onMedia = () => evaluate();
    reduceQuery?.addEventListener?.("change", onMedia);
    return () => {
      window.removeEventListener("scroll", onScroll);
      reduceQuery?.removeEventListener?.("change", onMedia);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [headerRef]);
}

// ── Host C — content pages (#issue: universal scroll-aware beam). The sticky, scroll-aware header
// every NON-Topic content page (/about/data, /contribute, /contributor) uses: the same continuous
// Tier-A beam → slim Tier-C collapse as Topic, driven by the same `p`-derived CSS vars, but with NO
// search slot, NO seam-on-divider probe, and NO title cue — just the projector beam (self-contained
// lockup, centred desktop / left at narrow, exactly like Home) and a single right-anchored
// AuthControl. It ALSO emits a full-bleed beam-landing page surface (`.beam-page-illum`) right after
// the sticky header so the beam lands on a white→grey page top with the band-bottom burn matching
// the page (the #96 burn-to-page-surface fix) — for free, with no per-page wiring. Home stays the
// free-standing hero (AC12); this is the universal default for ordinary pages. ───────────────────
function PageSiteHeader({ auth }: { auth: ReactNode }) {
  const headerRef = useRef<HTMLElement>(null);
  useHeaderScrollProgress(headerRef);
  return (
    <>
      <header
        ref={headerRef}
        // Background is `--beam-seam-surface` (owned by `.header-shared`): the visible cool band is
        // painted by the projector's own coolfield span, so the header element's bg only shows
        // through the reserved 2px bottom border (transparent in the front half) — and that strip
        // must match the PAGE at the seam (the `--p`-tracked seam colour), not a fixed content-white
        // that over-shoots once the page greys. No bg utility here — `.header-shared` owns it.
        className="header-shared header-page sticky top-0 z-40"
        style={INITIAL_HEADER_VARS}
      >
        <div
          className="header-band relative w-full"
          style={{ height: "var(--topic-burn-y)" }}
        >
          {/* The single Tier-A projector layer — full-bleed, BEHIND the chrome. It owns the
              wordmark at every `p`: the flat Tier-C lockup is always opaque (the home link) and the
              lit aperture glow + descending beam fade out ON TOP of it as `p` rises, while the band
              collapses 104 → 56. Clipped to the LIVE band height so the projector's internal
              cool→white edge is pinned to the band bottom (#96 §4.2). No seam probe (no divider on a
              content page) — the lockup is self-contained (centred desktop / left at narrow). */}
          <div
            data-testid="page-beam"
            className="header-beam absolute inset-x-0 top-0 z-0 overflow-hidden"
            style={{ height: "var(--topic-burn-y)" }}
          >
            <HeaderProjector variant="projector" continuous href="/" />
          </div>
          {/* The chrome row — the single AuthControl, right-anchored, pinned to the top slim-bar
              height so it is reachable at every `p`. pointer-events-none row so its empty space lets
              clicks fall through to the flat wordmark home link behind it; the auth restores its own
              pointer events. No search, no title cue. */}
          <div
            className="header-chrome pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto flex max-w-[1200px] items-center px-5"
            style={{ height: SLIM_BAR_HEIGHT }}
          >
            <div className="pointer-events-auto ml-auto flex shrink-0 items-center">
              {auth}
            </div>
          </div>
        </div>
      </header>
      {/* The beam-landing page surface — a full-bleed illumination falloff (content-white → body
          grey) painted behind the TOP of the page content, flush beneath the sticky header. It has
          NET-ZERO layout height (its own height is the falloff distance, pulled back by an equal
          negative bottom margin) so the page content overlaps it rather than being pushed down: the
          beam lands on a white page top, the brightness falls to the body grey just under the lamp,
          and as the reader scrolls the white top recedes under the collapsing band — the same
          white→grey-page mechanic the Topic page gets from `.topic-illum`, here for free for any
          `host="page"` page. Decorative (no content, behind the page). */}
      <div aria-hidden className="beam-page-illum pointer-events-none" />
    </>
  );
}

// ── Host A — Home. Exactly today's landing header markup (AC12), now through the wrapper. No
// search slot, no scroll-aware collapse, the projector at every width + a single right-anchored
// AuthControl on the wordmark row (no top strip, no second row). Nothing here may change the
// landing look/behavior — it is a screenshot-diff guardrail (§4.5). ───────────────────────────
function HomeSiteHeader({ auth }: { auth: ReactNode }) {
  return (
    <div className="relative bg-[var(--color-header-field)]">
      <HeaderProjector variant="projector" as="a" href="/" />
      {/* The single AuthControl, right-anchored on the SAME row as the lockup at every width. The
          slot sits in the cool fluorescent band above the burn boundary, vertically centred on the
          wordmark row (cyMid=28 → height 56 = cyMid·2). Absolutely positioned so it never pushes the
          lockup off its anchor and never folds to a second row (§4.5 / #61 §7.5). Below 480px the
          button itself shrinks to the compact "Log in" label (AuthControl), keeping it clear of the
          left-anchored wordmark — so the slot needs no width clamp. */}
      <div
        className="auth-slot absolute right-0 top-0 z-10 flex items-center justify-end px-3 sm:px-4"
        style={{ height: 56 }}
      >
        {auth}
      </div>
    </div>
  );
}

// ── Host B — Topic. The scroll-aware, seam-on-divider header (sticky top-0 z-40). ─────────────
//
// Composition strategy (design §4.2 — "same nodes, no content jump"):
//   • A PERSISTENT slim chrome ROW is always mounted: the flat Tier-C wordmark (home link) +
//     search + the single AuthControl + the slim-state title cue. These are the SAME DOM nodes in
//     both scroll states, so focus is never lost on the Tier-A ↔ slim transition (AC9/AC13) and
//     there is no remount/jump.
//   • The flat Tier-C wordmark card is ALWAYS fully opaque (the stable home link); at scroll-top an
//     absolutely-positioned Tier-A PROJECTOR OVERLAY (the lit aperture GLOW + the descending beam,
//     seam on the divider) sits ON TOP of it, and when scrolled that glow fades OUT (opacity → 0)
//     while the band collapses 104 → 56 (height transition), revealing the identical flat card
//     beneath. Both lockups share the same left origin so there is no horizontal jump, and because
//     the card beneath never fades it never washes out and always occludes the beam apex. The
//     overlay is pointer-events:none + aria-hidden — the flat wordmark link beneath carries the
//     "wiki+" home affordance; the overlay is pure decoration that the persistent chrome owns the
//     interactivity for.
function TopicSiteHeader({
  auth,
  search,
  articleTitle,
}: {
  auth: ReactNode;
  search?: ReactNode;
  articleTitle?: string;
}) {
  // ── Continuous, scroll-linked collapse (#96) — driven by the shared `useHeaderScrollProgress`
  // hook (the rAF-gated scroll listener writing the `p`-derived CSS vars on the header element; see
  // its definition above). One value drives every transitioning property in lockstep, so no
  // property can lag another and no independently-scrolling seam can form. The seam probe stays
  // mount/resize-only (§2) — `p` never triggers a re-measure. ─────────────────────────────────────
  const headerRef = useRef<HTMLElement>(null);
  // `isSlim` is a coarse derived boolean (p ≥ SLIM_GATE_P) used ONLY to gate the muted title cue
  // (A4 / §5.1). It flips at most twice across the whole gesture (once each way at the midpoint) —
  // NOT a per-frame re-render. The continuous visual transition is driven entirely by CSS vars.
  const [isSlim, setIsSlim] = useState(false);
  useHeaderScrollProgress(headerRef, (slim) =>
    setIsSlim((prev) => (slim === prev ? prev : slim))
  );

  // ── The narrow-search collapse signal (topic-mobile-search §3.1, plumbing option (a)). ────────
  // `narrowSearchExpanded` = (viewport < md) AND (the topic-disclosure search field is open). The
  // disclosure reports its open state up via the context's `setSearchFieldOpen` (the lift); the
  // header ANDs that with a < md media check (the same MD_BREAKPOINT pattern HeaderAuth uses). When
  // true it (i) forces the wordmark to the Tier-D "+" glyph (HeaderProjector `forceGlyph`, §3.2) and
  // (ii) collapses the login to icon-only (HeaderAuth reads `narrowSearchExpanded` from the context,
  // §3.3) — so both neighbours collapse, and the field flexes between them, as ONE coordinated
  // change. It is structurally false ≥ md (the media check) and false while collapsed (the field
  // reports closed) — the magnifier-only and ≥ md states are untouched (AC3/AC11).
  const [searchFieldOpen, setSearchFieldOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(`(max-width: ${MD_BREAKPOINT - 1}px)`);
    const apply = () => setIsNarrow(mql.matches);
    apply();
    if (mql.addEventListener) mql.addEventListener("change", apply);
    else mql.addListener(apply);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", apply);
      else mql.removeListener(apply);
    };
  }, []);
  const narrowSearchExpanded = isNarrow && searchFieldOpen;
  // Stable context value so consumers (TopicSearch reporting up, HeaderAuth reading down) don't
  // re-render on an unrelated header re-render. `setSearchFieldOpen` from useState is already stable.
  const narrowSearchValue = useMemo(
    () => ({ narrowSearchExpanded, setSearchFieldOpen }),
    [narrowSearchExpanded]
  );

  // ── Seam-on-divider geometry (AC2/AC10/AC11), measured at MOUNT + on RESIZE only (never on
  // scroll). The probe (a zero-height div spanning the grid's gutter, rendered in the overlay)
  // gives the real gutter-centre in viewport px; we express it as a fraction of the band width so
  // it flows through HeaderProjector's existing `projectionX` hook (#72 §3.3 / A2 — the second,
  // dynamic consumer the landing spec reserved). At < lg the columns stack → there is no divider
  // (AC10): we pass NO projectionX, so the lockup lays out self-contained (left-anchored), exactly
  // as the landing page does at narrow widths.
  //
  // FORWARD-COMPAT (do NOT build — #72 nudge): the gutter centre is read from REAL column geometry
  // via the probe, with NO hardcoded column widths. A future feature where the +plus card is
  // draggable to rebalance the wiki/plus columns would move the probe, so the seam would follow for
  // free — it maps cleanly onto this same `projectionX`/`seamRatio` hook. No feature work here.
  const probeRef = useRef<HTMLDivElement>(null);
  const [seamProjectionX, setSeamProjectionX] = useState<number | undefined>(
    undefined
  );

  const measureSeam = useCallback(() => {
    if (typeof window === "undefined") return;
    // Below lg the columns stack → no divider to align to (AC10). Drop the projectionX so the
    // lockup is self-contained.
    if (window.innerWidth < LG_BREAKPOINT) {
      setSeamProjectionX(undefined);
      return;
    }
    const probe = probeRef.current;
    if (!probe) return;
    const rect = probe.getBoundingClientRect();
    if (rect.width <= 0) return; // pre-layout / jsdom → keep the prior (or undefined) value
    const gutterCentre = rect.left + rect.width / 2; // viewport px of the gutter midpoint
    // Band width = the document's client width (the full-bleed band excludes the scrollbar; using
    // documentElement.clientWidth rather than innerWidth keeps the fraction matched to the band the
    // beam draws into — the DQ-1 scrollbar caveat). Drive the APEX so the SEAM lands on the gutter
    // centre: seam_x = apex_x − APERTURE_SEAM_OFFSET, so apex_x = gutterCentre + offset.
    const bandWidth =
      document.documentElement.clientWidth || window.innerWidth || 1;
    setSeamProjectionX((gutterCentre + APERTURE_SEAM_OFFSET) / bandWidth);
  }, []);

  // Measure on mount (after paint) + on resize of the grid probe (ResizeObserver) — NOT on scroll
  // (AC11). useEffect (not useLayoutEffect) so SSR/first paint is warning-free; the SSR fallback is
  // the layout-driven apex (no projectionX), refined to the seam one frame after mount.
  useEffect(() => {
    measureSeam();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && probeRef.current) {
      ro = new ResizeObserver(() => measureSeam());
      ro.observe(probeRef.current);
    }
    // Also re-measure on window resize (catches the < lg ↔ ≥ lg crossover the probe RO may miss
    // when the probe is display:none-equivalent at narrow widths).
    window.addEventListener("resize", measureSeam, { passive: true });
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measureSeam);
    };
  }, [measureSeam]);

  // The Tier-A geometry, with the measured seam fraction driven through projectionX (≥ lg only).
  // The single HeaderProjector instance OWNS the cross-fade (DEFECT-B): both the lit lockup and the
  // flat slim lockup live at ONE shared origin, so only opacity animates — never two wordmarks at
  // two positions (§4.2 single-origin transition). Under #96 those opacities (and the projector's
  // internal burn boundary) are driven by the same `p`-derived CSS vars this header writes, in
  // continuous mode.
  const tierAGeometry: ProjectorGeometry = {
    ...TOPIC_GEOMETRY,
    projectionX: seamProjectionX,
  };

  return (
    <NarrowSearchProvider value={narrowSearchValue}>
    <header
      ref={headerRef}
      // Background is `--beam-seam-surface` (owned by `.header-shared`): the visible cool fluorescent
      // band is painted by the projector's own coolfield span, so the header element's background
      // only ever shows through the reserved 2px bottom border (transparent in the front half). That
      // strip must match the PAGE at the seam (the `--p`-tracked seam colour), not a fixed
      // content-white that over-shoots once the page greys — no hairline at the header bottom.
      className="header-shared sticky top-0 z-40"
      // Initial CSS-var values so SSR/first paint is the full Tier-A state (p = 0) before the
      // scroll handler runs; the mount evaluate() immediately corrects a deep-linked position (§5).
      style={
        {
          "--p": "0",
          "--topic-burn-y": `${TOPIC_BURN_Y}px`,
          "--beam-opacity": "1",
          "--border-opacity": "0",
        } as React.CSSProperties
      }
    >
      {/* ── The band. Its HEIGHT recedes continuously (104 → 56) with `p` (#96 §3.2): driven by the
          `--topic-burn-y` CSS var the scroll handler writes every frame — NO per-property tween (the
          scroll is the animation). The chrome controls (search, title cue, auth) live in the top
          SLIM_BAR_HEIGHT row so they are reachable at every `p`. The WORDMARK (lit beam + flat slim
          lockup + the squeeze glyph) is owned by the single HeaderProjector layer below, which
          cross-fades by OPACITY ONLY at one shared origin. ── */}
      <div
        className="header-band relative w-full"
        style={{ height: "var(--topic-burn-y)" }}
      >
        {/* ── The single Tier-A PROJECTOR layer — full-bleed, BEHIND the chrome controls. It owns
            the wordmark at every `p`: the flat Tier-C lockup is always opaque at the shared origin
            and the lit aperture GLOW + descending beam (seam on the divider ≥ lg) fade out ON TOP of
            it as `p` rises (DEFECT-B — no double wordmark, no wash-out), and below SQUEEZE_BREAKPOINT
            it collapses to the Tier-D glyph so the search has room (DEFECT-A). The band is
            pointer-events:none; the ONLY
            interactive node is the flat/glyph home link (so it never intercepts the search/auth —
            DEFECT-A pointer-events fix). The seam probe (the gutter span) lives here so
            getBoundingClientRect reads the REAL gutter centre (§3.3 / AC2), at mount/resize only —
            `p` never re-measures it. ── */}
        <div
          data-testid="tier-a-beam"
          className="header-beam absolute inset-x-0 top-0 z-0 overflow-hidden"
          // #96 crux (§4.2): the beam layer is clipped to the LIVE band height (`--topic-burn-y`),
          // NOT a fixed 104. So the projector's internal cool→white edge is pinned to the band's
          // bottom edge at every `p` — there is only ONE edge and no independently-scrolling
          // white/grey seam can ever form (defect #1).
          style={{ height: "var(--topic-burn-y)" }}
        >
          {/* The seam probe: a zero-height grid mirroring the Topic page grid (max-w-[1200px] px-5
              gap-7 lg:grid-cols-[1fr_360px]). The marker spans the 28px gutter so its rect centre
              IS the gutter centre. Measured at mount/resize only (never per scroll — AC11). */}
          <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-0 max-w-[1200px] px-5">
            <div className="grid h-0 grid-cols-1 gap-7 lg:grid-cols-[1fr_360px]">
              <div className="h-0" />
              <div className="relative h-0">
                <div
                  ref={probeRef}
                  className="absolute h-0"
                  style={{ left: -28, width: 28, top: 0 }}
                />
              </div>
            </div>
          </div>
          {/* The ONE projector: lit + beam (Tier A) cross-fading continuously to the flat slim
              lockup at one shared origin, or the glyph at the squeeze. `continuous` makes it
              scroll-aware via the `p`-derived CSS vars (the flat layer + the interactive home link
              live inside it now — AC3/AC13). Seam on the divider (≥ lg) / self-contained past the
              reserved search (< lg — AC10). */}
          <HeaderProjector
            variant="projector"
            geometry={tierAGeometry}
            continuous
            href="/"
            // §3.2 — force the Tier-D "+" glyph (and suppress the lit beam) while the narrow search
            // disclosure is open. ORs into the existing < 380px squeeze (a superset); restores the
            // normal `p`-driven lockup/beam on close.
            forceGlyph={narrowSearchExpanded}
          />
        </div>

        {/* ── The chrome controls row — the SAME nodes in both scroll states (AC9/AC13), pinned to
            the top SLIM_BAR_HEIGHT. z-10 → above the projector band. It reserves the upper-left
            search box (so the lockup never overlaps it — DEFECT-A) and right-anchors the single
            auth. The title cue (slim only) flexes in the middle, truncating first under pressure.
            The wordmark is NOT in this row — it is the projector layer above, positioned at the
            seam / left-inset — so search + auth own their own boxes and can never be overlapped. ── */}
        <div
          className="header-chrome pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto flex max-w-[1200px] items-center gap-3 px-5"
          style={{ height: SLIM_BAR_HEIGHT }}
        >
          {/* Search — upper-left (AC6/AC7). The host passes topic-inline ≥ md / topic-disclosure
              < md. min-w-0 lets the inline field shrink; the disclosure icon is a fixed 44px box.
              pointer-events-auto restores interactivity (the row is pointer-events-none so its empty
              middle lets clicks fall through to the flat wordmark link behind it — DEFECT-A).
              topic-mobile-search §3.4: while the narrow search is open the slot also `grow`s so the
              field FILLS the row's free space between the glyph and the login (instead of `ml-auto`
              on the auth eating the slack) — the field is wider at wider narrow widths (AC9) and the
              login stays pinned at the right with no overlap. The `grow` is gated to the open state,
              so the collapsed magnifier slot is unchanged (AC3) and ≥ md is untouched (AC11). */}
          {search ? (
            <div
              className={`pointer-events-auto flex min-w-0 shrink items-center ${
                narrowSearchExpanded ? "grow" : ""
              }`}
            >
              {search}
            </div>
          ) : null}

          {/* A4 — the muted article-title cue, slim state ONLY (§4.4). One muted serif line,
              truncated, NOT a heading (a <span>), aria-hidden (the real <h1> is in the lead block).
              It sits left-of-centre on the article side (after the reserved search) and is the FIRST
              to yield under width pressure (min-w-0 + truncate, hidden < md). The auth's ml-auto
              keeps it pushed right, so the cue takes only the slack between search and auth. */}
          {articleTitle && isSlim ? (
            <span
              aria-hidden="true"
              className="pointer-events-none hidden min-w-0 shrink truncate font-serif text-[0.95rem] text-slate-500 md:inline"
              data-testid="slim-title-cue"
            >
              {articleTitle}
            </span>
          ) : null}

          {/* The single consolidated AuthControl, right-anchored (AC9). Same node in both states.
              ml-auto pushes it right whether or not the title cue renders. pointer-events-auto
              restores interactivity over the pointer-events-none row. */}
          <div className="pointer-events-auto ml-auto flex shrink-0 items-center">
            {auth}
          </div>
        </div>
      </div>
    </header>
    </NarrowSearchProvider>
  );
}
