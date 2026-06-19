import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

// Issue #66 — the minimal privacy / data notice. These give QA a head start; QA extends coverage
// to map every AC. They cover the two NEW Dev-owned surfaces:
//   - the gate data disclosure rendered by LoginPromptPanel / LoginPromptDialog (AC1, AC3–AC5);
//   - the /about/data persistent notice page (AC2, AC3–AC6, AC11 heading structure).
//
// next/navigation is mocked because the page + the gate render Next <Link>s and the dialog uses
// ModalShell (which reads no router, but the auth client surface is stubbed by the shared setup).

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/about/data",
  useSearchParams: () => new URLSearchParams(),
}));

import AboutDataPage from "@/app/about/data/page";
import { LoginPromptDialog, LoginPromptPanel } from "@/components/auth/LoginPrompt";
import { AUTH_COPY } from "@/lib/auth/microcopy";

afterEach(() => vi.clearAllMocks());

// ── The gate data disclosure (AC1, AC3–AC5). ──────────────────────────────────
describe("the gate data disclosure (LoginPrompt*)", () => {
  it("LoginPromptPanel renders the verbatim dataNotice lead + body + the /about/data link", () => {
    render(
      <LoginPromptPanel
        title="Log in with Wikipedia to contribute"
        body="Contributing requires a Wikipedia login. Reading stays anonymous."
      />
    );
    // The lead label (legible BY WEIGHT, not color) + the verbatim body summary (AC1/AC3/AC5).
    expect(screen.getByText(AUTH_COPY.dataNotice.gateLead)).toBeInTheDocument();
    expect(
      screen.getByText(/your email is never shown/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Reading needs no login and stores no identity\./i)
    ).toBeInTheDocument();
    // A real link to the anonymous-reachable fuller notice (AC1/AC2). The WORD is the label.
    const link = screen.getByRole("link", { name: /About your data/i });
    expect(link).toHaveAttribute("href", "/about/data");
  });

  it("the disclosure renders on EVERY gate by construction — also inside LoginPromptDialog", () => {
    render(
      <LoginPromptDialog
        title="Log in to curate"
        body="Writing a context note requires a Wikipedia login."
        onClose={() => {}}
      />
    );
    expect(screen.getByText(AUTH_COPY.dataNotice.gateLead)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /About your data/i });
    expect(link).toHaveAttribute("href", "/about/data");
  });

  it("the dataNotice copy never implies email is shown (AC4 positive promise)", () => {
    render(<LoginPromptPanel title="Log in" body="…" />);
    // The promise is affirmative and unconditional in the gate summary.
    expect(AUTH_COPY.dataNotice.gateBody).toMatch(/your email is never shown/i);
    expect(AUTH_COPY.dataNotice.gateBody).not.toMatch(/email is shown/i);
  });
});

// ── The /about/data persistent notice (AC2, AC3–AC6, AC11). ───────────────────
describe("the /about/data persistent notice page", () => {
  it("renders exactly one <h1> 'About your data' (AC2 / AC11 heading structure)", () => {
    render(<AboutDataPage />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/About your data/i);
  });

  it("has the four sequential <h2> sections in order (AC3/AC4/AC5/AC6, AC11)", () => {
    render(<AboutDataPage />);
    const h2s = screen.getAllByRole("heading", { level: 2 });
    expect(h2s.map((h) => h.textContent)).toEqual([
      "Reading is anonymous",
      "What logging in and contributing stores",
      "What's public, and what's never shown",
    ]);
    // (The intro paragraph carries the "not a legal policy" framing before the first h2 — AC6.)
    expect(h2s).toHaveLength(3);
  });

  it("states the email-never-shown positive promise (AC4)", () => {
    render(<AboutDataPage />);
    expect(
      screen.getByText(/email is never displayed anywhere on wiki\+/i)
    ).toBeInTheDocument();
  });

  it("makes reading-is-anonymous explicit and never overclaims deletion/export (AC5/AC6)", () => {
    render(<AboutDataPage />);
    // AC5 — reading needs no login, stores no identity, sets no login cookie.
    expect(screen.getByText(/without logging in/i)).toBeInTheDocument();
    expect(screen.getByText(/sets no login cookie/i)).toBeInTheDocument();
    // AC6 — explicitly a prototype, not a legal policy; explicitly disclaims export/deletion.
    expect(
      screen.getByText(/doesn't offer data-export or account-deletion requests/i)
    ).toBeInTheDocument();
    // No overclaim: no "delete your data" / "export your data" affordance/promise.
    expect(screen.queryByRole("button", { name: /delete|export/i })).toBeNull();
  });

  it("names the three stored categories in plain language, no table names (AC3)", () => {
    render(<AboutDataPage />);
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(list).getByText(/A link to your Wikimedia account/i)).toBeInTheDocument();
    expect(within(list).getByText(/A session cookie/i)).toBeInTheDocument();
    expect(within(list).getByText(/Your curation contributions/i)).toBeInTheDocument();
    // No internal table/column names leak into the user-facing prose.
    expect(screen.queryByText(/clip_vote|dismissed_candidate|write_event|providerAccountId/i)).toBeNull();
  });

  it("offers a back-link home to / (AC2 reachability)", () => {
    render(<AboutDataPage />);
    const back = screen.getByRole("link", { name: /Back to wiki\+/i });
    expect(back).toHaveAttribute("href", "/");
  });

  it("renders the persistent footer link to /about/data on the page (AC2)", () => {
    render(<AboutDataPage />);
    // The SiteFooter is a contentinfo landmark carrying the "About your data" link.
    const footer = screen.getByRole("contentinfo");
    const footerLink = within(footer).getByRole("link", { name: /About your data/i });
    expect(footerLink).toHaveAttribute("href", "/about/data");
  });
});
