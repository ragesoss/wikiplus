// TopicHeader — RETIRED (#72, AC1). The bespoke two-block "Wiki" + separate "＋plus" header (with
// the unlinked wordmark + duplicated auth) is gone. This file is now a thin COMPATIBILITY
// RE-EXPORT of the ONE shared Daylight Projector header (components/header/SiteHeader.tsx), Topic
// host: the seam-aligned lockup straddling the column divider, the scroll-aware Tier-A → slim beam,
// the wordmark→home link, the search slot, and a single consolidated AuthControl.
//
// New code should consume `SiteHeader host="topic"` directly (as app/topic/TopicView.tsx does).
// This wrapper exists only so existing call sites / tests that imported `TopicHeader` keep working
// against the unified header — there is NO surviving bespoke header implementation here (AC1).
//
// Contract: docs/specs/shared-header.md · docs/design/shared-header.md.

import {
  SiteHeader,
  TopicHeaderSearch,
} from "@/components/header/SiteHeader";
import { HeaderAuth } from "@/components/header/HeaderAuth";

export function TopicHeader({ articleTitle }: { articleTitle: string }) {
  return (
    <SiteHeader
      host="topic"
      articleTitle={articleTitle}
      search={<TopicHeaderSearch />}
      auth={<HeaderAuth />}
    />
  );
}
