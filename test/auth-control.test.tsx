import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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

import { AuthControl } from "@/components/auth/AuthControl";
import { LoginPromptPanel } from "@/components/auth/LoginPrompt";

beforeEach(() => {
  signIn.mockReset();
  signOut.mockReset();
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
