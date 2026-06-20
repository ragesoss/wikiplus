"use client";

// The narrow-search coordination signal (docs/design/topic-mobile-search.md §3.1, plumbing
// option (a) — the React-prop lift). ONE derived boolean, owned by the Topic host header, shared
// by the three independent chrome slots so they collapse/restore as a single coordinated change:
//
//   narrowSearchExpanded = (viewport < md, 768px) AND (the topic-disclosure search field is open).
//
// Why a context, not props: the Topic host receives `search` and `auth` as OPAQUE ReactNode slots
// (the callers pass `<TopicHeaderSearch/>` / `<HeaderAuth/>`), so the host cannot inject a prop into
// them directly. The host PROVIDES this context; the disclosure REPORTS its open state up via
// `setSearchFieldOpen`, the host ANDs it with the < md media check, and the consumers (the wordmark
// projector force-glyph, the auth icon-only skin) READ `narrowSearchExpanded`. The composition logic
// stays in the header (§3.1a), with no new component / variant / fork.
//
// Outside the Topic host (Home / Page hosts, or any non-provided tree) the defaults are inert:
// `narrowSearchExpanded` is false and `setSearchFieldOpen` is a no-op — so TopicSearch and AuthControl
// render exactly as before when not under this provider.

import { createContext, useContext } from "react";

export interface NarrowSearchContextValue {
  /** True only when the viewport is < md AND the topic-disclosure search field is open (§3.1). It
   *  drives BOTH neighbour collapses (wordmark → "+" glyph, login → icon-only) and the row layout
   *  together, so the two glyphs and the field appear/disappear in one coordinated change. */
  narrowSearchExpanded: boolean;
  /** The topic-disclosure search reports its open/closed state here (the lift, §3.1a). The host
   *  combines it with the < md media check to derive `narrowSearchExpanded`. No-op outside the
   *  Topic host provider. */
  setSearchFieldOpen: (open: boolean) => void;
}

const NarrowSearchContext = createContext<NarrowSearchContextValue>({
  narrowSearchExpanded: false,
  setSearchFieldOpen: () => {},
});

export const NarrowSearchProvider = NarrowSearchContext.Provider;

export function useNarrowSearch(): NarrowSearchContextValue {
  return useContext(NarrowSearchContext);
}
