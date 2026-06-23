import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Issue #66 — QA-added coverage that maps the ACs the Dev head-start suite (data-notice.test.tsx)
// did NOT cover. The Dev suite covered the gate disclosure copy/link (AC1/AC3–AC5), the
// /about/data heading structure + copy (AC2/AC3–AC6), and the footer link ON that page. This file
// closes the remaining verifiable gaps for the release gate:
//   - AC1: the gate disclosure is ALWAYS present (no toggle) and sits below the gate {body}.
//   - AC2: the SiteFooter "About your data" link reaches /about/data and is NOT signed-in-gated
//          (renders signed-out); the account-menu item exists + navigates to /about/data; and the
//          footer is wired into the home / contribute / contributor-profile routes (source check
//          for the two heavy routes whose full render is out of scope for a unit test).
//   - AC11: the page's links use text-link (no gold), decorative arrows are aria-hidden, links
//          carry the focus-visible affordance, and the footer is a <footer>/contentinfo landmark.
//
// The auth client surface + the router are mocked per-test (the established pattern in
// auth-control.test.tsx) so we can drive signed-out vs signed-in deterministically.

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => "/about/data",
  useSearchParams: () => new URLSearchParams(),
}));

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

import AboutDataPage from "@/app/about/data/page";
import { AuthControl } from "@/components/auth/AuthControl";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { LoginPromptPanel, LoginPromptDialog } from "@/components/auth/LoginPrompt";

// vitest runs from the repo root (cwd); resolve route source files from there for the
// source-wiring assertions on the heavy routes that aren't fully rendered here.
const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

beforeEach(() => {
  routerPush.mockReset();
  signIn.mockReset();
  signOut.mockReset();
});
afterEach(() => vi.clearAllMocks());

// ── AC1 — the gate disclosure is always present (no toggle), below the gate body. ─────────────
describe("AC1 — the gate disclosure is readable before sign-in, with no toggle", () => {
  it("the disclosure renders inline (no 'more info'/'show'/'details' toggle gates it) — panel", () => {
    render(
      <LoginPromptPanel title="Log in with Wikipedia to contribute" body="Reading stays anonymous." />
    );
    // The disclosure substance is present on first paint (AC1: readable, not behind a click).
    expect(screen.getByText("What contributing stores:")).toBeInTheDocument();
    expect(screen.getByText(/sets a session cookie/i)).toBeInTheDocument();
    // No disclosure/expander control wraps it (no <details>, no show/more-info button).
    expect(document.querySelector("details")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /more info|show|details|learn more|expand/i })
    ).toBeNull();
  });

  it("the disclosure body follows the gate's own {body} text in document order (design §3.3)", () => {
    const { container } = render(
      <LoginPromptPanel title="Log in" body="UNIQUE_GATE_BODY_MARKER reading stays anonymous." />
    );
    const text = container.textContent ?? "";
    const bodyIdx = text.indexOf("UNIQUE_GATE_BODY_MARKER");
    const discIdx = text.indexOf("What contributing stores:");
    expect(bodyIdx).toBeGreaterThanOrEqual(0);
    expect(discIdx).toBeGreaterThan(bodyIdx); // disclosure is BELOW the body, not above it.
  });

  it("the gate link to /about/data is a real link in the gate's tab order (panel + dialog)", () => {
    const { unmount } = render(<LoginPromptPanel title="Log in" body="…" />);
    let link = screen.getByRole("link", { name: /About your data/i });
    expect(link).toHaveAttribute("href", "/about/data");
    unmount();
    render(<LoginPromptDialog title="Log in to curate" body="…" onClose={() => {}} />);
    link = screen.getByRole("link", { name: /About your data/i });
    expect(link).toHaveAttribute("href", "/about/data");
  });
});

