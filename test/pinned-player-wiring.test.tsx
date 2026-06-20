import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FullArticle } from "@/lib/wiki/article";
import type { Candidate } from "@/lib/data/types";

// END-TO-END wiring of the pinned candidate player through TopicView (issue #10,
// docs/specs/pinned-player.md AC1/AC3/AC4/AC5/AC6/AC7/AC8/AC10; design §3/§9 state
// table). Same posture as topic-view.test.tsx: next/navigation + the wiki module are
// MOCKED (no network in CI). The candidate set is SEEDED into localStorage so the
// no-key path (liveCandidatesEnabled() === false → suggestCandidates no-op) keeps it.
//
// Required fixtures (spec §"Acceptance criteria" preamble): one YouTube candidate WITH
// embedUrl, one YouTube candidate WITHOUT embedUrl, one NON-YouTube candidate.

const TOPIC_QID = "Q189603"; // seeded uncurated topic (Cellular respiration → empty state)

const ytWithEmbed: Candidate = {
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
  general: false,
  sectionSlug: "glycolysis",
  sectionLabel: "Glycolysis",
};

const ytWithEmbedB: Candidate = {
  id: "cand_yt_embed_b",
  topicQid: TOPIC_QID,
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "vertical",
  watchUrl: "https://www.youtube.com/watch?v=BBB",
  embedUrl: "https://www.youtube-nocookie.com/embed/BBB",
  thumbnailUrl: "https://i.ytimg.com/vi/BBB/hqdefault.jpg",
  caption: "Citric acid cycle animated",
  creator: {
    handle: "@amoebasisters",
    name: "Amoeba Sisters",
    platform: "youtube",
    url: "https://youtube.com/@AmoebaSisters",
  },
  vetted: false,
  source: "YouTube",
  matchReason: "Mentions citric acid cycle",
  general: false,
  sectionSlug: "citric-acid-cycle",
  sectionLabel: "Citric acid cycle",
};

const ytNoEmbed: Candidate = {
  id: "cand_yt_noembed",
  topicQid: TOPIC_QID,
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=CCC",
  // no embedUrl → State F: new-tab fallback, no dock (AC7)
  thumbnailUrl: "https://i.ytimg.com/vi/CCC/hqdefault.jpg",
  caption: "Respiration overview no-embed",
  creator: {
    handle: "@khanacademy",
    name: "Khan Academy",
    platform: "youtube",
    url: "https://youtube.com/@khanacademy",
  },
  vetted: false,
  source: "YouTube",
  matchReason: "General overview",
  general: true,
};

const nonYouTube: Candidate = {
  id: "cand_tiktok",
  topicQid: TOPIC_QID,
  platform: "tiktok",
  platformLabel: "TikTok",
  orientation: "vertical",
  watchUrl: "https://www.tiktok.com/@bio/video/123",
  // TikTok carries no embedUrl in this prototype (embed-never-host: link out)
  caption: "Quick respiration short",
  creator: {
    handle: "@biotok",
    name: "BioTok",
    platform: "tiktok",
    url: "https://www.tiktok.com/@biotok",
  },
  vetted: false,
  source: "TikTok",
  matchReason: "Hashtag match",
  general: true,
};

const SEED: Candidate[] = [ytWithEmbed, ytWithEmbedB, ytNoEmbed, nonYouTube];

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
    {
      slug: "citric-acid-cycle",
      title: "Citric acid cycle",
      level: 2,
      html: "<p>C.</p>",
    },
  ],
};

const fetchFullArticle = vi.fn();
const routerReplace = vi.fn();
const routerPush = vi.fn();

// Stable router (matches the real useRouter) so the resolution effect — which now
// depends on `pathname` (#23) — fires once per input change, not on every re-render.
const router = { replace: routerReplace, push: routerPush };
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(`qid=${TOPIC_QID}`),
  usePathname: () => "/topic/",
  useRouter: () => router,
}));
vi.mock("@/lib/wiki/article", () => ({
  qidToTitle: vi.fn(async () => "Cellular respiration"),
  titleToQid: vi.fn(async () => TOPIC_QID),
  // The ?qid= entry never calls resolvePage (the title branch does); stub it for parity.
  resolvePage: vi.fn(async () => ({
    canonicalTitle: "Cellular respiration",
    displayTitle: "Cellular respiration",
    qid: TOPIC_QID,
  })),
  fetchFullArticle: (...a: unknown[]) => fetchFullArticle(...a),
}));
// Issue #45: mock the @/lib/data seam to the localStorage-backed test double.
vi.mock("@/lib/data", async () => {
  const { buildDataMock } = await import("./helpers/data-mock");
  return buildDataMock();
});

