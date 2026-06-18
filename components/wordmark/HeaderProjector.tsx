"use client";

// HeaderProjector — the "Daylight Projector" wordmark (#15), the first implementation of
// the LOCKED identity in docs/VISUAL_IDENTITY.md (variant 01, Tier A). One reusable,
// tier-aware, PARAMETERIZED component (AC9/AC10). Bespoke Tailwind + inline SVG — no
// shadcn, no new font (serif "Wiki"/"pedia" reuse the article Georgia stack; "plus" reuses
// the Source Sans Pro stack via `.plus-disp`).
//
// Design contract: docs/design/landing-page.md §4 (Tier-A geometry mapped to the hero),
// §5 (this API: §5.1 tiers, §5.2 geometry props/tokens, §5.3 tokens), §7 (responsive),
// §8 (a11y). Geometry source of truth:
// mockups/wordmark-projector-illuminate.html buildScene() (variant 01).
//
// ── Iteration 2 (PR #61, owner findings — design "Iteration 2" note + revised §4.3/§4.7/§7): ──
//   1. TIGHT SEAM. The lockup is laid out as a shrink-to-fit inline-flex row: "Wiki" takes its
//      INTRINSIC width (no fixed WIKI_W) and the zine block butts immediately against "Wiki"'s
//      right edge (no gap). The ghost "Wikipedia"/"pedia" is covered by the block from the seam
//      rightward and is glimpsed ONLY through the lit "+" aperture — never floating in a gap.
//   2. burnY 168 → 150 (matches the mockup's pageY); cyMid 52 → 64 (matches the mockup) so the
//      composition is TIGHT (short cone, crossbar near burnY) and reads as a projection landing
//      ON the search, not a far-off underline.
//   3. BEAM AT EVERY WIDTH (fluid). The landing page renders Tier A "projector" at ALL widths —
//      no tier-drop. The beam is a preserveAspectRatio="none" full-width SVG whose viewBox width
//      is a fixed canvas mapped to 100%, so the brackets always reach both real page edges and
//      the beam scales fluidly (design §4.7). The Tier B/C/D variants remain DEFINED for the
//      future Topic-page shared header, but the landing call (variant="projector") shows the full
//      projector at every viewport.
//
// SCOPE (AC10): the geometry below is exposed as named props/typed config with the Tier-A
// landing defaults pinned as CSS variables (`--projector-*`, app/globals.css `.header-projector`).
// The landing render is ONE configuration — `<HeaderProjector variant="projector" />` with NO
// inline geometry numbers at the call site. The DYNAMIC behavior (live column-ratio measurement,
// runtime re-projection) is NOT implemented this round — only the API shape.

import { useEffect, useId, useRef, useState } from "react";

// ── The four tiers (design §5.1 / VISUAL_IDENTITY §6.2). ──────────────────────
export type HeaderProjectorVariant =
  | "projector" // Tier A — full treatment; the LANDING page uses this at EVERY width
  | "lockup-lit" // Tier B — lockup + lit aperture, no beam (future Topic-page fallback)
  | "lockup-flat" // Tier C — plain lockup, flat "+" block (future Topic-page + forced-colors)
  | "glyph"; // Tier D — the "+" zine tile alone (favicon/app-icon scale)

// ── Parameterized geometry (design §5.2 / AC10). Optional per-prop overrides; any value
// left undefined falls back to the pinned `--projector-*` token default. The landing page
// passes NONE of these — it is one configuration of the defaults. ─────────────
export interface ProjectorGeometry {
  /** beamSlope — beam arm half-width = (y − apex)·tan. Token: --projector-beam-tan (0.6). */
  beamSlope?: number;
  /** beamCrossUp(px) — how far above burnY the crossbar sits. Token: --projector-cross-up (28). */
  beamCrossUp?: number;
  /** beamEdgeInset(px) — crossbar end inset before brackets go off-page. Token: --projector-edge-inset (17). */
  beamEdgeInset?: number;
  /** burnY(px) — content boundary where the beam burns to white. Token: --projector-burn-y (150). */
  burnY?: number;
  /** projectionX — beam apex x (0..1 of width). Default: the lockup aperture center (content-column center, §4.3). */
  projectionX?: number;
  /** seamRatio — wiki/plus seam position driven by a column ratio. Token: --projector-seam-ratio (0.5 centered). */
  seamRatio?: number;
  /** fullBleed — gold border runs off real page edges (Tier A requires true). Default true. */
  fullBleed?: boolean;
}

