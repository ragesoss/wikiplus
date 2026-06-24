import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// Skin toggle component tests. These cover the AC the controls themselves are responsible for:
// the destination microcopy + full aria-label per resolved skin (AC13), NO `aria-pressed`/
// `role="switch"` (§5.3), the LIVE in-place `data-skin` flip + the cookie write on activation
// (AC2/AC3/AC4), the no-flash first-frame deferral (§4.5), and the fire-and-forget DB persist
// that never gates the visual switch (§6.1 / §4.6).
//
// The toggle is now in the FOOTER (SiteFooter → FooterSkinToggle) rather than the header.
// The account-menu mirror item was removed when the footer became the canonical control.
//
// The data seam is mocked so the toggle's DB persist does not reach the Server Action boundary;
// the DB round-trip itself is verified against the real DrizzleDataStore in
// test/skin-preference-db.test.ts.

const setSkinPreference = vi.fn((_skin: string | null) => Promise.resolve());
vi.mock("@/lib/data", () => ({
  store: { setSkinPreference: (skin: string | null) => setSkinPreference(skin) },
}));

// FooterSkinToggle — the canonical footer control.
import { FooterSkinToggle } from "@/components/chrome/FooterSkinToggle";
// SiteFooter — the host; the toggle is embedded inside it.
import { SiteFooter } from "@/components/chrome/SiteFooter";

function clearSkin() {
  document.documentElement.removeAttribute("data-skin");
  // Clear any cookie a prior test wrote.
  document.cookie = "wikiplus-skin=; Max-Age=0; Path=/";
}

beforeEach(() => {
  setSkinPreference.mockClear();
  clearSkin();
});
afterEach(() => clearSkin());

// ── FooterSkinToggle — placement and microcopy ────────────────────────────────────────────────
describe("FooterSkinToggle — the canonical footer skin control", () => {
  it("is present in SiteFooter as a button — reachable logged-out (AC1)", async () => {
    render(<SiteFooter />);
    const footer = screen.getByRole("contentinfo");
    const btn = await within(footer).findByRole("button", { name: "Switch to dark skin" });
    expect(btn).toBeInTheDocument();
  });

  it("shows the destination word 'Dark' and aria-label 'Switch to dark skin' on light skin (AC13/§5.1)", async () => {
    render(<FooterSkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to dark skin" });
    await waitFor(() => expect(btn).toHaveTextContent("Dark"));
    expect(btn).toHaveAttribute("aria-label", "Switch to dark skin");
  });

  it("shows 'Light' / 'Switch to light skin' when dark is active (§4.5 honesty)", async () => {
    document.documentElement.setAttribute("data-skin", "zine-dark");
    render(<FooterSkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to light skin" });
    await waitFor(() => expect(btn).toHaveTextContent("Light"));
  });

  it("is a plain toggle BUTTON — no role='switch', no aria-pressed (§5.3)", async () => {
    render(<FooterSkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to dark skin" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn.getAttribute("role")).not.toBe("switch");
    expect(btn).not.toHaveAttribute("aria-pressed");
    expect(btn).not.toBeDisabled(); // no disabled state (§4.6)
  });

  it("has a ≥ 44px touch target (min-h-[44px]) — comfortable alongside the footer link", async () => {
    render(<FooterSkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to dark skin" });
    expect(btn.className).toContain("min-h-[44px]");
  });

  it("always shows the visible word (the footer form is never icon-only)", async () => {
    render(<FooterSkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to dark skin" });
    // The footer control always shows the text word — no collapsed/icon-only state.
    await waitFor(() => {
      expect(btn.textContent).toMatch(/Dark|Light/);
    });
    // There should be no hidden span with the word.
    const hiddenWord = btn.querySelector("span.hidden");
    expect(hiddenWord).toBeNull();
  });

  it("carries data-testid='footer-skin-toggle'", async () => {
    render(<FooterSkinToggle />);
    await screen.findByTestId("footer-skin-toggle");
  });
});

// ── FooterSkinToggle — the live switch (AC2/AC3/AC4) ─────────────────────────────────────────
describe("FooterSkinToggle — the live switch", () => {
  it("flips data-skin on <html> IN PLACE light→dark and writes the wikiplus-skin cookie (AC2/AC3/AC4)", async () => {
    render(<FooterSkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to dark skin" });
    fireEvent.click(btn);
    expect(document.documentElement.getAttribute("data-skin")).toBe("zine-dark");
    expect(document.cookie).toContain("wikiplus-skin=zine-dark");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Switch to light skin" })).toBeInTheDocument()
    );
  });

  it("flips dark→light by removing data-skin and writes zine cookie (AC15)", async () => {
    document.documentElement.setAttribute("data-skin", "zine-dark");
    render(<FooterSkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to light skin" });
    fireEvent.click(btn);
    expect(document.documentElement.hasAttribute("data-skin")).toBe(false);
    expect(document.cookie).toContain("wikiplus-skin=zine");
  });

  it("persists the choice to the DB seam fire-and-forget (§6.1) — does NOT gate the visual switch", async () => {
    render(<FooterSkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to dark skin" });
    fireEvent.click(btn);
    await waitFor(() => expect(setSkinPreference).toHaveBeenCalledWith("zine-dark"));
  });
});

