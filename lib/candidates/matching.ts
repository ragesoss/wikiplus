import type { ArticleSection, Candidate } from "@/lib/data/types";
import type { RawCandidate } from "./types";

// Deterministic section-matching + placement (spec Decision 2). Pure functions over
// a single YouTube search response — no API calls, no I/O — so QA can unit-test the
// heuristic in isolation. The pipeline (pipeline.ts) wires these to the source + cache.

// ── Tokenization (Decision 2: case-insensitive, stopwords + ≤2-char tokens removed) ──

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had",
  "her", "was", "one", "our", "out", "his", "has", "how", "its", "who", "did",
  "with", "this", "that", "from", "they", "what", "your", "have", "more", "will",
  "about", "into", "than", "then", "them", "these", "those", "when", "which",
  "video", "videos", "youtube", "watch", "explained", "explainer", "tutorial",
]);

/** Lowercase + split on non-alphanumerics; drop stopwords and ≤2-char tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Distinct tokenized keywords for a section title. */
export function sectionKeywords(title: string): string[] {
  return [...new Set(tokenize(title))];
}

// ── Section matching ──────────────────────────────────────────────────────────────

export interface SectionMatch {
  raw: RawCandidate;
  /** Index in the source's relevance-ordered results (for tie-break #3). */
  rank: number;
  /** Distinct non-topic-generic section keywords found in the candidate text. */
  matchedKeywords: string[];
  /** Of the matched keywords, the ones that hit the title (title-weighted, tie-break #1). */
  titleKeywords: string[];
  /** Total score = distinct section keywords found anywhere in the candidate text. */
  score: number;
  /** The single keyword we name in the matchReason (first title hit, else first hit). */
  reasonKeyword: string;
}

/**
 * Rank ALL qualifying matches for one section, best-first (Decision 2 tie-break order).
 * A result qualifies only if ≥1 distinct section keyword that is NOT also a topic-title
 * token matches. Single-word generic sections (their only keyword is a topic token, or no
 * keyword survives tokenization) never match → empty list. The first element is the best
 * single match; later elements are the fall-throughs used when an earlier section already
 * claimed the best video (F3 / Product refinement — see placeCandidates).
 */
export function rankedMatchesForSection(
  section: ArticleSection,
  results: RawCandidate[],
  topicTokens: Set<string>
): SectionMatch[] {
  const keywords = sectionKeywords(section.title);
  // Non-topic-generic keywords are the only ones that can QUALIFY a match (threshold).
  const distinctive = keywords.filter((k) => !topicTokens.has(k));
  if (distinctive.length === 0) return []; // e.g. "History" alone, or only topic words.

  const matches: SectionMatch[] = [];
  results.forEach((raw, rank) => {
    const text = new Set(tokenize(raw.searchText));
    const titleTokens = new Set(tokenize(raw.caption));
    const matched = keywords.filter((k) => text.has(k));
    const distinctiveMatched = matched.filter((k) => !topicTokens.has(k));
    // Threshold: at least one DISTINCT, non-topic-generic keyword must match.
    if (distinctiveMatched.length === 0) return;
    const titleHits = matched.filter((k) => titleTokens.has(k));
    // Prefer a distinctive title hit as the reason keyword, else any distinctive hit.
    const reasonKeyword =
      titleHits.find((k) => !topicTokens.has(k)) ?? distinctiveMatched[0];
    matches.push({
      raw,
      rank,
      matchedKeywords: matched,
      titleKeywords: titleHits,
      score: matched.length,
      reasonKeyword,
    });
  });
  // Deterministic best-first order (same tie-break as the single-best pick).
  matches.sort((a, b) => (isBetter(a, b) ? -1 : isBetter(b, a) ? 1 : 0));
  return matches;
}

/**
 * Find the best single match for one section across all results (Decision 2).
 * Returns null when no result clears the threshold. Thin wrapper over
 * rankedMatchesForSection for callers/tests that want only the top pick.
 */
export function bestMatchForSection(
  section: ArticleSection,
  results: RawCandidate[],
  topicTokens: Set<string>
): SectionMatch | null {
  return rankedMatchesForSection(section, results, topicTokens)[0] ?? null;
}

/** Deterministic tie-break order (Decision 2): title hits, score, rank, videoId. */
function isBetter(a: SectionMatch, b: SectionMatch): boolean {
  if (a.titleKeywords.length !== b.titleKeywords.length)
    return a.titleKeywords.length > b.titleKeywords.length;
  if (a.score !== b.score) return a.score > b.score;
  if (a.rank !== b.rank) return a.rank < b.rank; // earlier YouTube relevance wins
  return a.raw.videoId < b.raw.videoId; // stable final tiebreak
}

