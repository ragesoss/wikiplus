import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// Issue #50 — the signed-out "Log in with Wikipedia" button sets a local `connecting`
// state on click (label → "Connecting…", disabled, aria-busy) then full-page-redirects to
// meta.wikimedia.org. On browser Back the page restores from the bfcache with React state
// intact, leaving the button stuck "Connecting…"/disabled. The fix (commit acce423) resets
// `connecting` on the `window` `pageshow` event (which fires on bfcache restore).
//
// These are the acceptance-criterion tests:
//   AC1 — after click + back-navigation (a `pageshow`), the button reads "Log in with
//         Wikipedia", is enabled, and aria-busy is cleared (+ the listener is cleaned up).
//   AC2 — a fresh click still starts the redirect: signIn("wikimedia", { callbackUrl }) once,
//         with the click setting the "Connecting…"/disabled state.
//
// The auth client surface is mocked PER-FILE (overriding the shared setup default) so we can
// drive the signed-out state and spy on `signIn` — no live OAuth, no SessionProvider needed.

const signIn = vi.fn();
const signOut = vi.fn();
let sessionState: {
  data: { user: { username?: string } } | null;
  status: "authenticated" | "unauthenticated" | "loading";
} = { data: null, status: "unauthenticated" };

vi.mock("next-auth/react", () => ({
  useSession: () => sessionState,
  signIn: (...a: unknown[]) => signIn(...a),
  signOut: (...a: unknown[]) => signOut(...a),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

// SignedIn uses next/navigation's router; the signed-out path under test doesn't, but the
// module is imported, so provide the same stub the sibling auth-control test uses.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { AuthControl } from "@/components/auth/AuthControl";

beforeEach(() => {
  signIn.mockReset();
  signOut.mockReset();
  sessionState = { data: null, status: "unauthenticated" };
  // currentCallbackUrl() reads window.location.{pathname,search} at click time.
  Object.defineProperty(window, "location", {
    value: { pathname: "/topic/Cat/", search: "" },
    writable: true,
  });
});
afterEach(() => vi.clearAllMocks());

describe("AuthControl — connecting-state reset on bfcache restore (issue #50)", () => {
  // AC1 — after click + back-navigation (pageshow), the button is restored to its idle state.
  //
  // NOTE on the accessible name: on the `home` variant the button carries a stable
  // aria-label "Log in with Wikipedia" (responsiveLabel branch), so the ACCESSIBLE NAME stays
  // "Log in with Wikipedia" in both the idle and the connecting state — the visible TEXT is
  // what swaps ("Log in with Wikipedia" ↔ "Connecting…"). So AC1 asserts the connecting state
  // via the visible text + disabled + aria-busy, and the reset via those returning to idle.
  it("AC1: a pageshow (bfcache restore) clears the stuck 'Connecting…' state back to an enabled 'Log in with Wikipedia'", () => {
    render(<AuthControl variant="home" />);

    // Click → "Connecting…", disabled, aria-busy (the pre-redirect state that bfcache freezes).
    const btn = screen.getByRole("button", { name: "Log in with Wikipedia" });
    fireEvent.click(btn);
    expect(btn).toHaveTextContent("Connecting…");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");

    // Simulate the browser Back / bfcache restore: a `pageshow` on window.
    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });

    // The button is back to its idle, enabled state — visible word restored, aria-busy gone.
    const after = screen.getByRole("button", { name: "Log in with Wikipedia" });
    expect(after).toHaveTextContent("Log in with Wikipedia");
    expect(after).not.toHaveTextContent("Connecting…");
    expect(after).toBeEnabled();
    expect(after).toHaveAttribute("aria-busy", "false");
  });

  // AC1 (cleanup) — the listener must be removed on unmount so a later pageshow does not fire a
  // setState on an unmounted component (no error / act warning).
  it("AC1: the pageshow listener is removed on unmount (no setState-after-unmount on a later pageshow)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<AuthControl variant="home" />);
    unmount();

    // A pageshow after unmount must be a no-op (the listener was cleaned up).
    expect(() =>
      act(() => {
        window.dispatchEvent(new Event("pageshow"));
      })
    ).not.toThrow();
    // No React "setState on unmounted component" / act warning was emitted.
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  // AC2 — the fresh redirect path is unchanged: one signIn with the wikimedia provider + the
  // current page as callbackUrl, and the click sets the "Connecting…"/disabled state.
  it("AC2: a fresh click still starts the Wikimedia OAuth redirect (signIn once with the current-page callbackUrl) and enters the connecting state", () => {
    render(<AuthControl variant="home" />);

    fireEvent.click(screen.getByRole("button", { name: /log in with wikipedia/i }));

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledWith("wikimedia", {
      callbackUrl: "/topic/Cat/",
    });

    // The click also entered the connecting state (visible word → "Connecting…", disabled) — the
    // pre-redirect UI the fix later releases on bfcache restore is still set on a fresh click.
    const btn = screen.getByRole("button", { name: "Log in with Wikipedia" });
    expect(btn).toHaveTextContent("Connecting…");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });
});
