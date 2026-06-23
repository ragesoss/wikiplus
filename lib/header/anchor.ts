// Header wordmark anchor/apex — the pure math behind WHERE the "Daylight Projector" lockup is
// placed horizontally (issue #144). Three regimes, decided in priority order:
//
//   1. SEAM-ON-DIVIDER (≥ lg, Topic only): the host measured a real column gutter and passes a
//      `projectionX` fraction → the apex is `projectionX · cw` (the seam lands on the divider).
//   2. SELF-CONTAINED LEFT-ANCHORED (no projectionX, below the host's `narrowBelow` threshold): the
//      lockup's left edge sits at `leftInset` (clearing the upper-left search) and the aperture
//      follows by construction → apex = `leftInset + apertureX`.
//   3. CENTERED (no projectionX, at/above `narrowBelow`): the apex is the content-column centre,
//      `cw / 2` (the landing hero / Home, and Topic ≥ lg only if no projectionX has resolved yet).
//
// The `narrowBelow` threshold is HOST-DRIVEN (the #144 fix): the scroll-aware Topic host left-anchors
// across the WHOLE `< lg` (1024) range, while Home keeps `md` (768) — so the md–lg band, where the
// Topic chrome row is packed (search · wordmark · cue · auth), no longer centers the lockup INTO the
// search/cue (the iPad-Mini overlap). Home's ≥ md centering is unchanged (AC4 guardrail).
//
// These functions are deliberately pure (no DOM, no window) so the placement decision is
// unit-testable in isolation — jsdom does no layout, so this is the offline verification gate for
// the #144 non-overlap math (mirroring lib/header/progress.ts). HeaderProjector measures `cw`,
// `apertureX`, and the viewport width client-side and feeds them here.

/** The default narrow-anchor threshold (Tailwind `md`, 768px) — the centered ↔ left-anchored switch
 * for the LANDING hero (Home). Below it the lockup left-anchors; at/above it the lockup centers. */
export const DEFAULT_NARROW_BELOW = 768;

/** The Topic (scroll-aware) host's narrow-anchor threshold (Tailwind `lg`, 1024px). The whole
 * `< lg` range left-anchors the self-contained lockup (clearing the inline search), since below lg
 * the Topic columns stack and there is no gutter divider to aim the seam at (#144 / shared-header
 * §5.6). At ≥ lg the host instead drives `projectionX` (seam-on-divider). */
export const TOPIC_NARROW_BELOW = 1024;

/** Which horizontal placement regime the lockup is in (for assertions + clarity). */
export type WordmarkAnchorMode = "projection" | "left" | "center";

export interface WordmarkAnchorInput {
  /** Live canvas (band) width in px. */
  cw: number;
  /** Viewport / band width compared against `narrowBelow` to pick centered vs left-anchored. In the
   *  component this equals `cw`; kept separate so a host can decide the regime off the viewport
   *  width even before the band width resolves. */
  viewportWidth: number;
  /** The width below which the lockup is self-contained / left-anchored. Host-driven: 768 (Home) or
   *  1024 (Topic). */
  narrowBelow: number;
  /** The aperture x WITHIN the lockup, from the lockup's left edge ("Wiki" advance + block margin +
   *  cut inset). */
  apertureX: number;
  /** The self-contained left edge of the lockup ("Wiki" begins) when left-anchored. */
  leftInset: number;
  /** Seam-on-divider apex as a fraction (0..1) of `cw`, driven by the host ≥ lg. `undefined` (the
   *  usual `< lg` / landing case) ⇒ the apex is layout-driven (centered or left-anchored). */
  projectionX?: number;
}

export interface WordmarkAnchor {
  /** The beam apex x in px (= the live aperture x). */
  apexX: number;
  /** Which regime decided it. */
  mode: WordmarkAnchorMode;
}

/**
 * Decide the lockup's apex x (= the aperture x) — the single placement decision behind every header
 * state. Priority: an explicit `projectionX` (seam-on-divider, ≥ lg) wins; otherwise the lockup is
 * left-anchored below `narrowBelow` (apex = leftInset + apertureX) and centered at/above it
 * (apex = cw/2). Mirrors HeaderProjector's `apexX` expression as a testable pure function (#144).
 */
export function computeWordmarkAnchor(input: WordmarkAnchorInput): WordmarkAnchor {
  const { cw, viewportWidth, narrowBelow, apertureX, leftInset, projectionX } = input;
  if (projectionX != null) {
    return { apexX: projectionX * cw, mode: "projection" };
  }
  if (viewportWidth < narrowBelow) {
    return { apexX: leftInset + apertureX, mode: "left" };
  }
  return { apexX: cw / 2, mode: "center" };
}

/**
 * The width-aware self-contained `leftInset` (#144 §3.2). Below `md` the reserve is the `< md`
 * disclosure MAGNIFIER box (44px field + the 20px page inset = the existing 64px). At ≥ md the Topic
 * search slot renders the wider INLINE field, so the left-anchored lockup must begin past it:
 *   page inset (px-5 = 20) + inline field (max-w-[280px]) + chrome gap (gap-3 = 12) + 8 clearance
 *   = 320px.
 * Token-derived so it tracks the real chrome tokens. Home never calls this (no search slot — it uses
 * its own LANDING_PAD_X). The constants are passed in so the geometry source of truth stays in
 * SiteHeader.
 *
 * @param viewportWidth the live viewport width in px
 * @param mdBreakpoint  the inline ↔ disclosure handoff width (768)
 * @param magnifierReserve the `< md` magnifier reserve (64)
 * @param inlineReserve    the ≥ md inline-field-clearing reserve (320)
 */
export function topicLeftInset(
  viewportWidth: number,
  mdBreakpoint: number,
  magnifierReserve: number,
  inlineReserve: number
): number {
  return viewportWidth >= mdBreakpoint ? inlineReserve : magnifierReserve;
}
