import type { Candidate } from "@/lib/data/types";

// Per-topic candidate cache (spec Decision 5, AC11). Key = `wikiplus.candidates.<QID>`,
// value = { fetchedAt, candidates }. TTL = 24h. Within the TTL listCandidates returns
// the cached set with NO API call; stale entries trigger a lazy refresh on read.
//
// IMPORTANT (Decision 5): a no-key no-op does NOT write a cache entry — so once the key
// is available the search runs. Only a real computed set is cached. This mirrors the
// production Redis cached-set shape (ARCHITECTURE §"Candidate suggestion").

const PREFIX = "wikiplus.candidates.";
export const CANDIDATE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedCandidates {
  fetchedAt: number;
  candidates: Candidate[];
}

function key(topicQid: string): string {
  return `${PREFIX}${topicQid}`;
}

/** Read the cached set for a topic, or null when absent/corrupt. */
export function readCache(topicQid: string): CachedCandidates | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(topicQid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCandidates;
    if (!parsed || typeof parsed.fetchedAt !== "number" || !Array.isArray(parsed.candidates))
      return null;
    return parsed;
  } catch {
    return null;
  }
}

/** True when a cached entry is missing or older than the TTL (Decision 5). */
export function isStale(cached: CachedCandidates | null, now = Date.now()): boolean {
  return !cached || now - cached.fetchedAt >= CANDIDATE_TTL_MS;
}

/** Write a freshly computed set for a topic. Only call with a REAL computed result. */
export function writeCache(topicQid: string, candidates: Candidate[], now = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    const value: CachedCandidates = { fetchedAt: now, candidates };
    window.localStorage.setItem(key(topicQid), JSON.stringify(value));
  } catch {
    // Quota/serialization failure must not break the read path (AC14 posture).
  }
}
