import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FullArticle } from "@/lib/wiki/article";

// QA call-site integration for the ＋plus Overview card (design overview-card-cleanup.md): the
// card is a quiet stats card — no curate/add button, and no Browse/Jump scroll button in any
// state. The wiki module is MOCKED (no network egress). Drives the EMPTY topic (no clips → the
// empty panel face: the dashed "uncurated videos" volume block).

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

let sessionStatus: "authenticated" | "unauthenticated" = "unauthenticated";
vi.mock("next-auth/react", () => ({
  useSession: () =>
    sessionStatus === "authenticated"
      ? { data: { user: { contributorId: 7, username: "Tester" } }, status: "authenticated" }
      : { data: null, status: "unauthenticated" },
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
  routerReplace.mockReset();
  routerPush.mockReset();
  sessionStatus = "unauthenticated";
  qid = "Q189603"; // Cellular respiration is seeded with NO clips → empty panel
  pathname = "/topic/";
  await seedIfEmpty();
  fetchFullArticle.mockResolvedValue(article);
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("TopicView — ＋plus Overview card (overview-card-cleanup)", () => {
  it("the curate/add button is NOT present in the card (logged out, empty topic)", async () => {
    render(<TopicView />);
    // Wait for the card to appear (empty state).
    await screen.findByText("uncurated videos");
    expect(screen.queryByRole("button", { name: "＋ Curate a video" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add a video/i })).toBeNull();
  });

  it("renders no Browse/Jump scroll button in the card (AC3)", async () => {
    render(<TopicView />);
    await screen.findByText("uncurated videos");
    expect(
      screen.queryByRole("button", { name: /Browse suggested videos/i })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Jump to videos/i })).toBeNull();
  });
});
