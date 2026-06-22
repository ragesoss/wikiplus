// <InSceneCard> — the in-scene "How it works" zine card (docs/design/about-page.md §2.5; values from
// Centerpiece.dc.html). The light hardbox the handoff layers in the dark scene's upper-left, BENEATH
// the beam (the center/middle cones visibly cross its lower-right corner — that overlap is intended).
//
// It is a DECORATIVE DUPLICATE of the §B section: its copy is exposed to assistive tech via §B, so
// reading it twice would be redundant — the whole card is aria-hidden (§4.2 / §9). It reads from the
// SAME HOW_IT_WORKS copy object as §B, so a copy edit updates both at once.
//
// It is rendered only inside the full desktop scene (≥ lg) — the parent <Centerpiece> drops the
// whole dark scene (and this card with it) below lg (§5.2). Colours via @theme tokens (AC18); this
// is the ONLY place gold appears on the page — a thin 2px eyebrow rule, never a fill, never a signal.

import { HOW_IT_WORKS } from "./copy";

export function InSceneCard() {
  return (
    <div
      aria-hidden="true"
      style={{
        background: "var(--color-card-warm)",
        border: "2px solid var(--color-ink)",
        boxShadow: "7px 7px 0 var(--color-ink)",
        padding: "20px 24px 20px",
      }}
    >
      {/* Eyebrow: gold accent rule + label. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ display: "inline-block", width: 24, height: 2, background: "var(--color-gold-accent)" }} />
        <span
          className="plus-disp"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".2em",
            textTransform: "uppercase",
            color: "var(--color-brand)",
          }}
        >
          {HOW_IT_WORKS.eyebrow}
        </span>
      </div>
      <h2
        className="plus-disp"
        style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.12, letterSpacing: "-0.01em", color: "var(--color-ink)", margin: "0 0 10px" }}
      >
        {HOW_IT_WORKS.heading}
      </h2>
      <p style={{ fontSize: 13.5, lineHeight: 1.62, color: "var(--color-prose-warm)", margin: "0 0 13px" }}>
        {HOW_IT_WORKS.lead}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {HOW_IT_WORKS.steps.map((step) => (
          <div key={step.n} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
            <span
              className="plus-disp"
              style={{ flex: "none", fontWeight: 800, fontSize: 12, color: "var(--color-brand)", lineHeight: 1.5 }}
            >
              {step.n}
            </span>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-prose-warm)" }}>{step.body}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
