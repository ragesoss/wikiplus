import type { ArticleSection, Candidate } from "@/lib/data/types";
import { isStale, readCache, writeCache } from "./cache";
import { dismissedKeysForTopic, identityKey } from "./dismissals";
import { placeCandidates } from "./matching";
import type { CandidateSource, RawCandidate } from "./types";

// The candidate pipeline (spec AC2/AC7/AC8/AC11/AC13/AC14). Orchestrates the
// pluggable source(s) + section matching + dedup + placement + 24h cache around a
// single search call per topic. Platform-agnostic: it runs each ENABLED source; this
// round only YouTube is registered (lib/candidates/index.ts).
//
// NO-KEY / ERROR POSTURE (AC1/AC14): if no source is enabled (e.g. no key), this
// returns `null` WITHOUT touching the cache — the caller then falls back to the
// seeded/empty store. Any source failure is already swallowed inside the source
// (returns []), so a thrown error never reaches here; an empty live result is a
// legitimate zero-results set (design §5.2) and IS cached.

export interface SuggestInput {
  topicQid: string;
  topicTitle: string;
  sections: ArticleSection[];
  /** `platform:videoId` keys already curated for this topic (AC8 dedup). */
  curatedVideoKeys: Set<string>;
}

/**
 * Compute the candidate set for a topic, or return null when no source is enabled
 * (the no-key no-op — caller falls back to seed). A cache hit within the 24h TTL
 * returns the cached set with no source call (AC11).
 */
export async function suggestCandidates(
  sources: CandidateSource[],
  input: SuggestInput,
  now = Date.now()
): Promise<Candidate[] | null> {
  const enabled = sources.filter((s) => s.isEnabled());
  if (enabled.length === 0) return null; // AC1 — no live path; do NOT write cache.

  // AC11 — warm cache within TTL: return it, no source call.
  const cached = readCache(input.topicQid);
  if (!isStale(cached, now)) return cached!.candidates;

  // Run each enabled source's single search (Decision 1: one call per source/topic).
  const rawLists = await Promise.all(
    enabled.map((s) =>
      s.search({ topicQid: input.topicQid, topicTitle: input.topicTitle })
    )
  );
  const raw = rawLists.flat();

  const deduped = dedupe(raw, input.topicQid, input.curatedVideoKeys);
  const { sectionCandidates, generalCandidates } = placeCandidates(
    input.topicQid,
    input.topicTitle,
    deduped,
    input.sections
  );
  // Section candidates first (they're placed first / take priority), then General.
  const candidates = [...sectionCandidates, ...generalCandidates];

  // Cache the computed set (AC11). An empty set is a valid zero-results cache entry
  // (so an obscure topic isn't re-searched every visit within the TTL).
  writeCache(input.topicQid, candidates, now);
  return candidates;
}

/**
 * Dedup the raw results (AC7/AC8): drop within-set duplicates, anything already
 * curated as a Clip, and anything the user has dismissed for this topic. Preserves
 * the source's relevance order (the rank the placement + tie-break depend on).
 */
function dedupe(
  raw: RawCandidate[],
  topicQid: string,
  curatedVideoKeys: Set<string>
): RawCandidate[] {
  const dismissed = dismissedKeysForTopic(topicQid);
  const seen = new Set<string>();
  const out: RawCandidate[] = [];
  for (const r of raw) {
    const k = identityKey(r.platform, r.videoId);
    if (seen.has(k)) continue; // within-set dup (AC7)
    if (curatedVideoKeys.has(k)) continue; // already a curated clip (AC8)
    if (dismissed.has(k)) continue; // user-dismissed (AC9)
    seen.add(k);
    out.push(r);
  }
  return out;
}
