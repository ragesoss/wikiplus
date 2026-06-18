// HeaderProjector — the "Daylight Projector" wordmark (#15), the first implementation of
// the LOCKED identity in docs/VISUAL_IDENTITY.md (variant 01, Tier A). One reusable,
// tier-aware, PARAMETERIZED component (AC9/AC10). Bespoke Tailwind + inline SVG — no
// shadcn, no new font (serif "Wiki"/"pedia" reuse the article Georgia stack; "plus" reuses
// the Source Sans Pro stack via `.plus-disp`).
//
// Design contract: docs/design/landing-page.md §4 (Tier-A geometry mapped to the hero),
// §5 (this API: §5.1 tiers, §5.2 geometry props/tokens, §5.3 tokens), §7 (responsive
// tiers), §8 (a11y). Geometry source of truth:
// mockups/wordmark-projector-illuminate.html buildScene() (variant 01).
//
// SCOPE (AC10): the geometry below is exposed as named props/typed config with the Tier-A
// landing defaults pinned as CSS variables (`--projector-*`, app/globals.css `.header-projector`).
// The landing render is ONE configuration — `<HeaderProjector variant="projector" />` with NO
// inline geometry numbers at the call site. The DYNAMIC behavior (live column-ratio measurement,
// runtime re-projection) is NOT implemented this round — only the API shape.
//
// SSR-SAFE responsive degradation (design §7): the tier is chosen by CSS media queries, NOT JS
// viewport detection, so it is correct on the first SSR paint. The component renders all needed
// tiers and shows the right one per breakpoint:
//   ≥ lg → Tier A "projector"  ·  md → Tier B "lockup-lit"  ·  < md → Tier C "lockup-flat".
// `forced-colors: active` forces the flat Tier-C lockup (design §8.5).

// ── The four tiers (design §5.1 / VISUAL_IDENTITY §6.2). ──────────────────────
export type HeaderProjectorVariant =
  | "projector" // Tier A — full treatment (the landing page uses this)
  | "lockup-lit" // Tier B — lockup + lit aperture, no beam
  | "lockup-flat" // Tier C — plain lockup, flat "+" block
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
  /** burnY(px) — content boundary where the beam burns to white. Token: --projector-burn-y (168). */
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

// Estimate the "Wiki" serif width so the lockup can be laid out without DOM measurement
// (SSR-safe — design §7). Georgia 600 42px "Wiki" ≈ 110px; the value only positions the
// block beside the serif, it is not load-bearing for meaning (the beam apex is the aperture
// center regardless). A small over-estimate keeps a comfortable gap.
const WIKI_W = 110;
// Horizontal offset of the APERTURE center within the full lockup, from the lockup's left
// edge: "Wiki" width + the block's 2px margin + the cut's x within the block (cutCx=27). Used
// to land the aperture (not the lockup midpoint) on the beam apex / content-column center (§4.3).
const APERTURE_X = WIKI_W + 2 + 27;

