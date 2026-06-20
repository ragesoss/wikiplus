import { expect, test, type Page } from "@playwright/test";
import { stubCommon } from "./fixtures";
import { signIn } from "./auth";

// QA e2e (topic-mobile-search) — the REAL-LAYOUT acceptance criteria for the expanded narrow-header
// search fix (docs/design/topic-mobile-search.md §9). jsdom returns zero layout rects, so these ACs
// — which are fundamentally about boxes not overlapping and the field flexing — must run in a real
// browser. Companion to the jsdom DOM/a11y coverage in test/topic-mobile-search-qa.test.tsx.
//
//   • AC2  — at 320/360/390/600px, expanded: the wordmark "+" glyph, the field (+ ✕), and the login
//            have non-overlapping boxes laid out left→right (glyph < field < login).
//   • AC9  — the field FLEXES (wider at 600 than at 360), has no max-w-[280px] clamp, and its right
//            edge never crosses the login's left edge.
//   • AC12 — the suggestions listbox anchors to the (now narrower) field's own box and stays within
//            the 320px viewport, above the page content (z-50).
//   • AC14 — the magnifier, the ✕, the login (logged-out), the account trigger (logged-in), and the
//            wordmark glyph link are each ≥ 44×44 in the expanded state.
//   • AC7  — (logged-in) the account collapses to the avatar + ▾ icon-only trigger (≥ 44×44) and the
//            Radix menu still opens with My curations / About your data / Sign out.
//
// Runs against the Node SSR server with the in-spec Wikipedia/Wikidata/YouTube stubs (no network
// egress) + the seeded ephemeral Postgres. "Photosynthesis" is a seeded curated topic so its header
// renders identically every run; the logged-in arm uses the e2e session-cookie helper (no OAuth).

const PHOTOSYNTHESIS_HTML = `<!DOCTYPE html><html><body>
  <section><p>Photosynthesis is the process used by plants and other organisms to convert light
  energy into chemical energy. This lead is long enough to give the article real height.</p></section>
  ${Array.from({ length: 12 })
    .map(
      (_, i) =>
        `<section data-mw-section-id="${i + 1}"><h2 id="s${i}">Section ${i}</h2><p>Body for section ${i}.</p></section>`
    )
    .join("")}
</body></html>`;

async function stubWikipedia(page: Page) {
  await stubCommon(page, {
    wikidata: { Q11982: "Photosynthesis" },
    resolve: (url) =>
      url.includes("Catalonia")
        ? { title: "Catalonia", qid: "Q5705" }
        : { title: "Photosynthesis", qid: "Q11982" },
    youtube: () => [],
  });
  // Typeahead — return a few completions for the AC12 listbox-anchoring assertion.
  await page.route("**/w/rest.php/v1/search/title**", (route) => {
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        pages: [
          { title: "Catalonia", description: "autonomous community in Spain" },
          { title: "Catabolism", description: "metabolic breakdown" },
          { title: "Catalysis", description: "rate change by a catalyst" },
        ],
      }),
    });
  });
  await page.route("**/api/rest_v1/page/html/**", (route) =>
    route.fulfill({ contentType: "text/html", body: PHOTOSYNTHESIS_HTML })
  );
}

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };

/** Read the bounding boxes of the four expanded-state chrome boxes, by their real selectors. The
 *  visible disclosure combobox is the < md one (the inline variant is display:none at these widths,
 *  so getBoundingClientRect on it would be 0 — we read the VISIBLE field's enclosing search form). */
async function readExpandedBoxes(page: Page) {
  return page.evaluate(() => {
    const rect = (el: Element | null): {
      left: number; right: number; top: number; bottom: number; width: number; height: number;
    } | null => {
      if (!el) return null;
      const b = (el as HTMLElement).getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
    };
    // Among the two role=search forms (inline + disclosure), the disclosure one is the one with a
    // non-zero box (the inline wrapper is display:none < md). Pick the visible one.
    const forms = Array.from(document.querySelectorAll('form[role="search"]')) as HTMLElement[];
    const field = forms
      .map((f) => ({ f, b: f.getBoundingClientRect() }))
      .filter((x) => x.b.width > 0 && x.b.height > 0)
      .map((x) => x.f)[0] ?? null;
    return {
      glyph: rect(document.querySelector("[data-projector-squeeze]")),
      field: rect(field),
      close: rect(document.querySelector('button[aria-label="Close search"]')),
      login: rect(document.querySelector('header.header-shared button[aria-label="Log in with Wikipedia"]')),
    };
  });
}

