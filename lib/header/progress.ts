// Header transition progress — the pure math behind the continuous, scroll-linked Topic header
// collapse (issue #96). A single normalized progress value `p ∈ [0, 1]` drives the band height,
// the projector's internal burn boundary, the beam/lit/flat opacities, and the bottom-border
// opacity in lockstep, every frame. `p = 0` is the full Tier-A projector (scroll-top); `p = 1` is
// the slim Tier-C bar.
//
// Design contract: docs/design/continuous-header-transition.md §3 (the progress model), §4 (the
// burn-boundary pin), §7 (reduced motion). These functions are deliberately pure (no DOM, no
// window) so the mapping and curves are unit-testable in isolation; SiteHeader wires them to a
// rAF-gated scroll handler that writes the results as CSS custom properties.

// ── Tunables (design §3.1). The transition begins the instant the reader leaves the very top
// (PROGRESS_START = 0, no dead zone) and completes exactly as a band-height of article has passed
// beneath the header (PROGRESS_END = the Tier-A band height). These two are the only new tunables;
// they are passed in from SiteHeader so TOPIC_BURN_Y / SLIM_BAR_HEIGHT stay the single geometry
// source of truth there. ──────────────────────────────────────────────────────────────────────
export const PROGRESS_START = 0;

/** clamp `v` into [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Standard easing functions (design §3.3) — cheap, allocation-free scalar math, no library.
/** easeOutCubic — fast at the start, settling near the end. */
export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}
/** easeInCubic — slow at the start, accelerating to the end. The mirror of easeOutCubic. */
export function easeInCubic(t: number): number {
  return t * t * t;
}
/** easeInQuad — gentle ramp; used for the bottom-border fade gated to the back half. */
export function easeInQuad(t: number): number {
  return t * t;
}

/**
 * The normalized scroll progress `p ∈ [0, 1]` (design §3.1):
 *   p = clamp((scrollY − start) / (end − start), 0, 1)
 * `end` is the Tier-A band height (PROGRESS_END = TOPIC_BURN_Y), passed in from SiteHeader.
 */
export function computeProgress(
  scrollY: number,
  end: number,
  start: number = PROGRESS_START
): number {
  if (end <= start) return scrollY > start ? 1 : 0;
  return clamp((scrollY - start) / (end - start), 0, 1);
}

/**
 * Quantize `p` to a {0, 1} end-state for the reduced-motion path (design §7): no intermediate
 * frames, only the two end-states the reader's own scroll selects. A tiny dead-band around the
 * midpoint (flip to slim at p ≥ 0.55, back to full at p ≤ 0.45, hold otherwise) avoids a 1px
 * chatter in this re-booleanized path — the only place hysteresis returns. `prev` is the last
 * quantized value (0 or 1); pass 0 for the initial evaluation.
 */
export function quantizeProgress(p: number, prev: 0 | 1): 0 | 1 {
  if (p >= 0.55) return 1;
  if (p <= 0.45) return 0;
  return prev;
}

/** The values `p` drives, in lockstep (design §3.2). All derived from one `p`. */
export interface HeaderProgress {
  /** The raw progress `p ∈ [0, 1]`. */
  p: number;
  /** Band height in px — linear `burnY − (burnY − slim)·p`. The burn boundary equals this. */
  bandHeight: number;
  /** Beam + lit-aperture-glow opacity — easeOutCubic to 0, fully gone by p ≈ 0.85 (design §3.3).
   * Only the GLOW (the lit aperture + the descending beam) fades; the wordmark CARD beneath stays
   * fully opaque at every `p`, so the card never washes out and always occludes the beam apex. */
  beamOpacity: number;
  /** Bottom-border opacity — easeInQuad gated to the back half (held at 0 until p = 0.5). */
  borderOpacity: number;
}

/**
 * Derive every transitioning property from one `p` (design §3.2 / §3.3). The band height and the
 * projector's internal burn boundary are the SAME number at every `p` (the crux invariant, §4.2):
 * SiteHeader feeds `bandHeight` to both the outer band and `--topic-burn-y`, so the cool→white edge
 * sits exactly on the band's bottom edge and no independently-scrolling seam can form.
 *
 * The wordmark card does NOT cross-fade: the flat lockup is always fully opaque (the stable card +
 * home link), and the lit aperture glow + beam fade out ON TOP of it via `beamOpacity`. So there is
 * no second opacity to drive — fading two semi-transparent identical cards could never composite
 * back to a solid card (the front-half wash-out), so the card is kept solid and only the glow fades.
 *
 * @param p     normalized progress in [0, 1]
 * @param burnY full Tier-A band height (TOPIC_BURN_Y, 104)
 * @param slim  slim end height (SLIM_BAR_HEIGHT, 56)
 */
export function deriveHeaderProgress(
  p: number,
  burnY: number,
  slim: number
): HeaderProgress {
  return {
    p,
    // Height & burn boundary → linear (position-following layout tracks the scroll 1:1, §3.3).
    bandHeight: burnY - (burnY - slim) * p,
    // Beam + lit aperture glow fade over a compressed sub-range so they are fully 0 for the final
    // stretch (§3.3); the opaque card beneath is unaffected.
    beamOpacity: 1 - easeOutCubic(clamp(p / 0.85, 0, 1)),
    // Border held at 0 while the beam still reads; eased in over the back half (§3.3).
    borderOpacity: easeInQuad(clamp((p - 0.5) / 0.5, 0, 1)),
  };
}
