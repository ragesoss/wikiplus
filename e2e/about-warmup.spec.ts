import { test, expect, type Page } from "@playwright/test";

// Runtime regression for the About "projector warm-up" intro + power toggle + dynamic title
// (docs/design/about-projector-warmup.md). The jsdom about-warmup tests assert the CSS SOURCE + the
// DOM contract; they cannot observe the RENDERED animation. This spec drives the real built app,
// pauses every running animation via the Web Animations API, samples computed values at chosen times,
// and asserts the motion that the source is supposed to produce:
//   • the lit lamp group is OFF (opacity 0) at t = 0 — the designed OFF lens, not a glow;
//   • the status light is RED before the flicker and GREEN by t = 180ms (step 0 is the first action);
//   • the flicker renders uneven strikes — a peak > 0.5 in the 180–520ms window;
//   • the OFF-lens base is gone (opacity 0) by lamp-max and at settle;
//   • the beam FADES in (opacity 0 → 1 over 560→1240ms) at FIXED geometry — no transform/scale;
//   • the miniature cool overlay illuminates 0.62 → 0, reaching 0 at lamp-max (the AC4 coupling);
//   • the background theater field tone NEVER changes (AC4b) and no .about-stage dim overlay exists;
//   • the projector power toggle (a labeled button) powers OFF (red light, beam gone) then ON.
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
const BEAM = ".about-stage--scene .about-beam";
const MINI_COOL = ".about-stage--scene .about-mini-cool";
const STATUS_RED = ".about-stage--scene .about-status-red";
const STATUS_GREEN = ".about-stage--scene .about-status-green";

// The §1.1 phase boundaries this spec pins (ms from the intro's first frame).
const STATUS_FLIP_MS = 180;
const FLICKER_START_MS = 180;
const FLICKER_END_MS = 520;
const BEAM_START_MS = 560;
const LAMP_MAX_MS = 1240;
const SETTLE_MS = 2000;

/** Load /about with MOTION ENABLED (so the intro plays), wait for the lamp group to exist, then PAUSE
 *  every animation so currentTime sampling is deterministic. */
async function loadAndPause(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(LG_VIEWPORT);
  await page.goto("/about");
  await page.locator(LAMP).first().waitFor();
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => a.pause());
  });
}

/** Computed opacity of the first matching element after scrubbing ITS animations to `t` ms. */
async function opacityAt(page: Page, selector: string, t: number): Promise<number> {
  return page.evaluate(
    ({ selector, t }) => {
      const el = document.querySelector(selector);
      if (!el) return NaN;
      el.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = t;
      });
      return parseFloat(getComputedStyle(el).opacity);
    },
    { selector, t }
  );
}

/** Computed `transform` of the first matching element after scrubbing ITS animations to `t` ms. */
async function transformAt(page: Page, selector: string, t: number): Promise<string> {
  return page.evaluate(
    ({ selector, t }) => {
      const el = document.querySelector(selector);
      if (!el) return "none";
      el.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = t;
      });
      return getComputedStyle(el).transform;
    },
    { selector, t }
  );
}

/** The computed background of the theater field (constant if it never animates). */
async function fieldBackground(page: Page, t: number): Promise<string> {
  return page.evaluate((t) => {
    const el = document.querySelector(".about-theater-field");
    if (!el) return "none";
    // Scrub ALL animations on the page to t, then read the field's background — it must be invariant.
    document.getAnimations().forEach((a) => {
      a.pause();
      a.currentTime = t;
    });
    const cs = getComputedStyle(el);
    return `${cs.backgroundColor}|${cs.backgroundImage}|${cs.filter}|${cs.opacity}`;
  }, t);
}

