// Derived loading/empty/error state for the Topic page (topic-loading-states §4).
//
// The Topic page has two INDEPENDENT regions (the article column + the plus side) on independent
// async flows; the page is the product of an article state × a plus state (§4 matrix). The single
// load-bearing fix in #146 is honesty of copy: the settled-empty (b) "no suggestions" line must
// render ONLY when the plus side has GENUINELY settled empty — never during load, never as a
// consequence of an article error. This module is the PURE derivation so the gate is unit-testable
// in isolation (the render in TopicView reads from it).

/** The plus-side facts the empty-suggestion gate consumes. Note the absence of `fetchState`: the
 *  gate is a PLUS-SIDE condition, blind to the article state as a positive enabler and never
 *  triggered by an article error (§4, AC2). */
export interface EmptySuggestionsInput {
  /** The store read has settled (`storeReady`). */
  storeReady: boolean;
  /** The store read failed (`storeError`) — the rail shows its own error floor instead. */
  storeError: boolean;
  /** The live candidate search is still in flight. */
  candidatesLoading: boolean;
  /** ≥1 curated clip. */
  hasCurated: boolean;
  /** Section-anchored remaining suggestions. */
  sectionCandidatesCount: number;
  /** General-band remaining suggestions. */
  generalCandidatesCount: number;
}

/**
 * The SINGLE load-bearing gate (topic-loading-states §4, AC1/AC2). The settled-empty (b)
 * "no suggestions" line renders ONLY when ALL of these hold:
 *   - the store has settled (`storeReady`) and did NOT error (`!storeError`);
 *   - the candidate search has settled (`!candidatesLoading`);
 *   - there are 0 curated clips; and
 *   - both candidate pools are genuinely zero.
 *
 * It is blind to `fetchState` — an article that is loading or errored cannot, on its own, surface
 * this copy. Per §4 row 10, when the article errors and the plus side settled empty, this still
 * returns `true` (the plus side's own honest state), but `ArticleError` carries no suggestion copy.
 */
export function shouldShowEmptySuggestions(s: EmptySuggestionsInput): boolean {
  return (
    s.storeReady &&
    !s.storeError &&
    !s.candidatesLoading &&
    !s.hasCurated &&
    s.sectionCandidatesCount === 0 &&
    s.generalCandidatesCount === 0
  );
}
