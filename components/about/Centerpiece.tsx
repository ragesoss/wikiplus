"use client";

// <Centerpiece> — the §A hero scene (docs/design/about-page.md §2, §5; AC5–AC8, AC13–AC14). The
// projector→page→＋plus thesis in one image. A client component because it hosts the one live
// control (the miniature's title input — §3); everything else is static illustration.
//
// Two width treatments (§5):
//   • ≥ lg — the full dark-theater scene in a fixed-ratio scaled 1280×720 stage (§2.6, the
//     recommended scaled-inner-stage mechanism): dark radial panel, three beam cones, the in-scene
//     "How it works" card (beneath the beam), the angled projector lower-left, and the Topic-page
//     miniature right with its warm outer glow. Projector→page left-to-right (AC5/AC13).
//   • < lg — the dark theater / projector / beams / in-scene card are DROPPED (a shrunk dark scene
//     reads as a glitch on a phone — §5.2); the Topic-page miniature renders ALONE, centered, on the
//     light page-grey frame, scaled down with the viewport via the same fixed-ratio mechanism, glow
//     softened. The metaphor is carried at narrow widths by §B (always present).
//
// The title-input interaction (§3) lives in the miniature, which is shown at EVERY width, so the
// live entry point is present + functional everywhere (AC14). The body never scrolls horizontally:
// the dark panel is max-width:100% and the scaled stage never exceeds its container (AC13/§5.3).
//
// A11y (§4.3, AC15): the projector + beams SVGs, the in-scene card, and the miniature's decorative
// pieces are aria-hidden; the title input + its label/help are kept OUT of any aria-hidden subtree;
// and a visually-hidden paragraph gives a screen-reader user the picture's meaning.

import { Beams } from "./Beams";
import { InSceneCard } from "./InSceneCard";
import { Projector } from "./Projector";
import { TopicMiniature } from "./TopicMiniature";
import { SCENE_DESCRIPTION } from "./copy";

// Reference-frame (1280×720) px positions — read directly from Centerpiece.dc.html.
const STAGE_W = 1280;
const STAGE_H = 720;

// The < lg miniature-alone stage box: the miniature renders at its natural height at 560px wide; the
// stage box gives it headroom so the fixed-ratio scaling never clips it. Scaled as a unit (§5.2).
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
    <section aria-label="What wiki+ is">
      {/* The picture's meaning in words (AC15) — the decorative graphics convey it visually; this
          gives a screen-reader user the same thesis. */}
      <p className="sr-only">{SCENE_DESCRIPTION}</p>

      {/* ── ≥ lg — the full dark-theater scene, in the scaled 1280×720 stage. ── */}
      <div
        className="about-stage hidden overflow-hidden rounded-md lg:block"
        style={stageVars(STAGE_W, STAGE_H)}
      >
        <div
          className="about-stage-inner"
          // The dark-theater radial (§2.1) — the warm centre at 34%/52% is where the projector sits.
          style={{
            background:
              "radial-gradient(120% 96% at 34% 52%, var(--color-theater-1) 0%, var(--color-theater-2) 46%, var(--color-theater-3) 100%)",
          }}
        >
          {/* Layer 2 — the three beam cones (inset:0, z-index:1), behind the projector + miniature. */}
          <Beams />

          {/* Layer 3 — the in-scene "How it works" card (z-index:0, beneath the beam). Desktop only;
              decorative (aria-hidden). The beam visibly crosses its lower-right corner (intended). */}
          <div style={{ position: "absolute", left: 60, top: 64, width: 392, zIndex: 0 }}>
            <InSceneCard />
          </div>

          {/* Layer 4 — the angled projector, lower-left (z-index:2). Decorative. */}
          <div style={{ position: "absolute", left: 8, top: 360, width: 540, zIndex: 2 }}>
            <Projector />
          </div>

          {/* Layer 5 — the Topic-page miniature, right (z-index:2), with its warm outer glow. */}
          <div style={{ position: "absolute", left: 686, top: 78, width: 560, zIndex: 2 }}>
            <TopicMiniature />
          </div>
        </div>
      </div>

      {/* ── < lg — the Topic-page miniature ALONE on the light page-grey frame, centered + scaled. ── */}
      <div className="mx-auto max-w-[560px] lg:hidden">
        <div className="about-stage" style={stageVars(MINI_W, MINI_H)}>
          <div className="about-stage-inner">
            {/* Softened glow on the light field (the dark-room drop shadow is wrong here — §5.2): a
                faint neutral drop + a gentle warm halo so it still reads as "lit". */}
            <div
              style={{
                boxShadow:
                  "0 0 40px 4px rgba(255,243,210,.5), 0 12px 32px rgba(0,0,0,.12)",
                borderRadius: 4,
              }}
            >
              <TopicMiniature />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
