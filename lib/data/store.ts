import type { ArticleSection, Candidate, Clip, Topic } from "./types";

// The seam between the GitHub Pages prototype (localStorage) and production
// (Server Actions + Drizzle/Postgres). Only ./index.ts decides which
// implementation is active — swap it there, not at call sites.
//
// Data model the seam carries (extended for Topic Page v1 — see types.ts and
// docs/design/topic-page-v1.md §14):
//   - Topic: qid (canonical key), title, description.
//   - Clip (curated): media + creator fields, orientation, general/sectionSlug,
//     contextNote, stance(+modifier), accuracyFlag(+modifier), upvotes, curatedBy.
//   - Candidate (unvetted, empty state): same media/creator fields, vetted:false,
//     source + matchReason; NO stance/accuracy/contextNote (CURATION §6).
// Topic-level counts (videos/creators/curators) are DERIVED from clips by the
// caller, not stored, so they can never drift from the clip set.
export interface DataStore {
  listTopics(): Promise<Topic[]>;
  getTopic(qid: string): Promise<Topic | null>;
  /**
   * Resolve a Wikipedia article title to a known Topic (canonical title-based route:
   * `/topic/<Title>` → QID under the hood — ARCHITECTURE "Internal-link resolution").
   * Matches case-insensitively with `_`/space normalized so a wikilink title (`Calvin_cycle`)
   * finds the seeded topic. Returns null for an unseeded title — the caller then resolves
   * title→QID via the Wikipedia API (`titleToQid`). Production: a single indexed lookup.
   */
  getTopicByTitle(title: string): Promise<Topic | null>;
  upsertTopic(topic: Topic): Promise<Topic>;

  /** Curated clips for a topic. Empty ⇒ the page renders the empty/uncurated state. */
  listClips(topicQid: string): Promise<Clip[]>;
  /**
   * Seeded/fallback candidates for a topic (the no-key / pre-article path). Used when
   * the live YouTube pipeline is a no-op (no API key) or before the article sections
   * are known. Returns the seeded mock set (CURATION §6 — no chips/note).
   */
  listCandidates(topicQid: string): Promise<Candidate[]>;
  /**
   * The LIVE candidate path (spec AC2): run the pluggable source pipeline (YouTube
   * search → section matching → dedup → 24h cache) for a topic, given its article
   * sections + the already-curated video keys (for dedup, AC8). Returns:
   *   - the computed candidate set (possibly empty → zero-results state) when a source
   *     is enabled (a key is present), or
   *   - `null` when no source is enabled (the no-key no-op, AC1) — the caller then
   *     falls back to `listCandidates` (seeded/empty).
   * The change stays behind this seam; component call sites are untouched.
   */
  suggestCandidates(input: {
    topicQid: string;
    topicTitle: string;
    sections: ArticleSection[];
    /** `platform:videoId` keys already curated for this topic (AC8 dedup). */
    curatedVideoKeys: Set<string>;
  }): Promise<Candidate[] | null>;

  addClip(clip: Omit<Clip, "id" | "createdAt">): Promise<Clip>;
  updateClip(id: string, patch: Partial<Omit<Clip, "id">>): Promise<Clip>;
  deleteClip(id: string): Promise<void>;
}
