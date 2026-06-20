import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// AuthControl + LoginPrompt component tests (issue C). The auth client surface
// (`useSession` / `signIn` / `signOut`) is mocked here PER-TEST so we can drive the
// signed-out / signed-in / loading states — no live OAuth, no SessionProvider needed (AC13).
// These exercise the header affordance microcopy (AC1/AC2/§5) + the logged-out gate (AC10).

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

// D3 (issue #54): SignedIn now navigates to the viewer's own profile via useRouter().push
// for the "My curations" entry. Mock next/navigation's router so the menu item is testable.
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

import { AuthControl } from "@/components/auth/AuthControl";
import { LoginPromptPanel } from "@/components/auth/LoginPrompt";

beforeEach(() => {
  signIn.mockReset();
  signOut.mockReset();
  routerPush.mockReset();
  Object.defineProperty(window, "location", {
    value: { pathname: "/topic/Cat/", search: "" },
    writable: true,
  });
});
afterEach(() => vi.clearAllMocks());

describe("AuthControl — signed-out (AC1 / §5 microcopy)", () => {
  beforeEach(() => {
    sessionState = { data: null, status: "unauthenticated" };
  });

  it("renders the verbatim 'Log in with Wikipedia' button on the home variant", () => {
    render(<AuthControl variant="home" />);
    expect(
      screen.getByRole("button", { name: "Log in with Wikipedia" })
    ).toBeInTheDocument();
  });

  it("starts the Wikimedia OAuth round-trip with the current page as callbackUrl", () => {
    render(<AuthControl variant="home" />);
    fireEvent.click(screen.getByRole("button", { name: /log in with wikipedia/i }));
    expect(signIn).toHaveBeenCalledWith("wikimedia", {
      callbackUrl: "/topic/Cat/",
    });
  });

  it("the compact (narrow Topic header) variant keeps an accessible 'Log in with Wikipedia' name", () => {
    render(<AuthControl variant="topic-compact" />);
    expect(
      screen.getByRole("button", { name: "Log in with Wikipedia" })
    ).toBeInTheDocument();
  });

  // topic-mobile-search §3.3 / AC6 — while the narrow search disclosure is open the login collapses
  // to icon-only ("W"), but the accessible name must NOT degrade.
  it("the icon-only (forceIconOnly) compact login keeps the full 'Log in with Wikipedia' name and hides the visible word", () => {
    render(<AuthControl variant="topic-compact" forceIconOnly />);
    const btn = screen.getByRole("button", { name: "Log in with Wikipedia" });
    expect(btn).toBeInTheDocument();
    // The visible "Log in" word is hidden (a span with the `hidden` utility), not removed — the
    // SSR/hydration markup is identical, only the visibility differs.
    const word = btn.querySelector("span.hidden");
    expect(word?.textContent).toBe("Log in");
  });
});

