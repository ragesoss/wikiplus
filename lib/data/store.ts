import type { Candidate, Clip, Topic } from "./types";

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
  upsertTopic(topic: Topic): Promise<Topic>;

  /** Curated clips for a topic. Empty ⇒ the page renders the empty/uncurated state. */
  listClips(topicQid: string): Promise<Clip[]>;
  /** Auto-suggested, unvetted candidates for a topic (empty-state UI; mock this round). */
  listCandidates(topicQid: string): Promise<Candidate[]>;

  addClip(clip: Omit<Clip, "id" | "createdAt">): Promise<Clip>;
  updateClip(id: string, patch: Partial<Omit<Clip, "id">>): Promise<Clip>;
  deleteClip(id: string): Promise<void>;
}
