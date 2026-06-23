import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FullArticle } from "@/lib/wiki/article";
import type { Candidate } from "@/lib/data/types";

// END-TO-END wiring of the SLIM MOBILE dock's in-player curation through TopicView
// (docs/design/mobile-player-slim.md §3/§10 — the mobile mirror of desktop #123 State K/L). Same
// posture as in-player-curation.test.tsx but on a MOBILE viewport: the candidate play routes into
// the unified MobilePlayerDock ("Video player"), and Curate / Not relevant live behind the Curate
// inline expander (open it first). This file owns the mobile watch+act loop FROM THE PLAYER:
//   - signed-in Curate from the Curate reveal opens the CurateModal (State K)
//   - signed-in Not relevant from the Curate reveal optimistically hides the card, persists,
//     CLOSES the dock, and moves focus to the General band heading (State L)
//   - the optimistic-dismiss ROLLBACK on a write failure (card reappears; dock stays closed)
//   - logged out, the Curate reveal shows the single Curate CTA and NO Not-relevant button.

const TOPIC_QID = "Q189603";

const ytA: Candidate = {
  id: "cand_yt_embed",
  topicQid: TOPIC_QID,
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=AAA",
  embedUrl: "https://www.youtube-nocookie.com/embed/AAA",
  thumbnailUrl: "https://i.ytimg.com/vi/AAA/hqdefault.jpg",
  caption: "Glycolysis explained",
  creator: {
    handle: "@2minuteclassroom",
    name: "2 Minute Classroom",
    platform: "youtube",
    url: "https://youtube.com/@2MinuteClassroom",
  },
  vetted: false,
  source: "YouTube",
  matchReason: "Mentions glycolysis",
  general: true,
};

const SEED: Candidate[] = [ytA];

const article: FullArticle = {
  title: "Cellular respiration",
  displayTitle: "Cellular respiration",
  url: "https://en.wikipedia.org/wiki/Cellular_respiration",
  styleCss: "",
  lead: {
    title: "Cellular respiration",
    url: "https://en.wikipedia.org/wiki/Cellular_respiration",
    leadHtml: "<p>Lead.</p>",
  },
  sections: [{ slug: "glycolysis", title: "Glycolysis", level: 2, html: "<p>G.</p>" }],
};

const fetchFullArticle = vi.fn();
const router = { replace: vi.fn(), push: vi.fn() };

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(`qid=${TOPIC_QID}`),
  usePathname: () => "/topic/",
  useRouter: () => router,
}));
vi.mock("@/lib/wiki/article", () => ({
  qidToTitle: vi.fn(async () => "Cellular respiration"),
  titleToQid: vi.fn(async () => TOPIC_QID),
  resolvePage: vi.fn(async () => ({
    canonicalTitle: "Cellular respiration",
    displayTitle: "Cellular respiration",
    qid: TOPIC_QID,
  })),
  fetchFullArticle: (...a: unknown[]) => fetchFullArticle(...a),
}));

