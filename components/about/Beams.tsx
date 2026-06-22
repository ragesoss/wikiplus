// <Beams> — the warm beam cones for the About poster: three nested cones that originate at the
// projector aperture (lower-left of the scene) and fan up-and-right onto the Topic-page miniature
// (upper-right) — the long diagonal "throw" across the dark room. Outer faint → center brightest;
// the overlap reads as a soft plus. Plus a few drifting motes along the throw.
//
// The beams are volumetric ONLY against the dark room — they do NOT paint a light gradient onto the
// miniature (it reads as evenly lit via its own warm glow). Pure decoration: aria-hidden +
// role="presentation" + focusable="false", pointer-events:none.
//
// viewBox 0 0 1280 880 = the poster reference frame; it scales natively with the fixed-ratio stage,
// so the cone geometry needs no per-width re-derivation.

export function Beams({ idPrefix = "beam" }: { idPrefix?: string }) {
  const grad = `${idPrefix}-cbeam`;
  return (
    <svg
      viewBox="0 0 1280 880"
      preserveAspectRatio="none"
      aria-hidden="true"
      role="presentation"
      focusable="false"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 1,
        pointerEvents: "none",
      }}
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--color-beam-warm)" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="var(--color-beam-warm)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--color-beam-warm)" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      {/* apex at the projector aperture (~287,773, lower-left); the far edge lands across the page's
          left side (~x 708), framing the DROPPED miniature top → bottom (~y 280–860). outer →
          widest/faintest. */}
      <polygon points="287,750 287,796 722,860 706,280" fill={`url(#${grad})`} opacity="0.16" />
      {/* middle */}
      <polygon points="287,758 287,788 712,792 708,398" fill={`url(#${grad})`} opacity="0.24" />
      {/* center → the brightest, narrow core along the throw, aimed at the page's middle */}
      <polygon points="287,766 287,780 712,700 710,540" fill={`url(#${grad})`} opacity="0.36" />
      {/* faint motes drifting in the beam, along the lower-left → page throw */}
      <g fill="var(--color-beam-warm)">
        <circle cx="412" cy="722" r="1.6" opacity="0.5" />
        <circle cx="512" cy="690" r="1.3" opacity="0.4" />
        <circle cx="606" cy="662" r="1.4" opacity="0.45" />
        <circle cx="700" cy="636" r="1.2" opacity="0.4" />
        <circle cx="800" cy="606" r="1.3" opacity="0.4" />
      </g>
    </svg>
  );
}
