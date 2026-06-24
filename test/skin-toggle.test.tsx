import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// SkinToggle component tests (issue #143, docs/design/skin-toggle.md). These cover the AC the control
// itself is responsible for: the destination microcopy + full aria-label per resolved skin (AC13),
// NO `aria-pressed`/`role="switch"` (§5.3), the LIVE in-place `data-skin` flip + the cookie write on
// activation (AC2/AC3/AC4), the no-flash first-frame deferral (§4.5), the icon-only collapse (§7),
// and the fire-and-forget DB persist that never gates the visual switch (§6.1 / §4.6).
//
// The data seam is mocked so the toggle's DB persist does not reach the Server Action boundary; the
// DB round-trip itself is verified against the real DrizzleDataStore in test/skin-preference-db.test.ts.

const setSkinPreference = vi.fn((_skin: string | null) => Promise.resolve());
vi.mock("@/lib/data", () => ({
  store: { setSkinPreference: (skin: string | null) => setSkinPreference(skin) },
}));

import { SkinToggle } from "@/components/header/SkinToggle";

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

describe("SkinToggle — light active (resolved skin = light zine)", () => {
  it("shows the destination word 'Dark' and the full aria-label 'Switch to dark skin' (AC13 / §5.1)", async () => {
    render(<SkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to dark skin" });
    expect(btn).toBeInTheDocument();
    // The visible word is the DESTINATION (one tap away), not the current skin.
    await waitFor(() => expect(btn).toHaveTextContent("Dark"));
  });

  it("is a plain toggle BUTTON — NO role='switch', NO aria-pressed (§5.3)", async () => {
    render(<SkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to dark skin" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn.getAttribute("role")).not.toBe("switch");
    expect(btn).not.toHaveAttribute("aria-pressed");
    expect(btn).not.toBeDisabled(); // no disabled state (§4.6)
  });
});

describe("SkinToggle — dark active (resolved skin = zine-dark)", () => {
  beforeEach(() => document.documentElement.setAttribute("data-skin", "zine-dark"));

  it("reads the RESOLVED dark skin on mount and shows 'Light' / 'Switch to light skin' (§4.5 honesty)", async () => {
    render(<SkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to light skin" });
    await waitFor(() => expect(btn).toHaveTextContent("Light"));
  });
});

describe("SkinToggle — the live switch (AC2/AC3/AC4)", () => {
  it("flips data-skin on <html> IN PLACE light→dark and writes the wikiplus-skin cookie", async () => {
    render(<SkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to dark skin" });
    fireEvent.click(btn);
    // Live flip on the existing DOM — no reload (the test never navigates).
    expect(document.documentElement.getAttribute("data-skin")).toBe("zine-dark");
    expect(document.cookie).toContain("wikiplus-skin=zine-dark");
    // The control reflects the new state (now offers the reverse).
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Switch to light skin" })
      ).toBeInTheDocument()
    );
  });

  it("flips dark→light by REMOVING data-skin (the byte-identical light render returns — AC15) and writes zine", async () => {
    document.documentElement.setAttribute("data-skin", "zine-dark");
    render(<SkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to light skin" });
    fireEvent.click(btn);
    expect(document.documentElement.hasAttribute("data-skin")).toBe(false);
    // The explicit light choice is stored as `zine` so it overrides the OS dark default (§6.2).
    expect(document.cookie).toContain("wikiplus-skin=zine");
  });

  it("persists the choice to the DB seam fire-and-forget (§6.1) — and does NOT gate the visual switch", async () => {
    render(<SkinToggle />);
    const btn = await screen.findByRole("button", { name: "Switch to dark skin" });
    fireEvent.click(btn);
    // The visual switch already happened synchronously above; the persist is called with the new skin.
    await waitFor(() =>
      expect(setSkinPreference).toHaveBeenCalledWith("zine-dark")
    );
  });
});

describe("SkinToggle — icon-only collapse (§7.4)", () => {
  it("hides the visible word but keeps the full aria-label and a 44px-min square", async () => {
    render(<SkinToggle iconOnly />);
    const btn = await screen.findByRole("button", { name: "Switch to dark skin" });
    // The word is in the DOM but hidden (SSR-identical markup) — never removed.
    const word = btn.querySelector("span.hidden");
    expect(word?.textContent).toBe("Dark");
    expect(btn.className).toContain("min-w-[44px]");
  });
});
