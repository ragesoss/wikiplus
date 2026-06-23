import { test, expect } from "@playwright/test";
import { applyStub } from "./screenshots/catalog";

// ── Horizontal overflow regression (mobile document width, General carousel) ─────────────────────
//
// On mobile, the General-band carousel (<ul> in GeneralStrip.tsx) must NOT expand the document
// width beyond the viewport width. The root cause: the carousel's absolutely-positioned card
// overlays (thumbnail wash, brand wash, play circle, badge) escape the scrolling container when the
// <ul> is not a containing block, pushing `document.documentElement.scrollWidth` up to ~1013px on
// a 390px phone. The fix is `position: relative` on the <ul>, making it the containing block so
// `overflow-x` clips the overlays.
//
// This spec exercises a topic with suggestion candidates (the General band populated with
// candidates) at each of the four in-scope phone widths. It measures
// `document.documentElement.scrollWidth <= clientWidth + 1` (1px tolerance).
//
// STANDALONE, env-guarded (self-skips unless FIT_CHECK=1 or OVERFLOW_CHECK=1). Requires the real
// layout engine — jsdom has no layout and getBoundingClientRect there is meaningless. Reuses the
// screenshot harness's `applyStub` + the seeded ephemeral Postgres from playwright.config's
// globalSetup. Run with:
//   OVERFLOW_CHECK=1 yarn playwright test e2e/mobile-overflow.spec.ts
const ENABLED = !!process.env.FIT_CHECK || !!process.env.OVERFLOW_CHECK;

const WIDTHS = [360, 390, 414, 430] as const;
// Portrait height — same value used by the mobile-player-fit spec.
const PORTRAIT_H = 780;

// The Cellular-respiration suggestion topic: five YouTube candidates, all in the General band.
// Uses applyStub("suggestions") which stubs wikipedia / wikidata / youtube and resolves the topic.
const RESP_ROUTE = "/topic/Cellular_respiration/";

test.describe("Mobile — no horizontal document overflow with the General carousel (mobile-overflow-fix)", () => {
  test.skip(!ENABLED, "horizontal overflow check — run with OVERFLOW_CHECK=1 (or FIT_CHECK=1)");

  for (const width of WIDTHS) {
    test(`document.scrollWidth <= clientWidth at ${width}px portrait`, async ({ page }) => {
      await applyStub(page, "suggestions");
      await page.setViewportSize({ width, height: PORTRAIT_H });
      await page.goto(RESP_ROUTE);
      // Wait for the header and at least one suggestion card — the General band is populated.
      await page.locator("header.header-shared").waitFor();
      await page.locator("#general-band").waitFor();
      // One candidate tile should be visible.
      await page.locator("#general-band [role='listitem']").first().waitFor();

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        scrollWidth,
        `document.scrollWidth (${scrollWidth}) must be <= clientWidth (${clientWidth}) + 1 at ${width}px — horizontal overflow detected; the General carousel overlays are escaping the scroll container`
      ).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});