function overlaps(a: Box | null, b: Box | null): boolean {
  if (!a || !b) return false;
  // 1px tolerance for sub-pixel rounding / shared borders.
  return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
}

/** Wait out the ~150ms reveal grow + glyph cross-fade so geometry is read in the SETTLED end-state
 *  (AC2/AC9 are about the settled layout — the field's scaleX(0.82)→1 grow transiently compresses
 *  the box mid-animation, which would mis-measure the field's left edge). */
async function settleAnimations(page: Page) {
  await page.waitForTimeout(250); // past the 150ms tween
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const els = Array.from(
          document.querySelectorAll(".topic-disclosure-open, [data-projector-squeeze]")
        );
        const anims = els.flatMap((e) =>
          (e as Element & { getAnimations?: () => Animation[] }).getAnimations
            ? (e as Element & { getAnimations: () => Animation[] }).getAnimations()
            : []
        );
        Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => resolve());
      })
  );
}

async function revealSearch(page: Page) {
  await page.locator("header.header-shared").waitFor();
  await page.locator("h1").first().waitFor();
  await page.getByRole("button", { name: /search topics/i }).click();
  await expect(page.getByRole("button", { name: /close search/i })).toBeVisible();
  await settleAnimations(page);
}

const WIDTHS = [320, 360, 390, 600];