// ── matchReason copy (design §6.1 — never asserts quality; no platform stutter) ────

/** General candidate reason. Rank 1 = "Top result"; ranks 2+ = "Search result". */
export function generalMatchReason(topicTitle: string, rankZeroBased: number): string {
  return rankZeroBased === 0
    ? `Top result for '${topicTitle}'`
    : `Search result for '${topicTitle}'`;
}

/**
 * Section candidate reason. Names the matched keyword + section; collapses to
 * "Matched to the '<section>' section" when the keyword IS the section label word
 * (avoids a "Mentions 'glycolysis' · matched to 'Glycolysis'" stutter, design §6.1).
 */
export function sectionMatchReason(keyword: string, sectionLabel: string): string {
  if (keyword.toLowerCase() === sectionLabel.toLowerCase().trim())
    return `Matched to the '${sectionLabel}' section`;
  return `Mentions '${keyword}' · matched to '${sectionLabel}'`;
}

// ── Placement (Decision 2: one home per video; section beats General) ──────────────

export interface Placement {
  /** Section candidates, anchored, deduped to one-per-section + one-home-per-video. */
  sectionCandidates: Candidate[];
  /** Up to GENERAL_CANDIDATE_COUNT general candidates, none reused from a section. */
  generalCandidates: Candidate[];
}

export const GENERAL_CANDIDATE_COUNT = 5;

/**
 * Assign each result to its single best AVAILABLE home (Decision 2 + F3 refinement):
 * for each section, in article order, claim its best match that hasn't already been
 * claimed by an earlier section; if the best video is taken, fall through to the
 * next-best still-unused candidate that clears the threshold (rather than the section
 * getting nothing). This is "best available match per section" — each section gets its
 * best *available* match, one home per video — which improves section-match
 * yield (AC5 / success metric). The remaining results, in relevance order, fill the
 * General band up to GENERAL_CANDIDATE_COUNT. Inputs are already deduped (within-set +
 * against curated + dismissed) by the caller; this only does placement + matchReason +
 * Candidate shape.
 */
export function placeCandidates(
  topicQid: string,
  topicTitle: string,
  results: RawCandidate[],
  sections: ArticleSection[]
): Placement {
  const topicTokens = new Set(tokenize(topicTitle));
  const usedVideoIds = new Set<string>();
  const sectionCandidates: Candidate[] = [];

  for (const section of sections) {
    // Best-first qualifying matches; take the first whose video is still unclaimed.
    const ranked = rankedMatchesForSection(section, results, topicTokens);
    const match = ranked.find((m) => !usedVideoIds.has(m.raw.videoId));
    if (!match) continue;
    usedVideoIds.add(match.raw.videoId);
    sectionCandidates.push(
      toCandidate(topicQid, match.raw, {
        general: false,
        sectionSlug: section.slug,
        sectionLabel: section.title,
        matchReason: sectionMatchReason(match.reasonKeyword, section.title),
      })
    );
  }

  const generalCandidates: Candidate[] = [];
  for (const raw of results) {
    if (generalCandidates.length >= GENERAL_CANDIDATE_COUNT) break;
    if (usedVideoIds.has(raw.videoId)) continue;
    usedVideoIds.add(raw.videoId);
    generalCandidates.push(
      toCandidate(topicQid, raw, {
        general: true,
        matchReason: generalMatchReason(topicTitle, generalCandidates.length),
      })
    );
  }

  return { sectionCandidates, generalCandidates };
}

/** Build a Candidate from a RawCandidate + placement fields (AC4 shape). */
function toCandidate(
  topicQid: string,
  raw: RawCandidate,
  placement: {
    general: boolean;
    sectionSlug?: string;
    sectionLabel?: string;
    matchReason: string;
  }
): Candidate {
  return {
    // VideoBase media/creator fields (carried from the normalized result).
    id: `cand_${raw.platform}_${raw.videoId}`,
    topicQid,
    platform: raw.platform,
    platformLabel: raw.platformLabel,
    orientation: raw.orientation,
    watchUrl: raw.watchUrl,
    embedUrl: raw.embedUrl,
    thumbnailUrl: raw.thumbnailUrl,
    thumbGrad: raw.thumbGrad,
    caption: raw.caption,
    creator: raw.creator,
    general: placement.general,
    sectionSlug: placement.sectionSlug,
    sectionLabel: placement.sectionLabel,
    // Candidate-only fields (AC4: vetted:false, source, matchReason; NO chips/note).
    vetted: false,
    source: raw.source,
    matchReason: placement.matchReason,
  };
}
