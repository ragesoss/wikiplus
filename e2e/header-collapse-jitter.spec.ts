import { test, expect, type Page } from "@playwright/test";
import { stubCommon } from "./fixtures";

// Regression guard for the Topic-page scroll jitter at the header-collapse zone (#96 follow-up). The
// scroll-aware header collapses its IN-FLOW band height as scrollY rises; without opting the document
// scroller (BOTH html AND body) out of scroll anchoring, the browser nudges scrollY to keep the
// reflowed content stable, which re-drives the collapse — a feedback loop that makes the whole page
// jitter ~1px back and forth at unstable points just below the top. This test creeps the scroll 1px
// at a time through that zone and asserts scrollY does NOT keep reversing direction (the jitter
// signature). It fails loudly if the overflow-anchor opt-out ever regresses to html-only.

const ARTICLE_HTML = `<!DOCTYPE html><html><body>
  <section><p>Long article body so the page scrolls well past the header collapse threshold.</p></section>
  ${Array.from({ length: 60 })
    .map(
      (_, i) =>
        `<section data-mw-section-id="${i + 1}"><h2 id="s${i}">Section ${i + 1}</h2><p>Body text for section ${i + 1}, repeated to give real scroll height. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p></section>`
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

test.describe("@jitter header-collapse scroll stability", () => {
  test.beforeEach(async ({ page }) => stub(page));

  test("@jitter scrollY does not oscillate in the collapse zone", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/topic/Photosynthesis/");
    await page.locator("header.header-shared").waitFor();
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(400);

    // Confirm the opt-out is present on BOTH the root scroller and body — the html-only form leaves
    // the loop live (the regression this guards against).
    const anchor = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).overflowAnchor,
      body: getComputedStyle(document.body).overflowAnchor,
    }));
    expect(anchor.html).toBe("none");
    expect(anchor.body).toBe("none");

    // Creep 1px at a time through the unstable zone (a slow wheel scroll); at each stop, sample
    // scrollY over ~24 frames and count direction reversals. A stable page settles and holds (0–1
    // reversals from the settle frame); a jittering page reverses on almost every frame.
    const totalReversals = await page.evaluate(async () => {
      const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      const countReversals = (sy: number[]) => {
        let n = 0;
        for (let i = 2; i < sy.length; i++) {
          const d1 = sy[i - 1] - sy[i - 2];
          const d2 = sy[i] - sy[i - 1];
          if (d1 !== 0 && d2 !== 0 && Math.sign(d1) !== Math.sign(d2)) n++;
        }
        return n;
      };
      window.scrollTo(0, 24);
      for (let i = 0; i < 6; i++) await frame();
      let total = 0;
      for (let t = 26; t <= 38; t++) {
        window.scrollTo(0, t);
        for (let i = 0; i < 3; i++) await frame(); // settle
        const sy: number[] = [];
        for (let i = 0; i < 24; i++) {
          await frame();
          sy.push(window.scrollY);
        }
        total += countReversals(sy);
      }
      return total;
    });

    // With the loop killed this is 0; the regression (html-only) produced ~110. A tiny tolerance
    // absorbs at most a one-frame settle blip per stop without admitting the sustained oscillation.
    expect(totalReversals).toBeLessThanOrEqual(3);
  });
});
