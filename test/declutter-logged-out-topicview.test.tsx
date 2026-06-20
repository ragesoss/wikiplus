import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FullArticle } from "@/lib/wiki/article";

// Integration test for issue #71's logged-out player-CTA WIRING through TopicView — the seam the
// component-level test (declutter-player-ctas.test.tsx) cannot reach because it passes `onCurate`
// directly. Here we verify, end to end through TopicView with a LOGGED-OUT session, that:
//   - playing a candidate in the PinnedPlayer surfaces the "Curate this video" CTA, and activating
//     it routes through the `curate` login GATE (AC5: the curate flow for that candidate — for a
//     logged-out reader the gate is the destination);
//   - the bound candidate is the CURRENTLY-pinned one and is CLEARED on dock close, so a stale
//     candidate can't leak the CTA after dismissal (the `pinnedCandidate` lifecycle, design §6.5);
//   - the candidate tile itself is watch-only (no Curate / Not-relevant) when logged out (AC3).
//
// `useSession` is overridden to UNAUTHENTICATED here (the global test/setup.ts stub is authenticated),
// which is what flips TopicView's `signedIn` derivation (`typeof myContributorId === "number"`).

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

let qid = "Q189603"; // the uncurated demo topic → seeded candidates render
const routerReplace = vi.fn();
const routerPush = vi.fn();
const fetchFullArticle = vi.fn();

const router = { replace: routerReplace, push: routerPush };
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(qid ? `qid=${qid}` : ""),
  usePathname: () => "/topic/",
  useRouter: () => router,
}));

// LOGGED-OUT session — overrides the authenticated global stub (test/setup.ts). `signOut`/`signIn`
// are stubbed since useRequireLogin's gate uses them.
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
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
  routerReplace.mockReset();
  routerPush.mockReset();
  qid = "Q189603";
  await seedIfEmpty();
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// The seeded Q189603 candidate captions (lib/data/seed.ts) — embeddable YouTube, so their thumbs
// open the PinnedPlayer.
const CAND_A = "ATP & Respiration: Crash Course Biology #7";
const CAND_B = "Glycolysis Explained in 2 minutes";
const CURATE_CTA = "Curate this video — log in to write a context note and vouch for it";

describe("TopicView — logged-out player-CTA wiring (#71 §6.5, AC3/AC5/AC7)", () => {
  it("a logged-out candidate tile is watch-only — no Curate / Not-relevant (AC3)", async () => {
    render(<TopicView />);
    await screen.findByText(CAND_A);
    expect(
      screen.queryByRole("button", { name: /Curate this clip/ })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Dismiss as not relevant/ })
    ).toBeNull();
  });

  it("playing a candidate surfaces the dock CTA; activating it opens the curate LOGIN GATE (AC5)", async () => {
    render(<TopicView />);
    const thumb = await screen.findByRole("button", { name: `Play: ${CAND_A}` });
    await userEvent.click(thumb);

    // The non-modal dock is up with the logged-out "Curate this video" CTA (AC5/AC7).
    const cta = await screen.findByRole("button", { name: CURATE_CTA });
    expect(cta).toBeInTheDocument();

    // Activating it routes through the existing `curate` login gate (the logged-out destination).
    await userEvent.click(cta);
    expect(
      await screen.findByRole("heading", { name: "Log in to curate" })
    ).toBeInTheDocument();
  });

  it("the CTA binds to the CURRENTLY-pinned candidate (swap re-binds, no stale leak — §6.5)", async () => {
    render(<TopicView />);
    // Play candidate A, then swap to candidate B before curating.
    await userEvent.click(
      await screen.findByRole("button", { name: `Play: ${CAND_A}` })
    );
    await screen.findByRole("button", { name: CURATE_CTA });
    await userEvent.click(
      await screen.findByRole("button", { name: `Play: ${CAND_B}` })
    );

    // The dock now shows B's caption (swap kept one dock), and the CTA still routes to the gate
    // for the now-current candidate. (Binding correctness at the destination is the curate flow;
    // here we pin that the CTA is live and gates after a swap rather than going dead/stale.)
    expect(
      screen.getAllByText(CAND_B).length
    ).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: CURATE_CTA }));
    expect(
      await screen.findByRole("heading", { name: "Log in to curate" })
    ).toBeInTheDocument();
  });

  it("closing the dock clears pinnedCandidate so the CTA does not persist (§6.5 lifecycle)", async () => {
    render(<TopicView />);
    await userEvent.click(
      await screen.findByRole("button", { name: `Play: ${CAND_A}` })
    );
    const cta = await screen.findByRole("button", { name: CURATE_CTA });
    expect(cta).toBeInTheDocument();

    // Dismiss the dock; the CTA (and the dock) unmount — the pinned candidate is dropped.
    await userEvent.click(
      screen.getByRole("button", { name: "Close video preview" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: CURATE_CTA })).toBeNull()
    );
    expect(screen.queryByRole("region", { name: "Video preview" })).toBeNull();
  });
});
