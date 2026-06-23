// <TopicMiniature> — the Topic-page miniature, an HTML/CSS component tree (docs/design/about-page.md
// §2.4; values read from Centerpiece.dc.html). The product surface the projector lights up: a
// Wikipedia article (the calm grey/white "ground") with the indigo ＋plus layer composed on top as a
// literal "+". Built at the handoff's exact px values — it lives inside the scaled 1280×720 inner
// stage (Centerpiece §2.6), so the px are preserved verbatim and merely scaled as a unit.
//
// SEPARABLE PLUS LAYER (spec in-scope item 10 / §10.2): the indigo cards + clips render from one
// <PlusLayer>-family subtree distinct from the article-ground subtree (each plus group carries
// `.about-plus`), so the About warm-up intro reveals the ＋plus layer (a fade onto the present article
// ground) without re-architecting the miniature.
//
// A11y (§4.3, AC15): the miniature is decorative EXCEPT the one real control (the title input). An
// aria-hidden ancestor would also hide the input, so we do NOT put aria-hidden on an ancestor of the
// input. Instead the decorative pieces (body lines, plus cards, clips, play triangles, curation
// bars) are marked aria-hidden individually / in decorative groups, and the input + its label/help
// stay OUTSIDE any aria-hidden subtree. The colours come from @theme tokens (AC18).

import { MiniatureTitleInput } from "./MiniatureTitleInput";

// ── Indigo "hardbox" primitive (the zine-card signature): indigo fill, 2px ink border, 3px solid
// offset shadow (no blur). The plus cards + clips share it. ──────────────────────────────────────
const HARDBOX_STYLE: React.CSSProperties = {
  background: "var(--color-brand)",
  border: "2px solid var(--color-ink)",
  boxShadow: "3px 3px 0 var(--color-ink)",
};

/** A curation bar's decorative fill colour (teal = accurate, red = opinion, blue = caveat). On THIS
 *  page the bar carries no meaning the user must act on — the real fact/opinion signal is
 *  text-labelled on the actual Topic page — so it is decorative, not a color-only signal (§9.4). */
type CurationFill = "accurate" | "opinion" | "caveat";
const CURATION_FILL: Record<CurationFill, string> = {
  accurate: "var(--color-sprout)",
  opinion: "var(--color-clip-opinion)",
  caveat: "var(--color-action)",
};

/** One indigo video clip: a hardbox with a centered white play triangle + a bottom-left curation
 *  bar. Decorative (aria-hidden by the PlusLayer group above it). */
function Clip({
  width,
  height,
  curation,
}: {
  width: number | string;
  height: number;
  curation: CurationFill;
}) {
  return (
    <div style={{ position: "relative", flex: "none", width, height, ...HARDBOX_STYLE }}>
      {/* white play triangle (CSS borders), centered */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "11px solid transparent",
            borderBottom: "11px solid transparent",
            borderLeft: "18px solid var(--color-content-white)",
            marginLeft: 3,
          }}
        />
      </div>
      {/* curation bar, bottom-left */}
      <div
        style={{
          position: "absolute",
          left: 8,
          bottom: 8,
          width: 46,
          height: 12,
          borderRadius: 2,
          background: CURATION_FILL[curation],
          border: "2px solid var(--color-ink)",
        }}
      />
    </div>
  );
}