export interface HeaderProjectorProps {
  /** Tier (design §5.1). Default "lockup-flat" — the safest, smallest treatment. */
  variant?: HeaderProjectorVariant;
  /** The mark's accessible name (design §8.1). Default "wiki+". */
  accessibleName?: string;
  /** Render as a link (e.g. home) or a plain div. Default "div". */
  as?: "div" | "a";
  /** href when `as="a"`. */
  href?: string;
  /** Per-instance geometry overrides (AC10). Omit on the landing page — defaults are the config. */
  geometry?: ProjectorGeometry;
  className?: string;
}

// ── Fixed lockup-scale constants (VISUAL_IDENTITY §4.1/§4.3, from buildScene). These size
// the lockup itself (identity-fixed — the block does NOT scale with the header, §4.2). They
// are intrinsic to the mark, not layout geometry, so they live here, not as call-site
// numbers. ────────────────────────────────────────────────────────────────────
const FS = 42; // "Wiki"/"pedia"/ghost Georgia size
const BH = 56; // zine block height
const ARM_A = 8; // "+" arm half-thickness
const ARM_B = Math.min(BH * 0.32, 18); // "+" arm reach
const CORE = 44; // white-hot aperture core box
const PEDIA_OPACITY = 0.24; // halation ghost (VISUAL_IDENTITY §2.8 / o.pedia)
const CUT_CX = 27; // aperture x within the block (mockup cutCx clamp → ~27 at this scale)

// SSR-safe tight estimate of the "Wiki" serif advance (Georgia 600 42px). The mockup measures
// `crisp.offsetWidth` (~95px); we use that REAL advance — NOT the old inflated 110 that opened a
// gap (Iteration-2 finding 1). It is only the no-JS fallback for the beam apex x; the tight seam
// itself comes from the shrink-to-fit inline-flex layout (no fixed width on "Wiki"), so this
// constant never opens a gap. The live aperture x is measured once and exposed as a CSS var.
const WIKI_W_EST = 95;
// SSR fallback for the aperture center's x within the full lockup, from the lockup's left edge:
// "Wiki" advance + the block's 2px margin + the cut inset. Used to land the aperture (not the
// lockup midpoint) on the beam apex (= content-column center, §4.3) before the measure resolves.
const APERTURE_X_EST = WIKI_W_EST + 2 + CUT_CX;

// 12-point "+" polygon (mockup plusPath). Used for the aperture knockout, the gold rim,
// and the screen-blend bleed.
function plusPath(cx: number, cy: number, a: number, b: number): string {
  const P: [number, number][] = [
    [cx - a, cy - b], [cx + a, cy - b], [cx + a, cy - a], [cx + b, cy - a],
    [cx + b, cy + a], [cx + a, cy + a], [cx + a, cy + b], [cx - a, cy + b],
    [cx - a, cy + a], [cx - b, cy + a], [cx - b, cy - a], [cx - a, cy - a],
  ];
  return "M" + P.map((p) => p.join(" ")).join(" L") + " Z";
}

// Mix an [r,g,b] toward white by t (0..1) — the aperture core's warm-at-rim radial.
function mix(c: [number, number, number], t: number): string {
  return c.map((v) => Math.round(v + (255 - v) * t)).join(",");
}

const GOLD_FILL: [number, number, number] = [255, 236, 178]; // #FFECB2 (mixed toward white)
const GOLD_RIM_RGB = "238,206,135"; // #EECE87 — the single signal-carrying edge gold

