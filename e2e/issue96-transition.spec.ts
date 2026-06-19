import { test, type Page } from "@playwright/test";
import { stubCommon } from "./fixtures";

// #96 fix-round capture aid (NOT a CI test) — renders the Topic header transition zone at the exact
// scroll offsets the owner reviewed (scrollY 0 / 26 / 52, i.e. p = 0 / ~0.25 / ~0.5) so the
// front-half header/page temperature hairline can be confirmed gone by eye + pixel sample, while the
// back-half 2px ink border still fades in. Self-skips unless SHOTS=1 (driven manually). Output dir
// from SHOTS_OUT. Run: SHOTS=1 SHOTS_OUT=<dir> yarn test:e2e e2e/issue96-transition.spec.ts

const ENABLED = !!process.env.SHOTS;
const OUT = process.env.SHOTS_OUT || "screenshots/issue96-fix";

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

async function shotAt(page: Page, y: number, name: string) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(250); // let the rAF-gated CSS-var write settle
  // The transition zone: the full-width band bottom + the first slice of page below it.
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: 1280, height: 180 } });
}

test.describe("@issue96 header transition zone", () => {
  test.skip(!ENABLED, "capture aid — run with SHOTS=1");
  test.beforeEach(async ({ page }) => stub(page));

  test("@issue96 transition offsets 0/26/52", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("header.header-shared").waitFor();
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(300);
    await shotAt(page, 0, "offset-000");
    await shotAt(page, 26, "offset-026");
    await shotAt(page, 52, "offset-052");
  });
});

test.describe("@issue96b header back-half border", () => {
  test.skip(!ENABLED, "capture aid — run with SHOTS=1");
  test.beforeEach(async ({ page }) => stub(page));

  test("@issue96b deep offset 90 + slim 200", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("header.header-shared").waitFor();
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(300);
    await shotAt(page, 90, "offset-090");
    await shotAt(page, 200, "offset-200");
  });
});
