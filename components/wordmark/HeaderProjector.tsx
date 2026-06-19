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
// Key layout properties (design §4.3/§4.7/§7):
//   1. TIGHT SEAM. The lockup is laid out as a shrink-to-fit inline-flex row: "Wiki" takes its
//      INTRINSIC width (no fixed WIKI_W) and the zine block butts immediately against "Wiki"'s
//      right edge (no gap). The ghost "Wikipedia"/"pedia" is covered by the block from the seam
//      rightward and is glimpsed ONLY through the lit "+" aperture — never floating in a gap.
//   2. TIGHT COMPOSITION. burnY and cyMid sit close together (short cone, crossbar near burnY) so
//      the mark reads as a projection landing ON the search, not a far-off underline.
//   3. BEAM AT EVERY WIDTH (fluid). The landing page renders Tier A "projector" at ALL widths —
//      no tier-drop. The beam is drawn TRUE-SCALE: a full-width SVG whose viewBox width = the real
//      canvas width in px (no preserveAspectRatio stretch), so the stem width and flare angle are
//      identical at every viewport while the brackets always reach both real page edges (design
//      §4.7). The Tier B/C/D variants remain DEFINED for the future Topic-page shared header, but
//      the landing call (variant="projector") shows the full projector at every viewport.
//
// SCOPE (AC10): the geometry below is exposed as named props/typed config with the Tier-A
// landing defaults pinned as CSS variables (`--projector-*`, app/globals.css `.header-projector`).
// The landing render is ONE configuration — `<HeaderProjector variant="projector" />` with NO
// inline geometry numbers at the call site. The DYNAMIC behavior (live column-ratio measurement,
// runtime re-projection) is NOT implemented — only the API shape.

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
  /** burnY(px) — content boundary where the beam burns to white. Token: --projector-burn-y (130). */
  burnY?: number;
  /** projectionX — beam apex x as a fraction (0..1) of width. The reserved AC10 dynamic hook the
   * future Topic-page header drives. On the landing page it is OMITTED — the apex x is the LIVE
   * aperture x (centered on desktop / left-anchored at narrow widths — §4.3), computed from the
   * layout, not a static fraction. */
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
// `crisp.offsetWidth` (~95px); we use that REAL advance. It is only the no-JS fallback for the
// beam apex x; the tight seam itself comes from the shrink-to-fit inline-flex layout (no fixed
// width on "Wiki"), so this constant never opens a gap. The live aperture x is measured once and
// exposed as a CSS var.
const WIKI_W_EST = 95;
// SSR fallback for the aperture center's x within the full lockup, from the lockup's left edge:
// "Wiki" advance + the block's 2px margin + the cut inset. Used to land the aperture (not the
// lockup midpoint) on the beam apex (§4.3) before the measure resolves.
const APERTURE_X_EST = WIKI_W_EST + 2 + CUT_CX;

// SSR fallbacks + layout breakpoint for the true-scale beam (design §4.7). The beam
// viewBox width = the REAL band width `cw`; before the client measures it we draw at a sensible
// desktop fallback so SSR renders a coherent (centered) beam without JS. MD_BREAKPOINT mirrors
// Tailwind's `md` (768px) — the desktop(centered) vs. narrow(left-anchored) layout switch (§7.5).
// LANDING_PAD_X is the narrow-layout left inset of the lockup (matches the hero column's px-4),
// so the left-anchored aperture x = LANDING_PAD_X + apertureX.
const CW_FALLBACK = 960;
const MD_BREAKPOINT = 768;
const LANDING_PAD_X = 16;

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
          {/* Even-odd knockout: indigo block with the "+" cut OUT. The cut is left TRANSPARENT —
              the white-hot core + the faint "pedia" ghost are SEPARATE layers BEHIND this SVG (in
              Lockup) and show THROUGH the cut, exactly as the mockup stacks them (white backing →
              black "pedia" → block-with-transparent-cut). The earlier build filled the cut with an
              opaque white rect+core circle HERE, inside the SVG, which painted over the pedia ghost
              behind it — so no hint of the letters survived (owner). Now nothing opaque fills the
              cut; only the gold rim is drawn on its edge. */}
          <path
            d={`M0 0 H${bw} V${BH} H0 Z ${plus}`}
            fill="#676EB4"
            fillRule="evenodd"
          />
          {/* Gold rim: stroke ON the "+" path, clipped to the interior + blurred — gold at the
              edge, fading inward over the transparent cut so the lit core + pedia behind show
              through (NOT a circular glow). */}
          <path
            d={plus}
            fill="none"
            stroke={`rgb(${GOLD_RIM_RGB})`}
            strokeWidth={3}
            strokeOpacity={0.85}
            clipPath={`url(#cp-${uid})`}
            filter={`url(#fb-${uid})`}
          />
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

