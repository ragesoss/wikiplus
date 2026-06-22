// <Projector> — the angled "on" mini-LED projector, inline SVG (docs/design/about-page.md §2.2;
// the exact paths are read from docs/design/about-centerpiece-handoff/Centerpiece.dc.html, the
// visual tiebreaker). Pure decoration: the whole SVG is aria-hidden + role="presentation" +
// focusable="false" (§4.3, AC15) — the scene's meaning is carried by the visually-hidden
// description in <Centerpiece>, not this graphic.
//
// The white "+" aperture (clipped to #pclip) is the LAMP the beams originate from; it stays pure
// white (yellow appears only as the bloom spill, never the "+"). Colours are referenced via the
// @theme tokens (AC18): the projector body/shading indigos, the lamp/bloom warms, the ink strokes,
// the sprout power light, the violet focus hub.
//
// `idPrefix` namespaces the SVG <defs> ids so two instances on a page can never collide on a shared
// gradient/clip id (only one renders today, but the prefix keeps it safe + obvious).

export function Projector({ idPrefix = "proj" }: { idPrefix?: string }) {
  const lamp = `${idPrefix}-plamp`;
  const bloom = `${idPrefix}-pbloom`;
  const clip = `${idPrefix}-pclip`;
  return (
    <svg
      viewBox="0 0 660 440"
      width="100%"
      aria-hidden="true"
      role="presentation"
      focusable="false"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <radialGradient id={lamp} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--color-content-white)" />
          <stop offset="0.62" stopColor="var(--color-lamp-core)" />
          <stop offset="1" stopColor="var(--color-lamp-edge)" />
        </radialGradient>
        <radialGradient id={bloom} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--color-bloom-1)" stopOpacity="0.96" />
          <stop offset="0.34" stopColor="var(--color-bloom-2)" stopOpacity="0.74" />
          <stop offset="0.66" stopColor="var(--color-bloom-3)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--color-bloom-3)" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clip}>
          <ellipse cx="438" cy="272" rx="31" ry="46" />
        </clipPath>
      </defs>

      {/* Contact shadow on the surface. */}
      <ellipse cx="300" cy="362" rx="236" ry="16" fill="var(--color-ink)" opacity="0.08" />
      {/* Back-left leg peeking out. */}
      <rect x="94" y="320" width="20" height="22" rx="2" fill="var(--color-ink)" />
      {/* Curved side wall (the prism's depth). */}
      <path
        d="M168,211 L88,214 Q66,214 66,235 L66,309 Q66,330 88,330 L168,333 Q146,334 146,312 L146,232 Q146,210 168,211 Z"
        fill="var(--color-indigo-dark)"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
      />
      {/* Front feet (behind the faceplate). */}
      <rect x="196" y="328" width="26" height="15" rx="2" fill="var(--color-ink)" />
      <rect x="330" y="322" width="26" height="15" rx="2" fill="var(--color-ink)" />
      {/* Faceplate (tapers shorter on the lens side for the yaw). */}
      <path
        d="M168,211 L384,219 Q406,220 406,242 L406,302 Q406,324 384,325 L168,333 Q146,334 146,312 L146,232 Q146,210 168,211 Z"
        fill="var(--color-brand)"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
      />
      {/* Green power light. */}
      <circle cx="176" cy="236" r="5" fill="var(--color-sprout)" stroke="var(--color-ink)" strokeWidth="1.4" />
      {/* Focus dial: indigo-dark ring + violet hub. */}
      <circle cx="212" cy="302" r="14" fill="var(--color-indigo-dark)" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="212" cy="302" r="6" fill="var(--color-violet)" stroke="var(--color-ink)" strokeWidth="1.5" />
      {/* Vent grille. */}
      <g stroke="var(--color-indigo-dark)" strokeWidth="3" strokeLinecap="round">
        <line x1="330" y1="252" x2="330" y2="306" />
        <line x1="344" y1="252" x2="344" y2="306" />
        <line x1="358" y1="252" x2="358" y2="306" />
      </g>
      {/* Lens (ellipse stack, vertical major axis for the yaw). */}
      <ellipse cx="418" cy="272" rx="46" ry="62" fill="var(--color-indigo-barrel)" stroke="var(--color-ink)" strokeWidth="2.5" />
      <ellipse cx="424" cy="272" rx="40" ry="56" fill="var(--color-indigo-dark)" stroke="var(--color-ink)" strokeWidth="1.6" />
      <ellipse cx="438" cy="272" rx="38" ry="54" fill="var(--color-ink)" />
      <ellipse cx="438" cy="272" rx="32" ry="47" fill="var(--color-lamp-base)" />
      {/* The LAMP LIGHT group — the warm/white light layers that read as "the lamp is lit": the two
          warm bloom radials, the clipped glass lamp radial, and the white "+" aperture. The
          always-present cool lens stack beneath (above) is the "off-ish" lamp. The About warm-up
          intro animates THIS group's opacity (flicker → dim→bright) over the static lens; at rest
          the group is opacity 1 = today's committed lit projector (the default, so reduced-motion /
          no-JS get the lit lamp for free). Grouping the light layers keeps the intro a single
          group-opacity tween. The group stays decorative (the whole SVG is aria-hidden). */}
      <g className="about-lamp-light">
        {/* Warm bloom over the bezel/body. */}
        <circle cx="438" cy="272" r="150" fill={`url(#${bloom})`} />
        <circle cx="438" cy="272" r="96" fill={`url(#${bloom})`} />
        {/* The clipped glass lamp radial (the warm glow inside the aperture). */}
        <g clipPath={`url(#${clip})`}>
          <ellipse cx="438" cy="272" rx="32" ry="47" fill={`url(#${lamp})`} />
        </g>
        {/* The white "+" aperture — the lamp the beams originate from (pure white, clipped). */}
        <g clipPath={`url(#${clip})`}>
          <path
            d="M429,225 h18 v33 h23 v28 h-23 v33 h-18 v-33 h-23 v-28 h23 v-33 z"
            fill="var(--color-content-white)"
          />
        </g>
      </g>
    </svg>
  );
}