// ── AC2 — the persistent surface is reachable from non-gate places, signed-out included. ──────
describe("AC2 — SiteFooter is the persistent, signed-out-reachable link", () => {
  it("is a <footer>/contentinfo landmark carrying the 'About your data' link → /about/data", () => {
    render(<SiteFooter />);
    const footer = screen.getByRole("contentinfo");
    const link = within(footer).getByRole("link", { name: "About your data" });
    expect(link).toHaveAttribute("href", "/about/data");
  });

  it("renders the same regardless of session — it is NOT signed-in-gated (AC2)", () => {
    // Signed-out.
    sessionState = { data: null, status: "unauthenticated" };
    const { unmount } = render(<SiteFooter />);
    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", { name: "About your data" })
    ).toHaveAttribute("href", "/about/data");
    unmount();
    // The footer is a pure presentational component with no session read at all — proving it
    // cannot be signed-in-gated. (No useSession import in the component.)
    expect(repoFile("components/chrome/SiteFooter.tsx")).not.toMatch(/useSession/);
  });

  it("is wired into the home, contribute, and contributor-profile routes (design §2.2 / §4.3)", () => {
    // The two heavy routes (contribute / profile) require a broad store+session mock to render in
    // full; the AC2 requirement for them is that the persistent footer is placed on the route. We
    // assert that wiring at the source — each route imports AND renders <SiteFooter/>.
    for (const rel of [
      "app/page.tsx",
      "app/contribute/page.tsx",
      "app/contributor/ProfileView.tsx",
    ]) {
      const src = repoFile(rel);
      expect(src, `${rel} imports SiteFooter`).toMatch(
        /import\s*\{[^}]*SiteFooter[^}]*\}\s*from\s*["']@\/components\/chrome\/SiteFooter["']/
      );
      expect(src, `${rel} renders <SiteFooter`).toMatch(/<SiteFooter/);
    }
  });

  it("appears in EVERY /contribute return branch (gate / saved / form) — design §4.3", () => {
    // Dev flagged the multi-branch return; the footer must not be in only one branch. The page
    // has three early-return shapes; assert <SiteFooter appears as many times as the branches.
    const src = repoFile("app/contribute/page.tsx");
    const count = (src.match(/<SiteFooter/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

describe("AC2 — the account-menu item reaches /about/data (signed-in supplement)", () => {
  beforeEach(() => {
    sessionState = { data: { user: { username: "Ragesoss" } }, status: "authenticated" };
  });

  it("opening the menu and activating 'About your data' navigates to /about/data", async () => {
    render(<AuthControl variant="home" />);
    const trigger = screen.getByRole("button", { name: "Account: Ragesoss" });
    fireEvent.keyDown(trigger, { key: "Enter" }); // WAI-ARIA: Enter opens the menu-button.
    const item = await screen.findByText("About your data");
    fireEvent.click(item);
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/about/data"));
  });

  it("the menu item is ordered after 'My curations' and before 'Sign out' (design §4.4)", async () => {
    render(<AuthControl variant="home" />);
    const trigger = screen.getByRole("button", { name: "Account: Ragesoss" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    await screen.findByText("About your data");
    const items = screen.getAllByRole("menuitem").map((n) => n.textContent);
    // Issue #143 (design §5.2): the skin-toggle mirror is the FIRST menu item (above "My curations");
    // "About your data" stays between "My curations" and "Sign out", with "Sign out" last.
    expect(items).toEqual([
      "Switch to dark skin",
      "My curations",
      "About your data",
      "Sign out",
    ]);
  });

  it("the account menu (and its 'About your data' item) does NOT exist signed-out", () => {
    sessionState = { data: null, status: "unauthenticated" };
    render(<AuthControl variant="home" />);
    expect(screen.queryByText("About your data")).toBeNull();
  });
});

// ── AC11 — accessibility of the notice surfaces (text-labeled, no gold, focus-visible, landmark).
describe("AC11 — accessibility of the notice surfaces", () => {
  it("the /about/data page has exactly one <h1>; NO link uses gold (the reserved accent — AC11)", () => {
    const { container } = render(<AboutDataPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      // Gold (#E5AB28 / a `gold`/`accent` utility) is NEVER a functional link/signal color.
      // (The brand "wiki+" wordmark home link legitimately uses indigo `text-brand`, not gold.)
      expect(a.className, `link "${a.textContent?.trim()}" is not gold`).not.toMatch(
        /text-gold|text-\[#E5AB28\]|text-accent/i
      );
    }
  });

  it("the notice CONTENT links (back-link, footer) use text-link + a focus-visible ring", () => {
    render(<AboutDataPage />);
    // The back-link is a content link (distinct from the brand wordmark in the header).
    const back = screen.getByRole("link", { name: /Back to wiki\+/i });
    expect(back.className).toMatch(/text-link/);
    expect(back.className).toMatch(/focus-visible:/);
    // The footer link too (rendered on the page).
    const footerLink = within(screen.getByRole("contentinfo")).getByRole("link", {
      name: "About your data",
    });
    expect(footerLink.className).toMatch(/text-link/);
    expect(footerLink.className).toMatch(/focus-visible:/);
  });

  it("the back-link's decorative arrow is aria-hidden; the WORD is the accessible name", () => {
    render(<AboutDataPage />);
    const back = screen.getByRole("link", { name: /Back to wiki\+/i });
    // The accessible name is the word — the '←' must not be the only thing the link announces.
    expect(back).toHaveAccessibleName(/Back to wiki\+/i);
    const arrow = back.querySelector("[aria-hidden]");
    expect(arrow?.textContent).toBe("←");
  });

  it("the gate disclosure link's decorative '→' is aria-hidden; the word stands alone", () => {
    render(<LoginPromptPanel title="Log in" body="…" />);
    const link = screen.getByRole("link", { name: /About your data/i });
    expect(link).toHaveAccessibleName(/About your data/i);
    const arrow = link.querySelector("[aria-hidden]");
    expect(arrow?.textContent).toBe("→");
  });

  it("the SiteFooter link uses text-link with a focus-visible ring (no gold)", () => {
    render(<SiteFooter />);
    const link = within(screen.getByRole("contentinfo")).getByRole("link", {
      name: "About your data",
    });
    expect(link.className).toMatch(/text-link/);
    expect(link.className).toMatch(/focus-visible:/);
    expect(link.className).not.toMatch(/text-gold|text-\[#E5AB28\]|text-accent/i);
  });
});
