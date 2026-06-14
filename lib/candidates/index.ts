import { suggestCandidates, type SuggestInput } from "./pipeline";
import type { CandidateSource } from "./types";
import { youtubeSource } from "./youtube";

// The candidate-source registry (spec AC13). Platform-agnostic by design: a future
// TikTok/Vimeo source is added here as another `CandidateSource` — additive, not a
// rewrite. This round registers ONLY YouTube (ARCHITECTURE §"Candidate suggestion":
// "multi-platform by design; YouTube-only in the MVP"). A registered-but-disabled
// source (no key) is simply skipped by the pipeline (AC1).
export const CANDIDATE_SOURCES: CandidateSource[] = [youtubeSource];

/** True when at least one source is enabled (the live path can run). */
export function liveCandidatesEnabled(): boolean {
  return CANDIDATE_SOURCES.some((s) => s.isEnabled());
}

/**
 * Run the live candidate pipeline for a topic, or return null when no source is
 * enabled (the no-key no-op — caller falls back to the seeded/empty store). This is
 * the single entry point the DataStore's live path calls.
 */
export function runCandidatePipeline(
  input: SuggestInput
): Promise<Awaited<ReturnType<typeof suggestCandidates>>> {
  return suggestCandidates(CANDIDATE_SOURCES, input);
}

export type { SuggestInput } from "./pipeline";
export type { CandidateSource, RawCandidate } from "./types";
