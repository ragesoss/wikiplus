import { test, type Page } from "@playwright/test";
import { stubCommon } from "./fixtures";

// Inline capture aid for the #96 header-transition fix work (NOT a CI test). Renders the Topic
// header at many scroll offsets across the Tier-A → slim transition, high-DPI + tightly cropped, so
// the owner can confirm: (1) the #FAFBFE hairline at the header bottom at scroll 0; (2) the wordmark
// card lightening / fading + the beam apex peeking over the card top mid-transition. Self-skips
// unless SHOTS=1. Run: SHOTS=1 SHOTS_OUT=<dir> yarn test:e2e e2e/header-transition-capture.spec.ts

const ENABLED = !!process.env.SHOTS;
const OUT = process.env.SHOTS_OUT || "screenshots/header-transition";

const ARTICLE_HTML = `<!DOCTYPE html><html><body>
  <section><p>Photosynthesis is the process used by plants, algae, and some bacteria to convert
  light energy into chemical energy. This article is long so the page scrolls well past the header
  collapse threshold.</p></section>
  ${Array.from({ length: 40 })
    .map(
      (_, i) =>
        `<section data-mw-section-id="${i + 1}"><h2 id="s${i}">Section ${i + 1}</h2><p>Body text for section ${i + 1}, repeated to give the article real scroll height.</p></section>`
    )
    .join("")}
</body></html>`;

async function stub(page: Page) {
  await stubCommon(page, {
    wikidata: { Q11982: "Photosynthesis" },
    resolve: () => ({ title: "Photosynthesis", qid: "Q11982" }),
    youtube: () => [],
  });
  await page.route("**/api/rest_v1/page/html/**", (route) =>
    route.fulfill({ contentType: "text/html", body: ARTICLE_HTML })
  );
}

// p = scrollY / 104. Sample densely through the front half where the glitches live.
const OFFSETS = [0, 5, 10, 16, 21, 26, 31, 42, 52, 73, 104];

async function shotAt(page: Page, y: number) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(220); // let the rAF-gated CSS-var write settle
  const tag = String(y).padStart(3, "0");
  // Live apex x + band height so the wordmark crop tracks the seam-on-divider position.
  const { apexX, bandH } = await page.evaluate(() => {
    const el = document.querySelector("header.header-shared") as HTMLElement | null;
    const apex = el
      ? parseFloat(getComputedStyle(el.querySelector(".tier-a") as HTMLElement).getPropertyValue("--projector-apex-x"))
      : 640;
    const band = el ? parseFloat(getComputedStyle(el).getPropertyValue("--topic-burn-y")) : 104;
    return { apexX: isNaN(apex) ? 640 : apex, bandH: isNaN(band) ? 104 : band };
  });
  // (a) Full-width header band + the first slice of page below — the #FAFBFE bottom hairline.
  await page.screenshot({
    path: `${OUT}/band-${tag}.png`,
    clip: { x: 0, y: 0, width: 1280, height: 140 },
  });
  // (b) Tight crop centred on the live wordmark card — the lightening / fade + the beam apex over
  // the card top. Cropped small so the high-DPI render zooms it.
  await page.screenshot({
    path: `${OUT}/word-${tag}.png`,
    clip: { x: Math.max(0, apexX - 170), y: 0, width: 360, height: 120 },
  });
  // (c) Ultra-thin strip straddling the live header bottom edge (band height) — isolates the
  // #FAFBFE→white hairline at the header/page seam, away from the gold beam cone.
  await page.screenshot({
    path: `${OUT}/seam-${tag}.png`,
    clip: { x: 0, y: Math.max(0, bandH - 14), width: 460, height: 28 },
  });
}

test.describe("@captheader header transition (before)", () => {
  test.skip(!ENABLED, "capture aid — run with SHOTS=1");
  test.use({ deviceScaleFactor: 3 });
  test.beforeEach(async ({ page }) => stub(page));

  test("@captheader desktop transition sweep", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("header.header-shared").waitFor();
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(300);
    for (const y of OFFSETS) await shotAt(page, y);
  });
});
