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

// ── Topic Tier-A geometry (#72 design §3.4). Shorter than the landing hero (sticky chrome, not a
// hero): the beam flares over a 116px band with the wordmark row at cyMid=40. The rest are the
// token defaults (do NOT mutate the landing --projector-* defaults — AC12). ────────────────────
export const TOPIC_BURN_Y = 116; // band height / burn boundary (#72 §3.4 — vs landing 130)
export const TOPIC_CY_MID = 40; // wordmark row centre (#72 §3.4 — vs landing 44)
// The slim sticky bar height (#72 §4.2). Also the `HEAD` scroll-sync constant in TopicView (§8).
export const SLIM_BAR_HEIGHT = 56;
// Scroll thresholds + hysteresis (#72 §4.3): collapse when scrollY > burnY (116), restore when
// scrollY < burnY − 40 (76). Between 76 and 116 the state is sticky (keeps its last value) so it
// never flickers on a pixel boundary (AC11).
const COLLAPSE_AT = TOPIC_BURN_Y; // 116
const RESTORE_AT = TOPIC_BURN_Y - 40; // 76
// `lg` (the Topic grid's side-by-side ↔ stacked breakpoint; #72 decision (a)). Seam-on-divider
// applies ONLY at ≥ lg, where a real divider exists (§3 / AC2 / AC10).
const LG_BREAKPOINT = 1024;

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
export function TopicHeaderSearch() {
  return (
    <>
      {/* Inline compact field ≥ md (AC6). */}
      <div className="hidden min-w-0 md:flex">
        <TopicSearch variant="topic-inline" />
      </div>
      {/* Icon-disclosure < md (AC7) — reveals the same field on tap. */}
      <div className="flex md:hidden">
        <TopicSearch variant="topic-disclosure" />
      </div>
    </>
  );
}

type Host = "home" | "topic";

