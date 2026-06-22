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

import { useEffect, useState } from "react";
import { Beams } from "./Beams";
import { HowItWorks } from "./HowItWorks";
import { Projector } from "./Projector";
import { TopicMiniature } from "./TopicMiniature";
import { SCENE_DESCRIPTION } from "./copy";

// The on-load "projector warm-up" intro (docs/design/about-projector-warmup.md). One-shot per
// Centerpiece mount: lamp flicker → warm-up dim→bright → beam grows along the throw → ＋plus layer
// staggered reveal → the room brightens to its final tone (coupled to lamp-max). It is built as
// CSS keyframes gated behind `@media (prefers-reduced-motion: no-preference)` (the project idiom in
// globals.css), animating opacity/transform ONLY, over the existing markup — so the element default
// (no-animation) values ARE the final static poster, and a reduced-motion / no-JS render gets the
// settled state for free. The intro is decorative-only: it never moves focus, gates input, hides
// content, or animates layout (CLS = 0).
//
// `data-about-intro` is the capture-determinism signal (design §6): "running" while the warm-up is
// in flight, "settled" once it completes (driven off a hard 2200ms fallback timer, flipped early on
// the last animation finishing), and "settled" immediately under reduced motion. The screenshot
// catalog's About waiter blocks on it (and forces reduced motion) so the baseline can never race a
// mid-intro frame.

// The total warm-up window (the §1.1 settle guarantee) — the hard fallback that flips the readiness
// signal to "settled" even if an animationend is missed.
const INTRO_SETTLE_MS = 2200;

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
  // SSR / first paint renders WITHOUT the intro class so a no-JS / pre-hydration render is the
  // settled static poster (the CSS defaults). The class is added on mount only when motion is
  // allowed, so the keyframes run exactly once per mount (the App-Router soft-nav replay, design
  // §7) and never on a reduced-motion render. When the intro settles the class is REMOVED again,
  // tearing the animations down so the DOM re-reads as the pure static poster — no residual
  // non-final transform/opacity, and no `fill: both` keyframes that a relayout could restart
  // (AC2-ii / AC10).
  const [playIntro, setPlayIntro] = useState(false);
  // The readiness signal for capture (design §6). SSR/first paint = "settled" (the static poster),
  // flipped to "running" only when the intro actually starts, back to "settled" when it ends.
  const [introState, setIntroState] = useState<"running" | "settled">("settled");

  useEffect(() => {
    // Reduced motion (or no matchMedia): no intro — stay on the settled static state. This is the
    // safe default the gated keyframes already fall back to; we also never add the play class, so
    // nothing animates and the readiness signal stays "settled" immediately (design §3).
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    setPlayIntro(true);
    setIntroState("running");

    // A hard timer at the §1.1 settle window (2200ms) is the authoritative settle: when it fires the
    // whole choreography has reached its final values, so we flip the readiness signal to "settled"
    // AND drop the play class — removing the keyframes so the elements fall back to their static
    // defaults (which equal the animations' end values). One deterministic timer (not an
    // `animationend` race across phases, where the early-ending lamp flicker could settle the scene
    // prematurely); the design sanctions this hard fallback as the settle guarantee.
    const timer = window.setTimeout(() => {
      setIntroState("settled");
      setPlayIntro(false);
    }, INTRO_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    // ≥ xl the section is the poster's positioning context (relative; card absolutely overlaid);
    // below xl it is a stacked column (card first, graphic below).
    <section
      aria-label="What wiki+ is"
      data-about-intro={introState}
      className={`relative flex flex-col gap-10 xl:block${playIntro ? " about-intro" : ""}`}
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
          className="about-stage about-stage--scene hidden overflow-hidden lg:block"
          style={stageVars(STAGE_W, STAGE_H)}
        >
          <div className="about-stage-inner">
            {/* The room-dimming overlay (Surface, design §1.2-A / §5): a decorative aria-hidden,
                pointer-events:none veil filled with the theater edge colour at the lowest z of the
                scene content — above the field paint, BELOW the beam/projector/miniature/card — that
                fades 0.55 → 0, reaching 0 exactly at lamp-max (the room brightens to its committed
                tone). At rest it is opacity 0 (the committed field shows through untouched). */}
            <div className="about-room-dim" aria-hidden="true" />
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
            + dark-room drop shadow read correctly on the dark field, so it needs no extra wrap. The
            reduced intro plays here (steps 4+5 only — no on-screen projector/beam): the ＋plus layer
            reveals onto the present article ground, and the room-dim overlay scoped to this stage
            brightens the miniature surface to its final tone (design §4.3). */}
        <div className="mx-auto max-w-[520px] lg:hidden">
          <div className="about-stage about-stage--mini" style={stageVars(MINI_W, MINI_H)}>
            <div className="about-stage-inner">
              <div className="about-room-dim" aria-hidden="true" />
              <TopicMiniature />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
