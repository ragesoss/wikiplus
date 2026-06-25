import { Suspense } from "react";
import { RecentFeedView } from "./RecentFeedView";

// The recent-curations feed route (`/recent`, issue #160). The cross-topic feed of the clips most
// recently curated across the whole site, newest first, click-to-play, cursor-paginated. Browsable
// LOGGED-OUT and composing the universal projector header (host="page") — see RecentFeedView.
//
// DYNAMIC (UNCACHED) RENDER — recorded in docs/ARCHITECTURE.md ("/recent"). A global chronological
// list changes on EVERY curation, so it does NOT fit the cacheable per-topic ISR shell: it is
// explicitly NOT placed on the (future) static/ISR read path. `dynamic = "force-dynamic"` is the
// Next.js signal that this route is never statically cached — every request renders fresh, so a new
// curation appears at the head immediately (freshness-on-every-curation). The production read path
// (ISR/Redis) is not built yet anyway (per-request Node SSR today). FUTURE SCALING (deferred, not
// built here): a short-TTL cache or a cursor-API treatment, consistent with "read path is the scale
// lever" — speculative caching infra is intentionally not built now.
export const dynamic = "force-dynamic";

export default function RecentPage() {
  return (
    <Suspense
      fallback={<p className="px-5 py-10 text-sm text-ink-plus/50">Loading…</p>}
    >
      <RecentFeedView />
    </Suspense>
  );
}
