import { suggestCandidates, type SuggestInput } from "./pipeline";
import type { CandidateSource } from "./types";
import { youtubeSource } from "./youtube";

// The candidate-source registry (spec AC13). Platform-agnostic by design: a future
// TikTok/Vimeo source is added here as another `CandidateSource` — additive, not a
// rewrite. This round registers ONLY YouTube (ARCHITECTURE §"Candidate suggestion":
// "multi-platform by design; YouTube-only in the MVP"). A registered-but-disabled
// source (no key) is simply skipped by the pipeline (AC1).
export const CANDIDATE_SOURCES: CandidateSource[] = [youtubeSource];

/**
 * Issue #60 (coexistence, design §3.1 / spec AC6): the SINGLE named default for how many
 * General-pool *suggestions* render before the "See N more" control. It is the ONE source of
 * truth for this cap — never a literal repeated at a call site. Curated general clips are NOT
 * subject to it (curation is the priority content); section-anchored suggestions are not capped
 * either (the pipeline anchors only a small number per section). 8 is the calm low end of the
 * owner's ~8–10 guidance: generous enough to seed curation, few enough that the band stays a
 * scannable overview once curated clips already lead the row. Same value in empty and mixed.
 */
export const GENERAL_SUGGESTION_DEFAULT = 8;

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
