import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Tests for the rebuilt landing page (#15): the search-led front door + the Daylight Projector
// (HeaderProjector) at Tier A. We verify what the LANDING HOST adds, not TopicSearch's #12
// behavior (that is covered in topic-search.test.tsx) — specifically:
//   - search-to-route from the landing host still pushes topicHref(<raw title>) for an existing
//     seeded title, a created-on-demand title, and an unknown-title Enter (AC3/AC4/AC5);
//   - the demoted topic list's READ-ERROR FLOOR line still renders (AC7 guardrail);
//   - the HeaderProjector wordmark's accessible name is "wiki+" and decorative layers are
//     aria-hidden (AC11);
//   - the landing page adds NO write / NO QID to the navigation (AC4).
//
// The Wikipedia typeahead, the Next router, and the DataStore read are MOCKED (no network /
// no real navigation in CI — the established pattern, docs/ARCHITECTURE.md "Testing").

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const fetchTopicSuggestions = vi.fn();
vi.mock("@/lib/wiki/suggest", () => ({
  fetchTopicSuggestions: (...a: unknown[]) => fetchTopicSuggestions(...a),
}));

// Mock the DataStore seam so the demoted topic list's states are driven deterministically. The
// homepage reads `listCuratedTopics()` (issue #126) — curated topics + their at-a-glance stats,
// already filtered to videos ≥ 1 and recency-ordered server-side.
const listCuratedTopics = vi.fn();
vi.mock("@/lib/data", () => ({
  store: { listCuratedTopics: () => listCuratedTopics() },
}));

import HomePage from "@/app/page";
import { HeaderProjector } from "@/components/wordmark/HeaderProjector";

beforeEach(() => {
  routerPush.mockReset();
  fetchTopicSuggestions.mockReset();
  fetchTopicSuggestions.mockResolvedValue([]);
  listCuratedTopics.mockReset();
  // Default: a populated curated list (the create-on-demand test types a title NOT in it). Each
  // item carries its at-a-glance stats — the shape the redesigned TopicCard consumes (#126).
  listCuratedTopics.mockResolvedValue([
    {
      qid: "Q11173",
      title: "Photosynthesis",
      description: "Process used by plants",
      stats: { videos: 12, creators: 7, curators: 3 },
    },
  ]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ── Search-to-route from the landing host (AC3/AC4/AC5). ──────────────────────
describe("landing search routes to a Topic page", () => {
  it("an EXISTING seeded title (Enter) navigates to topicHref(title) (AC3)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomePage />);
    const input = await screen.findByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Photosynthesis");
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Photosynthesis/");
  });

  it("a CREATED-ON-DEMAND title (not in the seeded list) still navigates to topicHref(title) (AC4)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomePage />);
    const input = await screen.findByRole("combobox", { name: /find a topic/i });
    // "Mitochondrion" is not in the seeded list — the landing page adds no write, the route is
    // the same pure navigation; TopicView resolves title→QID + renders the empty/curate state.
    await user.type(input, "Mitochondrion");
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Mitochondrion/");
    // No write, no QID in the URL (AC4).
    const target = routerPush.mock.calls[0][0] as string;
    expect(target).not.toContain("qid=");
    expect(target).not.toContain("/contribute");
  });

  it("an UNKNOWN title (zero matches) shows the hint and Enter still navigates (AC5)", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([]); // no matching Wikipedia article
    render(<HomePage />);
    const input = await screen.findByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Asdkjfh");
    // The non-blocking no-results hint is present (inherited from TopicSearch — not a dead end).
    await screen.findByText(/No matching articles — press Enter to open/);
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Asdkjfh/");
  });
});

// ── The search is reused unforked + above the list (AC1/AC2). ─────────────────
describe("the landing hero leads with the reused search", () => {
  it("renders exactly one combobox (one TopicSearch, no second search) above the topic list", async () => {
    render(<HomePage />);
    await screen.findByRole("combobox", { name: /find a topic/i });
    // One search control on the page (AC2 — no divergent second search).
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    // The "Recently curated" heading (the demoted list) is present and secondary (an <h2>).
    expect(
      screen.getByRole("heading", { level: 2, name: /recently curated/i })
    ).toBeInTheDocument();
  });
});

// ── The demoted topic list — read-error floor preserved (AC7 guardrail). ──────
describe("the demoted topic list preserves its states", () => {
  it("renders the read-error FLOOR line when the topic read fails", async () => {
    listCuratedTopics.mockRejectedValue(new Error("DB down"));
    render(<HomePage />);
    expect(
      await screen.findByText(/Couldn't load topics — please refresh\./i)
    ).toBeInTheDocument();
  });

  it("renders the populated card grid below the hero", async () => {
    render(<HomePage />);
    // The seeded topic renders as a card link to its Topic page (Next normalizes the
    // trailing slash on the rendered <Link href>; topicHref returns the canonical /…/ form).
    const card = await screen.findByRole("link", { name: /Photosynthesis/i });
    expect(card.getAttribute("href")).toMatch(/^\/topic\/Photosynthesis\/?$/);
  });
});

// ── Header chrome — no "Contribute", a single AuthControl (§7.5). ──
describe("the landing header chrome", () => {
  it("renders NO 'Contribute' link", async () => {
    render(<HomePage />);
    await screen.findByRole("combobox", { name: /find a topic/i });
    // The landing header has no "Contribute" link or bare "Contribute" text.
    expect(screen.queryByRole("link", { name: /contribute/i })).toBeNull();
    expect(screen.queryByText(/^contribute$/i)).toBeNull();
  });

  it("renders a SINGLE AuthControl in the header (the global setup stubs it authenticated)", async () => {
    render(<HomePage />);
    await screen.findByRole("combobox", { name: /find a topic/i });
    // The shared test setup mocks useSession → authenticated "TestCurator", so AuthControl
    // renders the logged-in account disclosure. There is exactly ONE such control (no second
    // row, no duplicate auth): the account trigger carries the username.
    const accounts = screen.getAllByRole("button", { name: /account: TestCurator/i });
    expect(accounts).toHaveLength(1);
  });
});

// ── The Daylight Projector accessibility model (AC11). ────────────────────────
describe("HeaderProjector accessible name + decorative layers", () => {
  it("the wordmark exposes the accessible name 'wiki+'", () => {
    render(<HeaderProjector variant="projector" />);
    expect(screen.getByRole("img", { name: "wiki+" })).toBeInTheDocument();
  });

  it("the accessible name defaults to 'wiki+' on every tier", () => {
    for (const variant of ["projector", "lockup-lit", "lockup-flat", "glyph"] as const) {
      const { unmount } = render(<HeaderProjector variant={variant} />);
      expect(screen.getByRole("img", { name: "wiki+" })).toBeInTheDocument();
      unmount();
    }
  });

  it("a custom accessibleName is honored, and as='a' renders a named link", () => {
    render(<HeaderProjector variant="lockup-flat" as="a" href="/" accessibleName="wiki plus home" />);
    expect(screen.getByRole("link", { name: "wiki plus home" })).toBeInTheDocument();
  });

  it("every decorative layer (SVG, beam, ghosts, surfaces) is aria-hidden — no fragment is read", () => {
    const { container } = render(<HeaderProjector variant="projector" />);
    // The named container is the ONLY accessible node; every descendant SVG carries aria-hidden.
    container.querySelectorAll("svg").forEach((svg) => {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
    // No raw "pedia" / "Wiki" / "plus" text is exposed as an accessible name fragment: the
    // decorative spans are aria-hidden, so they do not appear as standalone headings/text roles.
    const named = screen.getByRole("img", { name: "wiki+" });
    // The decorative ghost spans live inside the named img and are aria-hidden.
    named.querySelectorAll("span[aria-hidden='true']").forEach((s) => {
      expect(s).toHaveAttribute("aria-hidden", "true");
    });
    expect(named.querySelectorAll("span[aria-hidden='true']").length).toBeGreaterThan(0);
  });
});

// ── The landing page mounts the projector at Tier A above the search (AC1/AC8/AC9). ──
// #72: the landing wordmark is now a LINK to / (the shared-header AC3 — the wordmark navigates
// home from BOTH pages), so it exposes role="link" name "wiki+" (not role="img"). This is the one
// sanctioned additive change to the landing header; everything visual is unchanged (AC12).
describe("the landing page composition", () => {
  it("renders the HeaderProjector wordmark (a home link) above the search hero", async () => {
    render(<HomePage />);
    const wordmark = screen.getByRole("link", { name: "wiki+" });
    expect(wordmark).toHaveAttribute("href", "/");
    const search = await screen.findByRole("combobox", { name: /find a topic/i });
    // The wordmark precedes the search in document order (header → hero, AC1).
    expect(
      wordmark.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