// ── The indigo "+" zine block (VISUAL_IDENTITY §5.3): even-odd knockout, 2px ink border,
// hard offset shadow arms, white "plus", with the lit aperture (core + gold rim + bleed) for
// Tiers A/B, or a flat drawn "+" for Tier C/D. Rendered as a fixed-size inline SVG so it never
// stretches. ──────────────────────────────────────────────────────────────────
function ZineBlock({ lit, uid }: { lit: boolean; uid: string }) {
  // Block width: room for the cut + "plus" text (mockup bw formula, fixed scale).
  const cutCx = 27; // aperture x within the block (mockup cutCx clamp → ~27 at this scale)
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
// fullBleed=false ⇒ no beam (Tier B threshold). ───────────────────────────────
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
// Laid out as a fixed-pixel inline-flex row so it never stretches and the aperture center can
// be placed at the content-column center (the beam apex). ──────────────────────
function Lockup({ lit, uid }: { lit: boolean; uid: string }) {
  return (
    <span className="relative inline-flex items-center" style={{ height: BH, lineHeight: 1 }}>
      {/* Ghost full "Wikipedia" (Wikipedia persists) — left-anchored under crisp "Wiki". */}
      <span
        aria-hidden="true"
        className="projector-serif pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 whitespace-nowrap"
        style={{ fontWeight: 600, fontSize: FS, color: "#6a5e46", opacity: 0.06, filter: "blur(0.8px)" }}
      >
        Wikipedia
      </span>
      {/* Crisp "Wiki" (the source serif). REAL text — meets AA (~17:1 on the header field). */}
      <span
        aria-hidden="true"
        className="projector-serif relative whitespace-nowrap"
        style={{ fontWeight: 600, fontSize: FS, color: "#1b1b1b", width: WIKI_W }}
      >
        Wiki
      </span>
      {/* The zine block (+ aperture/bleed when lit), straddling the seam. */}
      <span className="relative inline-flex items-center" style={{ marginLeft: 2 }}>
        <ZineBlock lit={lit} uid={uid} />
        {/* "pedia" halation ghost printed BEHIND the cut — faintest dark ghost, never read. */}
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
            style={{ left: 27 /* cutCx */ }}
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

  // Resolve geometry: explicit prop > pinned token default (read on the client via CSS var;
  // for the SSR-rendered SVG paths we need concrete numbers, so the JS defaults mirror the
  // pinned `--projector-*` tokens in globals.css — they are kept in sync intentionally, AC10).
  const burnY = geometry?.burnY ?? 168;
  const beamSlope = geometry?.beamSlope ?? 0.6;
  const crossUp = geometry?.beamCrossUp ?? 28;
  const edgeInset = geometry?.beamEdgeInset ?? 17;
  const seamRatio = geometry?.seamRatio ?? 0.5; // reserved (future column-ratio); centered now
  const fullBleed = geometry?.fullBleed ?? true;
  const apexXFrac = geometry?.projectionX ?? 0.5; // beam apex x; content-column center on landing
  void seamRatio; // API-shape only this round (AC10) — no dynamic re-seam; documented, unused.

  const cyMid = 52; // wordmark row center from header top (design §4.2)

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

  // ── Tier A — the full projector, which OWNS the responsive degradation (design §7): the
  // component sheds spectacle as the viewport narrows. The tier shown is gated by CSS media
  // queries (NOT JS viewport detection), so it is correct on the first SSR paint:
  //   ≥ lg → full projector (band + beam + lit lockup)
  //    md → Tier B (lit lockup, no beam — nowhere to flare)
  //   < md → Tier C (flat lockup)
  // and `forced-colors: active` forces the flat Tier-C lockup at every width (design §8.5).
  // The `forced-colors-flat` class (globals.css) flips the tiers under a forced palette.
  return (
    <Container
      as={as}
      href={href}
      accessibleName={accessibleName}
      className={`header-projector forced-colors-flat ${className}`}
    >
      {/* ≥ lg: the full projector with the two-temperature band + beam. */}
      <div className="tier-a hidden lg:block">
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
              the search. The aperture x within the lockup is WIKI_W + the block margin + cutCx;
              we translate the lockup left by that so the aperture (not the lockup midpoint)
              lands at left:50%. */}
          <div
            className="absolute left-1/2"
            style={{ top: cyMid, transform: `translate(${-APERTURE_X}px, -50%)` }}
          >
            <Lockup lit={true} uid={`${uid}-a`} />
          </div>
        </div>
      </div>

      {/* md: Tier B — lit lockup, no beam. Left-aligned on the cool fluorescent field; the
          chrome flows on its own row below (the page owns that, < lg). */}
      <div className="tier-b hidden bg-[var(--color-header-field)] px-4 pb-1 pt-3 md:block lg:hidden">
        <Lockup lit={true} uid={`${uid}-b`} />
      </div>

      {/* < md: Tier C — flat lockup, left-aligned on the cool fluorescent field. */}
      <div className="tier-c bg-[var(--color-header-field)] px-4 pb-1 pt-3 md:hidden">
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