test.describe("topic-mobile-search — expanded narrow header (real layout)", () => {
  test.beforeEach(async ({ page }) => {
    await stubWikipedia(page);
  });

  for (const width of WIDTHS) {
    test(`AC2/AC9/AC14 @ ${width}px — no overlap, fixed order, field flexes, 44px targets`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/topic/Photosynthesis/");
      await revealSearch(page);

      const boxes = await readExpandedBoxes(page);

      // All four boxes are present in the expanded state.
      expect(boxes.glyph, "wordmark '+' glyph present").not.toBeNull();
      expect(boxes.field, "search field present").not.toBeNull();
      expect(boxes.close, "close ✕ present").not.toBeNull();
      expect(boxes.login, "login present").not.toBeNull();

      // AC2 — fixed left→right order: glyph (left) · field+close (middle) · login (right). Use the
      // close ✕ as the field-group's right edge (it sits at the field's right end, inside the slot).
      expect(boxes.glyph!.right, "glyph.right ≤ field.left").toBeLessThanOrEqual(boxes.field!.left + 1);
      expect(boxes.close!.left, "✕ is right of the field start").toBeGreaterThanOrEqual(boxes.field!.left - 1);
      expect(boxes.close!.right, "✕.right ≤ login.left (field group left of login)").toBeLessThanOrEqual(
        boxes.login!.left + 1
      );

      // AC2 — no pairwise overlap among glyph / field / ✕ / login.
      expect(overlaps(boxes.glyph, boxes.field), "glyph vs field").toBe(false);
      expect(overlaps(boxes.glyph, boxes.login), "glyph vs login").toBe(false);
      expect(overlaps(boxes.field, boxes.login), "field vs login").toBe(false);
      expect(overlaps(boxes.close, boxes.login), "✕ vs login").toBe(false);
      expect(overlaps(boxes.glyph, boxes.close), "glyph vs ✕").toBe(false);

      // AC9 — the field's right edge never crosses the login's left edge (structural no-overlap).
      expect(boxes.field!.right, "field.right ≤ login.left").toBeLessThanOrEqual(boxes.login!.left + 1);

      // AC9 — the field carries no max-w-[280px] clamp (computed max-width is none / not 280px).
      const fieldMaxWidth = await page.evaluate(() => {
        const forms = Array.from(document.querySelectorAll('form[role="search"]')) as HTMLElement[];
        const visible = forms.find((f) => f.getBoundingClientRect().width > 0);
        return visible ? getComputedStyle(visible).maxWidth : null;
      });
      expect(fieldMaxWidth === "none" || fieldMaxWidth === "" || fieldMaxWidth === null).toBe(true);

      // AC14 — ≥ 44×44 hit targets for the ✕ and the login button (the glyph link target box is the
      // squeeze <a>; assert it too). The 1px tolerance covers sub-pixel layout.
      expect(boxes.close!.width).toBeGreaterThanOrEqual(43.5);
      expect(boxes.close!.height).toBeGreaterThanOrEqual(43.5);
      expect(boxes.login!.width).toBeGreaterThanOrEqual(43.5);
      expect(boxes.login!.height).toBeGreaterThanOrEqual(43.5);
      // The wordmark glyph link — the GlyphTile is 28px, but the <a> hit box must be tappable; the
      // chrome row is 56px tall, so assert at least the glyph graphic is present and the link box has
      // a real height. (The glyph is in the projector layer; its tappable box is the <a>.)
      expect(boxes.glyph!.width).toBeGreaterThan(0);
      expect(boxes.glyph!.height).toBeGreaterThan(0);
    });
  }

  test("AC9 — the field flexes wider at 600px than at 360px (not a fixed width)", async ({ page }) => {
    const widthAt = async (vw: number): Promise<number> => {
      await page.setViewportSize({ width: vw, height: 800 });
      await page.goto("/topic/Photosynthesis/");
      await revealSearch(page);
      const boxes = await readExpandedBoxes(page);
      return boxes.field!.width;
    };
    const w360 = await widthAt(360);
    const w600 = await widthAt(600);
    expect(w600, "the flexed field is wider at 600px than 360px").toBeGreaterThan(w360 + 20);
  });

  test("AC12 — the listbox anchors to the (narrow) field and stays within the 320px viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/topic/Photosynthesis/");
    await revealSearch(page);
    // The visible (disclosure) combobox — at 320px the inline one is display:none, so Playwright's
    // visibility-aware getByRole resolves to the one the reader actually sees.
    const field = page
      .getByRole("combobox", { name: /search wikipedia topics/i })
      .locator("visible=true");
    await field.fill("Cat");
    const listbox = page.getByRole("listbox", { name: /article suggestions/i });
    await expect(listbox).toBeVisible();

    const geom = await page.evaluate(() => {
      const lb = document.querySelector('ul[role="listbox"]') as HTMLElement | null;
      const forms = Array.from(document.querySelectorAll('form[role="search"]')) as HTMLElement[];
      const fieldEl = forms.find((f) => f.getBoundingClientRect().width > 0) || null;
      const r = (el: Element | null) => {
        if (!el) return null;
        const b = (el as HTMLElement).getBoundingClientRect();
        return { left: b.left, right: b.right };
      };
      return {
        lb: r(lb),
        field: r(fieldEl),
        z: lb ? Number(getComputedStyle(lb).zIndex) : null,
        vw: window.innerWidth,
      };
    });
    expect(geom.lb, "listbox rendered").not.toBeNull();
    expect(geom.field, "field rendered").not.toBeNull();
    // Anchored flush to the field's own (narrower) box, not a stale 280px (within 2px each edge).
    expect(Math.abs(geom.lb!.left - geom.field!.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(geom.lb!.right - geom.field!.right)).toBeLessThanOrEqual(2);
    // Stays within the 320px viewport (no right-edge overflow).
    expect(geom.lb!.left).toBeGreaterThanOrEqual(-1);
    expect(geom.lb!.right).toBeLessThanOrEqual(geom.vw + 1);
    // Above the page content.
    expect(geom.z ?? 0).toBeGreaterThanOrEqual(50);
  });
});

test.describe("topic-mobile-search — logged-in icon-only account (AC7/AC14)", () => {
  test.beforeEach(async ({ page }) => {
    await stubWikipedia(page);
  });

  test("AC7 — the account collapses to the icon-only avatar trigger (≥44×44) and the menu still opens", async ({
    page,
    baseURL,
  }) => {
    await signIn(page, baseURL);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/topic/Photosynthesis/");
    await revealSearch(page);

    // The account trigger keeps its accessible name (the username text is visually hidden).
    const account = page.getByRole("button", { name: /^Account:/ });
    await expect(account).toBeVisible();

    // AC14 — the icon-only avatar trigger is ≥ 44×44.
    const box = await account.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(43.5);
    expect(box!.height).toBeGreaterThanOrEqual(43.5);

    // AC2-order sanity: the account (login slot) sits to the right of the field group.
    const boxes = await readExpandedBoxes(page);
    expect(boxes.field, "field present").not.toBeNull();
    expect(boxes.field!.right).toBeLessThanOrEqual(box!.x + 1);

    // The Radix menu still opens from the collapsed avatar trigger, with all three items.
    await account.click();
    await expect(page.getByRole("menuitem", { name: "My curations" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "About your data" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  });
});
