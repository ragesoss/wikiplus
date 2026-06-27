import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Watchlist UI (issue #162): the topic-page watch control (Infobox) + the /watchlist route's
// login gate (AC7) and its two empty states (AC9 no-topics / AC10 watched-but-no-curations). The
// store/boundary ACs are covered in test/watchlist.test.ts; this asserts the rendered surfaces.

// ── Mocks the views need (the shared-header / topic-view component-test pattern). ──
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/watchlist",
  useSearchParams: () => new URLSearchParams(),
}));

// A mutable session the mocked `useSession` returns, flipped per test.
let mockSession: {
  data: { user: { contributorId?: number; username?: string } } | null;
  status: "authenticated" | "unauthenticated" | "loading";
} = { data: null, status: "unauthenticated" };
vi.mock("next-auth/react", () => ({
  useSession: () => mockSession,
  signIn: vi.fn(),
}));

const listWatchlistCurations = vi.fn();
vi.mock("@/lib/data", () => ({
  store: {
    listWatchlistCurations: (...a: unknown[]) => listWatchlistCurations(...a),
    listRecentCurations: vi.fn(),
  },
}));

import { Infobox } from "@/components/topic/Infobox";
import { WatchlistView } from "@/app/watchlist/WatchlistView";
import type { TopicStats } from "@/lib/data/types";

const STATS: TopicStats = { videos: 3, creators: 2, curators: 1 };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Infobox watch control (issue #162 — states + click)", () => {
  it("renders '＋ Watch topic' + the helper line when not watching, and calls onToggleWatch on click", () => {
    const onToggleWatch = vi.fn();
    render(
      <Infobox
        hasCurated
        stats={STATS}
        suggestionCount={0}
        watching={false}
        onToggleWatch={onToggleWatch}
      />
    );
    const btn = screen.getByRole("button", {
      name: /Watch this topic — follow it in your watchlist/,
    });
    expect(btn).toHaveTextContent("Watch topic");
    expect(
      screen.getByText(/Follow this topic to see its new curations/)
    ).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onToggleWatch).toHaveBeenCalledTimes(1);
  });

  it("renders '✓ Watching' (no helper line) when watching", () => {
    render(
      <Infobox
        hasCurated
        stats={STATS}
        suggestionCount={0}
        watching
        onToggleWatch={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", {
        name: /Watching this topic — tap to remove from your watchlist/,
      })
    ).toHaveTextContent("Watching");
    expect(
      screen.queryByText(/Follow this topic to see its new curations/)
    ).not.toBeInTheDocument();
  });

  it("shows the busy word + is disabled while a watch write is in flight", () => {
    // The optimistic flip sets `watching` to the TARGET before the in-flight word shows, so
    // watching=true + inFlight is an add-in-flight ("Adding…"); watching=false + inFlight is an
    // un-watch-in-flight ("Removing…"). Assert both arms.
    const { rerender } = render(
      <Infobox
        hasCurated
        stats={STATS}
        suggestionCount={0}
        watching
        watchInFlight
        onToggleWatch={vi.fn()}
      />
    );
    let btn = screen.getByRole("button", { name: /Watching this topic/ });
    expect(btn).toHaveTextContent("Adding…");
    expect(btn).toBeDisabled();

    rerender(
      <Infobox
        hasCurated
        stats={STATS}
        suggestionCount={0}
        watching={false}
        watchInFlight
        onToggleWatch={vi.fn()}
      />
    );
    btn = screen.getByRole("button", { name: /Watch this topic/ });
    expect(btn).toHaveTextContent("Removing…");
    expect(btn).toBeDisabled();
  });

  it("renders NO watch control when onToggleWatch is absent", () => {
    render(<Infobox hasCurated stats={STATS} suggestionCount={0} />);
    expect(
      screen.queryByRole("button", { name: /Watch this topic/ })
    ).not.toBeInTheDocument();
  });
});

describe("/watchlist route — login gate + empty states (AC7/AC9/AC10)", () => {
  it("logged-out → the login gate, never a blank page or someone's watchlist (AC7)", async () => {
    mockSession = { data: null, status: "unauthenticated" };
    render(<WatchlistView />);
    expect(
      await screen.findByText("Log in to see your watchlist")
    ).toBeInTheDocument();
    // The per-user feed read is never issued for a logged-out visitor.
    expect(listWatchlistCurations).not.toHaveBeenCalled();
  });

  it("signed-in + zero watched topics → the 'not watching any topics yet' empty (AC9)", async () => {
    mockSession = {
      data: { user: { contributorId: 1, username: "Ada" } },
      status: "authenticated",
    };
    listWatchlistCurations.mockResolvedValue({
      items: [],
      nextCursor: null,
      watchedTopicCount: 0,
    });
    render(<WatchlistView />);
    expect(
      await screen.findByText("You're not watching any topics yet")
    ).toBeInTheDocument();
  });

  it("signed-in + watching topics but no curations → the 'nothing new yet' empty (AC10)", async () => {
    mockSession = {
      data: { user: { contributorId: 1, username: "Ada" } },
      status: "authenticated",
    };
    listWatchlistCurations.mockResolvedValue({
      items: [],
      nextCursor: null,
      watchedTopicCount: 2,
    });
    render(<WatchlistView />);
    expect(
      await screen.findByText("Nothing new on your topics yet")
    ).toBeInTheDocument();
  });
});