// `seedTitle` is the dynamic title for the current power-on (AC16–AC18), seeded into the title input.
// `titleFlicker` switches on the §5.3 old→new title cross-flicker (the wrapper carries the
// `about-title-flicker` class the keyframe keys off) — set by <Centerpiece> only during a restarted
// power-on whose pick differs from the prior title; never on first/auto-play or under reduced motion.
// `coolOverlay` renders the dim-cool illuminate veil — set by <Centerpiece> ONLY when the intro/toggle
// machinery is engaged (motion-enabled). When false (reduced-motion / no-JS / settled capture) the
// overlay is ABSENT from the DOM, so the settled miniature is byte-identical to the committed poster
// (a z-index'd absolute child would otherwise re-rasterize the miniature's clipped edge — AC2/AC11).
export function TopicMiniature({
  seedTitle,
  titleFlicker = false,
  coolOverlay = false,
}: {
  seedTitle?: string;
  titleFlicker?: boolean;
  coolOverlay?: boolean;
} = {}) {
  return (
    <div
      className="about-mini-page"
      style={{
        position: "relative",
        background: "var(--color-content-white)",
        borderRadius: 4,
        overflow: "hidden",
        // A soft drop shadow grounds the page in the dark room. No warm halo glow — a box-shadow glow
        // traces the page's rectangle (reads as a rectangular outline); the beam landing on the page
        // is what should read as "lit", not a glow tracing its edges.
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        padding: "30px 28px 34px",
      }}
    >
      {/* The dim-cool "unlit screen" overlay (§1.2-D / AC4). Decorative, pointer-events:none, clipped
          by this root's overflow:hidden so it can never bleed into the surrounding theater field
          (AC4b). It multiplies the cool blue-grey over the miniature's surface and fades to 0 as the
          page illuminates. Rendered only while the intro/toggle is engaged so a settled / reduced-
          motion render is byte-identical to the committed poster (the comment above the prop). */}
      {coolOverlay && <div className="about-mini-cool" aria-hidden="true" />}
      {/* ── (a) Masthead: article title + body lines (left) · plus cards (right) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 132px", gap: 20, alignItems: "start" }}>
        {/* Left (article ground). The serif title is the LIVE input (§3) — the one real control,
            kept OUT of any aria-hidden subtree. The body lines beneath it are decorative. */}
        <div style={{ minWidth: 0, paddingTop: 2 }}>
          {/* The title block, wrapped so the §5.3 old→new flicker can key its opacity to the lamp
              strikes on a restarted power-on. The wrapper is structural-only at rest (no class, no
              style); the input inside stays the editable, Enter-navigable control (AC18). */}
          <div
            className={titleFlicker ? "about-title-flicker" : undefined}
            style={{ margin: "0 0 13px" }}
          >
            <MiniatureTitleInput seedTitle={seedTitle} />
          </div>
          <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {["100%", "100%", "100%", "88%", "54%"].map((w, i) => (
              <div key={i} style={{ height: 10, borderRadius: 5, background: "var(--color-line-body)", width: w }} />
            ))}
          </div>
        </div>
        {/* Right (gutter top) — the PLUS LAYER's overview + contents cards. */}
        <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Overview card — three white blocks. PLUS LAYER reveal group (order 2). */}
          <div className="about-plus about-plus--overview" style={{ ...HARDBOX_STYLE, padding: 11, display: "flex", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ flex: 1, height: 30, borderRadius: 3, background: "var(--color-content-white)" }} />
            ))}
          </div>
          {/* Contents / TOC card — white "+" glyph + a header rule, then five short white rule lines.
              PLUS LAYER reveal group (order 3). */}
          <div className="about-plus about-plus--contents" style={{ ...HARDBOX_STYLE, padding: 11, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ color: "var(--color-content-white)", fontSize: 11, fontWeight: 800, lineHeight: 1 }}>＋</span>
              <span style={{ height: 6, width: 42, borderRadius: 3, background: "var(--color-content-white)" }} />
            </div>
            {["64%", "46%", "72%", "38%", "56%"].map((w, i) => (
              <div
                key={i}
                style={{ height: 5, width: w, borderRadius: 2.5, background: "rgba(255,255,255,.6)" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── (b) General strip (the horizontal stroke of the "+") — three clips. PLUS LAYER reveal
          group (order 1 — the beam's core lands here, so it leads the stagger). ── */}
      <div className="about-plus about-plus--strip" aria-hidden="true" style={{ display: "flex", gap: 18, alignItems: "flex-start", margin: "18px 0" }}>
        <Clip width={190} height={116} curation="accurate" />
        <Clip width={88} height={116} curation="opinion" />
        <Clip width={190} height={116} curation="accurate" />
      </div>

      {/* ── (c) Body: section headings + body lines (left) · the tall portrait clip (right) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 132px", gap: 20, alignItems: "start" }}>
        {/* Left (article ground) — decorative section heads + body lines. */}
        <div aria-hidden="true" style={{ minWidth: 0 }}>
          <div style={{ height: 14, width: 188, borderRadius: 7, background: "var(--color-line-section)", marginBottom: 16 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
            {["100%", "100%", "94%", "58%"].map((w, i) => (
              <div key={i} style={{ height: 10, borderRadius: 5, background: "var(--color-line-body)", width: w }} />
            ))}
          </div>
          <div style={{ height: 14, width: 150, borderRadius: 7, background: "var(--color-line-section)", marginBottom: 16 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {["100%", "100%", "96%", "100%", "46%"].map((w, i) => (
              <div key={i} style={{ height: 10, borderRadius: 5, background: "var(--color-line-body)", width: w }} />
            ))}
          </div>
        </div>
        {/* Right (gutter bottom) — the tall portrait clip (PLUS LAYER reveal group, order 4 —
            completes the vertical stroke of the "+"). */}
        <div className="about-plus about-plus--portrait" aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Clip width="100%" height={212} curation="caveat" />
        </div>
      </div>
    </div>
  );
}
