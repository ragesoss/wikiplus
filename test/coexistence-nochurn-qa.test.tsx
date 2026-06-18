import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { FullArticle } from "@/lib/wiki/article";

// ── Issue #60 — QA & Review: AC10 no-churn STRENGTHENING (the primary bar). ────────────────────
// The author's coexistence.test.tsx already snapshots the suggestion order/identity across a
// curation and asserts `suggestCandidates` is not re-invoked. This file adds the strongest
// possible no-churn proof: the DOM NODE of an uncurated suggestion is the *same element instance*
// before and after curating a different suggestion — i.e. React did not re-key, remount, or
// reorder the remaining tiles (only the curated id was filtered out of `liveCandidates`). A
// re-fetch/re-derive/remount would replace the node and fail this. Mirrors the author's harness
// so the mocks are in place before TopicView imports.

const article: FullArticle = {
  title: "Cellular respiration",
  displayTitle: "Cellular respiration",
  url: "https://en.wikipedia.org/wiki/Cellular_respiration",
  lead: {
    title: "Cellular respiration",
    url: "https://en.wikipedia.org/wiki/Cellular_respiration",
    leadHtml: "<p>Lead.</p>",
  },
  sections: [
    { slug: "glycolysis", title: "Glycolysis", level: 2, html: "<p>G.</p>" },
    { slug: "citric-acid-cycle", title: "Citric acid cycle", level: 2, html: "<p>C.</p>" },
  ],
};

let qid = "Q189603";
let pathname = "/topic/";
const routerReplace = vi.fn();
const routerPush = vi.fn();
const fetchFullArticle = vi.fn();
const router = { replace: routerReplace, push: routerPush };

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(qid ? `qid=${qid}` : ""),
  usePathname: () => pathname,
  useRouter: () => router,
}));
vi.mock("@/lib/wiki/article", () => ({
  qidToTitle: vi.fn(async () => "Cellular respiration"),
  titleToQid: vi.fn(async () => "Q189603"),
  resolvePage: vi.fn(async (title: string) => ({
    canonicalTitle: title,
    displayTitle: title,
    qid: "Q189603",
  })),
  fetchFullArticle: (...a: unknown[]) => fetchFullArticle(...a),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { contributorId: 7, username: "Tester" } },
    status: "authenticated",
  }),
}));

const suggestSpy = vi.fn();
vi.mock("@/lib/data", async () => {
  const { buildDataMock } = await import("./helpers/data-mock");
  const real = buildDataMock();
  return {
    ...real,
    store: {
      ...real.store,
      suggestCandidates: (input: Parameters<typeof real.store.suggestCandidates>[0]) => {
        suggestSpy(input);
        return real.store.suggestCandidates(input);
      },
    },
  };
});

import { TopicView } from "@/app/topic/TopicView";
import { seedIfEmpty } from "./helpers/data-mock";

function ytItem(videoId: string, title: string) {
  return {
    id: { videoId, kind: "youtube#video" },
    snippet: {
      title,
      description: "",
      channelTitle: "Some Channel",
      channelId: "UC123",
      thumbnails: {
        high: { url: `https://i.ytimg.com/vi/${videoId}/hq.jpg`, width: 480, height: 360 },
      },
    },
  };
}
function mockYtSearch(items: ReturnType<typeof ytItem>[]) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
}

beforeEach(async () => {
  window.localStorage.clear();
  fetchFullArticle.mockReset();
  routerReplace.mockReset();
  routerPush.mockReset();
  suggestSpy.mockClear();
  qid = "Q189603";
  pathname = "/topic/";
  await seedIfEmpty();
  fetchFullArticle.mockResolvedValue(article);
  vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", "test-key");
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** The `.candcard` element whose caption matches — the live DOM node, for identity comparison. */
function suggestionNode(caption: string): HTMLElement | undefined {
  const band = document.getElementById("general-band")!;
  return Array.from(band.querySelectorAll<HTMLElement>(".candcard")).find(
    (card) => card.querySelector("p")?.textContent?.trim() === caption
  );
}

describe("Coexistence QA — AC10 no-churn: the remaining suggestion keeps its DOM node identity", () => {
  it("does not remount/re-key a surviving suggestion when an unrelated suggestion is curated", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    mockYtSearch([
      ytItem("g1", "First respiration overview"),
      ytItem("g2", "Second respiration deep-dive"),
      ytItem("g3", "Third on plants"),
    ]);
    render(<TopicView />);

    await screen.findByText("First respiration overview");
    await waitFor(() => {
      expect(suggestionNode("Second respiration deep-dive")).toBeTruthy();
      expect(suggestionNode("Third on plants")).toBeTruthy();
    });
    await waitFor(() => expect(suggestSpy).toHaveBeenCalledTimes(1));

    // Capture the live DOM nodes of the two suggestions we will NOT curate.
    const node2Before = suggestionNode("Second respiration deep-dive")!;
    const node3Before = suggestionNode("Third on plants")!;

    // Curate the FIRST suggestion (g1) — an unrelated one.
    await userEvent.click(
      within(document.getElementById("general-band")!).getByRole("button", {
        name: "Curate this clip: First respiration overview",
      })
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox"),
      "Clear and accurate; one dated stat."
    );
    await userEvent.click(within(dialog).getByRole("checkbox"));
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Publish curation/ })
    );

    // g1 leaves the suggestion set; g2/g3 remain.
    await waitFor(() => expect(suggestionNode("First respiration overview")).toBeUndefined());

    // THE STRONGER BAR: the surviving suggestions are the SAME DOM node instances — not
    // replaced/remounted. A re-fetch/re-derive/re-key would yield new elements here.
    const node2After = suggestionNode("Second respiration deep-dive");
    const node3After = suggestionNode("Third on plants");
    expect(node2After).toBe(node2Before);
    expect(node3After).toBe(node3Before);

    // And the pipeline still ran exactly once (no re-run on curation), after a microtask flush.
    await new Promise((r) => setTimeout(r, 0));
    expect(suggestSpy).toHaveBeenCalledTimes(1);
  });
});
