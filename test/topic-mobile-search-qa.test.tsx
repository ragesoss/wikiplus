import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

// QA supplement (topic-mobile-search) — independent, non-author acceptance-criterion tests written
// by the qa-reviewer role for the contract in docs/design/topic-mobile-search.md §9 (AC1–AC15).
// These verify the WHOLE integrated header — SiteHeader host="topic" wiring the shared
// `narrowSearchExpanded` signal through to HeaderProjector (forceGlyph) and HeaderAuth/AuthControl
// (forceIconOnly) and the TopicSearch disclosure layout — not just the AuthControl in isolation
// (which is all test/auth-control.test.tsx covers). jsdom returns zero layout rects, so the
// pure-geometry ACs (AC2 / AC9 / AC14 / AC12) are verified by the companion Playwright spec
// e2e/topic-mobile-search.spec.ts; here we verify the DOM/a11y/state ACs that do not need layout.
//
// matchMedia control: the narrow-search collapse is gated on a `< md` (max-width: 767px) media
// query in BOTH TopicSiteHeader (isNarrow) and HeaderAuth (compact). We install a query-aware
// matchMedia so a test can choose the < md (narrow) or ≥ md (wide) world, and a reduced-motion
// world for AC15. Outside that, components read prefers-reduced-motion: reduce as false (the
// no-preference default the project setup also uses).

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => "/topic/Photosynthesis/",
  useSearchParams: () => new URLSearchParams(),
}));

const fetchTopicSuggestions = vi.fn();
vi.mock("@/lib/wiki/suggest", () => ({
  fetchTopicSuggestions: (...a: unknown[]) => fetchTopicSuggestions(...a),
}));

const listTopics = vi.fn();
vi.mock("@/lib/data", () => ({
  store: { listTopics: () => listTopics() },
}));

