import { expect, test, type Page } from "@playwright/test";
import { stubCommon } from "./fixtures";

// #72 fix-round evidence (DEFECT-A + DEFECT-B). Real-browser capture, against the Node SSR server
// with the in-spec Wikipedia/Wikidata/YouTube stubs (no network egress — e2e/fixtures-contract.md)
// and the seeded ephemeral Postgres (globalSetup). It drives the seeded "Photosynthesis" topic
// (curated, so its header renders the same in every session) at the narrow widths the reviewers
// flagged and asserts + screenshots:
//   • DEFECT-A — at 320/360/375/390px, Tier A AND slim, the upper-left search magnifier / inline
//     field is fully visible and HITTABLE (a real click reaches it — it is no longer behind the
//     wordmark, and the invisible Tier-A overlay no longer steals the tap), and nothing overlaps it.
//   • DEFECT-B — a mid-transition frame shows NO two-wordmark ghost: there is exactly one accessible
//     "wiki+" link, and the lit + flat lockups are co-located at one origin (asserted geometrically).

const PHOTOSYNTHESIS_HTML = `<!DOCTYPE html><html><body>
  <section><p>Photosynthesis is the process used by plants. It is a long article so the page
  scrolls well past the header collapse threshold for the slim-state captures below.</p>
  ${Array.from({ length: 40 })
    .map((_, i) => `<section data-mw-section-id="${i + 1}"><h2 id="s${i}">Section ${i}</h2><p>Body text for section ${i}, repeated to give the article real scroll height for the slim-state and mid-transition captures.</p></section>`)
    .join("")}
</body></html>`;

async function stubWikipedia(page: Page) {
  await stubCommon(page, {
    wikidata: { Q11982: "Photosynthesis" },
    resolve: () => ({ title: "Photosynthesis", qid: "Q11982" }),
    youtube: () => [],
  });
  await page.route("**/api/rest_v1/page/html/**", (route) => {
    route.fulfill({ contentType: "text/html", body: PHOTOSYNTHESIS_HTML });
  });
}

// The widths the reviewers flagged (DEFECT-A): 320 + 360 are the squeeze band (Tier-D glyph), 375 +
// 390 sit at/above the squeeze threshold (380) so the self-contained lockup is anchored past the
// reserved search box. All four must keep the search visible + hittable in BOTH scroll states.
const NARROW_WIDTHS = [320, 360, 375, 390];

