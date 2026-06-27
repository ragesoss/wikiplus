import { Suspense } from "react";
import { WatchlistView } from "./WatchlistView";

// The watchlist feed route (`/watchlist`, issue #162). The per-user feed of curations on the topics
// the signed-in viewer WATCHES — the same vertical curation feed as `/recent` (#160), reused via the
// `RecentFeedView` scope, sourced from only the watched topics, newest first, cursor-paginated, and
// LOGIN-GATED (a logged-out visit gets the login gate, never a blank page — see WatchlistView).
//
// DYNAMIC (UNCACHED) RENDER — like `/recent`. A per-user feed that changes on every curation to a
// watched topic does not fit the (future) static/ISR per-topic shell, so it is explicitly NOT on the
// cached read path. `dynamic = "force-dynamic"` is the Next.js signal that this route is never
// statically cached — and the watched-set scope + the login gate are per-viewer by nature. The
// production read path (ISR/Redis) is not built yet anyway (per-request Node SSR today).
export const dynamic = "force-dynamic";

export default function WatchlistPage() {
  return (
    <Suspense
      fallback={<p className="px-5 py-10 text-sm text-ink-plus/50">Loading…</p>}
    >
      <WatchlistView />
    </Suspense>
  );
}