describe("AuthControl — signed-in (AC2 / AC5)", () => {
  beforeEach(() => {
    sessionState = {
      data: { user: { username: "Ragesoss" } },
      status: "authenticated",
    };
  });

  it("shows the real Wikimedia username (not @sage / @prototype / anonymous)", () => {
    render(<AuthControl variant="home" />);
    expect(screen.getByText("Ragesoss")).toBeInTheDocument();
    expect(screen.queryByText("@sage")).toBeNull();
    expect(screen.queryByText("@prototype")).toBeNull();
    // No "Log in" button while signed in.
    expect(screen.queryByRole("button", { name: /log in/i })).toBeNull();
  });

  // topic-mobile-search §3.3 / AC7 — icon-only account (narrow search open): the avatar + ▾ stay,
  // the username text is hidden UNCONDITIONALLY (not `sm:inline`), the accessible name is preserved.
  it("the icon-only (forceIconOnly) compact account keeps 'Account: {username}' and hides the username word up to < md", () => {
    render(<AuthControl variant="topic-compact" forceIconOnly />);
    const trigger = screen.getByRole("button", { name: "Account: Ragesoss" });
    expect(trigger).toBeInTheDocument();
    // The username span is hidden outright (no `sm:inline`), so it never re-appears in the
    // 640–767px band where the disclosure can still be open.
    const nameSpan = screen.getByText("Ragesoss");
    expect(nameSpan).toHaveClass("hidden");
    expect(nameSpan.className).not.toContain("sm:inline");
  });

  it("the account control is a labeled disclosure following the menu-button ARIA pattern", () => {
    // The Radix portal/menu open is driven by pointer mechanics jsdom lacks (ResizeObserver /
    // PointerEvent); the a11y CONTRACT we assert here is the trigger: an accessible
    // "Account: {username}" name + aria-haspopup="menu" + aria-expanded. The actual
    // open/Sign-out flow is exercised by UX's running-app evaluation (§10) / e2e.
    render(<AuthControl variant="home" />);
    const trigger = screen.getByRole("button", { name: "Account: Ragesoss" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  // QA-added (AC5): the dev only asserted the trigger's ARIA contract, leaving the actual
  // Sign-out invocation unverified. Radix DOES open via KEYBOARD under jsdom (Enter on the
  // menu-button), so the sign-out path is testable without a running app. This closes the
  // gap: opening the menu and activating "Sign out" must call signOut({ callbackUrl: "/" })
  // — the call that clears the session and returns the UI to the anonymous state (AC5).
  it("opening the menu and activating 'Sign out' calls signOut({ callbackUrl: '/' }) (AC5)", async () => {
    render(<AuthControl variant="home" />);
    const trigger = screen.getByRole("button", { name: "Account: Ragesoss" });
    // Keyboard-open the menu-button (WAI-ARIA: Enter opens), then click the item.
    fireEvent.keyDown(trigger, { key: "Enter" });
    const item = await screen.findByText("Sign out");
    fireEvent.click(item);
    await waitFor(() =>
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
    );
  });

  // D3 (issue #54, AC5): the SignedIn menu offers "My curations" → the viewer's OWN profile.
  it("opening the menu and activating 'My curations' navigates to the viewer's own profile (AC5)", async () => {
    render(<AuthControl variant="home" />);
    const trigger = screen.getByRole("button", { name: "Account: Ragesoss" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const item = await screen.findByText("My curations");
    fireEvent.click(item);
    await waitFor(() => expect(routerPush).toHaveBeenCalledTimes(1));
    // In-SPA navigation to the viewer's own /contributor/<own-username> (slash-tolerant).
    expect(routerPush.mock.calls[0][0]).toMatch(/^\/contributor\/Ragesoss\/?$/);
  });
});

describe("AuthControl — signed-out has NO 'My curations' entry (AC5)", () => {
  beforeEach(() => {
    sessionState = { data: null, status: "unauthenticated" };
  });
  it("renders no account menu (so no My curations) when signed out", () => {
    render(<AuthControl variant="home" />);
    // Signed-out renders the login button, not the account trigger — the menu (and its
    // "My curations" item) only mounts for a signed-in user (it needs the username).
    expect(screen.queryByText("My curations")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Account:/ })
    ).toBeNull();
  });
});

describe("AuthControl — loading (§7 no-flash)", () => {
  it("renders a neutral placeholder (NOT the 'Log in' button) while the session resolves", () => {
    sessionState = { data: null, status: "loading" };
    render(<AuthControl variant="home" />);
    expect(screen.queryByRole("button", { name: /log in/i })).toBeNull();
  });
});

describe("LoginPromptPanel — the /contribute gate (AC10 / §5)", () => {
  it("shows the verbatim gate copy + the login button + a back-to-topics link", () => {
    render(
      <LoginPromptPanel
        title="Log in with Wikipedia to contribute"
        body="Contributing — adding a clip and writing its context note — requires a Wikipedia login, so your curation is tied to your Wikimedia identity. Reading stays anonymous."
        secondaryHref="/"
        secondaryLabel="Browse topics instead →"
      />
    );
    expect(
      screen.getByText("Log in with Wikipedia to contribute")
    ).toBeInTheDocument();
    expect(screen.getByText(/Reading stays anonymous\./)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /log in with wikipedia/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse topics instead →" })
    ).toBeInTheDocument();
  });

  it("surfaces an OAuth-return error notice when one is passed (§4)", () => {
    render(
      <LoginPromptPanel
        title="Log in with Wikipedia to contribute"
        body="…"
        error="Login cancelled. You can try again whenever you're ready."
      />
    );
    expect(
      screen.getByText("Login cancelled. You can try again whenever you're ready.")
    ).toBeInTheDocument();
  });
});