let sessionState: {
  data: { user: { contributorId: number; username: string } } | null;
  status: "authenticated" | "unauthenticated";
} = {
  data: { user: { contributorId: 1, username: "TestCurator" } },
  status: "authenticated",
};
vi.mock("next-auth/react", () => ({
  useSession: () => sessionState,
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

const recordDismissal = vi.fn(async (_input: unknown): Promise<void> => undefined);
vi.mock("@/lib/data", async () => {
  const { buildDataMock } = await import("./helpers/data-mock");
  const real = buildDataMock();
  return {
    ...real,
    store: {
      ...real.store,
      recordDismissal: (input: unknown) => recordDismissal(input),
    },
  };
});

import { TopicView } from "@/app/topic/TopicView";
import { seedIfEmpty } from "./helpers/data-mock";

beforeEach(async () => {
  window.localStorage.clear();
  fetchFullArticle.mockReset();
  recordDismissal.mockReset();
  recordDismissal.mockResolvedValue(undefined);
  fetchFullArticle.mockResolvedValue(article);
  sessionState = {
    data: { user: { contributorId: 1, username: "TestCurator" } },
    status: "authenticated",
  };
  await seedIfEmpty();
  window.localStorage.setItem("wikiplus.candidates", JSON.stringify(SEED));
  // Mobile viewport: matchMedia returns matches:false for every query → `(min-width:1024px)` does
  // not match → `isMobile()` is true → candidate play routes into the MobilePlayerDock.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function queryDock() {
  return screen.queryByRole("region", { name: "Video player" });
}

/** Open the mobile dock by playing the (general) candidate, then open its Curate reveal. */
async function openDockAndCurate() {
  const btns = await screen.findAllByRole("button", { name: "Play: Glycolysis explained" });
  await userEvent.click(btns[0]);
  const dock = await screen.findByRole("region", { name: "Video player" });
  await userEvent.click(within(dock).getByRole("button", { name: "Curate" }));
  return dock;
}

describe("mobile slim — signed-in Curate from the player opens the curate flow (State K)", () => {
  it("activating ✦ Curate in the Curate reveal opens the 'Curate this clip' modal", async () => {
    render(<TopicView />);
    const dock = await openDockAndCurate();
    await userEvent.click(
      within(dock).getByRole("button", { name: "Curate this clip: Glycolysis explained" })
    );
    expect(
      await screen.findByRole("dialog", { name: /Curate this clip/ })
    ).toBeInTheDocument();
  });
});

describe("mobile slim — signed-in Not relevant from the Curate reveal (State L)", () => {
  it("optimistically hides the card, persists, CLOSES the dock, and focuses the band heading", async () => {
    render(<TopicView />);
    const dock = await openDockAndCurate();
    expect(
      (await screen.findAllByRole("button", { name: "Play: Glycolysis explained" })).length
    ).toBeGreaterThan(0);

    await userEvent.click(
      within(dock).getByRole("button", {
        name: "Dismiss as not relevant: Glycolysis explained",
      })
    );

    await waitFor(() => {
      // Dock closed (iframe torn down) — the playing candidate is gone.
      expect(queryDock()).toBeNull();
      expect(document.querySelector("iframe")).toBeNull();
      // The card is optimistically hidden.
      expect(
        screen.queryByRole("button", { name: "Play: Glycolysis explained" })
      ).toBeNull();
    });
    expect(recordDismissal).toHaveBeenCalledWith(
      expect.objectContaining({ topicQid: TOPIC_QID, platform: "youtube" })
    );
    // Focus landed on the General band heading (focusBandHeading), never <body>.
    const heading = document.querySelector("#general-band h2");
    expect(document.activeElement).toBe(heading);
  });

  it("ROLLS BACK on a write failure reached from the player: the card reappears (dock stays closed)", async () => {
    recordDismissal.mockRejectedValue(new Error("db down"));
    render(<TopicView />);
    const dock = await openDockAndCurate();

    await userEvent.click(
      within(dock).getByRole("button", {
        name: "Dismiss as not relevant: Glycolysis explained",
      })
    );

    // The optimistic hide is rolled back → the card (its play button) reappears.
    await waitFor(() =>
      expect(
        screen.queryAllByRole("button", { name: "Play: Glycolysis explained" }).length
      ).toBeGreaterThan(0)
    );
    // The dock has already closed and is NOT re-opened by the rollback.
    expect(queryDock()).toBeNull();
  });
});

describe("mobile slim — logged out: single Curate CTA, no Not-relevant button (State J)", () => {
  beforeEach(() => {
    sessionState = { data: null, status: "unauthenticated" };
  });

  it("the Curate reveal shows the ✦ Curate this video CTA and NO Not relevant button", async () => {
    render(<TopicView />);
    const dock = await openDockAndCurate();
    expect(
      within(dock).getByRole("button", {
        name: "Curate this video — log in to write a context note and vouch for it",
      })
    ).toBeInTheDocument();
    expect(
      within(dock).queryByRole("button", { name: /Dismiss as not relevant/ })
    ).toBeNull();
    expect(
      within(dock).queryByRole("button", { name: /^Curate this clip:/ })
    ).toBeNull();
  });

  it("activating the logged-out CTA opens the curate login gate (no false hide)", async () => {
    render(<TopicView />);
    const dock = await openDockAndCurate();
    await userEvent.click(
      within(dock).getByRole("button", {
        name: "Curate this video — log in to write a context note and vouch for it",
      })
    );
    expect(
      await screen.findByRole("dialog", { name: /Log in to curate/ })
    ).toBeInTheDocument();
    expect(recordDismissal).not.toHaveBeenCalled();
  });
});
