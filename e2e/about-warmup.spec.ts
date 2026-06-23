import { test, expect, type Page } from "@playwright/test";

// Runtime regression for the About "projector warm-up" intro (docs/design/about-projector-warmup.md
// §1.2-B, §2). The jsdom about-warmup tests assert the CSS SOURCE + the DOM contract; they cannot
// observe the RENDERED animation. This spec drives the real built app, pauses every running
// animation via the Web Animations API, samples computed opacity at chosen times, and asserts the
// motion that the source is supposed to produce:
//   • the lit lamp group is OFF (opacity 0) at t = 0 — the designed OFF lens, not a glow;
//   • the flicker actually renders uneven strikes — a peak > 0.5 in the 0–520ms window (catches a
//     steps(1) collapse to a flat held value, and an animation-list order that overrides the strikes);
//   • the OFF-lens base is gone (opacity 0) by lamp-max and at settle, so the settled lens is the
//     committed lit poster with no warm rim / seam.
//
// GATING: like e2e/screenshots.spec.ts this is NOT part of the default CI e2e gate (which carries
// pre-existing reds on main). It self-SKIPS unless ABOUT_WARMUP=1 is set, so it runs on demand
// (ABOUT_WARMUP=1 yarn test:e2e about-warmup) and stands on its own.

const ENABLED = !!process.env.ABOUT_WARMUP;

// The intro lives in the ≥ lg poster scene (.about-stage--scene is `hidden lg:block`), so capture at
// a desktop width where the projector + lamp render.
const LG_VIEWPORT = { width: 1280, height: 900 };

const LAMP = ".about-stage--scene .about-lamp-light";
const OFF_LENS = ".about-stage--scene .about-off-lens";

// The §1.1 phase boundaries this spec pins (ms from the intro's first frame).
const FLICKER_END_MS = 520;
const LAMP_MAX_MS = 1240;
const SETTLE_MS = 2200;

/** Load /about with MOTION ENABLED (no reduced-motion emulation, so the intro actually plays), wait
 *  for the lamp group to exist, then PAUSE every animation so currentTime sampling is deterministic. */
async function loadAndPause(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(LG_VIEWPORT);
  await page.goto("/about");
  await page.locator(LAMP).first().waitFor();
  // Pause all animations so setting currentTime samples a stable frame (the intro is one-shot and may
  // already be in flight; pausing freezes it wherever it is, then we scrub).
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => a.pause());
  });
}

/** Computed opacity of the first matching element after scrubbing EVERY running animation to `t` ms. */
async function opacityAt(page: Page, selector: string, t: number): Promise<number> {
  return page.evaluate(
    ({ selector, t }) => {
      const el = document.querySelector(selector);
      if (!el) return NaN;
      // Scrub only the animations that belong to THIS element to the sample time, then read the
      // resolved computed opacity (the animation's effect at that frame).
      el.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = t;
      });
      return parseFloat(getComputedStyle(el).opacity);
    },
    { selector, t }
  );
}

test.describe("About projector warm-up — runtime motion @about-warmup", () => {
  test.skip(!ENABLED, "about warm-up regression — run via ABOUT_WARMUP=1");

  test("the lit lamp is OFF at t=0 and the flicker renders an uneven strike", async ({ page }) => {
    await loadAndPause(page);

    // t = 0 — the lit layers are fully absent (the designed OFF lens shows, not a glow).
    const atZero = await opacityAt(page, LAMP, 0);
    expect(atZero).toBeCloseTo(0, 2);

    // The flicker must render real strikes (not a steps(1) flat hold, not an overridden constant):
    // sample across the 0–520ms window and require at least one peak > 0.5. The §1.2-B strikes peak
    // near t≈84 (0.70) and t≈270 (0.85); sample densely so we catch a peak regardless of rounding.
    let maxInFlicker = 0;
    for (let t = 0; t <= FLICKER_END_MS; t += 6) {
      const o = await opacityAt(page, LAMP, t);
      if (o > maxInFlicker) maxInFlicker = o;
    }
    expect(maxInFlicker).toBeGreaterThan(0.5);

    // It must NOT be a flat held value across the window (the bug symptom was a constant ~0.30): the
    // spread between the window's min and max is large because the strikes drop near 0 between peaks.
    let minInFlicker = 1;
    for (let t = 0; t <= FLICKER_END_MS; t += 6) {
      const o = await opacityAt(page, LAMP, t);
      if (o < minInFlicker) minInFlicker = o;
    }
    expect(maxInFlicker - minInFlicker).toBeGreaterThan(0.3);
  });

  test("the lamp reaches max by t=1240 and holds at settle", async ({ page }) => {
    await loadAndPause(page);
    expect(await opacityAt(page, LAMP, LAMP_MAX_MS)).toBeCloseTo(1, 2);
    // After the animation's end the fill:both holds it at 1 (sample past the end).
    expect(await opacityAt(page, LAMP, SETTLE_MS)).toBeCloseTo(1, 2);
  });

  test("the OFF-lens base is visible at t=0 and gone by lamp-max / settle", async ({ page }) => {
    await loadAndPause(page);
    // At t=0 the OFF lens covers the warm lamp-base rim (the OFF state reads as OFF).
    expect(await opacityAt(page, OFF_LENS, 0)).toBeCloseTo(1, 2);
    // It cross-fades out by lamp-max, so the settled lens is the committed lit poster (no warm rim /
    // anti-aliased seam) — zero contribution at and after t=1240.
    expect(await opacityAt(page, OFF_LENS, LAMP_MAX_MS)).toBeCloseTo(0, 2);
    expect(await opacityAt(page, OFF_LENS, SETTLE_MS)).toBeCloseTo(0, 2);
  });
});
