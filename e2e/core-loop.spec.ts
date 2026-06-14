import { expect, test, type Page } from "@playwright/test";

// E2E of the core loop (find topic → read → watch & weigh → contribute) against the
// static export. The sandbox has no network egress, so the live MediaWiki + Wikidata
// calls are INTERCEPTED with deterministic fixtures; the plus side renders from the
// seeded localStorage DataStore (seeded on first visit by the app).

const PHOTOSYNTHESIS_HTML = `<!DOCTYPE html><html><body>
  <section><p>Photosynthesis is the <a href="./Process">process</a> used by plants.</p></section>
  <section data-mw-section-id="1"><h2 id="Light-dependent_reactions">Light-dependent reactions</h2><p>The light-dependent reactions body text.</p></section>
  <section data-mw-section-id="2"><h2 id="Calvin_cycle">Calvin cycle</h2><p>The Calvin cycle body text.</p></section>
  <section data-mw-section-id="3"><h2 id="Water_photolysis">Water photolysis</h2><p>Water splitting body text.</p></section>
</body></html>`;

const RESP_HTML = `<!DOCTYPE html><html><body>
  <section><p>Cellular respiration lead.</p></section>
  <section><h2 id="Glycolysis">Glycolysis</h2><p>Glycolysis body.</p></section>
  <section><h2 id="Citric_acid_cycle">Citric acid cycle</h2><p>Citric acid cycle body.</p></section>
</body></html>`;

async function stubWikipedia(page: Page) {
  await page.route("**/wikidata.org/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        entities: {
          Q11982: { sitelinks: { enwiki: { title: "Photosynthesis" } } },
          Q189603: { sitelinks: { enwiki: { title: "Cellular respiration" } } },
        },
      }),
    })
  );
  // Canonical title route resolves title→QID under the hood via the Wikipedia action
  // API (pageprops/wikibase_item). Stub it so an unseeded wikilink target also resolves.
  await page.route("**/w/api.php**", (route) => {
    const url = decodeURIComponent(route.request().url());
    const qid = url.includes("Cellular")
      ? "Q189603"
      : url.includes("Process")
        ? "Q3249551"
        : "Q11982";
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        query: { pages: { "1": { pageprops: { wikibase_item: qid } } } },
      }),
    });
  });
  await page.route("**/api/rest_v1/page/html/**", (route) => {
    const url = decodeURIComponent(route.request().url());
    const body = url.includes("Cellular") ? RESP_HTML : PHOTOSYNTHESIS_HTML;
    route.fulfill({ contentType: "text/html", body });
  });
}

test.describe("Curated topic — read & weigh (AC1–AC13)", () => {
  test.beforeEach(async ({ page }) => {
    await stubWikipedia(page);
  });

  test("renders the two-world layout, the article, and curated clips with chips", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");

    // AC1 — split wordmark
    await expect(page.getByText("Wiki", { exact: true })).toBeVisible();
    await expect(page.getByText("plus", { exact: true })).toBeVisible();

    // AC2/AC3 — real article title + section headings render
    await expect(
      page.getByRole("heading", { name: "Photosynthesis", level: 1 })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Calvin cycle" })
    ).toBeVisible();

    // AC4 — CC BY-SA + QID attribution
    await expect(page.getByText(/CC BY-SA 4\.0 · Wikidata Q11982/)).toBeVisible();

    // AC7 — infobox counts; AC8 — General strip; AC9 — chips
    await expect(page.getByText("Videos")).toBeVisible();
    await expect(page.getByText("＋ General").first()).toBeVisible();
    await expect(page.getByText("Explainer").first()).toBeVisible();
    await expect(page.getByText("Curator note").first()).toBeVisible();
  });

  test("AC5 — an in-article wikilink resolves to a working Topic page (no 404), title-based URL", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    // The lead has a rewritten wikilink to "Process" → canonical /topic/Process/.
    const wikilink = page.getByRole("link", { name: "process" });
    await expect(wikilink).toHaveAttribute("href", /\/topic\/Process\/$/);
    await wikilink.click();
    // Lands on a working Topic page (not a 404), with the title-based URL and no QID.
    await expect(page).toHaveURL(/\/topic\/Process\/?$/);
    await expect(page).not.toHaveURL(/qid=/);
    // The article column rendered (resolved title→QID under the hood + fetched).
    await expect(page.getByText(/CC BY-SA 4\.0/)).toBeVisible();
  });

  test("AC11 — clicking a YouTube thumbnail opens the embedded player (no iframe before click)", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    await expect(page.getByText("Videos")).toBeVisible();

    // No iframe on initial render (embed-never-host facade).
    await expect(page.locator("iframe")).toHaveCount(0);

    await page.getByRole("button", { name: /^Play:/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Video player" });
    await expect(dialog).toBeVisible();
    const frame = dialog.locator("iframe");
    await expect(frame).toHaveAttribute(
      "src",
      /youtube-nocookie\.com\/embed\/.*autoplay=1/
    );

    // Esc closes and removes the iframe.
    await page.keyboard.press("Escape");
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("AC6/AC13 — clicking a TOC entry scrolls the article to that section", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    await expect(page.getByText("Videos")).toBeVisible();
    await page.getByRole("link", { name: "Calvin cycle" }).first().click();
    const heading = page.locator("#h-calvin-cycle");
    await expect(heading).toBeInViewport();
  });

  test("AC13 — clicking a card's section link jumps both columns to that section", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    await expect(page.getByText("Videos")).toBeVisible();
    // A clip card's "↳ <section>" link drives goTo (rail → article jump-to).
    await page
      .getByRole("button", { name: /Light-dependent reactions/ })
      .first()
      .click();
    await expect(page.locator("#h-light-dependent-reactions")).toBeInViewport();
  });

  test("AC12 — scrolling the article applies the active-pairing highlight to the matching section", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    await expect(page.getByText("Videos")).toBeVisible();
    // Scroll a clip-bearing section past the reading line; the article→rail sync
    // (TopicView onScroll, AC12) sets `.sec.active` on that section. This auto-follow
    // is layout-dependent (real geometry), so it is only verifiable in a real browser.
    const sec = page.locator("#sec-calvin-cycle");
    await sec.scrollIntoViewIfNeeded();
    await expect(sec).toHaveClass(/\bactive\b/);
  });
});

