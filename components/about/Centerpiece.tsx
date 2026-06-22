"use client";

// <Centerpiece> — the About page's one scene, composed as a POSTER within the full-page theater field
// (.about-theater-field, painted by <main>): the projector→beam→＋plus thesis as a picture, with the
// "How it works" card as a peer element IN the same room. The four elements — card, projector, beam,
// lit Topic-page miniature — are all composed within that one warm-dark field; there is no separate
// scene box (the stage is transparent, so the page field shows through it). A client component
// because it hosts the one live control (the miniature's title input); everything else is static
// illustration.
//
// Composition principle (the relative placement chain): place the CARD (upper-left), the PROJECTOR
// BELOW it (lower-left), the PAGE relative to that (the miniature, upper-right where the beam lands),
// and the BEAM between the projector and the page — a long diagonal throw across the room. The beam
// may pass near/behind the card; the card sits above the beam so its copy stays legible.
//
// Layout (the card is ALWAYS first in reading + DOM order):
//   • ≥ xl — POSTER: the card is OVERLAID upper-left (real-font readable, not scaled with the scene),
//     the projector sits lower-left BELOW the card, the beam throws up to the Topic-page miniature on
//     the upper-right. Reading the room: card (the idea in words) → projector → beam → page (lit up).
//   • lg … xl — it reflows to STACKED: the card FIRST (top, full reading measure), the poster scene
//     BELOW it, both on the field.
//   • < lg — STACKED: the card FIRST, then the Topic-page miniature ALONE below (a shrunk scene reads
//     as a glitch on a phone; the miniature alone scales cleanly).
//
// The scene's stage is TRANSPARENT — the warm-dark page field shows through it, so the projector's
// bloom and the miniature's glow read as light in the one continuous room. The body never scrolls
// horizontally: the scaled stage is clipped to its own box and never exceeds its container.
//
// A11y: the projector + beams SVGs and the miniature's decorative pieces are aria-hidden; the title
// input + its label/help are kept OUT of any aria-hidden subtree; a visually-hidden paragraph gives a
// screen-reader user the picture's meaning, and the card carries the real heading + steps.

import { Beams } from "./Beams";
import { HowItWorks } from "./HowItWorks";
import { Projector } from "./Projector";
import { TopicMiniature } from "./TopicMiniature";
import { SCENE_DESCRIPTION } from "./copy";

// The poster reference frame (taller than 16:9 so the projector drops BELOW the card on the left and
// the beam has a long diagonal throw up to the page on the right). Positions below are px in this
// frame; the .about-stage scales the whole frame to the container width as a unit.
const STAGE_W = 1280;
const STAGE_H = 880;

// The < lg miniature-alone stage box: the miniature renders at its natural height at 560px wide; the
// stage box gives it headroom so the fixed-ratio scaling never clips it. Scaled as a unit.
const MINI_W = 560;
const MINI_H = 660;

// CSS-var bag for an .about-stage instance: the reference width/height as LENGTHS (px) so the
// scale calc is a clean length÷length = unitless ratio, plus the matching unitless aspect ratio.
function stageVars(w: number, h: number): React.CSSProperties {
  return {
    ["--stage-w" as string]: `${w}px`,
    ["--stage-h" as string]: `${h}px`,
    ["--stage-ar" as string]: `${w} / ${h}`,
  };
}

export function Centerpiece() {
  return (
    // ≥ xl the section is the poster's positioning context (relative; card absolutely overlaid);
    // below xl it is a stacked column (card first, graphic below).
    <section
      aria-label="What wiki+ is"
      className="relative flex flex-col gap-10 xl:block"
    >
      {/* The picture's meaning in words (for a screen-reader user) — the decorative graphics convey
          it visually; this gives the same thesis. */}
      <p className="sr-only">{SCENE_DESCRIPTION}</p>

      {/* ── The ONE "How it works" card — first in flow (top when stacked); at ≥ xl it is overlaid on
          the scene's upper-left, composed into the room (real-font readable, never scaled; z above the
          beam so the copy stays crisp even where the beam passes behind it). It is wide here so it
          stays short enough to leave the projector room below it. ── */}
      <HowItWorks className="mx-auto w-full max-w-[560px] xl:absolute xl:left-[2.5%] xl:top-[3%] xl:z-20 xl:mx-0 xl:w-[510px] xl:max-w-none" />

      {/* ── The graphic — the in-flow block that sizes the poster at ≥ xl; below xl it stacks under
          the card. ── */}
      <div className="w-full">
        {/* ≥ lg — the poster scene (projector lower-left + beam + miniature upper-right) in the scaled
            1280×880 stage. The stage is TRANSPARENT, so the page theater field shows through it. */}
        <div
          className="about-stage hidden overflow-hidden lg:block"
          style={stageVars(STAGE_W, STAGE_H)}
        >
          <div className="about-stage-inner">
            {/* Layer 1 — the beam cones (z-index:1), behind the projector + miniature. */}
            <Beams />

            {/* Layer 2 — the angled projector, lower-left (z-index:2), BELOW the card. Decorative. */}
            <div style={{ position: "absolute", left: 8, top: 600, width: 420, zIndex: 2 }}>
              <Projector />
            </div>

            {/* Layer 3 — the Topic-page miniature, right (z-index:2), DROPPED so its bottom aligns
                with the projector's bottom (the composition's lower edge) — the page sits down at the
                projector's level, lit by the beam, rather than floating above it. (560 = its designed
                width, where the general-strip clips fit exactly.) */}
            <div style={{ position: "absolute", left: 700, top: 270, width: 560, zIndex: 2 }}>
              <TopicMiniature />
            </div>
          </div>
        </div>

        {/* < lg — the Topic-page miniature ALONE, centered + scaled, on the field. Its own warm glow
            + dark-room drop shadow read correctly on the dark field, so it needs no extra wrap. */}
        <div className="mx-auto max-w-[520px] lg:hidden">
          <div className="about-stage" style={stageVars(MINI_W, MINI_H)}>
            <div className="about-stage-inner">
              <TopicMiniature />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
