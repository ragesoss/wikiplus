import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FullArticle } from "@/lib/wiki/article";
import type { Candidate, Clip } from "@/lib/data/types";

// END-TO-END wiring of the unified MOBILE dock through TopicView (issue #120,
// docs/design/unified-player-mobile.md §3/§8/§12). Same posture as pinned-player-wiring.test.tsx,
// but on a MOBILE viewport (the shared setup's matchMedia reports matches:false for every query,
// so `(min-width: 1024px)` does NOT match → `isMobile()` is true → both curated and candidate
// playback route into the single `MobilePlayerDock` "Video player").
//
// This pins the MOBILE arm of the play split: the curated clip opens the dock (not PlayerModal),
// the candidate opens the same dock, a second play SWAPS in place (one dock, one iframe — across
// kinds too), Close tears it down, and the no-embed/non-YouTube fall-throughs are unchanged.

const TOPIC_QID = "Q189603";

const ytCandidate: Candidate = {
  id: "cand_yt_embed",
  topicQid: TOPIC_QID,
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=AAA",
  embedUrl: "https://www.youtube-nocookie.com/embed/AAA",
  thumbnailUrl: "https://i.ytimg.com/vi/AAA/hqdefault.jpg",
  caption: "Glycolysis explained",
  creator: { handle: "@2minuteclassroom", name: "2 Minute Classroom", platform: "youtube" },
  vetted: false,
  source: "YouTube",
  matchReason: "Mentions glycolysis",
  general: true,
};

const ytNoEmbedCandidate: Candidate = {
  id: "cand_yt_noembed",
  topicQid: TOPIC_QID,
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=CCC",
  thumbnailUrl: "https://i.ytimg.com/vi/CCC/hqdefault.jpg",
  caption: "Respiration overview no-embed",
  creator: { handle: "@khanacademy", name: "Khan Academy", platform: "youtube" },
  vetted: false,
  source: "YouTube",
  matchReason: "General overview",
  general: true,
};

const curatedClip: Clip = {
  id: "clip_curated",
  topicQid: TOPIC_QID,
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=DDD",
  embedUrl: "https://www.youtube-nocookie.com/embed/DDD",
  thumbnailUrl: "https://i.ytimg.com/vi/DDD/hqdefault.jpg",
  caption: "The Calvin cycle, animated",
  creator: { handle: "@amoebasisters", name: "Amoeba Sisters", platform: "youtube" },
  general: true,
  contextNote: "Clear walkthrough; treat the timeline as illustrative.",
  stance: "explainer",
  accuracyFlag: "accurate",
  curatedBy: "curatorX",
  createdAt: "2026-01-01T00:00:00Z",
};

const curatedNoEmbed: Clip = {
  ...curatedClip,
  id: "clip_curated_noembed",
  embedUrl: undefined,
  caption: "Curated but unembeddable",
};

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
vi.mock("@/lib/data", async () => {
  const { buildDataMock } = await import("./helpers/data-mock");
  return buildDataMock();
});

import { TopicView } from "@/app/topic/TopicView";
import { seedIfEmpty } from "./helpers/data-mock";

