import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./auth";

// E2E for the in-app skin toggle (footer placement). Covers the genuinely BROWSER-ONLY ACs the
// unit/SSR/DB tests cannot prove end to end:
//   - AC1  : the control is present + operable LOGGED-OUT and LOGGED-IN in the footer.
//   - AC2  : activating it flips data-skin LIVE with NO navigation / reload.
//   - AC5  : the choice survives a FRESH full reload (cookie → pre-paint bootstrap, first paint dark).
//   - AC11 : with no cookie, the OS prefers-color-scheme: dark default is honored client-side; an
//            explicit light cookie overrides OS-dark.
//   - AC12 : the control is keyboard-reachable + activates via Enter, flipping the skin.
//
// The toggle lives in SiteFooter (data-testid="footer-skin-toggle"). It is NOT in the header
// or the account menu — the footer is the single canonical control. Driven against the home host
// (`/`), which needs no Wikipedia/YouTube fixtures.

const FOOTER_TOGGLE = '[data-testid="footer-skin-toggle"]';

async function skinAttr(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute("data-skin"));
}

test.describe("Skin toggle — footer, logged-out (AC1/AC2/AC4/AC5/AC12)", () => {
  test("AC1/AC2 — present in footer logged-out; activating flips data-skin live with no navigation", async ({
    page,
  }) => {
    await page.goto("/");
    // Scroll to the footer so the toggle is in view.
    const toggle = page.locator(FOOTER_TOGGLE).first();
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeVisible();
    // Light is the default (no data-skin).
    expect(await skinAttr(page)).toBeNull();

    // Pin the page identity so we can prove there was no navigation/reload on the flip (AC2).
    await page.evaluate(() => {
      (window as unknown as { __nonav: boolean }).__nonav = true;
    });
    await toggle.click();
    await expect.poll(() => skinAttr(page)).toBe("zine-dark");
    // The same JS context survived (no reload would have wiped this) — proof of the LIVE flip.
    expect(
      await page.evaluate(
        () => (window as unknown as { __nonav?: boolean }).__nonav === true
      )
    ).toBe(true);

    // AC4 — the cookie is written to the chosen value.
    const cookies = await page.context().cookies();
    const skinCookie = cookies.find((c) => c.name === "wikiplus-skin");
    expect(skinCookie?.value).toBe("zine-dark");
    expect(skinCookie?.sameSite).toBe("Lax");
    expect(skinCookie?.path).toBe("/");
    expect(skinCookie?.httpOnly).toBe(false); // the pre-paint bootstrap must read it (A3.5)
  });

  test("AC5 — the chosen dark skin survives a FRESH full reload (cookie → first paint)", async ({
    page,
  }) => {
    await page.goto("/");
    const toggle = page.locator(FOOTER_TOGGLE).first();
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await expect.poll(() => skinAttr(page)).toBe("zine-dark");

    // A real full navigation: the pre-paint bootstrap must apply dark from the cookie at first paint.
    await page.reload();
    expect(await skinAttr(page)).toBe("zine-dark");
    // The footer control honestly reflects the resolved dark skin (offers "Switch to light skin").
    const reloaded = page.locator(FOOTER_TOGGLE).first();
    await reloaded.scrollIntoViewIfNeeded();
    await expect(reloaded).toHaveAttribute("aria-label", "Switch to light skin");
  });

  test("AC12 — keyboard: focus the footer control and activate with Enter to flip the skin", async ({
    page,
  }) => {
    await page.goto("/");
    const toggle = page.locator(FOOTER_TOGGLE).first();
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeVisible();
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => skinAttr(page)).toBe("zine-dark");
  });

  test("header has NO skin toggle — the footer is the single canonical control", async ({
    page,
  }) => {
    await page.goto("/");
    // data-testid="skin-toggle" was the old header chip; it must not be in the header.
    const headerToggle = page.locator('header [data-testid="skin-toggle"]');
    await expect(headerToggle).toHaveCount(0);
    // The footer-skin-toggle IS present.
    const footerToggle = page.locator(FOOTER_TOGGLE);
    await expect(footerToggle).toHaveCount(1);
  });

  test("account menu has NO skin mirror item — the footer is the single canonical control", async ({
    page,
    baseURL,
  }) => {
    await signIn(page, baseURL);
    await page.goto("/");
    const account = page.getByRole("button", { name: /^Account:/ }).first();
    await account.click();
    // The skin mirror item was removed; only "My curations", "About your data", "Sign out" remain.
    const skinItem = page.getByRole("menuitem", { name: /Switch to (dark|light) skin/i });
    await expect(skinItem).toHaveCount(0);
  });
});

test.describe("Skin toggle — OS default + override (AC11)", () => {
  test.use({ colorScheme: "dark" });

  test("AC11 — no cookie + OS dark → first paint is zine-dark (resolved client-side)", async ({
    page,
  }) => {
    await page.goto("/");
    // The pre-paint bootstrap reads matchMedia('(prefers-color-scheme: dark)') and applies dark.
    expect(await skinAttr(page)).toBe("zine-dark");
    // The footer control reflects it: it offers the way back to light.
    const toggle = page.locator(FOOTER_TOGGLE).first();
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toHaveAttribute("aria-label", "Switch to light skin");
  });

  test("AC11 — an explicit LIGHT choice overrides OS-dark across a reload", async ({
    page,
  }) => {
    await page.goto("/");
    expect(await skinAttr(page)).toBe("zine-dark"); // OS-dark default
    // Toggle to light via the footer control.
    const toggle = page.locator(FOOTER_TOGGLE).first();
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await expect.poll(() => skinAttr(page)).toBeNull();
    await page.reload();
    // Explicit light persists even though the OS is dark (the reader is never trapped).
    expect(await skinAttr(page)).toBeNull();
  });
});

test.describe("Skin toggle — logged-in (AC1)", () => {
  test("AC1 — present + operable in footer logged-in; one state, one action", async ({
    page,
    baseURL,
  }) => {
    await signIn(page, baseURL);
    await page.goto("/");

    // The footer control is present logged-in too.
    const toggle = page.locator(FOOTER_TOGGLE).first();
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect.poll(() => skinAttr(page)).toBe("zine-dark");

    // Toggle back to light via the footer.
    await toggle.click();
    await expect.poll(() => skinAttr(page)).toBeNull();
  });
});
