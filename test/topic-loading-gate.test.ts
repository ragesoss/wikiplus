import { describe, expect, it } from "vitest";
import {
  shouldShowEmptySuggestions,
  type EmptySuggestionsInput,
} from "@/app/topic/loading-state";

// The single load-bearing gate for the misleading-empty bug (#146, topic-loading-states §4).
// The settled-empty (b) "no suggestions" line renders ONLY when the plus side has GENUINELY
// settled empty — never during load, never as a consequence of an article error (AC1, AC2).

/** A genuinely-settled-empty plus side: the ONE input that returns true. */
const settledEmpty: EmptySuggestionsInput = {
  storeReady: true,
  storeError: false,
  candidatesLoading: false,
  hasCurated: false,
  sectionCandidatesCount: 0,
  generalCandidatesCount: 0,
};

describe("shouldShowEmptySuggestions (the §4 gate)", () => {
  it("shows the empty line only when the plus side has genuinely settled empty (b)", () => {
    expect(shouldShowEmptySuggestions(settledEmpty)).toBe(true);
  });

  it("AC1: never shows while the store is still loading", () => {
    expect(
      shouldShowEmptySuggestions({ ...settledEmpty, storeReady: false })
    ).toBe(false);
  });

  it("AC1: never shows while the candidate search is still loading", () => {
    expect(
      shouldShowEmptySuggestions({ ...settledEmpty, candidatesLoading: true })
    ).toBe(false);
  });

  it("AC2: never shows when the store read errored (the rail shows its own floor)", () => {
    expect(
      shouldShowEmptySuggestions({ ...settledEmpty, storeError: true })
    ).toBe(false);
  });

  it("does not show when there are curated clips (reads as fully-curated, not empty)", () => {
    expect(
      shouldShowEmptySuggestions({ ...settledEmpty, hasCurated: true })
    ).toBe(false);
  });

  it("does not show when section candidates remain", () => {
    expect(
      shouldShowEmptySuggestions({ ...settledEmpty, sectionCandidatesCount: 2 })
    ).toBe(false);
  });

  it("does not show when general candidates remain", () => {
    expect(
      shouldShowEmptySuggestions({ ...settledEmpty, generalCandidatesCount: 3 })
    ).toBe(false);
  });

  it("AC2: is blind to fetchState — the gate has no article input, so an article error cannot trigger or suppress it; a genuinely-settled-empty plus side returns true regardless of the (absent) article state", () => {
    // The input shape carries NO fetchState: the gate cannot depend on the article succeeding,
    // and an article error cannot, on its own, surface this copy. The same settled-empty input
    // is the plus side's own honest state whether the article is ready, loading, or errored.
    expect(shouldShowEmptySuggestions(settledEmpty)).toBe(true);
    expect("fetchState" in settledEmpty).toBe(false);
  });
});
