"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { AuthControl } from "@/components/auth/AuthControl";
import { SiteHeader } from "@/components/header/SiteHeader";
import { LoginPromptPanel } from "@/components/auth/LoginPrompt";
import { store } from "@/lib/data";
import {
  RecentFeedView,
  type FeedPage,
  type FeedScope,
} from "@/app/recent/RecentFeedView";

// The watchlist feed view (`/watchlist`, issue #162 / design watchlist.md §3). The per-user feed of
// curations on the topics the signed-in viewer WATCHES — the SAME vertical curation feed as `/recent`
// (#160), reused VERBATIM via the `RecentFeedView` `scope` prop, only the data source + a little copy
// differ. This view adds the two things that are NOT feed-body states: the LOGIN GATE (the route is
// login-gated — AC7) and the route-level shell for it; the populated/loading/error/empty feed states
// are the shared `RecentFeedView`'s.

// The collapsed slim-bar height (host="page") — mirrors RecentFeedView so the gate/loading panel
// centers in the usable viewport below the sticky header, exactly like the feed's non-populated shell.
const SLIM_BAR_HEIGHT = 56;
const PANEL_MIN_HEIGHT = `calc(100dvh - ${SLIM_BAR_HEIGHT}px)`;

// The `/watchlist` scope (#162): the per-user feed read + the watchlist copy. Everything else (the
// scroll/playback/pagination/a11y model) is the shared feed body's. `renderEmpty` picks between the
// two empties by `watchedTopicCount` (no topics watched vs. watched-but-no-curations — §3.4/§3.5).
const watchlistScope: FeedScope = {
  h1: "Your watchlist",
  loadingLabel: "Loading your watchlist…",
  errorHeading: "Couldn't load your watchlist",
  errorBody: "Something went wrong loading your watchlist.",
  endPrimary: "You're all caught up.",
  endSecondary: "That's every curation on the topics you watch, newest first.",
  loadInitial: () => store.listWatchlistCurations({}),
  loadMore: (cursor) => store.listWatchlistCurations({ cursor }),
  renderEmpty: (page: FeedPage) => (
    <WatchlistEmptyPanel watchedTopicCount={page.watchedTopicCount ?? 0} />
  ),
};

export function WatchlistView() {
  // The signed-in viewer — the gate decision (and the feed read's per-user scope) is made in the
  // ALREADY-AUTHENTICATED client session, so the route stays a client SPA shell like the topic +
  // recent views (no server redirect; the read is server-gated regardless — AC7/AC11).
  const { status } = useSession();
  const header = <SiteHeader host="page" auth={<AuthControl variant="home" />} />;

  // Authenticated → the shared feed body, scoped to the viewer's watched topics. RecentFeedView
  // renders its own header + all the feed states (loading/error/empty/populated), so this view
  // delegates entirely once signed in.
  if (status === "authenticated") {
    return <RecentFeedView scope={watchlistScope} />;
  }

  // Loading (session resolving) or unauthenticated → the route-level shell: the universal header +
  // a centered panel below the slim bar. Logged out gets the LOGIN GATE (AC7 — never a blank page,
  // never a leak of anyone's watchlist); the brief session-loading frame shows a polite status.
  return (
    <main>
      {header}
      <h1 className="sr-only">Your watchlist</h1>
      <div
        className="flex items-center justify-center bg-[var(--color-content-white)] px-5"
        style={{ minHeight: PANEL_MIN_HEIGHT }}
      >
        {status === "loading" ? (
          <p
            role="status"
            aria-live="polite"
            className="text-sm font-semibold text-ink2"
          >
            Loading your watchlist…
          </p>
        ) : (
          // The login gate (design §3.2). Reuses the inline LoginPromptPanel (its own plus-card + the
          // gate data-notice + the canonical "Log in with Wikipedia" button). Watchlist-feed copy
          // (VERBATIM from the design): the gate, not a feed state, so it is route-level here.
          <div className="w-full max-w-md">
            <LoginPromptPanel
              title="Log in to see your watchlist"
              body="Your watchlist feed shows the latest curations on the topics you follow. Log in with Wikipedia to watch topics and keep up with them. Reading the rest of wiki+ stays anonymous."
            />
          </div>
        )}
      </div>
    </main>
  );
}

// ── The two empty states (design §3.4 / §3.5) — distinguished by the watched-topic count. ──────────
// They are DISTINCT panels with distinct copy (never conflate "no topics watched" with "no curations
// yet"): zero watched topics ⇒ go find some; ≥1 watched but none has a vouched curation ⇒ nothing new
// yet (with a graceful path to the broader feed). Indigo-Press light card, mirroring the `/recent`
// empty panel's treatment.
function WatchlistEmptyPanel({
  watchedTopicCount,
}: {
  watchedTopicCount: number;
}) {
  if (watchedTopicCount === 0) {
    // §3.4 — the viewer follows no topics yet. Send them to find some (you watch a topic ON its page).
    return (
      <div className="w-full max-w-[460px] border-2 border-hardbox bg-surface-raised p-6 text-center shadow-[4px_4px_0_var(--color-hardbox-offset)]">
        <h2 className="plus-disp text-xl font-bold text-ink-plus">
          You&apos;re not watching any topics yet
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink2">
          Watch a topic to see its new curations here. Open a topic and tap ＋ Watch topic to follow
          it.
        </p>
        <Link
          href="/"
          aria-label="Find a topic to watch"
          className="mt-5 inline-flex min-h-[48px] items-center gap-2 border-2 border-hardbox bg-brand px-5 py-2.5 text-base font-bold text-white shadow-[4px_4px_0_var(--color-hardbox-offset)] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hardbox"
        >
          Find a topic <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }
  // §3.5 — the viewer follows topics, but none has a (vouched) curation yet. Honest "nothing yet",
  // with a quiet path to the broader recent feed while the watched set is quiet.
  return (
    <div className="w-full max-w-[460px] border-2 border-hardbox bg-surface-raised p-6 text-center shadow-[4px_4px_0_var(--color-hardbox-offset)]">
      <h2 className="plus-disp text-xl font-bold text-ink-plus">
        Nothing new on your topics yet
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink2">
        You&apos;re watching topics, but they don&apos;t have any curations yet. New curations on the
        topics you watch will show up here, newest first.
      </p>
      <Link
        href="/recent"
        aria-label="Browse all recent curations"
        className="mt-5 inline-block text-sm font-bold text-link hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
      >
        Browse all recent curations <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
