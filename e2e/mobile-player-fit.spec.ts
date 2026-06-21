import { test, expect, type Page } from "@playwright/test";
import { applyStub } from "./screenshots/catalog";

// ── DEFECT-1 dimensional fit guarantee (issue #120, docs/design/unified-player-mobile.md §6.1/§6.2,
//    AC-fit). ──────────────────────────────────────────────────────────────────────────────────────
//
// The no-overflow safety net: at every in-scope phone width (360/390/414/430), in BOTH orientations,
// for BOTH 16:9 and 9:16 clips, collapsed AND with the curated note expanded, the unified mobile dock
// must NEVER overflow the viewport — its top edge stays >= 0 and the Close + Move controls stay
// inside the viewport (never pushed off-screen).
//
// This is a STANDALONE, env-guarded check (it self-skips unless FIT_CHECK=1), NOT part of the normal
// e2e gate — it drives the REAL app + REAL CSS so the assertion measures the shipped layout (jsdom in
// vitest has no layout engine, so getBoundingClientRect there is meaningless). It reuses the
// screenshot harness's `applyStub` (deterministic Wikipedia/YouTube fixtures, no network egress) and
// the seeded ephemeral Postgres from playwright.config's globalSetup. Run with:
//   FIT_CHECK=1 yarn playwright test e2e/mobile-player-fit.spec.ts
const ENABLED = !!process.env.FIT_CHECK;

const SEL_DOCK = 'section[aria-label="Video player"]';

// Two real Photosynthesis curated clips (lib/data/seed.ts), one of each orientation, BOTH carrying a
// contextNote (so the curated "Context ▸" expander renders and the expanded-note case is exercised).
const HORIZONTAL_CAPTION = "Photosynthesis: Crash Course Biology #8";
const VERTICAL_CAPTION = "Photosynthesis Explained in under 1min! 🌱🔆";

const WIDTHS = [360, 390, 414, 430] as const;
// Portrait height = the most-stressing in-scope phone height (the UX repro used 780; a shorter
// viewport is a harder fit). Landscape rotates the same window.
const PORTRAIT_H = 780;

type Orientation = "portrait" | "landscape";
type Aspect = "16:9" | "9:16";

async function openDock(page: Page, caption: string): Promise<void> {
  await page.locator("#general-band").waitFor();
  await page.getByRole("button", { name: `Play: ${caption}` }).first().click();
  await page.locator(SEL_DOCK).waitFor();
  await page.waitForTimeout(150);
}

/** Measure the dock's top + whether Close / Move are inside the viewport. In landscape the dock
 *  auto-maximizes (inset-0), where the park toggle is intentionally hidden (§7) — so Move is only
 *  asserted when present. Close must ALWAYS be reachable and on-screen. */
async function measure(page: Page) {
  const vh = page.viewportSize()!.height;
  const vw = page.viewportSize()!.width;
  const dock = page.locator(SEL_DOCK);
  const box = (await dock.boundingBox())!;
  const close = page.getByRole("button", { name: "Close video player" });
  const closeBox = (await close.boundingBox())!;
  const moveBtn = page.getByRole("button", { name: /Move player to (top|bottom) of screen/ });
  const moveCount = await moveBtn.count();
  const moveBox = moveCount ? await moveBtn.first().boundingBox() : null;
  const inViewport = (b: { x: number; y: number; width: number; height: number }) =>
    b.y >= 0 && b.x >= 0 && b.y + b.height <= vh + 0.5 && b.x + b.width <= vw + 0.5;
  return {
    dockTop: box.y,
    closeOnScreen: inViewport(closeBox),
    movePresent: moveCount > 0,
    moveOnScreen: moveBox ? inViewport(moveBox) : null,
  };
}

test.describe("Mobile dock — no-overflow fit guarantee (DEFECT 1, §6.1/§6.2)", () => {
  test.skip(!ENABLED, "dimensional fit check — run with FIT_CHECK=1");

  for (const aspect of ["16:9", "9:16"] as Aspect[]) {
    const caption = aspect === "9:16" ? VERTICAL_CAPTION : HORIZONTAL_CAPTION;
    for (const width of WIDTHS) {
      for (const orientation of ["portrait", "landscape"] as Orientation[]) {
        for (const expanded of [false, true]) {
          const title = `${aspect} ${width}px ${orientation} ${expanded ? "expanded" : "collapsed"}`;
          test(title, async ({ page }) => {
            await applyStub(page, "curated");
            const size =
              orientation === "portrait"
                ? { width, height: PORTRAIT_H }
                : { width: PORTRAIT_H, height: width };
            await page.setViewportSize(size);
            await page.goto("/topic/Photosynthesis/");
            await page.locator("header.header-shared").waitFor();
            await page.locator("h1").first().waitFor();

            await openDock(page, caption);

            // Expand the curated note (the case that DEFECT 1 reproduced). In landscape the dock is
            // maximized and the supplemental row (incl. the expander) is hidden — there is nothing to
            // expand, so skip the expand step there; the maximized layout is what we still measure.
            if (expanded && orientation === "portrait") {
              await page.getByRole("button", { name: /^Context/ }).click();
              await page.waitForTimeout(120);
            }

            const m = await measure(page);
            // The dock never grows past the top edge (the title bar is never clipped off-screen).
            expect(m.dockTop, `dock top must be >= 0 (was ${m.dockTop})`).toBeGreaterThanOrEqual(-0.5);
            // Close is always reachable and on-screen.
            expect(m.closeOnScreen, "Close button must be within the viewport").toBe(true);
            // Move is on-screen whenever it is present (docked); absent (correctly) when maximized.
            if (m.movePresent) {
              expect(m.moveOnScreen, "Move button must be within the viewport").toBe(true);
            }
          });
        }
      }
    }
  }
});