test.describe("Uncurated topic — empty state & contribute (AC14–AC19)", () => {
  test.beforeEach(async ({ page }) => {
    await stubWikipedia(page);
  });

  test("AC14/AC16 — '0 videos curated' CTA + Suggested band with unvetted candidates", async ({
    page,
  }) => {
    await page.goto("/topic/Cellular_respiration/");
    await expect(page.getByText("videos curated")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Be the first to curate this topic" })
    ).toBeVisible();
    await expect(page.getByText("＋ Suggested videos")).toBeVisible();
    await expect(page.getByText("uncurated")).toBeVisible();
    await expect(page.getByText("Suggested").first()).toBeVisible();
    // AC15 — no chips on candidates
    await expect(page.getByText("Curator note")).toHaveCount(0);
  });

  test("AC18 — Search YouTube / TikTok deep-links open in a new tab; Add opens the modal", async ({
    page,
  }) => {
    await page.goto("/topic/Cellular_respiration/");
    const yt = page.getByRole("link", { name: /Search YouTube/ });
    await expect(yt).toHaveAttribute("target", "_blank");
    await expect(yt).toHaveAttribute("rel", /noopener/);
    await page.getByRole("button", { name: /Add video/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Add a video")).toBeVisible();
  });

  test("AC19 — Promote opens the Curate modal with the closed-enum selects + CC BY-SA notice", async ({
    page,
  }) => {
    await page.goto("/topic/Cellular_respiration/");
    await page.getByRole("button", { name: /Promote and curate/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Curate this clip")).toBeVisible();
    await expect(
      dialog.getByText(/release your context note under CC BY-SA 4\.0/)
    ).toBeVisible();
    // closed stance enum (Myth-busting present)
    await expect(dialog.getByRole("option", { name: "Myth-busting" })).toBeAttached();
  });

  test("AC19 — 'Not relevant' dismisses a candidate and decrements the count", async ({
    page,
  }) => {
    await page.goto("/topic/Cellular_respiration/");
    await expect(page.getByText(/5 auto-suggestions/)).toBeVisible();
    await page
      .getByRole("button", { name: /Dismiss as not relevant/ })
      .first()
      .click();
    await expect(page.getByText(/4 auto-suggestions/)).toBeVisible();
  });
});

test.describe("Article fetch error (design §7.2)", () => {
  test("shows the inline error card with retry when Wikipedia is unreachable", async ({
    page,
  }) => {
    await page.route("**/wikidata.org/**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          entities: { Q11982: { sitelinks: { enwiki: { title: "Photosynthesis" } } } },
        }),
      })
    );
    await page.route("**/api/rest_v1/page/html/**", (route) => route.abort());
    await page.goto("/topic/Photosynthesis/");
    await expect(page.getByRole("alert")).toContainText("Couldn't load the article");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    // the plus side stays useful
    await expect(page.getByText("Videos")).toBeVisible();
  });
});