import { TopicView } from "@/app/topic/TopicView";
import { seedIfEmpty } from "./helpers/data-mock";

beforeEach(async () => {
  window.localStorage.clear();
  fetchFullArticle.mockReset();
  routerReplace.mockReset();
  routerPush.mockReset();
  fetchFullArticle.mockResolvedValue(article);
  await seedIfEmpty(); // sets the seed flag + base topics
  // Replace the seeded candidate set with our deterministic three-shape fixture.
  // listCandidates reads this key; with no YouTube key the live path is a no-op so it sticks.
  window.localStorage.setItem("wikiplus.candidates", JSON.stringify(SEED));
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** The pinned-player dock, if present. */
function queryDock() {
  return screen.queryByRole("region", { name: "Video preview" });
}

/** All play buttons in the RAIL for a given caption (rail + inline may both render). */
async function playButton(caption: string) {
  return await screen.findByRole("button", { name: `Play: ${caption}` });
}

describe("AC1 — clicking a YouTube candidate plays in-app, no new tab", () => {
  it("opens the pinned dock with an iframe at the candidate's embedUrl, window.open NOT called", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<TopicView />);
    const btns = await screen.findAllByRole("button", {
      name: "Play: Glycolysis explained",
    });
    await userEvent.click(btns[0]);

    const dock = await screen.findByRole("region", { name: "Video preview" });
    const iframe = dock.querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/AAA?autoplay=1"
    );
    expect(open).not.toHaveBeenCalled();
  });
});

describe("AC4 — single instance after two different candidates clicked", () => {
  it("exactly one dock and one iframe exist after clicking A then B", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<TopicView />);

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Play: Glycolysis explained" }))[0]
    );
    await screen.findByRole("region", { name: "Video preview" });

    await userEvent.click(
      (
        await screen.findAllByRole("button", {
          name: "Play: Citric acid cycle animated",
        })
      )[0]
    );

    await waitFor(() => {
      expect(
        screen.getAllByRole("region", { name: "Video preview" })
      ).toHaveLength(1);
      expect(document.querySelectorAll("iframe")).toHaveLength(1);
    });
    expect(open).not.toHaveBeenCalled();
  });
});

describe("AC5 — clicking a different candidate swaps the one iframe's src", () => {
  it("the single iframe's src changes from A's to B's embedUrl (no new tab)", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<TopicView />);

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Play: Glycolysis explained" }))[0]
    );
    let iframe = (
      await screen.findByRole("region", { name: "Video preview" })
    ).querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/AAA?autoplay=1"
    );

    await userEvent.click(
      (
        await screen.findAllByRole("button", {
          name: "Play: Citric acid cycle animated",
        })
      )[0]
    );

    await waitFor(() => {
      iframe = screen
        .getByRole("region", { name: "Video preview" })
        .querySelector("iframe")!;
      expect(iframe.getAttribute("src")).toBe(
        "https://www.youtube-nocookie.com/embed/BBB?autoplay=1"
      );
    });
    expect(open).not.toHaveBeenCalled();
  });
});

describe("AC6 — dismiss removes the dock + iframe from the DOM", () => {
  it("after Close, no Video-preview region and no iframe remain", async () => {
    render(<TopicView />);
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Play: Glycolysis explained" }))[0]
    );
    await screen.findByRole("region", { name: "Video preview" });
    expect(document.querySelector("iframe")).not.toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Close video preview" })
    );

    await waitFor(() => {
      expect(queryDock()).toBeNull();
      expect(document.querySelector("iframe")).toBeNull();
    });
  });
});

describe("AC7 — YouTube candidate with NO embedUrl degrades to new tab (State F)", () => {
  it("opens watchUrl in a new tab, renders NO dock and NO src-less iframe", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<TopicView />);
    // The no-embed YT candidate is general → appears in the strip. Its thumb has no
    // embedUrl so the YouTube branch falls through to window.open(watchUrl) (design §9 F).
    const btn = await playButton("Respiration overview no-embed");
    await userEvent.click(btn);

    expect(open).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=CCC",
      "_blank",
      "noopener"
    );
    expect(queryDock()).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
  });
});

