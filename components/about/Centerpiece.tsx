"use client";

// <Centerpiece> — the About page's one scene: the projector→page→＋plus thesis as a picture, paired
// with the single "How it works" card. The whole page is the dark "theater"; the warm card is the
// only deliberately-light surface (the Topic-page miniature is bright because the projector throws
// light onto it). A client component because it hosts the one live control (the miniature's title
// input); everything else is static illustration.
//
// Responsive composition (the card is ALWAYS first in reading + DOM order):
//   • ≥ xl — side by side: the "How it works" card LEFT, the full dark scene RIGHT (the angled
//     projector lower-left of the scene throws three warm beam cones toward the Topic-page miniature
//     at the right, lit by its own warm glow). Reading left→right: idea-in-words → projector → page.
//   • lg … xl — it reflows to STACKED: the card FIRST (top, full reading measure), the full scene
//     BELOW it (rendered large enough to read comfortably).
//   • < lg — STACKED: the card FIRST, then the Topic-page miniature ALONE below (a shrunk 16:9 dark
//     scene reads as a glitch on a phone; the miniature alone scales cleanly). The metaphor is
//     carried by the card (always present) + the lit miniature.
//
// The scene's dark radial (warm centre behind the lamp) fades to the page's flat theater dark
// (--color-theater-3) at its edges, so the scaled stage blends into the full-bleed dark page rather
// than reading as an isolated panel. The body never scrolls horizontally: the scaled stage is
// clipped to its own box (overflow-hidden) and never exceeds its container.
//
// A11y: the projector + beams SVGs and the miniature's decorative pieces are aria-hidden; the title
// input + its label/help are kept OUT of any aria-hidden subtree; a visually-hidden paragraph gives a
// screen-reader user the picture's meaning, and the card carries the real heading + steps.

import { Beams } from "./Beams";
import { HowItWorks } from "./HowItWorks";
import { Projector } from "./Projector";
import { TopicMiniature } from "./TopicMiniature";
import { SCENE_DESCRIPTION } from "./copy";

// Reference-frame (1280×720) px positions — read directly from the centerpiece handoff.
const STAGE_W = 1280;
const STAGE_H = 720;

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
    <section
      aria-label="What wiki+ is"
      className="flex flex-col gap-10 xl:flex-row xl:items-center xl:gap-14"
    >
      {/* The picture's meaning in words (for a screen-reader user) — the decorative graphics convey
          it visually; this gives the same thesis. */}
      <p className="sr-only">{SCENE_DESCRIPTION}</p>

      {/* ── The ONE "How it works" card — first in flow (top when stacked / left column when side by
          side). It is the page's only light surface. ── */}
      <HowItWorks className="mx-auto w-full max-w-[560px] xl:mx-0 xl:w-[360px] xl:max-w-none xl:shrink-0" />

      {/* ── The graphic. ── */}
      <div className="min-w-0 xl:flex-1">
        {/* ≥ lg — the full dark scene (projector + beams + miniature) in the scaled 1280×720 stage.
            Its radial blends into the page theater dark at the edges. */}
        <div
          className="about-stage hidden overflow-hidden lg:block"
          style={stageVars(STAGE_W, STAGE_H)}
        >
          <div
            className="about-stage-inner"
            // The dark-theater radial — the warm centre at 34%/52% is where the projector sits; the
            // 100% stop is --color-theater-3, the same flat dark the page uses, so the stage edges
            // melt into the page.
            style={{
              background:
                "radial-gradient(120% 96% at 34% 52%, var(--color-theater-1) 0%, var(--color-theater-2) 46%, var(--color-theater-3) 100%)",
            }}
          >
            {/* Layer 1 — the three beam cones (inset:0, z-index:1), behind the projector + miniature. */}
            <Beams />

            {/* Layer 2 — the angled projector, lower-left (z-index:2). Decorative. */}
            <div style={{ position: "absolute", left: 8, top: 360, width: 540, zIndex: 2 }}>
              <Projector />
            </div>

            {/* Layer 3 — the Topic-page miniature, right (z-index:2), with its own warm outer glow +
                dark-room drop shadow (correct on the dark field). */}
            <div style={{ position: "absolute", left: 686, top: 78, width: 560, zIndex: 2 }}>
              <TopicMiniature />
            </div>
          </div>
        </div>

        {/* < lg — the Topic-page miniature ALONE, centered + scaled, on the dark page. Its own warm
            glow + dark-room drop shadow read correctly on the dark field, so it needs no extra wrap. */}
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
