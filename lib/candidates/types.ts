import type { ArticleSection, Candidate } from "@/lib/data/types";

// The pluggable candidate-source layer (spec AC13; ARCHITECTURE §"Candidate
// suggestion" — "multi-platform by design; YouTube-only in the MVP"). A source
// runs ONE search for a topic and returns provider-neutral results; the shared
// pipeline (lib/candidates/pipeline.ts) does section-matching, dedup, placement,
// caching and the no-key/error fallback around it. Adding TikTok/Vimeo later is a
// new `CandidateSource` registered in lib/candidates/index.ts — not a rewrite.

/**
 * One normalized search hit from a provider, before placement/matchReason. The
 * pipeline turns these into `Candidate`s (it owns `general`, `sectionSlug`,
 * `matchReason`, the placement, and dedup). A source only knows how to *fetch and
 * normalize* its platform's results.
 */
export interface RawCandidate {
  /** Stable provider video id (the dedup key, with `platform`). */
  videoId: string;
  platform: Candidate["platform"];
  platformLabel: string;
  /** Human-facing label of the source, e.g. "YouTube" (→ Candidate.source). */
  source: string;
  watchUrl: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  thumbGrad?: string;
  /** Video title shown as the candidate caption. */
  caption: string;
  /** Free text the section matcher reads (title + description + tags joined). */
  searchText: string;
  orientation: Candidate["orientation"];
  creator: Candidate["creator"];
}

/** The context a source needs to run its single search for a topic. */
export interface SourceContext {
  topicQid: string;
  topicTitle: string;
}

/**
 * A registered candidate source. `isEnabled()` gates the live path (e.g. YouTube
 * is disabled when its key is unset — AC1/AC14); `search()` makes the single
 * provider call and returns normalized hits in the provider's own relevance order.
 * It must NEVER throw — it resolves to `[]` on any key/quota/network failure, so
 * the pipeline degrades to seeded/empty without a broken page (AC14).
 */
export interface CandidateSource {
  /** e.g. "youtube" — for logging/registry only. */
  id: string;
  isEnabled(): boolean;
  search(ctx: SourceContext): Promise<RawCandidate[]>;
}

/** Extra context for the live pipeline: the article sections to match against. */
export interface SuggestContext {
  topicTitle: string;
  sections: ArticleSection[];
  /** Curated clips for the topic — deduped against (AC8). */
  curatedVideoKeys: Set<string>;
}