// ── The indigo "+" zine block (VISUAL_IDENTITY §5.3): even-odd knockout, 2px ink border,
// hard offset shadow arms, white "plus", with the lit aperture (core + gold rim + bleed) for
// Tiers A/B, or a flat drawn "+" for Tier C/D. Rendered as a fixed-size inline SVG so it never
// stretches. ──────────────────────────────────────────────────────────────────
function ZineBlock({ lit, uid }: { lit: boolean; uid: string }) {
  // Block width: room for the cut + "plus" text (mockup bw formula, fixed scale).
  const cutCx = CUT_CX; // aperture x within the block
  const bw = cutCx + ARM_B + 13 + 64;
  const cy = BH / 2;
  const plus = plusPath(cutCx, cy, ARM_A, ARM_B);

  return (
    <svg
      width={bw}
      height={BH}
      viewBox={`0 0 ${bw} ${BH}`}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <clipPath id={`cp-${uid}`}>
          <path d={plus} />
        </clipPath>
        <filter id={`fb-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.85" />
        </filter>
      </defs>
      {/* Hard offset shadow arms (the .plus-card hard black drop shadow). */}
      <rect x={6} y={BH} width={bw} height={6} fill="#2C2C2C" />
      <rect x={bw} y={6} width={6} height={BH} fill="#2C2C2C" />
      {lit ? (
        <>
          {/* Even-odd knockout: indigo block with the "+" cut OUT (the lamp shows through). */}
          <path
            d={`M0 0 H${bw} V${BH} H0 Z ${plus}`}
            fill="#676EB4"
            fillRule="evenodd"
          />
          {/* White-hot core behind the cut (radial, warm only at the very rim). */}
          <g clipPath={`url(#cp-${uid})`}>
            <rect x={0} y={0} width={bw} height={BH} fill="#fff" />
            <circle
              cx={cutCx}
              cy={cy}
              r={CORE / 2}
              fill={`url(#core-${uid})`}
            />
          </g>
          {/* Gold rim: stroke ON the "+" path, clipped to the interior + blurred — gold at the
              edge, clipping to white inward (NOT a circular glow). */}
          <path
            d={plus}
            fill="none"
            stroke={`rgb(${GOLD_RIM_RGB})`}
            strokeWidth={3}
            strokeOpacity={0.85}
            clipPath={`url(#cp-${uid})`}
            filter={`url(#fb-${uid})`}
          />
          <radialGradient id={`core-${uid}`} cx="50%" cy="46%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="74%" stopColor="#ffffff" />
            <stop offset="93%" stopColor={`rgb(${mix(GOLD_FILL, 0.5)})`} />
            <stop offset="100%" stopColor={`rgb(${mix(GOLD_FILL, 0.22)})`} />
          </radialGradient>
        </>
      ) : (
        <>
          {/* Tier C/D flat block: solid indigo with a DRAWN white "+" glyph (no lamp). */}
          <rect x={0} y={0} width={bw} height={BH} fill="#676EB4" />
          <path d={plus} fill="#ffffff" />
        </>
      )}
      {/* 2px ink border (matches .plus-card exactly). */}
      <rect x={1} y={1} width={bw - 2} height={BH - 2} fill="none" stroke="#2C2C2C" strokeWidth={2} />
      <text
        x={cutCx + ARM_B + 13}
        y={cy + 1}
        dominantBaseline="middle"
        className="plus-disp"
        fontWeight={900}
        fontSize={Math.round(BH * 0.46)}
        letterSpacing={-1}
        fill="#fff"
      >
        plus
      </text>
    </svg>
  );
}

