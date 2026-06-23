import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FullArticle } from "@/lib/wiki/article";
import type { Candidate } from "@/lib/data/types";

// END-TO-END wiring of the DESKTOP pinned player's IN-PLAYER curation actions through TopicView
// (issue #123, docs/design/in-player-curation.md §3–§8; "Done when" DW1/DW3/DW4/DW5). Same posture
// as pinned-player-wiring.test.tsx: next/navigation, @/lib/wiki, and @/lib/data are MOCKED (no
// network). This file owns the watch+act loop FROM THE PLAYER:
//   - signed-in Curate from the dock opens the CurateModal (State K)        → DW1
//   - signed-in Not relevant from the dock optimistically hides the card,
//     persists, CLOSES the dock, and moves focus to the General band (L)    → DW1/DW3
//   - the optimistic-dismiss ROLLBACK on a write failure, reached FROM the
//     player (card reappears; the dock stays closed)                        → DW3
//   - logged out, the dock shows the single Curate CTA and NO Not-relevant
//     button (no false optimistic hide)                                     → DW4
//
// Auth is per-test: `sessionState` is mutated in `beforeEach`/the logged-out describe so the same
// fixtures exercise both arms. The data seam is the localStorage test double, with `recordDismissal`
// swappable to reject for the rollback case.

const TOPIC_QID = "Q189603"; // seeded uncurated topic (Cellular respiration)

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
  sections: [
    { slug: "glycolysis", title: "Glycolysis", level: 2, html: "<p>G.</p>" },
  ],
};

const fetchFullArticle = vi.fn();
const routerReplace = vi.fn();
const routerPush = vi.fn();
const router = { replace: routerReplace, push: routerPush };

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

// Per-test session: default authenticated (the in-player two-button row); the logged-out describe
// flips it to unauthenticated to exercise State J.
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

// A swappable recordDismissal so the rollback test can make the persist reject. Default = resolve.
const recordDismissal = vi.fn(
  async (_input: unknown): Promise<void> => undefined
);
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
  routerReplace.mockReset();
  routerPush.mockReset();
  recordDismissal.mockReset();
  recordDismissal.mockResolvedValue(undefined);
  fetchFullArticle.mockResolvedValue(article);
  sessionState = {
    data: { user: { contributorId: 1, username: "TestCurator" } },
    status: "authenticated",
  };
  await seedIfEmpty();
  window.localStorage.setItem("wikiplus.candidates", JSON.stringify(SEED));
  // Desktop viewport so the candidate play routes into the bottom-left PinnedPlayer.
  window.matchMedia = ((query: string) => ({
    matches: /min-width:\s*1024px/.test(query),
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
  return screen.queryByRole("region", { name: "Video preview" });
}

/** Open the pinned dock by playing the (general) candidate. */
async function openDock() {
  const btns = await screen.findAllByRole("button", {
    name: "Play: Glycolysis explained",
  });
  await userEvent.click(btns[0]);
  return screen.findByRole("region", { name: "Video preview" });
}

describe("DW1 — signed-in Curate from the player opens the curate flow (State K)", () => {
  it("activating ✦ Curate in the dock opens the 'Curate this clip' modal", async () => {
    render(<TopicView />);
    const dock = await openDock();
    await userEvent.click(
      within(dock).getByRole("button", {
        name: "Curate this clip: Glycolysis explained",
      })
    );
    // The CurateModal (a real dialog, labelled by its heading) is up — the signed-in gate ran.
    expect(
      await screen.findByRole("dialog", { name: /Curate this clip/ })
    ).toBeInTheDocument();
  });
});

describe("DW1/DW3 — signed-in Not relevant from the player (State L)", () => {
  it("optimistically hides the card, persists, CLOSES the dock, and focuses the band heading", async () => {
    render(<TopicView />);
    const dock = await openDock();
    // The candidate card/tile is present before dismiss.
    expect(
      (await screen.findAllByRole("button", { name: "Play: Glycolysis explained" }))
        .length
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
      // The card is optimistically hidden (no play button left for it).
      expect(
        screen.queryByRole("button", { name: "Play: Glycolysis explained" })
      ).toBeNull();
    });
    // The dismissal was persisted in the background.
    expect(recordDismissal).toHaveBeenCalledWith(
      expect.objectContaining({ topicQid: TOPIC_QID, platform: "youtube" })
    );
    // Focus landed on the General band heading (reused focusBandHeading), never <body>.
    const heading = document.querySelector("#general-band h2");
    expect(document.activeElement).toBe(heading);
  });

  it("ROLLS BACK on a write failure reached from the player: the card reappears (dock stays closed)", async () => {
    recordDismissal.mockRejectedValue(new Error("db down"));
    render(<TopicView />);
    const dock = await openDock();

    await userEvent.click(
      within(dock).getByRole("button", {
        name: "Dismiss as not relevant: Glycolysis explained",
      })
    );

    // The optimistic hide is rolled back → the card (its play button) reappears.
    await waitFor(() =>
      expect(
        screen.queryAllByRole("button", { name: "Play: Glycolysis explained" })
          .length
      ).toBeGreaterThan(0)
    );
    // The dock has already closed and is NOT re-opened by the rollback (the reader chose to stop
    // watching; the clip is recoverable from the restored card).
    expect(queryDock()).toBeNull();
  });
});

describe("DW4 — logged out: single Curate CTA, no Not-relevant button (State J)", () => {
  beforeEach(() => {
    sessionState = { data: null, status: "unauthenticated" };
  });

  it("shows the ✦ Curate this video CTA and NO Not relevant button in the dock", async () => {
    render(<TopicView />);
    const dock = await openDock();
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
    const dock = await openDock();
    await userEvent.click(
      within(dock).getByRole("button", {
        name: "Curate this video — log in to write a context note and vouch for it",
      })
    );
    // The curate login gate is shown (gate-at-trigger; no optimistic write).
    expect(
      await screen.findByRole("dialog", { name: /Log in to curate/ })
    ).toBeInTheDocument();
    expect(recordDismissal).not.toHaveBeenCalled();
  });
});
