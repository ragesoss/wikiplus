import { expect, test, type Page } from "@playwright/test";

// E2E for the navbar topic search (#12) against the static export. The sandbox has no
// network egress, so the Wikipedia typeahead (REST search/title), title→QID, and
// article HTML are INTERCEPTED with deterministic fixtures. Covers AC1 (submit a title),
// AC2 (select a suggestion), AC5 (an UNSEEDED title still opens a working Topic page,
// no QID in the URL). Drives the control by accessible role/name (AC11) per the design.

const ARTICLE_HTML = (lead: string) => `<!DOCTYPE html><html><body>
  <section><p>${lead}</p></section>
  <section><h2 id="History">History</h2><p>History body text.</p></section>
</body></html>`;

async function stubWikipedia(page: Page) {
  // Typeahead (REST search/title) — return ranked completions for the query.
  await page.route("**/w/rest.php/v1/search/title**", (route) => {
    const url = new URL(route.request().url());
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const pool = [
      { title: "Cat", description: "domestic species" },
      { title: "Catalonia", description: "autonomous community in Spain" },
      { title: "Photosynthesis", description: "biological process" },
      { title: "Quantum entanglement", description: "physics phenomenon" },
    ];
    const pages = pool.filter((p) => p.title.toLowerCase().startsWith(q));
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ pages }),
    });
  });

  // title→QID (Wikipedia action API pageprops/wikibase_item) — resolves any title.
  await page.route("**/w/api.php**", (route) => {
    const url = decodeURIComponent(route.request().url());
    const qid = url.includes("Catalonia")
      ? "Q5705"
      : url.includes("Quantum")
        ? "Q4378"
        : url.includes("Photosynthesis")
          ? "Q11982"
          : "Q146";
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        query: { pages: { "1": { pageprops: { wikibase_item: qid } } } },
      }),
    });
  });

  await page.route("**/api/rest_v1/page/html/**", (route) => {
    const url = decodeURIComponent(route.request().url());
    const lead = url.includes("Quantum")
      ? "Quantum entanglement lead."
      : url.includes("Catalonia")
        ? "Catalonia lead."
        : "Article lead.";
    route.fulfill({ contentType: "text/html", body: ARTICLE_HTML(lead) });
  });
}

test.describe("Navbar topic search (#12)", () => {
  test.beforeEach(async ({ page }) => {
    await stubWikipedia(page);
  });

  test("AC1 — typing a title and pressing Enter opens its Topic page", async ({
    page,
  }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /find a topic/i });
    await search.fill("Photosynthesis");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/topic\/Photosynthesis\/?$/);
    // The landing Topic page rendered (article + CC BY-SA attribution).
    await expect(page.getByText(/CC BY-SA 4\.0/)).toBeVisible();
  });

  test("AC2 — selecting a suggestion opens that title's Topic page", async ({
    page,
  }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /find a topic/i });
    await search.fill("Cat");
    // The suggestion list appears; pick "Catalonia" via keyboard (ArrowDown x2 → Enter).
    await expect(
      page.getByRole("option", { name: /Catalonia/ })
    ).toBeVisible();
    await search.press("ArrowDown");
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/topic\/Catalonia\/?$/);
  });

  test("AC5 — an unseeded title opens a working Topic page with no QID in the URL", async ({
    page,
  }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /find a topic/i });
    // "Quantum entanglement" is NOT a seeded topic (Photosynthesis/Cellular respiration/Cat).
    await search.fill("Quantum entanglement");
    await search.press("Enter");
    // Title-based URL with space→underscore (#11 encoding), and NO qid= anywhere.
    await expect(page).toHaveURL(/\/topic\/Quantum_entanglement\/?$/);
    await expect(page).not.toHaveURL(/qid=/);
    await expect(page).not.toHaveURL(/%20/);
    // It renders the topic shell (article side resolves), not a hard error / blank page.
    await expect(page.getByText(/CC BY-SA 4\.0/)).toBeVisible();
    // Pure navigation — never routed through /contribute.
    await expect(page).not.toHaveURL(/contribute/);
  });

  test("AC1 (topic header host) — search from a Topic page jumps to another topic", async ({
    page,
  }) => {
    await page.goto("/topic/Photosynthesis/");
    await expect(page.getByText(/CC BY-SA 4\.0/)).toBeVisible();
    // The topic header carries the search on the Wiki side (inline ≥ md in this viewport).
    const search = page
      .getByRole("combobox", { name: /search wikipedia topics/i })
      .first();
    await search.fill("Catalonia");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/topic\/Catalonia\/?$/);
  });
});
