import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FullArticle } from "@/lib/wiki/article";

// QA call-site integration for the ＋plus panel handler split (issue #16 / design §10): proves
// the split is wired CORRECTLY through TopicView — `onCurate` (Curate/Add) preserves the
// `requireLogin` gate (logged-out → the login gate, NOT the modal), and `onBrowse` (Browse/Jump)
// is a pure scroll that opens NO gate and fires NO write regardless of session. The wiki module is
// MOCKED (no network egress). Drives the EMPTY topic (no clips → the empty panel face).

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

// LOGGED OUT — the curate gate must NOT clear; clicking ＋ Curate a video opens the login gate.
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

describe("TopicView — ＋plus panel handler split wiring (issue #16 §10)", () => {
  it("onCurate (＋ Curate a video) preserves the login gate when logged out — opens the gate, not the modal", async () => {
    render(<TopicView />);
    const curate = await screen.findByRole("button", { name: "＋ Curate a video" });
    await userEvent.click(curate);
    // The login gate ("Log in to curate") appears — the curate modal ("Curate this clip") does NOT.
    expect(await screen.findByText("Log in to curate")).toBeInTheDocument();
    expect(screen.queryByText("Curate this clip")).toBeNull();
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

  it("onCurate opens the real Curate modal when logged in (gate clears, split still curates)", async () => {
    sessionStatus = "authenticated";
    render(<TopicView />);
    const curate = await screen.findByRole("button", { name: "＋ Curate a video" });
    await userEvent.click(curate);
    // Signed in → the curate gate clears and the real modal opens (there is a suggestion to promote).
    await waitFor(() =>
      expect(screen.getByText("Curate this clip")).toBeInTheDocument()
    );
    expect(screen.queryByText("Log in to curate")).toBeNull();
  });
});