// ── The "+"-shaped screen-blend bleed (VISUAL_IDENTITY §5.5): two blurred "+" shapes drawn
// OVER the block, screen-blended, so the bleed traces the "+" outline onto the indigo (a
// near no-op over the white cut interior). Positioned over the aperture center. ──
function ApertureBleed() {
  const gw = 100;
  const a = ARM_A;
  const b = ARM_B;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{
        left: -gw / 2,
        top: -gw / 2,
        width: gw,
        height: gw,
        mixBlendMode: "screen",
        filter: "blur(4px)",
      }}
    >
      <svg width={gw} height={gw} viewBox={`0 0 ${gw} ${gw}`} style={{ display: "block" }} aria-hidden="true">
        <path d={plusPath(gw / 2, gw / 2, a + 4, b + 4)} fill={`rgb(${GOLD_RIM_RGB})`} opacity={0.46} />
        <path d={plusPath(gw / 2, gw / 2, a + 1, b + 1)} fill="rgb(255,252,246)" opacity={0.92} />
      </svg>
    </span>
  );
}

// ── The geometric "+" beam (VISUAL_IDENTITY §5.6): a full-width SVG that scales horizontally
// (preserveAspectRatio="none") so the straight bracket arms reach BOTH real page edges and the
// 2px gold border runs off-page. Clipped at burnY so the gold edge-glow stays in the header and
// the beam burns to white into the hero below. SSR-safe: a fixed viewBox, no measurement.
//
// FLUID at every width (Iteration-2 finding 3 / design §4.7): VBW is a fixed canvas mapped to
// 100% width, so as the viewport narrows the crossbar's horizontal segment simply shortens — the
// cone stays a narrow stem, the brackets always reach both edges, the beam never becomes a sliver.
// fullBleed=false ⇒ no beam (the future Tier-B threshold; never used on the landing page).
function Beam({
  burnY,
  apexY,
  beamSlope,
  crossUp,
  edgeInset,
  apexXFrac,
}: {
  burnY: number;
  apexY: number; // beam apex y = aperture center y
  beamSlope: number;
  crossUp: number;
  edgeInset: number;
  apexXFrac: number; // beam apex x as a fraction of width (0.5 = center)
}) {
  // Work in a fixed viewBox; preserveAspectRatio="none" maps VBW → 100% width so the off-page
  // brackets land on the real viewport edges at any width. VBW is arbitrary scale; pick a wide
  // canvas so the slope reads as in the strip. (The vertical axis is true pixels.)
  const VBW = 1000;
  const apexX = VBW * apexXFrac;
  const top0 = apexY + BH / 2 + 6; // beam top just below the block bottom (mockup top0)
  const crossY = burnY - crossUp;
  const LX = edgeInset;
  const RX = VBW - edgeInset;
  const hw = (y: number) => (y - apexY) * beamSlope; // half-width at height y
  const dn = (burnY - crossY) * beamSlope; // bracket downward expansion past the crossbar
  // 8-point polygon: narrow stem → horizontal crossbar reaching near the edges → brackets
  // return to the beam angle and expand down past full width (encloses the content region).
  const P: [number, number][] = [
    [apexX - hw(top0), top0],
    [apexX + hw(top0), top0],
    [apexX + hw(crossY), crossY],
    [RX, crossY],
    [RX + dn, burnY],
    [LX - dn, burnY],
    [LX, crossY],
    [apexX - hw(crossY), crossY],
  ];
  const d = "M" + P.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L") + " Z";
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0"
      style={{
        top: 0,
        height: burnY, // clip the beam (and its glow) at the burn boundary — gold off-page, no bleed
        overflow: "hidden",
        filter:
          `drop-shadow(0 0 4px rgba(${GOLD_RIM_RGB},0.6)) drop-shadow(0 0 11px rgba(${GOLD_RIM_RGB},0.32))`,
      }}
    >
      <svg
        width="100%"
        height={burnY}
        viewBox={`0 0 ${VBW} ${burnY}`}
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
        aria-hidden="true"
      >
        {/* vectorEffect keeps the 2px gold stroke a true 2px despite the horizontal scale. */}
        <path
          d={d}
          fill="#ffffff"
          stroke={`rgb(${GOLD_RIM_RGB})`}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

// ── The lockup unit: ghost "Wikipedia" + crisp "Wiki" + "pedia" halation + the zine block.
// Laid out as a SHRINK-TO-FIT inline-flex row (Iteration-2 finding 1): "Wiki" is an UNSIZED
// inline span (intrinsic width) and the block follows with no left padding, so the seam is
// tight at every width and NO magic width is load-bearing for the gap.
//
// `wikiRef` (optional) lets the parent measure "Wiki"'s real advance ONCE (a useLayoutEffect)
// to land the beam apex on the aperture; the seam tightness does not depend on that measure.
function Lockup({
  lit,
  uid,
  wikiRef,
}: {
  lit: boolean;
  uid: string;
  wikiRef?: React.Ref<HTMLSpanElement>;
}) {
  return (
    <span className="relative inline-flex items-center" style={{ height: BH, lineHeight: 1 }}>
      {/* Ghost full "Wikipedia" (Wikipedia persists) — left-anchored under crisp "Wiki", so it
          sits BEHIND the block from the seam rightward (covered; glimpsed only through the cut). */}
      <span
        aria-hidden="true"
        className="projector-serif pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 whitespace-nowrap"
        style={{ fontWeight: 600, fontSize: FS, color: "#6a5e46", opacity: 0.06, filter: "blur(0.8px)" }}
      >
        Wikipedia
      </span>
      {/* Crisp "Wiki" (the source serif). REAL text — meets AA (~17:1 on the header field).
          NO fixed width: it takes its intrinsic advance so the block butts tight at the seam. */}
      <span
        ref={wikiRef}
        aria-hidden="true"
        className="projector-serif relative whitespace-nowrap"
        style={{ fontWeight: 600, fontSize: FS, color: "#1b1b1b" }}
      >
        Wiki
      </span>
      {/* The zine block (+ aperture/bleed when lit), butting the seam (only the block's own 2px
          ink border as margin — NOT a gap; the mockup's bx = seam). */}
      <span className="relative inline-flex items-center" style={{ marginLeft: 2 }}>
        <ZineBlock lit={lit} uid={uid} />
        {/* "pedia" halation ghost printed BEHIND the cut — faintest dark ghost, never read,
            anchored at the seam so it lives entirely behind the block (covered; never floats). */}
        <span
          aria-hidden="true"
          className="projector-serif pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 whitespace-nowrap"
          style={{ fontWeight: 600, fontSize: FS, color: "#000", opacity: PEDIA_OPACITY, filter: "blur(1.45px)", zIndex: -1 }}
        >
          pedia
        </span>
        {/* The screen-blend "+"-outline bleed, over the aperture center. */}
        {lit && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2"
            style={{ left: CUT_CX }}
          >
            <ApertureBleed />
          </span>
        )}
      </span>
    </span>
  );
}

