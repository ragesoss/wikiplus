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
      {/* The designed OFF-state lens base (docs/design/about-projector-warmup.md §2.1.1, §2.2). The
          projector's lens BEFORE the lamp strikes: a dark interior, a geometric "+" aperture that
          reads by GEOMETRY (a dark plus on the slightly-darker interior, edged by a faint lighter
          outline — never a glow), and a faint glass reflection. It is the floor the About warm-up
          intro's lit layers light up OVER (the lit group's opacity animates 0 → 1 above it). The dark
          off interior is painted at the FULL lit-glass extent (the lamp-base ellipse rx32 ry47) so it
          covers that warm #ffdf9f base completely — the OFF lens reads as OFF, with no warm gold rim
          around its edge.

          The whole group cross-fades opacity 1 → 0 over the warm-up (completing by lamp-max,
          t = 1240ms; the §2.2 belt-and-braces) so by settle it contributes ZERO pixels and the
          settled lens is byte-identical to the committed lit poster — there is no anti-aliased seam at
          the lit radial's clip edge under the stage's non-uniform scale. The group's CSS DEFAULT
          opacity is 0 (see globals.css `.about-off-lens`), so a reduced-motion / no-JS / settled
          render never shows the OFF lens at all — only the lit poster. The fade is gated exactly like
          the rest of the intro (`@media (prefers-reduced-motion: no-preference)` + `.about-intro`).

          Decorative (the whole SVG is aria-hidden); painted in order interior → rim → "+" →
          reflection, beneath the lit `about-lamp-light` group. */}
      <g className="about-off-lens">
        {/* Dark off interior — at the full lit-glass extent (rx32 ry47) so it fully covers the warm
            lamp-base ellipse: no warm rim shows around the OFF lens. */}
        <ellipse cx="438" cy="272" rx="32" ry="47" fill="var(--color-lens-off-interior)" />
        {/* The thin interior rim — stroke only, fully inside the clip (covered by the lit radial). */}
        <ellipse
          cx="438"
          cy="272"
          rx="27"
          ry="42"
          fill="none"
          stroke="var(--color-lens-off-rim)"
          strokeWidth="1.6"
        />
        {/* Geometric "+" aperture — an inset of the lit white "+"'s path, so its anti-aliased edge
            sits inside the opaque lit "+"'s coverage and is occluded pixel-for-pixel at settle (AC2).
            A dark plus edged by a faint lighter outline (read by geometry, never a glow), still sized
            to nearly fill the glass; clipped to the same #proj-pclip so it can't spill past it. */}
        <g clipPath={`url(#${clip})`}>
          <path
            d="M431,229 h14 v31 h21 v24 h-21 v31 h-14 v-31 h-21 v-24 h21 v-31 z"
            fill="var(--color-aperture-off)"
            stroke="var(--color-aperture-off-edge)"
            strokeWidth="1.4"
            strokeOpacity="0.6"
          />
        </g>
        {/* Faint glass reflection — a small rotated sheen, upper-left of the lens centre. */}
        <ellipse
          cx="424"
          cy="250"
          rx="11"
          ry="7"
          fill="var(--color-glass-sheen)"
          opacity="0.2"
          transform="rotate(-32 424 250)"
        />
      </g>
      {/* The LAMP LIGHT group — the warm/white light layers that read as "the lamp is lit": the two
          warm bloom radials, the clipped glass lamp radial, and the white "+" aperture, painted OVER
          the designed OFF-state lens base above. The About warm-up intro animates THIS group's
          opacity from 0 (the off lens shows through) up to 1 over a single flicker → dim→bright
          keyframe, reaching the committed lit projector at lamp-max. As it rises, the OFF base below
          cross-fades out (see `.about-off-lens`), so at settle only the lit lamp paints. At rest the
          group is opacity 1 (the default, so reduced-motion / no-JS get the lit lamp for free — the
          off base, default opacity 0, never shows). Grouping the light layers keeps the intro a single
          group-opacity tween. The group stays decorative (the whole SVG is aria-hidden). */}
      <g className="about-lamp-light">
        {/* The clipped glass lamp radial (the warm glow inside the aperture). */}
        <g clipPath={`url(#${clip})`}>
          <ellipse cx="438" cy="272" rx="32" ry="47" fill={`url(#${lamp})`} />
        </g>
        {/* Warm bloom over the bezel/body — painted OVER the glass radial (the committed paint order:
            the bloom's warm spill layers on top of the bright glass, so the lens reads bright-white at
            the core with a warm halo; this exact ordering keeps the settled lens byte-identical to the
            committed lit poster). */}
        <circle cx="438" cy="272" r="150" fill={`url(#${bloom})`} />
        <circle cx="438" cy="272" r="96" fill={`url(#${bloom})`} />
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
