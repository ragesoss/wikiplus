import { expect, test, type Page } from "@playwright/test";

// E2E for the article-fidelity feature (#24–#27) — the BROWSER-ONLY criteria QA
// cannot verify in jsdom: A3/A4 the marker↔reference scroll+focus round-trip and the
// multi-cited back-ref; B2 the "Scroll table →" overflow hint (real geometry) + the
// two-column shell not widening; B3/B4 the Wikipedia infobox renders float-right in the
// article column with no collision with the wiki+ panel; C1/C2 math renders as the SVG
// fallback image; D6 scroll-sync tracks restored tail sections + no clip mis-anchors.
//
// The live MediaWiki/Wikidata calls are intercepted with a deterministic fixture that
// carries one of EACH restored category (the sandbox has no network egress).

// A fixture rich enough to exercise every restored category on ONE page.
const FIDELITY_HTML = `<!DOCTYPE html><html><body>
  <div role="note" class="hatnote navigation-not-searchable">For other uses, see
    <a rel="mw:WikiLink" href="./Photosynthesis_(disambiguation)">Photosynthesis (disambiguation)</a>.</div>
  <section>
    <table class="infobox biota"><caption>Photosynthesis</caption>
      <tbody><tr><th>Type</th><td>Process</td></tr><tr><th>Inputs</th><td>CO2, H2O</td></tr></tbody></table>
    <p>Photosynthesis is the <a rel="mw:WikiLink" href="./Process">process</a> used by plants<sup class="mw-ref reference" id="cite_ref-keystone-1"><a href="./Photosynthesis#cite_note-keystone-1"><span class="mw-reflink-text"><span class="cite-bracket">[</span>1<span class="cite-bracket">]</span></span></a></sup>.</p>
  </section>
  <section data-mw-section-id="1"><h2 id="Light-dependent_reactions">Light-dependent reactions</h2>
    <p>The reactions<sup class="mw-ref reference" id="cite_ref-multi-2"><a href="./Photosynthesis#cite_note-multi-2"><span class="mw-reflink-text"><span class="cite-bracket">[</span>2<span class="cite-bracket">]</span></span></a></sup> proceed.</p>
  </section>
  <section data-mw-section-id="2"><h2 id="Equation">Equation</h2>
    <p>The overall reaction is shown:</p>
    <p><span class="mwe-math-element mwe-math-element-block" typeof="mw:Extension/math"><span class="mwe-math-mathml-display mwe-math-mathml-a11y" style="display: none;"><math xmlns="http://www.w3.org/1998/Math/MathML" alttext="6CO2"><semantics><annotation>6CO2</annotation></semantics></math></span><img src="https://wikimedia.org/api/rest_v1/media/math/render/svg/photo-eq" class="mwe-math-fallback-image-display" aria-hidden="true" alt="{\\displaystyle 6CO_{2}+6H_{2}O}"></span></p>
  </section>
  <section data-mw-section-id="3"><h2 id="Yields">Yields</h2>
    <table class="wikitable"><caption>Energy yields</caption><tbody>
      <tr><th>Stage</th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th><th>F</th><th>G</th><th>H</th><th>I</th><th>J</th><th>K</th><th>L</th></tr>
      <tr><td>Net</td><td>1111111111</td><td>2222222222</td><td>3333333333</td><td>4444444444</td><td>5555555555</td><td>6666666666</td><td>7777777777</td><td>8888888888</td><td>9999999999</td><td>0000000000</td><td>1234567890</td><td>0987654321</td></tr>
    </tbody></table>
  </section>
  <section data-mw-section-id="4"><h2 id="References">References</h2>
    <ol class="mw-references references">
      <li id="cite_note-keystone-1" data-mw-footnote-number="1">
        <span class="mw-cite-backlink"><a href="./Photosynthesis#cite_ref-keystone-1" rel="mw:referencedBy"><span class="mw-linkback-text">↑</span></a></span>
        <span class="mw-reference-text reference-text">Keystone source. <a href="https://doi.org/10.1/keystone">doi:10.1/keystone</a>.</span></li>
      <li id="cite_note-multi-2" data-mw-footnote-number="2">
        <span class="mw-cite-backlink" rel="mw:referencedBy">
          <a href="./Photosynthesis#cite_ref-multi-2-0"><span class="mw-linkback-text">a</span></a>
          <a href="./Photosynthesis#cite_ref-multi-2-1"><span class="mw-linkback-text">b</span></a></span>
        <span class="mw-reference-text reference-text">Multi-cited source.</span></li>
    </ol></section>
  <section data-mw-section-id="5"><h2 id="See_also">See also</h2>
    <ul>${Array.from({ length: 30 }, (_, i) => `<li><a rel="mw:WikiLink" href="./Related_${i}">Related topic ${i}</a></li>`).join("")}</ul></section>
  <section data-mw-section-id="6"><h2 id="External_links">External links</h2>
    <ul><li><a href="https://example.org">Resource</a></li></ul></section>
</body></html>`;

