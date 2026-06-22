// <Beams> — the three nested warm beam cones, inline SVG (docs/design/about-page.md §2.3; polygons
// read from Centerpiece.dc.html). All three originate at the projector aperture (x ≈ 368) and fall
// rightward toward the page (faint → bright, outer → center); their overlap reads as a soft plus
// over the dark room. Plus the five faint motes.
//
// The beams are volumetric ONLY against the dark room — they do NOT paint a light gradient onto the
// page (AC7); the miniature reads as evenly lit via its own warm outer glow. Pure decoration:
// aria-hidden + role="presentation" + focusable="false" (§4.3, AC15), pointer-events:none.
//
// It fills the stage at viewBox 0 0 1280 720 (the reference frame), so it scales natively with the
// fixed-ratio stage (§2.6) — no per-width re-derivation.

export function Beams({ idPrefix = "beam" }: { idPrefix?: string }) {
  const grad = `${idPrefix}-cbeam`;
  return (
    <svg
      viewBox="0 0 1280 720"
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
      {/* outer → top-left & bottom-left corners of the page (frames the whole topic) */}
      <polygon points="368,558 368,606 686,715 686,78" fill={`url(#${grad})`} opacity="0.16" />
      {/* middle → top & bottom of the gutter */}
      <polygon points="368,564 368,600 712,618 712,112" fill={`url(#${grad})`} opacity="0.24" />
      {/* center → the general strip (brightest, widest core) */}
      <polygon points="368,574 368,588 712,426 712,264" fill={`url(#${grad})`} opacity="0.36" />
      {/* faint motes drifting in the beam */}
      <g fill="var(--color-beam-warm)">
        <circle cx="520" cy="512" r="1.6" opacity="0.5" />
        <circle cx="582" cy="448" r="1.3" opacity="0.4" />
        <circle cx="624" cy="392" r="1.4" opacity="0.45" />
        <circle cx="660" cy="470" r="1.2" opacity="0.4" />
        <circle cx="700" cy="332" r="1.3" opacity="0.4" />
      </g>
    </svg>
  );
}
