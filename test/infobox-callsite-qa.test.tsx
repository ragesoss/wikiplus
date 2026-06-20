import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FullArticle } from "@/lib/wiki/article";

// QA call-site integration for the ＋plus panel handler (issue #16 / design §10): proves
// `onBrowse` (Browse/Jump) is a pure scroll that opens NO gate and fires NO write regardless
// of session. The secondary curate block is removed — this file now covers only the browse
// path. The wiki module is MOCKED (no network egress). Drives the EMPTY topic (no clips →
// the empty panel face).

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

describe("TopicView — ＋plus panel handler wiring (issue #16 §10)", () => {
  it("the curate/add button is NOT present in the panel (secondary block removed)", async () => {
    render(<TopicView />);
    // Wait for the panel to appear (empty state).
    await screen.findByText("uncurated videos");
    expect(screen.queryByRole("button", { name: "＋ Curate a video" })).toBeNull();
    expect(screen.queryByRole("button", { name: "＋ Add a video" })).toBeNull();
  });

  it("onBrowse (Browse suggested videos) is a pure scroll — no login gate, no modal, even logged out", async () => {
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<TopicView />);
    const browse = await screen.findByRole("button", { name: "Browse suggested videos" });
    await userEvent.click(browse);
    // No write surface triggered: no gate, no curate/add modal.
    expect(screen.queryByText("Log in to curate")).toBeNull();
    expect(screen.queryByText("Log in to add a video")).toBeNull();
    expect(screen.queryByText("Curate this clip")).toBeNull();
    expect(screen.queryByText("Add a video")).toBeNull();
    // It scrolled (to the General band) — the pure non-write path.
    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
  });
});