interface SiteHeaderProps {
  /** Which host config (design §2). Default "home" (the unchanged landing hero). */
  host?: Host;
  /** The auth control node (exactly ONE AuthControl per header — AC9). */
  auth: ReactNode;
  /** Optional search slot. Unset on Home (no header search — AC6/AC12); set on Topic. */
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
  return <HomeSiteHeader auth={auth} />;
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
          wordmark row (~cyMid=44px → height 88). Absolutely positioned so it never pushes the
          lockup off its anchor and never folds to a second row (§4.5 / #61 §7.5). */}
      <div
        className="auth-slot absolute right-0 top-0 z-10 flex items-center justify-end px-3 sm:px-4 max-[479px]:max-w-[46%] max-[359px]:max-w-[120px]"
        style={{ height: 88 }}
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
//   • At scroll-top an absolutely-positioned Tier-A PROJECTOR OVERLAY (the lit aperture + the
//     descending beam, seam on the divider) fades IN over the flat chrome; when scrolled it fades
//     OUT (opacity → 0) and the band collapses 116 → 56 (height transition), revealing the flat
//     chrome bar beneath. Both lockups share the same left origin so there is no horizontal jump.
//     The overlay is pointer-events:none + aria-hidden — the flat wordmark link beneath carries the
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
  // ── Scroll-aware collapse (AC4/AC11). A passive, rAF-gated scroll listener reading ONLY
  // window.scrollY (a cheap read — no layout flush) flips a single boolean with hysteresis. It
  // never re-measures the column divider per scroll (that is mount/resize only — §3.3). ─────────
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    let raf = 0;
    const evaluate = () => {
      raf = 0;
      const y = window.scrollY;
      // Hysteresis: cross COLLAPSE_AT going down → slim; cross RESTORE_AT going up → Tier A; in
      // between, keep the last state (the functional updater reads the current value).
      setCollapsed((prev) => {
        if (y > COLLAPSE_AT) return true;
        if (y < RESTORE_AT) return false;
        return prev;
      });
    };
    const onScroll = () => {
      if (raf) return; // rAF-gate: at most one evaluation per frame
      raf = requestAnimationFrame(evaluate);
    };
    evaluate(); // initial state (e.g. a deep-linked scroll position / refresh mid-article)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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

  // The Tier-A geometry, with the measured seam fraction driven through projectionX (≥ lg only) and
  // the collapsed flag the projector uses to OWN the cross-fade (DEFECT-B): both the lit lockup and
  // the flat slim lockup live in ONE HeaderProjector instance at ONE shared origin, so only opacity
  // animates — never two wordmarks at two positions (§4.2 single-origin transition).
  const tierAGeometry: ProjectorGeometry = {
    ...TOPIC_GEOMETRY,
    projectionX: seamProjectionX,
  };

  return (
    <header
      className="header-shared sticky top-0 z-40 bg-[var(--color-header-field)]"
      data-collapsed={collapsed ? "" : undefined}
    >
      {/* ── The band. Its HEIGHT is what collapses (116 → 56) on scroll (AC4): a height transition,
          gated on reduced motion (AC5) via the .header-shared CSS. The chrome controls (search,
          title cue, auth) live in the top SLIM_BAR_HEIGHT row so they are reachable in BOTH states.
          The WORDMARK (lit beam + flat slim lockup + the squeeze glyph) is owned by the single
          HeaderProjector layer below, which cross-fades by OPACITY ONLY at one shared origin. ── */}
      <div
        className="header-band relative w-full"
        style={{ height: collapsed ? SLIM_BAR_HEIGHT : TOPIC_BURN_Y }}
      >
        {/* ── The single Tier-A PROJECTOR layer — full-bleed, BEHIND the chrome controls. It owns
            the wordmark in BOTH scroll states: the lit aperture + descending beam (seam on the
            divider ≥ lg) fade out and the flat Tier-C lockup fades IN at the IDENTICAL origin when
            `collapsed` (DEFECT-B — no double wordmark), and below SQUEEZE_BREAKPOINT it collapses to
            the Tier-D glyph so the search has room (DEFECT-A). The band is pointer-events:none; the
            ONLY interactive node is the flat/glyph home link (so it never intercepts the search/auth
            — DEFECT-A pointer-events fix). The seam probe (the gutter span) lives here so
            getBoundingClientRect reads the REAL gutter centre (§3.3 / AC2), at mount/resize only
            (AC11). The layer is the FULL Tier-A band height so the beam has its flare room; it
            overflows the slim band visually only via the projector's own paint (decorative). ── */}
        <div
          data-testid="tier-a-beam"
          className="header-beam absolute inset-x-0 top-0 z-0 overflow-hidden"
          style={{ height: TOPIC_BURN_Y }}
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
          {/* The ONE projector: lit + beam (Tier A) cross-fading to the flat slim lockup (collapsed)
              at one shared origin, or the glyph at the squeeze. `collapsed` makes it scroll-aware
              (the flat layer + the interactive home link live inside it now — AC3/AC13). Seam on the
              divider (≥ lg) / self-contained past the reserved search (< lg — AC10). */}
          <HeaderProjector
            variant="projector"
            geometry={tierAGeometry}
            collapsed={collapsed}
            href="/"
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
              middle lets clicks fall through to the flat wordmark link behind it — DEFECT-A). */}
          {search ? (
            <div className="pointer-events-auto flex min-w-0 shrink items-center">
              {search}
            </div>
          ) : null}

          {/* A4 — the muted article-title cue, slim state ONLY (§4.4). One muted serif line,
              truncated, NOT a heading (a <span>), aria-hidden (the real <h1> is in the lead block).
              It sits left-of-centre on the article side (after the reserved search) and is the FIRST
              to yield under width pressure (min-w-0 + truncate, hidden < md). The auth's ml-auto
              keeps it pushed right, so the cue takes only the slack between search and auth. */}
          {articleTitle && collapsed ? (
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
  );
}