describe("AC8 — non-YouTube candidate keeps new-tab behavior", () => {
  it("a TikTok candidate opens its watch URL in a new tab; no dock appears", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<TopicView />);
    const btn = await screen.findByRole("button", {
      name: "Open on TikTok: Quick respiration short",
    });
    await userEvent.click(btn);

    expect(open).toHaveBeenCalledWith(
      "https://www.tiktok.com/@bio/video/123",
      "_blank",
      "noopener"
    );
    expect(queryDock()).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
  });
});

describe("AC10 — opening the player does not steal focus", () => {
  it("focus stays on the candidate's play button after activating it", async () => {
    render(<TopicView />);
    const btn = (
      await screen.findAllByRole("button", { name: "Play: Glycolysis explained" })
    )[0];
    btn.focus();
    expect(btn).toHaveFocus();

    await userEvent.click(btn);
    const dock = await screen.findByRole("region", { name: "Video preview" });

    // The play button keeps focus — the dock did NOT auto-move focus into itself.
    expect(btn).toHaveFocus();
    expect(dock.contains(document.activeElement)).toBe(false);
  });
});

describe("AC3 — page stays interactive while the player is open (non-blocking)", () => {
  it("a candidate's Not-relevant handler still fires while the dock is open", async () => {
    render(<TopicView />);
    // Open the player.
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Play: Glycolysis explained" }))[0]
    );
    await screen.findByRole("region", { name: "Video preview" });

    // 4 seeded candidates → the empty ＋plus volume panel shows the suggestion numeral "4"
    // (plus-overview-redesign §6.1). Dismiss one WHILE the dock is open.
    const volumePanel = (
      await screen.findByText("uncurated videos")
    ).closest("div")!.parentElement!;
    expect(within(volumePanel).getByText("4")).toBeInTheDocument();
    const dismissBtns = await screen.findAllByRole("button", {
      name: /Dismiss as not relevant/,
    });
    await userEvent.click(dismissBtns[0]);

    // The dismiss took effect (count decremented to 3) → the page was fully interactive,
    // the player did not block the candidate controls or trap focus (AC3/AC9).
    await waitFor(() =>
      expect(within(volumePanel).getByText("3")).toBeInTheDocument()
    );
    // The dock is still present (the dismiss did not close it; it is independent).
    expect(queryDock()).not.toBeNull();
  });

  it("the dock is rendered as a sibling region, not a focus-trapping modal (AC9 corroborates AC3)", async () => {
    render(<TopicView />);
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Play: Glycolysis explained" }))[0]
    );
    const dock = await screen.findByRole("region", { name: "Video preview" });
    expect(dock).not.toHaveAttribute("aria-modal");
    expect(dock).not.toHaveAttribute("role", "dialog");
    // The article landmark and the suggested-videos rail remain reachable in the DOM
    // (not removed/inert) while the dock is up.
    expect(
      screen.getByRole("main", { name: "Wikipedia article" })
    ).toBeInTheDocument();
  });
});

describe("State table sanity — idle has no dock/iframe (State A)", () => {
  it("no dock and no iframe before any play click", async () => {
    render(<TopicView />);
    await screen.findByRole("heading", {
      name: "Cellular respiration",
      level: 1,
    });
    expect(queryDock()).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
  });
});

describe("Mobile spacer (design §6.2 / AC3) reserves bottom space only while open", () => {
  it("the aria-hidden bottom spacer appears with the dock and is removed on dismiss", async () => {
    const { container } = render(<TopicView />);
    // No spacer when idle.
    expect(container.querySelector("div[aria-hidden].lg\\:hidden")).toBeNull();

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Play: Glycolysis explained" }))[0]
    );
    await screen.findByRole("region", { name: "Video preview" });
    // Spacer present alongside the open dock (mobile reserves scroll space).
    await waitFor(() =>
      expect(
        container.querySelector("div[aria-hidden].lg\\:hidden")
      ).not.toBeNull()
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Close video preview" })
    );
    await waitFor(() =>
      expect(
        container.querySelector("div[aria-hidden].lg\\:hidden")
      ).toBeNull()
    );
  });
});