test.describe("#72 DEFECT-A — narrow-width search is visible + hittable (Tier A and slim)", () => {
  test.beforeEach(async ({ page }) => {
    await stubWikipedia(page);
  });

  for (const width of NARROW_WIDTHS) {
    test(`width ${width}px: search reachable at Tier A and slim; no overlap`, async ({ page }) => {
      await page.setViewportSize({ width, height: 760 });
      await page.goto("/topic/Photosynthesis/");
      // The header is present.
      const header = page.locator("header.header-shared");
      await expect(header).toBeVisible();
      // Wait for the article body so the document has real scroll height (the slim-state capture
      // below scrolls past the collapse threshold).
      await expect(page.locator("h1")).toBeVisible();

      // The reviewers' DEFECT-A: in the DEFAULT (collapsed) search state the < md disclosure
      // magnifier ("Search topics") was hidden behind "Wiki" and the invisible Tier-A overlay link
      // stole the tap. The fix must make the magnifier fully visible AND tappable in BOTH scroll
      // states. We assert a real tap LANDS on the trigger (Playwright hit-tests, so a click that
      // doesn't throw "intercepts pointer events" proves nothing covers it), and that the trigger's
      // box does not overlap the wordmark/auth boxes.

      const assertNoOverlapWithMark = async () => {
        // The search trigger box must not overlap the wordmark home link box nor the auth box.
        const boxes = await page.evaluate(() => {
          const r = (sel: string) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
          };
          return {
            search: r('button[aria-label="Search topics"]'),
            // The wordmark home link (flat lockup at ≥ squeeze, or the glyph tile < squeeze).
            mark: r('a[aria-label="wiki+"]'),
            auth: r('header.header-shared [aria-label="Log in with Wikipedia"]'),
          };
        });
        const overlaps = (
          a: { left: number; right: number; top: number; bottom: number } | null,
          b: { left: number; right: number; top: number; bottom: number } | null
        ) =>
          !!a &&
          !!b &&
          a.left < b.right - 1 &&
          a.right > b.left + 1 &&
          a.top < b.bottom - 1 &&
          a.bottom > b.top + 1;
        expect(boxes.search).not.toBeNull();
        expect(overlaps(boxes.search, boxes.mark)).toBe(false);
        expect(overlaps(boxes.search, boxes.auth)).toBe(false);
      };

      // ── Tier A (scroll-top) ──────────────────────────────────────────────────────────────────
      await page.evaluate(() => window.scrollTo(0, 0));
      const trigger = page.getByRole("button", { name: /search topics/i });
      await expect(trigger).toBeVisible();
      await assertNoOverlapWithMark();
      await page.screenshot({
        path: `screenshots/72-defectA-${width}-tierA.png`,
        clip: { x: 0, y: 0, width, height: 130 },
      });
      // A real tap lands on the trigger (would throw "intercepts pointer events" if anything covered
      // it — the DEFECT-A regression). It reveals the field; we re-collapse via Escape (the #12
      // model) so the slim capture starts clean, NOT a close-click (which the §5.5 revealed-field
      // squeeze can crowd — that crowding is the separate, design-sanctioned caveat, not DEFECT-A).
      await trigger.click();
      await expect(page.getByRole("button", { name: /close search/i })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeVisible();

      // ── Slim (scrolled past the collapse threshold) ──────────────────────────────────────────
      // Scroll well past burnY (104); poll for the slim end-state. #96 replaced the boolean
      // `data-collapsed` flip with a continuous, scroll-linked `p` written as a CSS var, so we poll
      // `--p` reaching 1 (the slim end). Retry the scroll if the first didn't take (timing on the
      // slowest widths).
      await expect(async () => {
        await page.evaluate(() => window.scrollTo(0, 700));
        const p = await header.evaluate(
          (el) => (el as HTMLElement).style.getPropertyValue("--p").trim()
        );
        expect(Number(p)).toBeGreaterThan(0.99);
      }).toPass({ timeout: 8000 });
      const triggerSlim = page.getByRole("button", { name: /search topics/i });
      await expect(triggerSlim).toBeVisible();
      await assertNoOverlapWithMark();
      // Settle on the slim END-STATE before capturing (the glow has faded; the flat card remains).
      await page.waitForTimeout(300);
      const slimLayers = await page.evaluate(() => {
        const op = (sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          return el ? Number(getComputedStyle(el).opacity) : null;
        };
        return {
          beam: op(".projector-beamfade"),
          lit: op(".projector-litlockup"),
          flat: op(".projector-flatlockup"),
          glyph: !!document.querySelector("[data-projector-squeeze]"),
        };
      });
      if (width < 380) {
        // Squeeze (< SQUEEZE_BREAKPOINT): the wordmark is the Tier-D glyph tile (no beam / no full
        // lockup), so the search has maximum room. The cross-fade layers do not exist here.
        expect(slimLayers.glyph).toBe(true);
      } else {
        // Above the squeeze: the decorative glow layers (beam + lit aperture) have faded to ~0 in
        // the slim end-state; the always-opaque flat card is all that remains (no orphaned glow).
        expect(slimLayers.beam ?? 1).toBeLessThan(0.05);
        expect(slimLayers.lit ?? 1).toBeLessThan(0.05);
        expect(slimLayers.flat ?? 0).toBeGreaterThan(0.95);
      }
      await page.screenshot({
        path: `screenshots/72-defectA-${width}-slim.png`,
        clip: { x: 0, y: 0, width, height: 70 },
      });
      await triggerSlim.click(); // a landed click proves the search is hittable in the slim bar too
      await expect(page.getByRole("button", { name: /close search/i })).toBeVisible();

      // Exactly one accessible "wiki+" home link (no double wordmark — DEFECT-B, here too).
      await expect(page.getByRole("link", { name: "wiki+" })).toHaveCount(1);
    });
  }
});

test.describe("#72 DEFECT-B — single-origin cross-fade (no double wordmark)", () => {
  test.beforeEach(async ({ page }) => {
    await stubWikipedia(page);
  });

  test("a mid-transition frame shows ONE wordmark; lit + flat lockups share one origin", async ({
    page,
  }) => {
    // A wide viewport so the seam-on-divider geometry is in play (≥ lg) — the case where the old
    // build drew the two lockups ~406px apart. The fix co-locates them at one origin.
    await page.setViewportSize({ width: 1280, height: 900 });
    await stubWikipedia(page);
    await page.goto("/topic/Photosynthesis/");
    const header = page.locator("header.header-shared");
    await expect(header).toBeVisible();

    // Exactly ONE accessible wordmark link — never two (the lit overlay is decorative now).
    await expect(page.getByRole("link", { name: "wiki+" })).toHaveCount(1);

    // The lit + flat lockups are positioned at the IDENTICAL inline origin (left + transform), so
    // the glow fades over the opaque card with no position change. Read both layers' computed left
    // edge: equal ⇒ no double-vision teleport at any opacity between the end-states.
    const origins = await page.evaluate(() => {
      const lit = document.querySelector(".projector-litlockup") as HTMLElement | null;
      const flat = document.querySelector(".projector-flatlockup") as HTMLElement | null;
      if (!lit || !flat) return null;
      const lr = lit.getBoundingClientRect();
      const fr = flat.getBoundingClientRect();
      return { litLeft: lr.left, flatLeft: fr.left, litTop: lr.top, flatTop: fr.top };
    });
    expect(origins).not.toBeNull();
    // Same horizontal + vertical origin within a sub-pixel tolerance → one mark, two opacities.
    expect(Math.abs(origins!.litLeft - origins!.flatLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(origins!.litTop - origins!.flatTop)).toBeLessThanOrEqual(1);

    // Capture a MID-TRANSITION frame: scroll into the transition zone and screenshot while the glow
    // is partially faded over the opaque card (co-located → reads as ONE mark, the glow lifting off a
    // stable card, not two ghosting apart).
    await page.evaluate(() => window.scrollTo(0, 130));
    await page.screenshot({
      path: "screenshots/72-defectB-midtransition.png",
      clip: { x: 0, y: 0, width: 1280, height: 130 },
    });
  });
});
