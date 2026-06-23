import { Suspense } from "react";
import { ProfileView } from "../ProfileView";

// The public contributor profile route (issue #54 / D3, AC1–AC4). Lives at
// `/contributor/<username>`, paralleling the title-based Topic catch-all
// (`app/topic/[[...slug]]/page.tsx`) and Wikipedia's `Special:Contributions/<user>`
// (Decision 1). `<username>` is the Wikimedia username (`contributor.handle` / `clip.curatedBy`),
// slug-encoded like a title (spaces → `_`); `ProfileView` decodes it client-side and reads
// `getContributorByUsername` + `listClipsByContributor` through the seam — ANONYMOUS, no session
// (AC1/AC2). It is a plain dynamic read page: NO ISR/Redis caching is added (deferred), and the
// profile reads run ONLY here, never on the cached Topic shell (Decision 5 / AC9).
//
// `dynamicParams = true` (the SSR default, set explicitly): an arbitrary username is rendered on
// demand by the running server — no exhaustive param list. The server emits the neutral loading
// shell (ProfileView's skeleton); ProfileView resolves the profile client-side and decides the
// state (populated / empty / not-found), so a not-found never flashes during the read (AC3/AC4).
export const dynamicParams = true;

export default function ContributorPage() {
  return (
    <Suspense fallback={<p className="px-5 py-10 text-sm text-ink-plus/50">Loading…</p>}>
      <ProfileView />
    </Suspense>
  );
}
