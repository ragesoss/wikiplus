import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

// QA (issue #143) — AC6/AC7/AC8: the DB→cookie mirror at login (components/header/SkinSync.tsx,
// spec §6.1). When a session resolves carrying a stored `skinPreference`, SkinSync mirrors it into
// the `wikiplus-skin` cookie (and flips `data-skin` live) so the next paint's pre-paint bootstrap
// reads the cookie alone — making a fresh browser/device that logs in end up in the user's stored
// skin (the cross-session restore). It NEVER touches server markup (AC9/AC10): it runs client-side
// after the session resolves. The CONFLICT RULE (spec §6.1) requires the mirror to fire AT MOST ONCE
// per established session, so a later same-device toggle (which writes a newer cookie) is never
// re-stomped by this effect.

// Drive `useSession` per-test (the established next-auth/react mock pattern).
let sessionState: {
  data: { user: { skinPreference?: string } } | null;
  status: "authenticated" | "unauthenticated" | "loading";
} = { data: null, status: "unauthenticated" };
vi.mock("next-auth/react", () => ({
  useSession: () => sessionState,
}));

import { SkinSync } from "@/components/header/SkinSync";

function getCookie(): string | null {
  const m = document.cookie.match(/(?:^|; )wikiplus-skin=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function clearAll() {
  document.documentElement.removeAttribute("data-skin");
  document.cookie = "wikiplus-skin=; Max-Age=0; Path=/";
}

beforeEach(clearAll);
afterEach(clearAll);

describe("SkinSync — DB→cookie mirror at login (AC6/AC7/AC8)", () => {
  it("mirrors a stored dark preference into the cookie + flips data-skin live (cookieless login)", async () => {
    // A fresh browser/device with NO wikiplus-skin cookie logs in as a user whose DB pref is dark.
    sessionState = {
      data: { user: { skinPreference: "zine-dark" } },
      status: "authenticated",
    };
    render(<SkinSync />);
    await waitFor(() => expect(getCookie()).toBe("zine-dark"));
    // The current paint is corrected too (not just the next navigation) — AC8.
    expect(document.documentElement.getAttribute("data-skin")).toBe("zine-dark");
  });

  it("does nothing when there is no stored preference (falls through to cookie/OS default)", async () => {
    sessionState = {
      data: { user: { skinPreference: undefined } },
      status: "authenticated",
    };
    render(<SkinSync />);
    // Give the effect a tick; it must not write a cookie or touch data-skin.
    await new Promise((r) => setTimeout(r, 20));
    expect(getCookie()).toBeNull();
    expect(document.documentElement.hasAttribute("data-skin")).toBe(false);
  });

  it("no-ops when the cookie already carries the stored preference (already painted correctly)", async () => {
    document.cookie = "wikiplus-skin=zine-dark; Path=/";
    sessionState = {
      data: { user: { skinPreference: "zine-dark" } },
      status: "authenticated",
    };
    render(<SkinSync />);
    await new Promise((r) => setTimeout(r, 20));
    // Cookie unchanged; SkinSync did not need to re-apply (the bootstrap already painted dark).
    expect(getCookie()).toBe("zine-dark");
  });

  it("CONFLICT RULE: mirrors at most once — a later same-device toggle is not re-stomped", async () => {
    sessionState = {
      data: { user: { skinPreference: "zine-dark" } },
      status: "authenticated",
    };
    const { rerender } = render(<SkinSync />);
    await waitFor(() => expect(getCookie()).toBe("zine-dark"));
    // The user then toggles back to light on this device (the toggle writes the cookie itself).
    document.cookie = "wikiplus-skin=zine; Path=/";
    document.documentElement.removeAttribute("data-skin");
    // A re-render with the SAME established session (the DB pref is still the older dark value) must
    // NOT re-mirror DB→cookie and clobber the user's newer explicit light choice (spec §6.1 once-guard).
    rerender(<SkinSync />);
    await new Promise((r) => setTimeout(r, 20));
    expect(getCookie()).toBe("zine"); // the newer same-device toggle stands
    expect(document.documentElement.hasAttribute("data-skin")).toBe(false);
  });

  it("does nothing while the session is still loading / unauthenticated", async () => {
    sessionState = { data: null, status: "loading" };
    const { rerender } = render(<SkinSync />);
    await new Promise((r) => setTimeout(r, 20));
    expect(getCookie()).toBeNull();
    sessionState = { data: null, status: "unauthenticated" };
    rerender(<SkinSync />);
    await new Promise((r) => setTimeout(r, 20));
    expect(getCookie()).toBeNull();
    expect(document.documentElement.hasAttribute("data-skin")).toBe(false);
  });
});
