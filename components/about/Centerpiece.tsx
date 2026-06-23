"use client";

// <Centerpiece> — the About page's one scene, composed as a POSTER within the full-page theater field
// (.about-theater-field, painted by <main>): the projector→beam→＋plus thesis as a picture, with the
// "How it works" card as a peer element IN the same room. The four elements — card, projector, beam,
// lit Topic-page miniature — are all composed within that one warm-dark field; there is no separate
// scene box (the stage is transparent, so the page field shows through it). A client component
// because it hosts the live control (the miniature's title input) AND the projector power toggle;
// everything else is static illustration.
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
// screen-reader user the picture's meaning, and the card carries the real heading + steps. The
// projector is wrapped in a real, labeled power-control <button> (the one intentional newly-exposed
// node — §6); its inner SVG stays decorative.

import { useCallback, useEffect, useRef, useState } from "react";
import { Beams } from "./Beams";
import { HowItWorks } from "./HowItWorks";
import { Projector } from "./Projector";
import { TopicMiniature } from "./TopicMiniature";
import {
  DEFAULT_TITLE,
  POWER_LABEL_OFF,
  POWER_LABEL_ON,
  SCENE_DESCRIPTION,
} from "./copy";

// The on-load "projector warm-up" intro + the projector power toggle (docs/design/about-projector-
// warmup.md). The on-sequence (one-shot per power-on): status light RED → GREEN → lamp flicker →
// warm-up dim→bright → beam fade-in → miniature illuminate → ＋plus fade-in, settling to the committed
// static poster. The projector is a real <button> that powers OFF (the AC1 dark state) and ON again
// (replay the sequence + re-pick the title). Built as CSS keyframes gated behind
// `@media (prefers-reduced-motion: no-preference)`, animating OPACITY/FILTER only, over the existing
// markup — so the element defaults ARE the final static poster and reduced-motion / no-JS get the
// settled state for free. The background theater field NEVER animates (AC4b). The intro is
// decorative-only: it never moves focus, gates input, hides content, or animates layout (CLS = 0).
//
// `data-about-intro` is the capture-determinism signal (design §7.1): "running" while the on-load
// warm-up is in flight, "settled" once it completes (a hard fallback timer at the 2000ms total),
// "settled" immediately under reduced motion. The screenshot catalog's About waiter blocks on it (and
// forces reduced motion) so the baseline can never race a mid-intro frame.

// The on-sequence total (the §1.1 settle guarantee, ≥ lg) — the hard fallback that flips the
// readiness signal to "settled" and tears the running animations down.
const INTRO_SETTLE_MS = 2000;

// The lamp's strong "catch" strike (§1.2-B, ~470ms from the power-on) — when the old→new title text
// swaps during a restarted power-on (§5.3), masked by the flicker dip so it reads as a re-focus.
const TITLE_SWAP_MS = 470;

// The poster reference frame (taller than 16:9 so the projector drops BELOW the card on the left and
// the beam has a long diagonal throw up to the page on the right). Positions below are px in this
// frame; the .about-stage scales the whole frame to the container width as a unit.
const STAGE_W = 1280;
const STAGE_H = 880;

// The miniature-alone stage box: the miniature renders at its natural height at 560px wide; the
// stage box gives it headroom so the fixed-ratio scaling never clips it. Scaled as a unit. This is
// the fallback layout — used both when the viewport is too narrow AND when it is wide-but-short.
const MINI_W = 560;
const MINI_H = 660;

// The full poster scene renders only when the viewport is BOTH wide enough (≥ lg, 1024px) AND tall
// enough (≥ 820px). On a wide-but-short viewport (iPad-Mini landscape, a short desktop window) the
// width-scaled 1280×880 stage renders too tall to fit the vertically-centred content area — its
// bottom-anchored projector falls out and the beam orphans — so the page falls back to the
// miniature-alone layout (docs/design/about-height-aware-scene.md §2/§3). The gate is a single
// media query evaluated as one boolean; the height term is what Tailwind can't express, so the
// choice is made in JS and selects which of the two stage subtrees renders.
const FULL_SCENE_QUERY = "(min-width: 1024px) and (min-height: 820px)";

