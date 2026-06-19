import { test, type Page } from "@playwright/test";
import { stubCommon } from "./fixtures";
import { signIn } from "./auth";

// Standard PR screenshot matrix (driven by scripts/dev/shots.sh — do NOT run this directly with a
// bare `yarn test:e2e`). It renders the app's main UI surfaces — the **home/landing** page and a
// **Topic** page — across logged-out/logged-in × desktop/tablet/mobile × (for Topic) the scroll-top
// and slim-sticky states, plus the mobile search icon-reveal. Captures run against the Node SSR
// server with the in-spec Wikipedia/Wikidata/YouTube stubs + the seeded ephemeral Postgres
// (globalSetup); the logged-in state uses the e2e session-cookie helper (no real OAuth).
//
// These are CAPTURES, not assertions — so they MUST NOT run as part of the normal CI e2e gate
// (they'd be no-assertion "tests" that only slow it down). They self-SKIP unless `SHOTS=1` is set,
// which `scripts/dev/shots.sh` does. Subsetting is by Playwright `--grep` on the `@home` / `@topic`
// tags in the titles (the wrapper maps `--home` / `--topic` to those); `--all` runs everything.
//
// Output dir comes from `SHOTS_OUT` (default `screenshots/standard`, gitignored). The wrapper points
// it at a committed `docs/design/<slug>-screenshots/` dir for the opt-in permanent-record case.

const ENABLED = !!process.env.SHOTS;
const OUT = process.env.SHOTS_OUT || "screenshots/standard";

// A long article so the Topic page scrolls past the header collapse threshold (slim-state shots).
const ARTICLE_HTML = `<!DOCTYPE html><html><body>
  <section><p>Photosynthesis is the process used by plants, algae, and some bacteria to convert
  light energy into chemical energy. This article is long so the page scrolls well past the header
  collapse threshold for the slim-state captures.</p></section>
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

async function collapseHeader(page: Page) {
  await page.locator("header.header-shared").waitFor();
  await page.evaluate(() => window.scrollTo(0, 700));
  await page
    .locator("header.header-shared[data-collapsed]")
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(350); // let the ~180ms cross-fade settle to the slim end-state
}

async function shot(page: Page, name: string, width: number, height: number) {
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width, height } });
}

// ── HOME (landing) ────────────────────────────────────────────────────────────────────────────
test.describe("@home home / landing", () => {
  test.skip(!ENABLED, "screenshot capture — run via scripts/dev/shots.sh");
  test.beforeEach(async ({ page }) => stub(page));

  test("@home desktop logged-out", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByRole("link", { name: "wiki+" }).waitFor();
    await page.waitForTimeout(300);
    await shot(page, "home-desktop-logged-out", 1280, 360);
  });

  test("@home desktop logged-in", async ({ page, baseURL }) => {
    await signIn(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByRole("link", { name: "wiki+" }).waitFor();
    await page.waitForTimeout(300);
    await shot(page, "home-desktop-logged-in", 1280, 360);
  });

  test("@home mobile logged-out", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto("/");
    await page.getByRole("link", { name: "wiki+" }).waitFor();
    await page.waitForTimeout(300);
    await shot(page, "home-mobile-logged-out", 390, 430);
  });

  test("@home mobile logged-in", async ({ page, baseURL }) => {
    await signIn(page, baseURL);
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto("/");
    await page.getByRole("link", { name: "wiki+" }).waitFor();
    await page.waitForTimeout(300);
    await shot(page, "home-mobile-logged-in", 390, 430);
  });
});

// ── TOPIC ─────────────────────────────────────────────────────────────────────────────────────
test.describe("@topic topic page", () => {
  test.skip(!ENABLED, "screenshot capture — run via scripts/dev/shots.sh");
  test.beforeEach(async ({ page }) => stub(page));

  test("@topic desktop tierA logged-out (seam on divider)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("header.header-shared").waitFor();
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(300);
    await shot(page, "topic-desktop-tierA-logged-out", 1280, 440);
  });

  test("@topic desktop tierA logged-in", async ({ page, baseURL }) => {
    await signIn(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("header.header-shared").waitFor();
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(300);
    await shot(page, "topic-desktop-tierA-logged-in", 1280, 440);
  });

  test("@topic desktop slim logged-in (scrolled, beam faded)", async ({ page, baseURL }) => {
    await signIn(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("h1").first().waitFor();
    await collapseHeader(page);
    await shot(page, "topic-desktop-slim-logged-in", 1280, 96);
  });

  test("@topic tablet tierA logged-out (md, stacked)", async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1000 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("header.header-shared").waitFor();
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(300);
    await shot(page, "topic-tablet-tierA-logged-out", 834, 420);
  });

  test("@topic mobile tierA logged-out (search icon)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("header.header-shared").waitFor();
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(300);
    await shot(page, "topic-mobile-tierA-logged-out", 390, 420);
  });

  test("@topic mobile tierA logged-in", async ({ page, baseURL }) => {
    await signIn(page, baseURL);
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("header.header-shared").waitFor();
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(300);
    await shot(page, "topic-mobile-tierA-logged-in", 390, 420);
  });

  test("@topic mobile slim logged-in (scrolled)", async ({ page, baseURL }) => {
    await signIn(page, baseURL);
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("h1").first().waitFor();
    await collapseHeader(page);
    await shot(page, "topic-mobile-slim-logged-in", 390, 84);
  });

  test("@topic mobile search revealed", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("header.header-shared").waitFor();
    await page.getByRole("button", { name: /search topics/i }).click();
    await page.getByRole("button", { name: /close search/i }).waitFor();
    await page.waitForTimeout(200);
    await shot(page, "topic-mobile-search-revealed", 390, 140);
  });
});