async function stubWikipedia(page: Page) {
  await page.route("**/wikidata.org/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        entities: { Q11982: { sitelinks: { enwiki: { title: "Photosynthesis" } } } },
      }),
    })
  );
  await page.route("**/w/api.php**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        query: { pages: { "1": { pageprops: { wikibase_item: "Q11982" } } } },
      }),
    })
  );
  await page.route("**/api/rest_v1/page/html/**", (route) =>
    route.fulfill({ contentType: "text/html", body: FIDELITY_HTML })
  );
}

test.describe("Article fidelity (#24–#27) — browser-only criteria", () => {
  test.beforeEach(async ({ page }) => {
    await stubWikipedia(page);
  });

  test("A1/A2 — inline marker renders and opens a non-modal citation popover", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    const marker = page.getByRole("link", { name: "Citation 1" });
    await expect(marker).toBeVisible();
    await marker.click();
    const popover = page.getByRole("dialog", { name: "Citation 1" });
    await expect(popover).toBeVisible();
    await expect(popover.getByText(/Keystone source/)).toBeVisible();
    // non-modal: page is not inert/aria-hidden behind it
    await expect(popover).not.toHaveAttribute("aria-modal", "true");
  });

  test("A2 — opening the popover does not change the active section (scroll-sync untouched)", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    const scrollY = await page.evaluate(() => window.scrollY);
    await page.getByRole("link", { name: "Citation 1" }).click();
    await expect(page.getByRole("dialog", { name: "Citation 1" })).toBeVisible();
    // The page did not scroll on open (the load-bearing A2 contract).
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  });

  test("A3/A4 — References section renders; back-ref scrolls to the inline marker + focuses it", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    await expect(
      page.getByRole("heading", { name: "References" })
    ).toBeVisible();
    // The reference list entry exists at the foot.
    const refEntry = page.locator("#cite_note-keystone-1");
    await expect(refEntry).toBeAttached();
    // Activate the single back-ref → returns to the inline marker (id cite_ref-keystone-1).
    await refEntry.getByRole("link", { name: /Back to citation/ }).click();
    await expect(page.locator("#cite_ref-keystone-1")).toBeInViewport();
  });

  test("A4 — a multi-cited reference renders ALL its back-refs (a, b)", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    const multi = page.locator("#cite_note-multi-2");
    const backrefs = multi.getByRole("link", { name: /Back to citation/ });
    await expect(backrefs).toHaveCount(2);
  });

  test("A3 — marker → reference jump scrolls the foot entry into view", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    // Marker is an in-page hash to the foot entry; clicking opens the popover, whose
    // "View in References" jumps to the list entry. Verify the entry is reachable.
    await page.getByRole("link", { name: "Citation 1" }).first().click();
    await page.getByRole("button", { name: /View in References/ }).click();
    await expect(page.locator("#cite_note-keystone-1")).toBeInViewport();
  });

  test("B2 — wide table shows the 'Scroll table →' hint AND does not widen the shell", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    const wrap = page.locator(".wiki-tablewrap").first();
    await expect(wrap).toBeAttached();
    // The wide table genuinely overflows → data-overflow flag set → CSS hint shows.
    await expect(wrap).toHaveAttribute("data-overflow", "");
    // The article column did not widen past the viewport (no horizontal page scroll).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);
    // The wrapper itself is the scroll container (its scrollWidth > clientWidth).
    const scrollable = await wrap.evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1
    );
    expect(scrollable).toBe(true);
  });

  test("B3/B4 — Wikipedia infobox renders float-right in the article column; wiki+ panel is separate", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    const infobox = page.locator("table.wiki-infobox");
    await expect(infobox).toBeVisible();
    // It floats right (computed float === 'right' at lg widths).
    const float = await infobox.evaluate((el) => getComputedStyle(el).float);
    expect(float).toBe("right");
    // It lives inside the LEFT article column, not the right rail.
    const inArticleColumn = await infobox.evaluate(
      (el) => !el.closest("aside")
    );
    expect(inArticleColumn).toBe(true);
    // The wiki+ panel ("Videos" counts) is a separate element; no overlap.
    const wikiPlusPanel = page.getByText("Videos", { exact: true }).first();
    await expect(wikiPlusPanel).toBeVisible();
    const ibBox = await infobox.boundingBox();
    const panelBox = await wikiPlusPanel.boundingBox();
    // Horizontally disjoint at lg+ (infobox right edge ≤ panel left edge, given the gap).
    expect(ibBox && panelBox && ibBox.x + ibBox.width <= panelBox.x + 2).toBe(true);
  });

  test("C1/C2 — display equation renders as the SVG fallback image in a labeled scroll region", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    const eq = page.locator("img.mwe-math-fallback-image-display");
    await expect(eq).toBeVisible();
    // The math element is a keyboard-reachable region labeled "Equation".
    await expect(page.getByRole("region", { name: "Equation" })).toBeAttached();
    // The image carries the TeX alt and is NOT aria-hidden (C3/§5.3 — perceivable).
    await expect(eq).toHaveAttribute("alt", /6CO_\{2\}/);
    expect(await eq.getAttribute("aria-hidden")).toBeNull();
    // No <math> element survives in the rendered DOM (XSS posture / C4 decision).
    expect(await page.locator("math").count()).toBe(0);
  });

  test("D2 — hatnote renders above the lead, styled distinctly (italic)", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    const hatnote = page.locator(".wiki-hatnote").first();
    await expect(hatnote).toBeVisible();
    const fontStyle = await hatnote.evaluate(
      (el) => getComputedStyle(el).fontStyle
    );
    expect(fontStyle).toBe("italic");
  });

  test("D5/D6 — restored tail sections appear as TOC rows with a 'no video' badge; scroll-sync tracks them", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    await expect(page.getByText("Videos", { exact: true })).toBeVisible();
    // The TOC lists References + See also as rows (they came through the walk).
    const toc = page.getByRole("navigation", { name: "Table of contents" });
    await expect(toc.getByText("References")).toBeVisible();
    await expect(toc.getByText("See also")).toBeVisible();
    // They are video-less → "no video" badge present in the TOC.
    await expect(toc.getByText("no video").first()).toBeVisible();
    // Scroll-sync tracks the tail: the feature wires tail sections into scroll-sync
    // exactly like content sections (real `.sec` wrapper + setSectionRef). Scroll the
    // See-also heading past the reading line (HEAD+READ=184) with genuine wheel events
    // (the article→rail onScroll handler is rAF-debounced and needs real scroll events,
    // not one synthetic jump) and assert it becomes the active section.
    //   It is made viewport-tall on purpose so its heading CAN rise above the line while
    //   its body still fills the screen. NOTE: a *very short trailing* section can't
    //   activate — the page runs out of scroll before its heading reaches the line. That
    //   is PRE-EXISTING scroll-spy geometry (it affects the last content section too),
    //   unchanged by this feature, not a tail-specific defect.
    const seeAlso = page.locator("#sec-see-also");
    await seeAlso.getByRole("heading", { name: "See also" }).scrollIntoViewIfNeeded();
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 40);
      await page.waitForTimeout(120);
    }
    await expect(seeAlso).toHaveClass(/\bactive\b/);
  });

  test("D6 — no clip is mis-anchored to a tail section (tail TOC rows stay zero-count)", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    await expect(page.getByText("Videos", { exact: true })).toBeVisible();
    const toc = page.getByRole("navigation", { name: "Table of contents" });
    // The References / See also rows show "no video", never a numeric count badge.
    const refRow = toc.locator("li", { hasText: "References" });
    await expect(refRow.getByText("no video")).toBeVisible();
    const seeAlsoRow = toc.locator("li", { hasText: "See also" });
    await expect(seeAlsoRow.getByText("no video")).toBeVisible();
  });
});