// Auth client surface (the project setup mocks this to an authenticated stub; we re-mock per file
// so this file can drive the signed-OUT and signed-IN worlds independently — the icon-only login
// (AC5/AC6) needs logged-out; the icon-only account (AC7) needs logged-in).
let sessionState: {
  data: { user: { username?: string; contributorId?: number } } | null;
  status: "authenticated" | "unauthenticated" | "loading";
} = { data: null, status: "unauthenticated" };
vi.mock("next-auth/react", () => ({
  useSession: () => sessionState,
  signIn: (...a: unknown[]) => signInSpy(...a),
  signOut: (...a: unknown[]) => signOutSpy(...a),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));
const signInSpy = vi.fn();
const signOutSpy = vi.fn();

import {
  SiteHeader,
  TopicHeaderSearch,
} from "@/components/header/SiteHeader";
import { HeaderAuth } from "@/components/header/HeaderAuth";

// ── matchMedia worlds ────────────────────────────────────────────────────────────────────────
// `narrow` controls the `(max-width: 767px)` query the header gates the collapse on; `reduceMotion`
// controls `(prefers-reduced-motion: reduce)`. The handlers are stored so a test can flip a width
// LIVE (AC11 ≥ md never collapses even mid-session) by dispatching change.
type MediaWorld = { narrow: boolean; reduceMotion: boolean };
const world: MediaWorld = { narrow: false, reduceMotion: false };
const listeners = new Set<() => void>();

function installMatchMedia() {
  window.matchMedia = ((query: string) => {
    const isNarrowQ = /max-width/.test(query);
    const isReduceQ = /prefers-reduced-motion: reduce/.test(query);
    const matches = isNarrowQ ? world.narrow : isReduceQ ? world.reduceMotion : false;
    const mql = {
      get matches() {
        return isNarrowQ ? world.narrow : isReduceQ ? world.reduceMotion : false;
      },
      media: query,
      onchange: null,
      addEventListener: (_e: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_e: string, cb: () => void) => listeners.delete(cb),
      addListener: (cb: () => void) => listeners.add(cb),
      removeListener: (cb: () => void) => listeners.delete(cb),
      dispatchEvent: vi.fn(),
    };
    void matches;
    return mql as unknown as MediaQueryList;
  }) as unknown as typeof window.matchMedia;
}

function setNarrow(narrow: boolean) {
  act(() => {
    world.narrow = narrow;
    listeners.forEach((cb) => cb());
  });
}

beforeEach(() => {
  routerPush.mockReset();
  signInSpy.mockReset();
  signOutSpy.mockReset();
  fetchTopicSuggestions.mockReset();
  fetchTopicSuggestions.mockResolvedValue([]);
  listTopics.mockReset();
  listTopics.mockResolvedValue([]);
  sessionState = { data: null, status: "unauthenticated" };
  world.narrow = false;
  world.reduceMotion = false;
  listeners.clear();
  window.scrollY = 0;
  installMatchMedia();
  Object.defineProperty(window, "location", {
    value: { pathname: "/topic/Photosynthesis/", search: "" },
    writable: true,
  });
});
afterEach(() => {
  vi.clearAllMocks();
});

function renderTopicHeader() {
  return render(
    <SiteHeader
      host="topic"
      articleTitle="Photosynthesis"
      search={<TopicHeaderSearch />}
      auth={<HeaderAuth />}
    />
  );
}

/** The DISCLOSURE-variant subtree (`< md`). `TopicHeaderSearch` mounts BOTH the inline (`≥ md`,
 *  `hidden md:flex`) and the disclosure (`< md`, `md:hidden`) variants at all times — CSS hides one
 *  per width, but jsdom ignores CSS, so BOTH are in the DOM and both render a role=search form +
 *  combobox. To assert on the disclosure precisely (not accidentally the inline form), scope every
 *  query to this wrapper. The wrapper carries the `md:hidden` class the host gives the disclosure. */
function disclosure() {
  const wrap = document.querySelector("div.md\\:hidden") as HTMLElement | null;
  if (!wrap) throw new Error("disclosure wrapper (div.md:hidden) not found");
  return within(wrap);
}

/** Click the < md magnifier disclosure trigger open and wait for the close ✕ (the expanded state).
 *  Requires the narrow world set first (so the disclosure variant is the interactive one). */
async function openDisclosure() {
  const trigger = disclosure().getByRole("button", { name: /search topics/i });
  fireEvent.click(trigger);
  await disclosure().findByRole("button", { name: /close search/i });
}

// ── AC1 — NO FORK. The expanded-state wordmark is the SAME data-projector-squeeze glyph node the
// < 380px squeeze renders (not a new mark / variant). ─────────────────────────────────────────────
describe("AC1 — no fork: the expanded wordmark is the existing squeeze glyph node", () => {
  it("renders the data-projector-squeeze glyph link while the narrow search is open", async () => {
    setNarrow(true);
    renderTopicHeader();
    // Collapsed: no forced glyph from the open state.
    expect(document.querySelector("[data-projector-squeeze]")).toBeNull();
    await openDisclosure();
    // Open: the wordmark collapses to the existing squeeze glyph node (forceGlyph ORs into squeeze).
    await waitFor(() =>
      expect(document.querySelector("[data-projector-squeeze]")).not.toBeNull()
    );
    // It is the same accessible "wiki+" home link (no new mark) — see AC8.
    const glyph = document.querySelector("[data-projector-squeeze]") as HTMLElement;
    expect(glyph.tagName).toBe("A");
    expect(glyph.getAttribute("aria-label")).toBe("wiki+");
  });
});

// ── AC3 — COLLAPSED state unchanged: only the magnifier shows; the wordmark/login are NOT forced. ─
describe("AC3 — collapsed (< md) state is unchanged (no forced glyph, no icon-only login)", () => {
  it("shows only the magnifier; no squeeze glyph; the login keeps its visible 'Log in' word", () => {
    setNarrow(true);
    renderTopicHeader();
    // The magnifier disclosure trigger is present; the close ✕ is not (collapsed).
    expect(screen.getByRole("button", { name: /search topics/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close search/i })).toBeNull();
    // Wordmark is NOT forced to the glyph while collapsed (forceGlyph false).
    expect(document.querySelector("[data-projector-squeeze]")).toBeNull();
    // Login keeps its visible word (compact "Log in"), i.e. not the icon-only `hidden` span.
    const login = screen.getByRole("button", { name: "Log in with Wikipedia" });
    const wordSpan = Array.from(login.querySelectorAll("span")).find(
      (s) => s.textContent === "Log in"
    );
    expect(wordSpan).toBeTruthy();
    expect(wordSpan?.className ?? "").not.toContain("hidden");
  });
});

// ── AC4 — NO BEAM under the open field: while expanded the lit beam is not rendered and the glyph
// is. (jsdom: the squeeze branch returns ONLY the glyph link — no [data-projector-beam].) ─────────
describe("AC4 — no lit beam behind the open field (the squeeze branch renders only the glyph)", () => {
  it("removes [data-projector-beam] and renders the glyph while expanded; restores beam on close", async () => {
    setNarrow(true);
    renderTopicHeader();
    // Collapsed at a narrow-but-≥-380 width: the beam layer exists (full lockup; cw guard means the
    // SSR/jsdom zero-width keeps the full lockup until measured — so the beam node IS present).
    expect(document.querySelector("[data-projector-beam]")).not.toBeNull();
    await openDisclosure();
    await waitFor(() => {
      // Open: the wordmark is the glyph; the lit beam SVG is gone.
      expect(document.querySelector("[data-projector-squeeze]")).not.toBeNull();
      expect(document.querySelector("[data-projector-beam]")).toBeNull();
    });
    // Close restores the beam (forceGlyph clears).
    fireEvent.click(screen.getByRole("button", { name: /close search/i }));
    await waitFor(() => {
      expect(document.querySelector("[data-projector-squeeze]")).toBeNull();
      expect(document.querySelector("[data-projector-beam]")).not.toBeNull();
    });
  });
});

// ── AC5 — LOGIN present + icon-only, logged-out: the "W" glyph stays, the visible "Log in" hides. ─
describe("AC5 — logged-out login is present + icon-only while the narrow search is open", () => {
  it("hides the visible 'Log in' word but keeps the operable button + the WikiGlyph", async () => {
    setNarrow(true);
    renderTopicHeader();
    await openDisclosure();
    const login = screen.getByRole("button", { name: "Log in with Wikipedia" });
    expect(login).toBeInTheDocument();
    // The visible word is hidden (the `hidden` utility), not removed.
    const wordSpan = Array.from(login.querySelectorAll("span")).find(
      (s) => s.textContent === "Log in"
    );
    expect(wordSpan).toBeTruthy();
    expect(wordSpan?.className).toContain("hidden");
    // The decorative WikiGlyph "W" is still present (an svg in the button).
    expect(login.querySelector("svg")).not.toBeNull();
    // Operable: clicking starts the (mocked) sign-in — behaviour unchanged.
    fireEvent.click(login);
    expect(signInSpy).toHaveBeenCalledWith(
      "wikimedia",
      expect.objectContaining({ callbackUrl: expect.any(String) })
    );
  });
});

// ── AC6 — accessible name preserved in BOTH states (collapsed text form + expanded icon-only). ────
describe("AC6 — login accessible name stays 'Log in with Wikipedia' in both states", () => {
  it("resolves the button by its full name while collapsed AND while expanded (integrated)", async () => {
    setNarrow(true);
    renderTopicHeader();
    // Collapsed:
    expect(
      screen.getByRole("button", { name: "Log in with Wikipedia" })
    ).toBeInTheDocument();
    await openDisclosure();
    // Expanded / icon-only — same accessible name.
    expect(
      screen.getByRole("button", { name: "Log in with Wikipedia" })
    ).toBeInTheDocument();
  });
});

// ── AC7 — ACCOUNT icon-only, logged-in: avatar + ▾, username hidden, name 'Account: {username}'. ──
describe("AC7 — logged-in account collapses to icon-only while the narrow search is open", () => {
  beforeEach(() => {
    sessionState = {
      data: { user: { username: "Ragesoss", contributorId: 1 } },
      status: "authenticated",
    };
  });

  it("keeps 'Account: Ragesoss', hides the username unconditionally (no sm:inline), keeps ▾", async () => {
    setNarrow(true);
    renderTopicHeader();
    await openDisclosure();
    const trigger = screen.getByRole("button", { name: "Account: Ragesoss" });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    const nameSpan = screen.getByText("Ragesoss");
    expect(nameSpan).toHaveClass("hidden");
    // Hidden OUTRIGHT — never re-shows at sm (640–767px) where the disclosure can still be open.
    expect(nameSpan.className).not.toContain("sm:inline");
    // The ▾ disclosure caret is still present.
    expect(trigger.textContent).toContain("▾");
  });

  it("collapsed (logged-in) keeps the username VISIBLE on the compact bar (≥ sm) — AC3 logged-in", () => {
    setNarrow(true);
    renderTopicHeader();
    // Not opened — the account name span is the responsive `hidden sm:inline`, NOT the icon-only
    // unconditional `hidden`.
    const nameSpan = screen.getByText("Ragesoss");
    expect(nameSpan.className).toContain("sm:inline");
  });
});

// ── AC8 — wordmark stays a home link while expanded: <a href="/"> name "wiki+", focusable. ────────
describe("AC8 — the expanded '+' glyph is still the 'wiki+' home link", () => {
  it("the squeeze glyph is an <a href> to / with accessible name 'wiki+' and is focusable", async () => {
    setNarrow(true);
    renderTopicHeader();
    await openDisclosure();
    const glyph = await waitFor(() => {
      const el = document.querySelector("[data-projector-squeeze]") as HTMLElement | null;
      expect(el).not.toBeNull();
      return el!;
    });
    expect(glyph.tagName).toBe("A");
    expect(glyph.getAttribute("href")).toBe("/");
    expect(glyph.getAttribute("aria-label")).toBe("wiki+");
    // Keyboard-focusable: an <a href> is in the tab order by default (no tabindex=-1).
    expect(glyph.getAttribute("tabindex")).not.toBe("-1");
    glyph.focus();
    expect(document.activeElement).toBe(glyph);
  });
});

// ── AC9 (the non-geometry half) — the field drops the max-w-[280px] clamp in the disclosure state. ─
// The actual width-flex + field.right ≤ login.left is geometry → verified in the e2e spec. Here we
// assert the structural class change the layout guarantee rests on (no fixed 280px clamp).
describe("AC9 — the expanded disclosure field has no max-w-[280px] clamp (flexes, not fixed 280)", () => {
  it("the open field's <form> uses flex-1 min-w-0 (not w-full max-w-[280px])", async () => {
    setNarrow(true);
    renderTopicHeader();
    await openDisclosure();
    // Scope to the DISCLOSURE subtree (the inline variant's form is a separate node also in the DOM
    // under jsdom, and that one legitimately KEEPS max-w-[280px] for ≥ md — AC11).
    const form = disclosure()
      .getByRole("search", { name: /search wikipedia topics/i }) as HTMLElement;
    expect(form.className).toContain("flex-1");
    expect(form.className).toContain("min-w-0");
    expect(form.className).not.toContain("max-w-[280px]");
  });
});

// ── AC10 — CLOSE restores the clean collapsed header + focus to the magnifier trigger. ────────────
describe("AC10 — closing restores the collapsed header, the full wordmark/login, and trigger focus", () => {
  it("✕ collapses the disclosure, clears the glyph + icon-only login, and focuses the magnifier", async () => {
    setNarrow(true);
    renderTopicHeader();
    await openDisclosure();
    // Open invariants present.
    await waitFor(() =>
      expect(document.querySelector("[data-projector-squeeze]")).not.toBeNull()
    );
    fireEvent.click(screen.getByRole("button", { name: /close search/i }));
    // Back to the magnifier, the glyph gone, the login word restored.
    const trigger = await screen.findByRole("button", { name: /search topics/i });
    await waitFor(() =>
      expect(document.querySelector("[data-projector-squeeze]")).toBeNull()
    );
    const login = screen.getByRole("button", { name: "Log in with Wikipedia" });
    const wordSpan = Array.from(login.querySelectorAll("span")).find(
      (s) => s.textContent === "Log in"
    );
    expect(wordSpan?.className ?? "").not.toContain("hidden");
    // Focus is returned to the magnifier trigger (the existing #12 collapse() rAF focus).
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("Escape (with the listbox closed) also collapses + restores trigger focus", async () => {
    setNarrow(true);
    renderTopicHeader();
    await openDisclosure();
    const input = disclosure().getByRole("combobox", {
      name: /search wikipedia topics/i,
    });
    fireEvent.keyDown(input, { key: "Escape" });
    const trigger = await disclosure().findByRole("button", {
      name: /search topics/i,
    });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

// ── AC11 — ≥ md is UNCHANGED: the inline field (no disclosure), full lockup/beam, full login. ─────
describe("AC11 — ≥ md renders the inline field + full login; the collapse machinery never fires", () => {
  // NOTE: the inline-vs-disclosure *visible* swap is a CSS (`hidden md:flex` / `md:hidden`) concern
  // that jsdom cannot see (both variants are in the DOM here), so the "no disclosure trigger
  // visible ≥ md" assertion lives in the e2e spec. What IS jsdom-meaningful — and the real
  // correctness risk — is that the collapse MACHINERY is structurally gated off ≥ md: even if the
  // (CSS-hidden) disclosure is driven open, narrowSearchExpanded stays false, so the wordmark is
  // NOT forced to the glyph and the login does NOT go icon-only.
  it("at ≥ md the inline field + full login render and no glyph/icon-only collapse exists", () => {
    world.narrow = false; // ≥ md
    renderTopicHeader();
    // The inline combobox is present (it is the ≥ md interactive variant in the hidden md:flex slot).
    const inlineWrap = document.querySelector("div.md\\:flex") as HTMLElement;
    expect(
      within(inlineWrap).getByRole("combobox", { name: /search wikipedia topics/i })
    ).toBeInTheDocument();
    // Full login label — the `home` skin (≥ md) renders the full visible phrase, not compact "Log in".
    const login = screen.getByRole("button", { name: "Log in with Wikipedia" });
    expect(login.textContent).toContain("Log in with Wikipedia");
    // No forced glyph (narrowSearchExpanded is structurally false ≥ md).
    expect(document.querySelector("[data-projector-squeeze]")).toBeNull();
  });

  it("at ≥ md, driving the disclosure open does NOT force the glyph (the < md AND-gate holds)", async () => {
    world.narrow = false; // ≥ md
    renderTopicHeader();
    // The disclosure's magnifier is in the DOM (CSS-hidden ≥ md, but present under jsdom). Click it
    // open: the field reports `expanded`, but the host's `< md` media check keeps narrowSearchExpanded
    // FALSE, so the wordmark must NOT collapse to the glyph and the login must NOT go icon-only.
    fireEvent.click(disclosure().getByRole("button", { name: /search topics/i }));
    await disclosure().findByRole("button", { name: /close search/i });
    expect(document.querySelector("[data-projector-squeeze]")).toBeNull();
    // The login (the home skin ≥ md) still shows its full visible label, never icon-only.
    const login = screen.getByRole("button", { name: "Log in with Wikipedia" });
    expect(login.textContent).toContain("Log in with Wikipedia");
  });

  it("a mid-session resize to ≥ md while the disclosure WAS reporting open does not force the glyph", async () => {
    // Start narrow, open the disclosure (the field reports open) — the glyph is forced.
    setNarrow(true);
    renderTopicHeader();
    await openDisclosure();
    await waitFor(() =>
      expect(document.querySelector("[data-projector-squeeze]")).not.toBeNull()
    );
    // Resize to ≥ md: the AND with the < md media check must drop the force even though the
    // disclosure's internal `expanded` may still be true (it is now display:none, not interactive).
    setNarrow(false);
    await waitFor(() =>
      expect(document.querySelector("[data-projector-squeeze]")).toBeNull()
    );
  });
});

// ── AC13 — the #19 prefill auto-open lands in the expanded state with focus in the field. ─────────
describe("AC13 — the #19 prefill auto-opens the disclosure into the expanded state (focus in field)", () => {
  it("a prefill nonce opens the disclosure, forces the glyph, and focuses the seeded field", async () => {
    setNarrow(true);
    const { rerender } = render(
      <SiteHeader
        host="topic"
        articleTitle="Photosynthesis"
        search={<TopicHeaderSearch prefill={{ value: "Phytosphere", nonce: 0 }} />}
        auth={<HeaderAuth />}
      />
    );
    // Bump the nonce → the disclosure auto-opens, seeds, and focuses (the existing #19 path).
    rerender(
      <SiteHeader
        host="topic"
        articleTitle="Photosynthesis"
        search={<TopicHeaderSearch prefill={{ value: "Phytosphere", nonce: 1 }} />}
        auth={<HeaderAuth />}
      />
    );
    // Expanded: the disclosure's close ✕ is present and ITS field is seeded + focused. (The inline
    // variant also receives the prefill value under jsdom, so scope to the disclosure subtree.)
    await disclosure().findByRole("button", { name: /close search/i });
    const input = disclosure().getByRole("combobox", {
      name: /search wikipedia topics/i,
    }) as HTMLInputElement;
    expect(input.value).toBe("Phytosphere");
    await waitFor(() => expect(document.activeElement).toBe(input));
    // The coordinated collapse fired with the auto-open (same no-overlap layout — glyph forced).
    await waitFor(() =>
      expect(document.querySelector("[data-projector-squeeze]")).not.toBeNull()
    );
  });
});

// ── AC14 (the non-geometry half) — the close ✕ is a 44×44 box (h-11 w-11). Pixel hit-test is
// e2e; here we assert the class the size rests on (jsdom has no layout). ──────────────────────────
describe("AC14 — the close ✕ carries the 44×44 (h-11 w-11) target classes", () => {
  it("the ✕ button is h-11 w-11 (not the old h-9 w-9 36px target)", async () => {
    setNarrow(true);
    renderTopicHeader();
    await openDisclosure();
    const close = screen.getByRole("button", { name: /close search/i });
    expect(close.className).toContain("h-11");
    expect(close.className).toContain("w-11");
    expect(close.className).not.toContain("h-9");
  });
});

// ── AC15 — REDUCED MOTION: opening/closing applies the end-states (functionally identical), focus
// still moves in. (The CSS tween suppression is a media-gated stylesheet rule — asserted in the
// e2e/CSS check; here we verify the FUNCTIONAL end-state holds under reduce: the field opens, is
// usable, and focus moves in, regardless of motion preference.) ──────────────────────────────────
describe("AC15 — reduced motion: the open end-state is functional (field usable, focus in)", () => {
  it("under prefers-reduced-motion: reduce, opening focuses the field and the collapse still fires", async () => {
    world.reduceMotion = true;
    setNarrow(true);
    renderTopicHeader();
    await openDisclosure();
    const input = disclosure().getByRole("combobox", {
      name: /search wikipedia topics/i,
    }) as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(input));
    // The end-state is the SAME as no-preference: glyph forced, login icon-only — only the tween
    // (a CSS animation) is suppressed, which the stylesheet gates; the functional result is equal.
    await waitFor(() =>
      expect(document.querySelector("[data-projector-squeeze]")).not.toBeNull()
    );
    // The field is immediately typeable.
    fireEvent.change(input, { target: { value: "Cytosol" } });
    expect(input.value).toBe("Cytosol");
  });
});