// ── The geometric "+" beam (VISUAL_IDENTITY §5.6 / design §4.7). ──────────────────
//
// TRUE-SCALE, ASYMMETRICAL-ARM model (design §4.7):
//   • The SVG is full-width but its viewBox width = the REAL canvas width `cw` in pixels, with NO
//     `preserveAspectRatio="none"` override — so the coordinate system is 1:1 px (option (b) of
//     §4.7, exactly what the mockup's buildScene() does: viewBox="0 0 {cw} {svgH}", no PAR). The
//     central stem width = the "+" cutout width and the flare angle (`beamSlope` = 0.6) are drawn
//     at TRUE pixel scale — identical at 320px and 1920px. `cw` enters as a real length, never as
//     a stretch ratio. NOTHING is horizontally stretched.
//   • The apex x = the LIVE aperture x (`apexX`, px) — centered on desktop, left at narrow. The
//     two crossbar arms are ASYMMETRICAL: the left arm runs apex→`edgeInset` (length apexX −
//     edgeInset), the right arm runs apex→`cw − edgeInset` (length cw − edgeInset − apexX). Arm
//     length is the ONLY horizontal thing that varies with layout/width.
//   • NO BOUNDARY UNDERLINE: the polygon's bottom vertices sit at `coneBot`, which is BELOW `burnY`
//     (like the mockup's `coneBot` below `pageY`). The whole span is then CLIPPED at `burnY`
//     (`height: burnY; overflow: hidden`), so the polygon's bottom CLOSING EDGE (the horizontal
//     segment joining the two bottom vertices) lies below the clip line and is NEVER drawn as a
//     stroke at the boundary. At/near `burnY` only the two diagonal brackets exiting the left/right
//     viewport edges (the `dn` down-and-out turns) and the crossbar arms ABOVE the boundary are
//     visible — there is NO full-width horizontal gold line at the header bottom.
//   • The 2px gold stroke is `non-scaling-stroke` so it stays a true 2px (the viewBox is 1:1 here,
//     so this is belt-and-suspenders, but it keeps the stroke crisp under any DPR rounding).
//
// `cw` is the live canvas width (measured client-side; SSR fallback `CW_FALLBACK`). fullBleed=false
// ⇒ no beam (the future Tier-B threshold; never used on the landing page).
function Beam({
  cw,
  burnY,
  apexY,
  beamSlope,
  crossUp,
  edgeInset,
  apexX,
}: {
  cw: number; // live canvas width in real px (true-scale viewBox width — NO stretch)
  burnY: number;
  apexY: number; // beam apex y = aperture center y
  beamSlope: number;
  crossUp: number;
  edgeInset: number;
  apexX: number; // beam apex x in real px = the LIVE aperture x (centered desktop / left narrow)
}) {
  // The cone's apex is a POINT at the aperture center (apexY), which sits BEHIND the zine block
  // (the block, drawn after the beam, occludes the apex region). So the beam has NO horizontal
  // gold cap at the top (the apex is a zero-width point, not a flat top edge) and NO gap — it
  // emerges flush from under the block's bottom (black zine) edge, exactly touching it: no top
  // gold border on the apex; the beam touches the black zine edge.
  const top0 = apexY;
  const crossY = burnY - crossUp; // crossbar sits crossUp above the burn boundary
  // The polygon extends BELOW burnY to coneBot, then the span clips at burnY (so the bottom
  // closing edge lies below the clip line and no line is drawn at the boundary). Mirrors the
  // mockup's coneBot below pageY;
  // svgH spans top0→coneBot. The exact coneBot only needs to be safely below burnY so the bottom
  // edge clips away; the brackets reach the edges well before it. Use the mockup's relationship.
  const coneBot = burnY + 96; // comfortably below burnY (mockup: ~96px below pageY=150 → 246)
  const svgH = coneBot - top0;
  const LX = edgeInset;
  const RX = cw - edgeInset;
  const hw = (y: number) => (y - apexY) * beamSlope; // cone half-width at height y (true-scale)
  const dn = (coneBot - crossY) * beamSlope; // bracket down-and-out expansion past the crossbar
  // y mapped into the SVG's own coordinate space (origin at top0).
  const yy = (y: number) => y - top0;
  // 8-point polygon (mockup P): narrow true-scale cone → horizontal crossbar arms reaching
  // edgeInset from EACH real edge (asymmetrical when apexX is off-center) → brackets return to
  // the beam angle and expand down-and-out PAST the edges to coneBot (below burnY → clipped).
  const P: [number, number][] = [
    [apexX - hw(top0), top0],
    [apexX + hw(top0), top0],
    [apexX + hw(crossY), crossY],
    [RX, crossY],
    [RX + dn, coneBot],
    [LX - dn, coneBot],
    [LX, crossY],
    [apexX - hw(crossY), crossY],
  ];
  const d =
    "M" + P.map((p) => `${p[0].toFixed(1)},${yy(p[1]).toFixed(1)}`).join(" L") + " Z";
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0"
      style={{
        top: top0, // SVG starts at the beam top; the span clips its bottom at burnY
        height: burnY - top0,
        // overflow:hidden clips the SVG CONTENT at burnY (the underline fix — the polygon's
        // bottom closing edge sits below this and is never drawn). But `overflow:hidden` does
        // NOT clip the element's own `filter` output, so the gold drop-shadow GLOW would leak
        // ~12px below burnY onto the white hero. `clip-path: inset(0)` clips the FILTERED result
        // too (clip-path applies AFTER filter in the paint order), so the edge-glow stays inside
        // the header and never bleeds below the boundary — matching the mockup's clip-path clip.
        overflow: "hidden",
        clipPath: "inset(0)",
        filter:
          `drop-shadow(0 0 4px rgba(${GOLD_RIM_RGB},0.6)) drop-shadow(0 0 11px rgba(${GOLD_RIM_RGB},0.32))`,
      }}
    >
      <svg
        width={cw}
        height={svgH}
        viewBox={`0 0 ${cw} ${svgH}`}
        style={{ display: "block", overflow: "visible" }}
        aria-hidden="true"
        data-projector-beam=""
        // The beam's structural markers for verification (no PAR override = true-scale):
        // data-beam-cone-bot = the polygon's bottom y (BELOW burnY, in the SVG's own coords);
        // data-beam-clip-h   = the clip height (burnY − top0). cone-bot > clip-h proves the bottom
        // closing edge sits BELOW the clip line and is clipped away → NO horizontal line at burnY.
        data-beam-cone-bot={(coneBot - top0).toFixed(1)}
        data-beam-clip-h={(burnY - top0).toFixed(1)}
        data-beam-apex-x={apexX.toFixed(1)}
        data-beam-left-arm={(apexX - edgeInset).toFixed(1)}
        data-beam-right-arm={(cw - edgeInset - apexX).toFixed(1)}
      >
        {/* viewBox width = cw (1:1 px) — the stem + angle are TRUE-SCALE, never stretched.
            non-scaling-stroke keeps the 2px gold edge crisp. */}
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
// Laid out as a SHRINK-TO-FIT inline-flex row: "Wiki" is an UNSIZED
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
      {/* The zine block + the lit-aperture stack, butting the seam (only the block's own 2px ink
          border as margin — NOT a gap; the mockup's bx = seam). When lit, the aperture is a RECESSED
          LAMP built as LAYERS, in the SAME z-order as the mockup's buildScene
          (wordmark-projector-illuminate.html): white-hot core (behind) → faint "pedia" ghost OVER
          the core → the zine block whose "+" cut is a TRANSPARENT knockout (so the core+pedia show
          THROUGH it) → the screen-blend bleed on top. Reproducing that stack here (rather than
          filling the cut with opaque white inside the SVG) is what restores the faint hint of the
          "pedia" letters in the aperture (owner: the build had lost it entirely).
          aria-hidden: the whole zine-block subtree is decorative (the mark is named once on the
          Container via role=img/aria-label); hiding it keeps the "plus"/"pedia" text out of the
          accessibility tree regardless of which layers render per tier. */}
      <span aria-hidden="true" className="relative inline-flex items-center" style={{ marginLeft: 2 }}>
        {lit && (
          <>
            {/* White-hot core (mockup z=2): a 44×44 radial that is pure white across its middle and
                warms to gold only at the very rim. Centered on the cut, BEHIND everything, so only
                the part inside the transparent "+" shows. NOT clipped to the "+" here — the block's
                cut does the masking, exactly as the mockup's free-standing radial div does. */}
            <span
              aria-hidden="true"
              data-aperture-core=""
              className="pointer-events-none absolute top-1/2"
              style={{
                left: CUT_CX - CORE / 2,
                width: CORE,
                height: CORE,
                transform: "translateY(-50%)",
                zIndex: 0,
                background: `radial-gradient(circle at 50% 46%, #fff 0%, #fff 74%, rgb(${mix(GOLD_FILL, 0.5)}) 93%, rgb(${mix(GOLD_FILL, 0.22)}) 100%)`,
              }}
            />
            {/* "pedia" halation ghost (mockup z=5): pure-black letters at low opacity, blurred,
                printed OVER the white core but BEHIND the block. The core light reads as washing
                over them, so they're the faintest dark ghosts — glimpsed ONLY through the lit "+"
                aperture (the block's indigo covers them everywhere else). */}
            <span
              aria-hidden="true"
              className="projector-serif pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 whitespace-nowrap"
              style={{ fontWeight: 600, fontSize: FS, color: "#000", opacity: PEDIA_OPACITY, filter: "blur(1.45px)", zIndex: 1 }}
            >
              pedia
            </span>
          </>
        )}
        {/* The zine block, ABOVE the core+pedia (mockup z=9). When lit, its "+" cut is transparent
            and reveals the lit core + pedia behind; when flat, it is a solid block with a drawn "+".
            aria-hidden: this wrapper carries the SVG's "plus" text content, so it must stay inside
            the mark's hidden subtree (the accessible name is the container's "wiki+" alone). */}
        <span aria-hidden="true" className="relative" style={{ zIndex: 2 }}>
          <ZineBlock lit={lit} uid={uid} />
        </span>
        {/* The screen-blend "+"-outline bleed, over the aperture center (mockup z=12, on top). */}
        {lit && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2"
            style={{ left: CUT_CX, zIndex: 3 }}
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
  // globals.css — kept in sync intentionally (AC10). burnY default = 130 (design §4.2).
  const burnY = geometry?.burnY ?? 130;
  const beamSlope = geometry?.beamSlope ?? 0.6;
  const crossUp = geometry?.beamCrossUp ?? 28;
  const edgeInset = geometry?.beamEdgeInset ?? 17;
  const seamRatio = geometry?.seamRatio ?? 0.5; // reserved (future column-ratio); centered now
  const fullBleed = geometry?.fullBleed ?? true;
  // projectionX is the reserved AC10 hook (0..1 of width) the FUTURE Topic-page header drives;
  // on the landing page the apex x is the LIVE aperture x, computed from the layout below. When
  // a caller passes projectionX explicitly we honor it as a fraction (the dynamic-API shape).
  const projectionXFrac = geometry?.projectionX; // undefined on the landing page (layout-driven)
  void seamRatio; // API-shape only (AC10) — no dynamic re-seam; documented, unused.

  // Wordmark row center from the header top (design §4.2). With burnY = 130 the cone length is
  // burnY − cyMid = 86px; the crossbar offset and flare angle complete the beam geometry.
  const cyMid = 44;

  // ── Live geometry measurement (design §4.3 / §4.7). The beam is drawn TRUE-SCALE
  // at the real canvas width `cw`, with the apex on the LIVE aperture x — so we measure both on
  // the client (resize-tracked). The apex x is LAYOUT-DRIVEN, not center-locked:
  //   • desktop (≥ md, ~≥ 768px): the lockup is CENTERED → aperture (= apex) at cw/2.
  //   • narrow  (< md):           the lockup is LEFT-anchored → aperture (= apex) at
  //                               LANDING_PAD_X + apertureX.
  // The aperture x WITHIN the lockup is "Wiki"'s real advance + the block's 2px margin + the cut
  // inset; we measure "Wiki"'s advance once it's laid out (the seam tightness itself needs no
  // measure — it comes from the shrink-to-fit Lockup). SSR/first paint uses the tight WIKI_W_EST
  // (~95px) + a sensible cw fallback so it is correct without JS; the measure refines it.
  const wikiRef = useRef<HTMLSpanElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const [apertureX, setApertureX] = useState<number>(APERTURE_X_EST);
  const [cw, setCw] = useState<number>(CW_FALLBACK);
  const [narrow, setNarrow] = useState<boolean>(false);

  // Measure "Wiki"'s real advance once (refines the SSR estimate to the real Georgia glyph width).
  // Use `offsetWidth` (the LAYOUT width), NOT getBoundingClientRect().width: at narrow widths the
  // lockup is scaled down by `.projector-lockup-fit`, and getBoundingClientRect returns the
  // POST-transform (shrunken) width. Mixing that scaled width with the unscaled CUT_CX — and
  // feeding it to the scale's transform-origin — made the computed aperture x diverge from where
  // the cutout actually renders, landing the beam apex LEFT of the "+". offsetWidth ignores the
  // ancestor transform, so apertureX is the true unscaled aperture offset and (since the scale's
  // transform-origin is this same apertureX) the cutout stays exactly on the apex at every width.
  useEffect(() => {
    if (wikiRef.current) {
      const w = wikiRef.current.offsetWidth;
      if (w > 0) setApertureX(w + 2 + CUT_CX); // "Wiki" advance + block margin + cut inset
    }
  }, []);

  // Track the band's real width + the desktop/narrow breakpoint (resize-aware) so the beam stays
  // true-scale to the actual viewport and the apex tracks the layout-driven aperture.
  useEffect(() => {
    const measure = () => {
      const el = bandRef.current;
      if (!el) return;
      const w = el.getBoundingClientRect().width;
      // Guard on w>0: jsdom (and pre-layout) reports 0 — keep the SSR fallback (centered desktop)
      // rather than flip to narrow on a bogus zero width.
      if (w > 0) {
        setCw(w);
        setNarrow(w < MD_BREAKPOINT);
      }
    };
    measure();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && bandRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(bandRef.current);
    } else if (typeof window !== "undefined") {
      window.addEventListener("resize", measure);
    }
    return () => {
      if (ro) ro.disconnect();
      else if (typeof window !== "undefined") window.removeEventListener("resize", measure);
    };
  }, []);

  // The live apex x in px (= the aperture x). Layout-driven: centered on desktop, left at narrow.
  // An explicit projectionX prop (the future Topic-page driver / AC10 dynamic hook) overrides.
  const apexX =
    projectionXFrac != null
      ? projectionXFrac * cw
      : narrow
        ? LANDING_PAD_X + apertureX // left-anchored: pad + aperture-within-lockup
        : cw / 2; // centered desktop: aperture at the content-column center

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
  // tier-drop — design §4.7 / §7); the beam is drawn TRUE-SCALE at the real band width with the
  // apex on the live aperture x and ASYMMETRICAL arms. The header is ONE row at
  // every width — the lockup is centered on desktop / LEFT-anchored at narrow (the auth control
  // sits at the right in the page host); there is NO top strip and NO folded second row. The
  // Tier B/C wrappers below remain DEFINED for the future Topic-page shared header (and
  // forced-colors, §8.5). `forced-colors: active` forces the flat Tier-C lockup via
  // `forced-colors-flat` (globals.css) — the burn-to-white/gold cannot survive a forced palette.
  return (
    <Container
      as={as}
      href={href}
      accessibleName={accessibleName}
      className={`header-projector forced-colors-flat ${className}`}
    >
      {/* The full projector with the two-temperature band + true-scale beam — shown at EVERY
          width (no `hidden lg:block` drop, no top strip). The lockup is positioned by the
          live apex x, so on narrow widths it sits LEFT (apex left-of-center → short left arm,
          long right arm) and on desktop it is centered (apex at cw/2 → arms ~equal) — design
          §4.3/§4.7. Exposes `--projector-apex-x` so the beam and lockup share the exact apex. */}
      <div
        className="tier-a block"
        style={{ ["--projector-apex-x" as string]: `${apexX.toFixed(1)}px` }}
      >
        {/* The full-bleed two-temperature header band. min-height holds the flare room. */}
        <div ref={bandRef} className="projector-band relative w-full" style={{ minHeight: burnY }}>
          {/* cool fluorescent field above the burn boundary */}
          <span aria-hidden="true" className="absolute inset-x-0 top-0 bg-[var(--color-header-field)]" style={{ height: burnY }} />
          {/* warm content white from the burn boundary down (the hero resolves into this) */}
          <span aria-hidden="true" className="absolute inset-x-0 bg-[var(--color-content-white)]" style={{ top: burnY, bottom: 0 }} />

          {/* The geometric "+" beam — true-scale stem + fixed 0.6 angle + ASYMMETRICAL arms,
              each drawn to its own real edge; the bottom extends below burnY and CLIPS at burnY
              so no horizontal gold line is drawn at the boundary (design §4.7). */}
          {fullBleed && (
            <Beam
              cw={cw}
              burnY={burnY}
              apexY={cyMid}
              beamSlope={beamSlope}
              crossUp={crossUp}
              edgeInset={edgeInset}
              apexX={apexX}
            />
          )}

          {/* The lockup, placed so its APERTURE sits exactly on the live apex x (design §4.3):
              left = apexX, then translate left by the aperture-within-lockup offset so the
              aperture (not the lockup midpoint) lands on the apex. The beam projects straight
              down from the lamp. The inner `.projector-lockup-fit` SCALES the lockup down on the
              smallest phones (transform-origin = the aperture so the apex stays put) BEFORE the
              auth is allowed to wrap (§7.5). */}
          <div
            className="absolute"
            style={{
              left: apexX,
              top: cyMid,
              transform: `translate(${-apertureX}px, -50%)`,
            }}
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