test.describe("About projector warm-up — runtime motion @about-warmup", () => {
  test.skip(!ENABLED, "about warm-up regression — run via ABOUT_WARMUP=1");

  test("step 0 — the status light is RED before the flicker and GREEN by t=180ms", async ({ page }) => {
    await loadAndPause(page);
    // At t=0 the projector is OFF: red full, green absent (AC1d). The first observable action is the
    // crossfade to green by t=180ms — BEFORE the lamp begins to flicker (AC3 step 0).
    expect(await opacityAt(page, STATUS_RED, 0)).toBeCloseTo(1, 2);
    expect(await opacityAt(page, STATUS_GREEN, 0)).toBeCloseTo(0, 2);
    expect(await opacityAt(page, STATUS_GREEN, STATUS_FLIP_MS)).toBeCloseTo(1, 2);
    expect(await opacityAt(page, STATUS_RED, STATUS_FLIP_MS)).toBeCloseTo(0, 2);
    // The lamp is still OFF until the green flip resolves — it does not strike before the light is green.
    expect(await opacityAt(page, LAMP, 0)).toBeCloseTo(0, 2);
    expect(await opacityAt(page, LAMP, STATUS_FLIP_MS)).toBeCloseTo(0, 2);
  });

  test("the flicker renders an uneven strike after the green flip", async ({ page }) => {
    await loadAndPause(page);
    // The flicker must render real strikes in the 180–520ms window: a peak > 0.5 and a big spread
    // (drops near 0 between peaks) — catches a steps(1) collapse or an overridden constant.
    let maxInFlicker = 0;
    let minInFlicker = 1;
    for (let t = FLICKER_START_MS; t <= FLICKER_END_MS; t += 6) {
      const o = await opacityAt(page, LAMP, t);
      if (o > maxInFlicker) maxInFlicker = o;
      if (o < minInFlicker) minInFlicker = o;
    }
    expect(maxInFlicker).toBeGreaterThan(0.5);
    expect(maxInFlicker - minInFlicker).toBeGreaterThan(0.3);
  });

  test("the lamp reaches max by t=1240 and holds at settle", async ({ page }) => {
    await loadAndPause(page);
    expect(await opacityAt(page, LAMP, LAMP_MAX_MS)).toBeCloseTo(1, 2);
    expect(await opacityAt(page, LAMP, SETTLE_MS)).toBeCloseTo(1, 2);
  });

  test("the OFF-lens base is visible at t=0 and gone by lamp-max / settle", async ({ page }) => {
    await loadAndPause(page);
    expect(await opacityAt(page, OFF_LENS, 0)).toBeCloseTo(1, 2);
    expect(await opacityAt(page, OFF_LENS, LAMP_MAX_MS)).toBeCloseTo(0, 2);
    expect(await opacityAt(page, OFF_LENS, SETTLE_MS)).toBeCloseTo(0, 2);
  });

  test("the beam FADES IN at fixed geometry — opacity ramps, transform never changes (AC5b)", async ({ page }) => {
    await loadAndPause(page);
    // Opacity 0 at the beam onset, rising to full at lamp-max.
    expect(await opacityAt(page, BEAM, BEAM_START_MS)).toBeCloseTo(0, 2);
    const mid = await opacityAt(page, BEAM, 1000);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(1);
    expect(await opacityAt(page, BEAM, LAMP_MAX_MS)).toBeCloseTo(1, 2);
    // The transform is identical at every sampled frame — no scaleX grow / translate (the jitter fix).
    const t0 = await transformAt(page, BEAM, BEAM_START_MS);
    const t1 = await transformAt(page, BEAM, 1000);
    const t2 = await transformAt(page, BEAM, LAMP_MAX_MS);
    expect(t1).toBe(t0);
    expect(t2).toBe(t0);
    // And it is the identity (no transform applied at all).
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(t0);
  });

  test("the miniature cool overlay illuminates 0.62 → 0, reaching 0 at lamp-max (AC4)", async ({ page }) => {
    await loadAndPause(page);
    expect(await opacityAt(page, MINI_COOL, BEAM_START_MS)).toBeCloseTo(0.62, 2);
    const mid = await opacityAt(page, MINI_COOL, 1000);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(0.62);
    // Reaches 0 (fully lit) AT lamp-max — coupled to the lamp + beam, not before.
    expect(await opacityAt(page, MINI_COOL, LAMP_MAX_MS)).toBeCloseTo(0, 2);
  });

  test("the background theater field tone NEVER changes across the intro (AC4b)", async ({ page }) => {
    await loadAndPause(page);
    // Sample the field's background/filter/opacity at the first frame, mid-intro, and settle — it is
    // constant (no whole-field dim, no brighten, no filter). No stage outline can appear because there
    // is no .about-stage-scoped dim overlay.
    const atZero = await fieldBackground(page, 0);
    const atMid = await fieldBackground(page, 700);
    const atSettle = await fieldBackground(page, SETTLE_MS);
    expect(atMid).toBe(atZero);
    expect(atSettle).toBe(atZero);
    // The removed deployed flaw: there must be no .about-room-dim overlay element at all.
    expect(await page.locator(".about-room-dim").count()).toBe(0);
  });

  test("the projector power toggle powers OFF (red, beam gone) then ON again", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize(LG_VIEWPORT);
    await page.goto("/about");
    // Wait for the on-load auto-intro to settle so the control reads "on".
    await page.locator('[data-about-intro="settled"]').waitFor({ timeout: 4000 }).catch(() => {});
    const power = page.getByRole("button", { name: "Turn the projector off" });
    await power.waitFor();
    // Power OFF: the scene returns to the AC1 off state — status red, lamp off, beam gone, the name
    // flips. Let the brief cool-down complete, then assert the held off values.
    await power.click();
    await expect(page.getByRole("button", { name: "Turn the projector on" })).toBeVisible();
    await page.waitForTimeout(400); // > the ~300ms cool-down
    expect(await opacityAt(page, STATUS_RED, 9999)).toBeCloseTo(1, 1);
    expect(await opacityAt(page, STATUS_GREEN, 9999)).toBeCloseTo(0, 1);
    expect(await opacityAt(page, BEAM, 9999)).toBeCloseTo(0, 1);
    expect(await opacityAt(page, LAMP, 9999)).toBeCloseTo(0, 1);
    // The background field is unchanged by the power-off (AC4b).
    const offField = await fieldBackground(page, 9999);
    // Power ON again: the name flips back and the on-sequence replays (lamp reaches max at settle).
    await page.getByRole("button", { name: "Turn the projector on" }).click();
    await expect(page.getByRole("button", { name: "Turn the projector off" })).toBeVisible();
    expect(await fieldBackground(page, 0)).toBe(offField); // field still unchanged
  });

  // ── AC12 — responsive tiers + no horizontal scroll at any width during the intro ──
  // The intro/toggle animate OPACITY/FILTER only (no transform/scale/translate) and the stage is
  // overflow:hidden, so the page body can never widen at any frame or tier. Sample the document
  // scrollWidth across the intro window at the three tier widths (mobile 390 / tablet 834 / desktop
  // 1280) while the intro plays — it must never exceed clientWidth (+1px tolerance).
  for (const [label, width] of [
    ["mobile 390", 390],
    ["tablet 834", 834],
    ["desktop 1280", 1280],
  ] as const) {
    test(`AC12 — no horizontal document overflow during the intro at ${label}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/about");
      // Pin EVERY animation at a sequence of mid-intro times and re-measure — catches any frame that
      // would push the body wider (a transform escaping the clipped stage). Measure with vertical
      // overflow allowed (a tall page is fine; only horizontal matters).
      for (const t of [0, 300, 700, 1240, 1760, 2000]) {
        const { scrollWidth, clientWidth } = await page.evaluate((t) => {
          document.getAnimations().forEach((a) => {
            a.pause();
            a.currentTime = t;
          });
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          };
        }, t);
        expect(
          scrollWidth,
          `scrollWidth (${scrollWidth}) must be <= clientWidth (${clientWidth}) + 1 at ${label}, intro t=${t}ms`
        ).toBeLessThanOrEqual(clientWidth + 1);
      }
    });
  }

  // ── AC12 — < lg: the miniature-alone reduced intro (NO projector / status light / beam / toggle) ──
  test("AC12 — below lg there is no projector control, status light, or beam (miniature alone)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/about");
    await page.locator(".about-stage--mini").waitFor();
    // The < lg composition is the miniature-alone stage; the ≥ lg poster scene (and its projector
    // control + status light + beam) is `hidden lg:block`, so none of them are laid out/visible here.
    await expect(page.getByRole("button", { name: /Turn the projector/ })).toHaveCount(0);
    expect(await page.locator(".about-stage--scene .about-status-red").isVisible()).toBe(false);
    expect(await page.locator(".about-stage--scene .about-beam").isVisible()).toBe(false);
    // The reduced intro DOES play on the standalone miniature: its dim-cool overlay illuminates
    // 0.62 → 0 (steps 4 + 5 only — design §4.3). The overlay is present and rideable.
    const miniCool = ".about-stage--mini .about-mini-cool";
    await page.locator(miniCool).waitFor();
    expect(await opacityAt(page, miniCool, 240)).toBeCloseTo(0.62, 1);
    expect(await opacityAt(page, miniCool, 940)).toBeCloseTo(0, 1);
  });

  // ── Height-aware gate — wide-but-short falls back to the miniature-alone layout (issue #145) ──
  // At 1024×768 (≥ lg WIDE but < 820px TALL) the height-aware gate
  // (docs/design/about-height-aware-scene.md) renders the miniature-alone fallback: NO projector
  // control / status light / beam (no orphaned beam pointing at nothing), the miniature scales cleanly,
  // and the page never scrolls horizontally. NOTE: deferred to a chromium session — run with
  // ABOUT_WARMUP=1 yarn test:e2e about-warmup.
  test("wide-but-short (1024×768) renders the miniature-alone fallback with no horizontal overflow", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/about");
    await page.locator(".about-stage--mini").waitFor();
    // The full poster scene (and therefore the projector control, status light, and beam) is NOT in
    // the DOM at all — the render-gate, not CSS visibility (the a11y contract / no orphaned beam).
    await expect(page.getByRole("button", { name: /Turn the projector/ })).toHaveCount(0);
    expect(await page.locator(".about-stage--scene").count()).toBe(0);
    expect(await page.locator(".about-beam").count()).toBe(0);
    // The reduced intro still plays on the standalone miniature (steps 4 + 5 — design §4.3).
    const miniCool = ".about-stage--mini .about-mini-cool";
    await page.locator(miniCool).waitFor();
    // No horizontal document overflow at any sampled intro frame (nothing scales/translates; the
    // miniature scales by width inside its overflow:hidden stage).
    for (const t of [0, 300, 700, 940, 2000]) {
      const { scrollWidth, clientWidth } = await page.evaluate((t) => {
        document.getAnimations().forEach((a) => {
          a.pause();
          a.currentTime = t;
        });
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        };
      }, t);
      expect(
        scrollWidth,
        `scrollWidth (${scrollWidth}) must be <= clientWidth (${clientWidth}) + 1 at 1024×768, intro t=${t}ms`
      ).toBeLessThanOrEqual(clientWidth + 1);
    }
  });

  // ── AC8 — the title input is editable + Enter-navigable DURING the intro (no input gating) ──
  test("AC8 — the title input accepts typing + Enter during the intro (input is never gated)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize(LG_VIEWPORT);
    await page.goto("/about");
    // Grab the title input as soon as it renders — WHILE the intro is still running (do not wait for
    // settle). It must be focusable + editable immediately (the intro never locks input — AC8).
    const input = page.getByRole("textbox", { name: /press Enter to open that topic/ }).first();
    await input.waitFor();
    await input.click();
    await input.fill("Helium");
    await input.press("Enter");
    // Enter navigates to the typed topic via topicHref (the input wiring is unchanged — AC18).
    await page.waitForURL(/\/topic\/Helium/, { timeout: 4000 });
    expect(page.url()).toContain("/topic/Helium");
  });

  // ── AC11 — the deterministic capture pin: ?capture=poster forces the fallback title ──
  test("AC11 — ?capture=poster pins the miniature title to the fallback 'Acer palmatum'", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" }); // the capture path forces reduced motion
    await page.setViewportSize(LG_VIEWPORT);
    await page.goto("/about?capture=poster");
    await page.locator('[data-about-intro="settled"]').waitFor({ timeout: 4000 }).catch(() => {});
    // Under the pin the eligible pool is forced EMPTY → the client falls to the fallback, so EVERY
    // rendered title input shows exactly "Acer palmatum" (AC11 — the baseline never churns).
    const inputs = page.getByRole("textbox", { name: /press Enter to open that topic/ });
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      await expect(inputs.nth(i)).toHaveValue("Acer palmatum");
    }
  });
});