// CSS-var bag for an .about-stage instance: the reference width/height as LENGTHS (px) so the
// scale calc is a clean length÷length = unitless ratio, plus the matching unitless aspect ratio.
function stageVars(w: number, h: number): React.CSSProperties {
  return {
    ["--stage-w" as string]: `${w}px`,
    ["--stage-h" as string]: `${h}px`,
    ["--stage-ar" as string]: `${w} / ${h}`,
  };
}

/** Pick one title from the eligible pool (AC16); empty pool ⇒ the fallback. A fresh pick per call so
 *  a re-pick on a later power-on may differ (re-picking the same title is acceptable — AC17). */
function pickTitle(pool: string[], fallback: string): string {
  if (pool.length === 0) return fallback;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function Centerpiece({
  // The eligible recently-curated title pool (titles that fit the miniature line — derived
  // server-side in /about) + the fallback. Defaults keep the component renderable in isolation
  // (tests / a no-data render) — an empty pool falls straight to the fallback (AC16).
  titlePool = [],
  fallbackTitle = DEFAULT_TITLE,
  // The title for the FIRST power-on (the on-load auto-play). PICKED SERVER-SIDE in /about and passed
  // in, so SSR and the client's first render agree — no hydration mismatch from a client-side random
  // pick on first paint (which would desync the input's `value`). Subsequent toggle-ON re-picks happen
  // client-side (post-mount, after the effect). Defaults to the fallback for an isolated render.
  initialTitle = fallbackTitle,
}: {
  titlePool?: string[];
  fallbackTitle?: string;
  initialTitle?: string;
} = {}) {
  // Whether the gated intro / toggle machinery is engaged at all. Stays false under reduced motion
  // and pre-mount, so a no-JS / pre-hydration / reduced-motion render is the settled static poster
  // (the CSS defaults) with no `.about-intro` class.
  const [motion, setMotion] = useState(false);
  // Whether the full poster scene (projector + beam + miniature) renders, vs the miniature-alone
  // fallback. Defaults to TRUE so SSR / pre-mount / no-JS render the full scene — matching the
  // current server output and the dominant wide-AND-tall viewport, and keeping the first client
  // render equal to the SSR markup (no hydration mismatch). The real query is read ONLY in a mount
  // effect, never during render; on a wide-but-short viewport the effect flips it to false post-
  // hydration, swapping the scene subtree for the miniature-alone one (docs/design/about-height-
  // aware-scene.md §4.3). This gate is orthogonal to `motion` — two separate matchMedia queries,
  // neither gates the other.
  const [fullScene, setFullScene] = useState(true);
  // The power state: true = on (warm-up / lit), false = off (the AC1 dark state). The on-load
  // auto-intro starts ON; the toggle flips it.
  const [on, setOn] = useState(true);
  // Bumped on each power-ON so the scene subtree REMOUNTS — restarting the gated keyframes from t=0
  // (the only reliable CSS-animation replay). Also the React key for the stage inners.
  const [runKey, setRunKey] = useState(0);
  // The readiness signal for capture (design §7.1). SSR/first paint = "settled" (the static poster),
  // flipped to "running" only when the on-load auto-intro actually starts, back to "settled" when it
  // ends. The user-initiated toggle does NOT drive this (capture only ever takes the auto-load path,
  // under reduced motion).
  const [introState, setIntroState] = useState<"running" | "settled">("settled");

  // The displayed miniature title. On a restarted power-on whose pick differs from the prior title,
  // it holds the OLD title through the flicker then swaps to the NEW pick at the strong catch (§5.3);
  // otherwise it is simply the current pick. The picked-for-this-power-on title is tracked separately
  // so we can decide whether a swap (and the flicker) is warranted.
  const [displayTitle, setDisplayTitle] = useState(initialTitle);
  // Does the current power-on run the old→new title flicker (§5.3)? True only on a restarted power-on
  // whose new pick differs from the displayed title; never on first/auto-play; never under reduced
  // motion. Reset after the swap completes.
  const [titleFlicker, setTitleFlicker] = useState(false);

  const settleTimer = useRef<number | null>(null);
  const swapTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    if (swapTimer.current !== null) {
      window.clearTimeout(swapTimer.current);
      swapTimer.current = null;
    }
  }, []);

  useEffect(() => {
    // Reduced motion (or no matchMedia): no intro and no engaged toggle machinery — stay on the
    // settled static state. The gated keyframes already fall back to it; we never add `.about-intro`,
    // so nothing animates and the readiness signal stays "settled" immediately (design §3.4 / §4-RM).
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    // Engage motion + auto-play the on-sequence ONCE (the first power-on — no old→new title flicker,
    // §3.1). The picked title is already in `displayTitle` (the initial pick); it shows from t=0.
    setMotion(true);
    setIntroState("running");

    // A hard timer at the settle window TEARS THE INTRO DOWN: the running animations have completed to
    // their identity end-values (= the static defaults), so we drop `.about-intro` (motion=false) and
    // the dim-cool overlay, leaving the DOM as the PRISTINE committed lit poster — no residual
    // engaged classes, no overlay compositing layer (so the settled scene is byte-identical to
    // `178c148`, AC2/AC11), and the `data-about-intro` signal flips to "settled".
    settleTimer.current = window.setTimeout(() => {
      setMotion(false);
      setIntroState("settled");
    }, INTRO_SETTLE_MS);
    return clearTimers;
  }, [clearTimers]);

  // The height-aware full-scene gate (docs/design/about-height-aware-scene.md §4). Read the real
  // viewport ONLY post-mount (never during render, to match the SSR full-scene default and avoid a
  // hydration mismatch — the same idiom as `motion` above), then keep it live: subscribe to the
  // MediaQueryList `change` event so resizing a window or rotating a tablet across the threshold
  // re-routes between the full scene and the miniature-alone fallback without a reload. Guard for an
  // absent matchMedia (SSR / a jsdom without the stub) exactly like the reduced-motion effect.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(FULL_SCENE_QUERY);
    setFullScene(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setFullScene(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Toggle the projector power on activation (click / Enter / Space). Only meaningful when the motion
  // machinery is engaged (≥ lg projector present; reduced-motion engages nothing on load but the
  // toggle still works — it engages motion=false path below by SNAPPING via the un-gated `.about-off`
  // rules). The control changes power state ONLY on explicit activation (AC15).
  const togglePower = useCallback(() => {
    clearTimers();
    setMotion(true); // engage the state classes so the toggle reflects in the gated/un-gated rules
    if (on) {
      // ON → OFF: the brief cool-down (motion) or an instant snap (reduced) into the AC1 off state.
      setOn(false);
      setTitleFlicker(false);
      setIntroState("settled"); // the off state holds steady; no running auto-intro
      return;
    }
    // OFF → ON: re-pick the title (AC16) and replay the full on-sequence (AC14).
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = pickTitle(titlePool, fallbackTitle);
    const prior = displayTitle;
    setRunKey((k) => k + 1); // remount → restart the keyframes from t=0
    setOn(true);

    if (reduced) {
      // Snap on: show the new title immediately, no flicker (§3.4 / §5.3).
      setTitleFlicker(false);
      setDisplayTitle(next);
      setIntroState("settled");
      return;
    }

    setIntroState("running");
    if (next !== prior) {
      // A restarted power-on with a DIFFERENT pick: hold the OLD title through the flicker, then swap
      // to the NEW pick at the lamp's strong catch (§5.3). The flicker class keys the title opacity to
      // the strikes; the swap is a single content change masked by the dip.
      setTitleFlicker(true);
      setDisplayTitle(prior);
      swapTimer.current = window.setTimeout(() => {
        setDisplayTitle(next);
        setTitleFlicker(false);
      }, TITLE_SWAP_MS);
    } else {
      // Same pick (or pool of one): stable as it lights up — no flicker, no swap (§5.3).
      setTitleFlicker(false);
      setDisplayTitle(next);
    }
    // A toggle-ON replay also tears down to the pristine lit poster on settle (same as the auto-intro).
    settleTimer.current = window.setTimeout(() => {
      setMotion(false);
      setIntroState("settled");
    }, INTRO_SETTLE_MS);
  }, [on, displayTitle, titlePool, fallbackTitle, clearTimers]);

  // The state class set on the scene root: `.about-intro` engages the gated machinery; `.about-on` /
  // `.about-off` carry the power state (the on-sequence keyframes run under `.about-on`, the cool-down
  // / snapped off-state under `.about-off`). Absent entirely under reduced motion / pre-mount (the
  // static poster).
  const stateClass = motion
    ? ` about-intro ${on ? "about-on" : "about-off"}`
    : "";

  const powerLabel = on ? POWER_LABEL_ON : POWER_LABEL_OFF;

  return (
    // ≥ xl the section is the poster's positioning context (relative; card absolutely overlaid);
    // below xl it is a stacked column (card first, graphic below).
    <section
      aria-label="What wiki+ is"
      data-about-intro={introState}
      className={`relative flex flex-col gap-10 xl:block${stateClass}`}
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
          the card. The height-aware gate (docs/design/about-height-aware-scene.md) renders EXACTLY
          ONE of the two stage subtrees: the full poster scene when the viewport is ≥ lg wide AND
          ≥ 820px tall, the miniature-alone fallback otherwise (too narrow OR too short). It is a
          render-gate (not CSS visibility), so the fallback truly has no projector/beam/power-button
          nodes in the DOM — the a11y contract (§4.2/§5.2). Width is part of the JS query
          (`min-width:1024`); the stage subtrees carry no CSS width gate. The `<main>`'s per-tier
          layout classes (the xl: overlay vs stacked) only take effect when the full scene is the one
          rendered. ── */}
      <div className="w-full">
        {fullScene ? (
          // ≥ lg AND ≥ 820 tall — the poster scene (projector lower-left + beam + miniature
          // upper-right) in the scaled 1280×880 stage. The stage is TRANSPARENT, so the page theater
          // field shows through it.
          <div
            className="about-stage about-stage--scene overflow-hidden"
            style={stageVars(STAGE_W, STAGE_H)}
          >
            {/* Keyed by runKey so a power-ON remounts the scene content → the gated keyframes replay
                from t=0 (the reliable CSS-animation restart). */}
            <div className="about-stage-inner" key={runKey}>
              {/* Layer 1 — the beam cones (z-index:1), behind the projector + miniature. */}
              <Beams />

              {/* Layer 2 — the angled projector, lower-left (z-index:2), BELOW the card. The projector
                  graphic is decorative (aria-hidden SVG); the wrapping <button> is the real power
                  control (§6) — labeled, focus-visible, keyboard-operable. Present only in the full
                  scene (≥ lg wide AND ≥ 820 tall) — the only place the projector is visible. */}
              <div style={{ position: "absolute", left: 8, top: 600, width: 420, zIndex: 2 }}>
                <button
                  type="button"
                  className="about-projector-power"
                  aria-label={powerLabel}
                  onClick={togglePower}
                >
                  <Projector />
                </button>
              </div>

              {/* Layer 3 — the Topic-page miniature, right (z-index:2), DROPPED so its bottom aligns
                  with the projector's bottom (the composition's lower edge) — the page sits down at the
                  projector's level, lit by the beam, rather than floating above it. (560 = its designed
                  width, where the general-strip clips fit exactly.) */}
              <div style={{ position: "absolute", left: 700, top: 270, width: 560, zIndex: 2 }}>
                <TopicMiniature
                  seedTitle={displayTitle}
                  titleFlicker={titleFlicker}
                  coolOverlay={motion}
                />
              </div>
            </div>
          </div>
        ) : (
          // The fallback (too narrow OR wide-but-short) — the Topic-page miniature ALONE, centered +
          // scaled, on the field. Its own warm glow + dark-room drop shadow read correctly on the dark
          // field, so it needs no extra wrap. The reduced intro plays here (steps 4+5 only — no
          // on-screen projector/beam/status light, no toggle): the miniature illuminates (its cool
          // overlay lifts) and the ＋plus layer fades onto the present article ground (design §4.3).
          // The title is seeded from the on-load pick (the first power-on — no flicker here, no toggle
          // to restart).
          <div className="mx-auto max-w-[520px]">
            <div className="about-stage about-stage--mini" style={stageVars(MINI_W, MINI_H)}>
              <div className="about-stage-inner" key={runKey}>
                <TopicMiniature seedTitle={displayTitle} coolOverlay={motion} />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
