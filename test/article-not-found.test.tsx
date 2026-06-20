import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FullArticle, ResolvedPage } from "@/lib/wiki/article";
import { ArticleNotFound } from "@/components/topic/ArticleNotFound";

// Issue #19 — the article-not-found state as a SEPARATE OUTCOME from the transient article
// error (design docs/design/article-not-found.md §9 is the oracle):
//   • a NONEXISTENT well-formed title (/topic/Asdfqwer) → full-page ArticleNotFound, no "Try
//     again", no role="alert" (AC1/AC6);
//   • a transient fetch failure on a RESOLVED real title → the in-pane ArticleError, "Try
//     again" present (AC2) — the two never collapse into one another.
// The integration tests drive these END-TO-END through TopicView with the wiki module MOCKED
// (no network egress), mirroring the test/topic-view.test.tsx mock posture; the unit tests
// exercise ArticleNotFound's copy + the Wikipedia-search link directly (AC3/AC4/AC5).

let pathname = "/topic/asdfqwer/";
const routerReplace = vi.fn();
const routerPush = vi.fn();
const resolvePage = vi.fn<(t: string) => Promise<ResolvedPage>>();
const fetchFullArticle =
  vi.fn<(t: string, d?: string | null) => Promise<FullArticle>>();

const router = { replace: routerReplace, push: routerPush };
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => pathname,
  useRouter: () => router,
}));
vi.mock("@/lib/wiki/article", () => ({
  qidToTitle: vi.fn(async () => null),
  titleToQid: vi.fn(async () => null),
  resolvePage: (t: string) => resolvePage(t),
  fetchFullArticle: (t: string, d?: string | null) => fetchFullArticle(t, d),
}));
vi.mock("@/lib/data", async () => {
  const { buildDataMock } = await import("./helpers/data-mock");
  return buildDataMock();
});

import { TopicView } from "@/app/topic/TopicView";
import { seedIfEmpty } from "./helpers/data-mock";

function article(canonical: string): FullArticle {
  return {
    title: canonical,
    displayTitle: canonical,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(canonical)}`,
    styleCss: "",
    lead: {
      title: canonical,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(canonical)}`,
      leadHtml: "<p>Lead.</p>",
    },
    sections: [
      { slug: "overview", title: "Overview", level: 2, html: "<p>Body.</p>" },
    ],
  };
}

beforeEach(async () => {
  window.localStorage.clear();
  routerReplace.mockReset();
  routerPush.mockReset();
  resolvePage.mockReset();
  fetchFullArticle.mockReset();
  await seedIfEmpty();
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("article not-found vs. transient error (#19) — separate outcomes", () => {
  it("AC1: a NONEXISTENT title → ArticleNotFound (missing), no 'Try again'", async () => {
    pathname = "/topic/Asdfqwer/";
    // The title is well-formed but Wikipedia resolves nothing (all-null).
    resolvePage.mockResolvedValue({
      canonicalTitle: null,
      displayTitle: null,
      qid: null,
    });
    render(<TopicView />);

    expect(
      await screen.findByRole("heading", {
        name: "There's no Wikipedia article by that title",
        level: 1,
      })
    ).toBeInTheDocument();
    // Honesty bar (design §4): never the transient "Try again".
    expect(screen.queryByText(/Try again/i)).toBeNull();
    // It never canonicalized to a guessed slug and never fetched the article (no Topic flash).
    expect(routerReplace).not.toHaveBeenCalled();
    expect(fetchFullArticle).not.toHaveBeenCalled();
  });

  it("AC2: a transient fetch failure on a RESOLVED title → ArticleError, 'Try again' present", async () => {
    pathname = "/topic/Photosynthesis/";
    // The page RESOLVES (a real article)…
    resolvePage.mockResolvedValue({
      canonicalTitle: "Photosynthesis",
      displayTitle: "Photosynthesis",
      qid: "Q11982",
    });
    // …but the article fetch throws (network down / 5xx) → the transient error path.
    fetchFullArticle.mockRejectedValue(new Error("network down"));
    render(<TopicView />);

    expect(
      await screen.findByText("Couldn't load the article")
    ).toBeInTheDocument();
    // The transient card offers a retry…
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
    // …and is NOT the not-found state.
    expect(
      screen.queryByText("There's no Wikipedia article by that title")
    ).toBeNull();
  });
});

describe("ArticleNotFound — presentational contract (#19)", () => {
  const noop = () => {};

  it("AC3: kind='missing' with attemptedTitle echoes the title in the body", () => {
    render(
      <ArticleNotFound
        kind="missing"
        attemptedTitle="Photosynthsis"
        onSearch={noop}
      />
    );
    expect(
      screen.getByRole("heading", {
        name: "There's no Wikipedia article by that title",
        level: 1,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Photosynthsis/)).toBeInTheDocument();
  });

  it("AC4: kind='no-identifier' uses the distinct headline", () => {
    render(<ArticleNotFound kind="no-identifier" onSearch={noop} />);
    expect(
      screen.getByRole("heading", {
        name: "That's not a topic we can open",
        level: 1,
      })
    ).toBeInTheDocument();
  });

  it("AC5: 'Open search on Wikipedia ↗' points at Wikipedia SEARCH, not /wiki/<Title>", () => {
    render(
      <ArticleNotFound
        kind="missing"
        attemptedTitle="Asdf qwer"
        onSearch={noop}
      />
    );
    const link = screen.getByRole("link", {
      name: /Open search on Wikipedia/,
    });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("en.wikipedia.org/w/index.php?search=");
    expect(href).toContain("Asdf%20qwer");
    expect(href).not.toContain("/wiki/");
  });

  it("AC6: role='alert' is ABSENT (this is not a transient error)", () => {
    const { container } = render(
      <ArticleNotFound
        kind="missing"
        attemptedTitle="Asdfqwer"
        onSearch={noop}
      />
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("primary 'Search Wikipedia' calls onSearch prefilled with the attempted title", async () => {
    const onSearch = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <ArticleNotFound
        kind="missing"
        attemptedTitle="Photosynthsis"
        onSearch={onSearch}
      />
    );
    await user.click(screen.getByRole("button", { name: "Search Wikipedia" }));
    expect(onSearch).toHaveBeenCalledWith("Photosynthsis");
  });

  it("kind='no-identifier' primary calls onSearch with empty prefill", async () => {
    const onSearch = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<ArticleNotFound kind="no-identifier" onSearch={onSearch} />);
    await user.click(screen.getByRole("button", { name: "Search topics" }));
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("focuses the headline <h1> on render (keyboard/SR lands on the explanation, §8)", () => {
    render(
      <ArticleNotFound
        kind="missing"
        attemptedTitle="Photosynthsis"
        onSearch={noop}
      />
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute("tabindex", "-1");
  });
});