beforeEach(async () => {
  window.localStorage.clear();
  fetchFullArticle.mockReset();
  fetchFullArticle.mockResolvedValue(article);
  await seedIfEmpty();
  // Seed BOTH a curated clip and candidates on the same topic so both play paths are reachable.
  // The local store reads each key as a FLAT array filtered by topicQid (lib/data/local-store.ts).
  window.localStorage.setItem(
    "wikiplus.clips",
    JSON.stringify([curatedClip, curatedNoEmbed])
  );
  window.localStorage.setItem(
    "wikiplus.candidates",
    JSON.stringify([ytCandidate, ytNoEmbedCandidate])
  );
  // The shared setup's matchMedia returns matches:false for every query → `(min-width:1024px)`
  // does not match → mobile routing. (No override needed; this asserts the mobile arm.)
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function queryDock() {
  return screen.queryByRole("region", { name: "Video player" });
}

describe("issue #120 — curated playback on mobile opens the unified dock (not PlayerModal)", () => {
  it("playing a curated clip opens the non-modal 'Video player' dock with its embed", async () => {
    render(<TopicView />);
    const btns = await screen.findAllByRole("button", {
      name: "Play: The Calvin cycle, animated",
    });
    await userEvent.click(btns[0]);

    const dock = await screen.findByRole("region", { name: "Video player" });
    // It is NOT the blocking PlayerModal dialog (mobile curated no longer uses the modal).
    expect(screen.queryByRole("dialog", { name: "Video player" })).toBeNull();
    expect(dock.querySelector("iframe")!.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/DDD?autoplay=1"
    );
  });

  it("a curated clip with no embedUrl still opens the dock with the note + can't-embed message", async () => {
    render(<TopicView />);
    const btns = await screen.findAllByRole("button", {
      name: "Play: Curated but unembeddable",
    });
    await userEvent.click(btns[0]);

    const dock = await screen.findByRole("region", { name: "Video player" });
    expect(within(dock).getByText(/can't be embedded/i)).toBeInTheDocument();
    // No src-less iframe; the See context reveal (where the note lives) is present.
    expect(dock.querySelector("iframe")).toBeNull();
    expect(within(dock).getByRole("button", { name: "See context" })).toBeInTheDocument();
  });
});

describe("issue #120 — candidate playback on mobile uses the same dock", () => {
  it("playing a YouTube candidate opens the 'Video player' dock with the match reason", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<TopicView />);
    const btns = await screen.findAllByRole("button", { name: "Play: Glycolysis explained" });
    await userEvent.click(btns[0]);

    const dock = await screen.findByRole("region", { name: "Video player" });
    expect(dock.querySelector("iframe")!.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/AAA?autoplay=1"
    );
    // The match reason lives behind the See context reveal (slim default — not in the bar). Open it.
    await userEvent.click(within(dock).getByRole("button", { name: "See context" }));
    expect(within(dock).getByText("Mentions glycolysis")).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it("a YouTube candidate with NO embedUrl falls through to a new tab — no dock (§8)", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<TopicView />);
    const btn = await screen.findByRole("button", {
      name: "Play: Respiration overview no-embed",
    });
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

describe("issue #120 — single instance, swap in place across kinds (§8)", () => {
  it("candidate → curated swaps the SAME one dock/iframe (no second dock)", async () => {
    render(<TopicView />);
    // Play the candidate first.
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Play: Glycolysis explained" }))[0]
    );
    await screen.findByRole("region", { name: "Video player" });

    // Now play a curated clip — the same single dock re-renders with kind="curated".
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Play: The Calvin cycle, animated" }))[0]
    );

    await waitFor(() => {
      expect(screen.getAllByRole("region", { name: "Video player" })).toHaveLength(1);
      expect(document.querySelectorAll("iframe")).toHaveLength(1);
      expect(document.querySelector("iframe")!.getAttribute("src")).toBe(
        "https://www.youtube-nocookie.com/embed/DDD?autoplay=1"
      );
    });
    // The dock swapped to the curated kind: opening See context reveals the curated note (a
    // candidate has no curator note, so this is curated-specific evidence of the swap).
    const dock = screen.getByRole("region", { name: "Video player" });
    await userEvent.click(within(dock).getByRole("button", { name: "See context" }));
    expect(within(dock).getByText("Curator note")).toBeInTheDocument();
  });
});

describe("issue #120 — Close tears down the dock + iframe (§8 dismissed)", () => {
  it("after Close, no 'Video player' region and no iframe remain", async () => {
    render(<TopicView />);
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Play: Glycolysis explained" }))[0]
    );
    await screen.findByRole("region", { name: "Video player" });
    expect(document.querySelector("iframe")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Close video player" }));
    await waitFor(() => {
      expect(queryDock()).toBeNull();
      expect(document.querySelector("iframe")).toBeNull();
    });
  });
});

describe("issue #120 — edge-aware page spacer (§6.6 reflow)", () => {
  it("the mobile spacer appears with the dock and moves to the top when parked top, removed on dismiss", async () => {
    const { container } = render(<TopicView />);
    expect(container.querySelector("div[aria-hidden].lg\\:hidden")).toBeNull();

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Play: Glycolysis explained" }))[0]
    );
    await screen.findByRole("region", { name: "Video player" });
    // The bottom-arm spacer is present alongside the open dock (default edge = bottom).
    await waitFor(() =>
      expect(container.querySelector("div[aria-hidden].lg\\:hidden")).not.toBeNull()
    );

    // Park to the top → still exactly one mobile spacer (the top arm), never two.
    await userEvent.click(
      screen.getByRole("button", { name: "Move player to top of screen" })
    );
    await waitFor(() =>
      expect(
        container.querySelectorAll("div[aria-hidden].lg\\:hidden")
      ).toHaveLength(1)
    );

    await userEvent.click(screen.getByRole("button", { name: "Close video player" }));
    await waitFor(() =>
      expect(container.querySelector("div[aria-hidden].lg\\:hidden")).toBeNull()
    );
  });
});