export function HeaderProjector({
  variant = "lockup-flat",
  accessibleName = "wiki+",
  as = "div",
  href,
  geometry,
  className = "",
}: HeaderProjectorProps) {
  // Stable id for SVG defs (avoids collisions if two instances ever render). Derived from the
  // accessible name + variant — deterministic, so SSR and client markup match.
  const uid = `${variant}-${accessibleName}`.replace(/[^a-zA-Z0-9]/g, "");
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");

  // Resolve geometry: explicit prop > pinned token default. For the SSR-rendered SVG paths we
  // need concrete numbers, so the JS defaults MIRROR the pinned `--projector-*` tokens in
  // globals.css — kept in sync intentionally (AC10). burnY default = 150 (Iteration 2, design §4.2).
  const burnY = geometry?.burnY ?? 150;
  const beamSlope = geometry?.beamSlope ?? 0.6;
  const crossUp = geometry?.beamCrossUp ?? 28;
  const edgeInset = geometry?.beamEdgeInset ?? 17;
  const seamRatio = geometry?.seamRatio ?? 0.5; // reserved (future column-ratio); centered now
  const fullBleed = geometry?.fullBleed ?? true;
  const apexXFrac = geometry?.projectionX ?? 0.5; // beam apex x; content-column center on landing
  void seamRatio; // API-shape only this round (AC10) — no dynamic re-seam; documented, unused.

  const cyMid = 64; // wordmark row center from header top (design §4.2; matches the mockup)

  // ── Tight seam + apex tracking (Iteration-2 finding 1 / OQ-4). The seam tightness is layout
  // (the shrink-to-fit Lockup), needing no measure. To LAND the beam apex on the aperture we
  // measure "Wiki"'s real advance ONCE on the client and offset the lockup so its aperture
  // center sits at the content-column center (= the beam apex). SSR/first paint uses the tight
  // WIKI_W_EST (~95px) estimate so it is correct without JS; the measure refines it within ~1px. ──
  const wikiRef = useRef<HTMLSpanElement>(null);
  const [apertureX, setApertureX] = useState<number>(APERTURE_X_EST);
  // useEffect (not useLayoutEffect) is SSR-safe (no SSR warning) and sufficient here: the
  // first paint already uses the tight WIKI_W_EST estimate, so there is no apex jump — the
  // measure only refines it to the real Georgia advance.
  useEffect(() => {
    if (wikiRef.current) {
      const w = wikiRef.current.getBoundingClientRect().width;
      if (w > 0) setApertureX(w + 2 + CUT_CX); // "Wiki" advance + block margin + cut inset
    }
  }, []);

  // ── Tier D — the glyph tile alone (favicon/app-icon scale). Defined-but-minimal. ──
  if (variant === "glyph") {
    return (
      <Container as={as} href={href} accessibleName={accessibleName} className={className}>
        <span aria-hidden="true" className="inline-flex">
          <GlyphTile />
        </span>
      </Container>
    );
  }

  // ── Tier C — the plain flat lockup (also the forced-colors fallback). ──
  if (variant === "lockup-flat") {
    return (
      <Container as={as} href={href} accessibleName={accessibleName} className={`header-projector ${className}`}>
        <Lockup lit={false} uid={uid} />
      </Container>
    );
  }

  // ── Tier B — lockup + lit aperture, NO beam (nowhere to flare). ──
  if (variant === "lockup-lit") {
    return (
      <Container as={as} href={href} accessibleName={accessibleName} className={`header-projector ${className}`}>
        <Lockup lit={true} uid={uid} />
      </Container>
    );
  }

  // ── Tier A — the full projector. On the LANDING page this renders at EVERY width (no
  // tier-drop — Iteration-2 finding 3 / design §4.7); the beam scales fluidly via the
  // preserveAspectRatio="none" full-width SVG. The Tier B/C wrappers below remain DEFINED for
  // the future Topic-page shared header (and forced-colors, §8.5), but on the landing page the
  // full projector (`.tier-a`) shows at every viewport. `forced-colors: active` still forces the
  // flat Tier-C lockup (the burn-to-white/gold cannot survive a forced palette) via the
  // `forced-colors-flat` class (globals.css).
  return (
    <Container
      as={as}
      href={href}
      accessibleName={accessibleName}
      className={`header-projector forced-colors-flat ${className}`}
    >
      {/* The full projector with the two-temperature band + fluid beam — shown at EVERY width
          on the landing page (no `hidden lg:block` drop). On NARROW viewports `.tier-a` gets a
          top inset (globals.css) so the whole projector (lamp + beam + boundary, which all sit
          inside `.projector-band` and move together) drops below the absolutely-positioned
          top-right AuthControl — the "top bar feel, lockup below" of design §7.5. The auth is
          absolute to the page wrapper (not the band), so it stays put; only the projector moves,
          keeping the lamp on the beam apex. This grows the header a little on phones (a thin top
          strip), never a "full second row," and never overlaps. */}
      <div className="tier-a block">
        {/* The full-bleed two-temperature header band. min-height holds the flare room. */}
        <div className="projector-band relative w-full" style={{ minHeight: burnY }}>
          {/* cool fluorescent field above the burn boundary */}
          <span aria-hidden="true" className="absolute inset-x-0 top-0 bg-[var(--color-header-field)]" style={{ height: burnY }} />
          {/* warm content white from the burn boundary down (the hero resolves into this) */}
          <span aria-hidden="true" className="absolute inset-x-0 bg-[var(--color-content-white)]" style={{ top: burnY, bottom: 0 }} />

          {/* The geometric "+" beam (full-width, off-page gold border, clipped at burnY). */}
          {fullBleed && (
            <Beam
              burnY={burnY}
              apexY={cyMid}
              beamSlope={beamSlope}
              crossUp={crossUp}
              edgeInset={edgeInset}
              apexXFrac={apexXFrac}
            />
          )}

          {/* The lockup, placed so its APERTURE CENTER sits at the content-column center =
              the beam apex (design §4.3) — the beam projects straight down from the lamp onto
              the search. The aperture x within the lockup is "Wiki" advance + block margin + cut
              inset; we translate the lockup left by that (measured once; SSR-safe estimate) so
              the aperture (not the lockup midpoint) lands at left:50%.
              The inner `.projector-lockup-fit` SCALES the lockup down on narrow viewports
              (design §7 / §4.7 / §7.5: "the lockup may scale down as a unit before the auth is
              allowed to wrap") — its transform-origin is the aperture so the apex stays put. */}
          <div
            className="absolute left-1/2"
            style={{ top: cyMid, transform: `translate(${-apertureX}px, -50%)` }}
          >
            <span
              className="projector-lockup-fit block"
              style={{ transformOrigin: `${apertureX}px center` }}
            >
              <Lockup lit={true} uid={`${uid}-a-${reactId}`} wikiRef={wikiRef} />
            </span>
          </div>
        </div>
      </div>

      {/* Tier B — lit lockup, no beam. DEFINED for the future Topic-page shared header; the
          landing page does NOT show this (it stays Tier A at every width). Hidden except under
          forced-colors-flat's flip (which forces Tier C). */}
      <div className="tier-b hidden bg-[var(--color-header-field)] px-4 pb-1 pt-3">
        <Lockup lit={true} uid={`${uid}-b`} />
      </div>

      {/* Tier C — flat lockup. DEFINED for the future Topic-page shared header + the
          forced-colors fallback. Hidden on the landing page except under forced-colors. */}
      <div className="tier-c hidden bg-[var(--color-header-field)] px-4 pb-1 pt-3">
        <Lockup lit={false} uid={`${uid}-c`} />
      </div>
    </Container>
  );
}

// ── Tier D glyph tile: the indigo "+" block alone. ──
function GlyphTile() {
  const s = 28;
  const plus = plusPath(s / 2, s / 2, 4, 9);
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" style={{ display: "block" }}>
      <rect x={1} y={1} width={s - 2} height={s - 2} fill="#676EB4" stroke="#2C2C2C" strokeWidth={2} />
      <path d={plus} fill="#ffffff" />
    </svg>
  );
}

// ── The accessible-name container: ONE node carries `aria-label` (the mark is named "wiki+");
// every decorative layer inside is aria-hidden (design §8.1). `role="img"` on the div form so
// the accessible name is exposed without a child text node. ──────────────────
function Container({
  as,
  href,
  accessibleName,
  className,
  children,
}: {
  as: "div" | "a";
  href?: string;
  accessibleName: string;
  className: string;
  children: React.ReactNode;
}) {
  if (as === "a") {
    return (
      <a href={href ?? "#"} aria-label={accessibleName} className={`inline-block ${className}`}>
        {children}
      </a>
    );
  }
  return (
    <div role="img" aria-label={accessibleName} className={className}>
      {children}
    </div>
  );
}
