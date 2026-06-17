import type { ArticleSection, Candidate, Clip, Topic } from "./types";

// The `DataStore` interface — the data-access seam. `./index.ts` is the single place that
// wires the concrete implementation: as of issue #45 that's `DrizzleDataStore` (shared
// Postgres, lib/db/drizzle-store.ts) reached through the Server Actions boundary
// (lib/server/actions.ts); the localStorage store is retired for the deployed app, kept
// only as a reference impl + test double.
//
// This seam localizes *which store* is active to one file — but it is NOT a "swap one line"
// boundary, despite earlier framing. Moving off localStorage forced the store server-side,
// which meant standing up the Server Actions boundary AND rewiring the (previously
// client-only) call sites to await it. Treat a store change as "pick the impl in index.ts +
// reconcile the client/server split," not a single-line edit.
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
    /**
     * `platform:videoId` keys dismissed for this topic (AC9 dedup). As of issue #45
     * dismissals are shared/durable in Postgres; the client fetches them (via the server
     * boundary) and passes them in here so the live pipeline stays pure + client-side (AC8).
     */
    dismissedVideoKeys: Set<string>;
  }): Promise<Candidate[] | null>;

  /**
   * Persist a curated clip. As of issue C the curator is the REAL signed-in contributor:
   * the Server Action boundary resolves the session and passes `curatorId` (the
   * authenticated `contributor.id`); the store no longer falls back to the `@prototype`
   * stub for new writes (AC6). `curatorId` is optional only so the store-level tests +
   * the localStorage reference impl can call it without a session.
   *
   * The note-license agreement (issue #52 / D1, AC7) flows differently per side of the seam,
   * and the two trailing params model both honestly without minting trust on the client:
   *   - `agreement` — the SERVER-STAMPED capture `{ noteLicense: "CC-BY-SA-4.0",
   *     noteLicenseAgreedAt }`. Used by the SERVER store (DrizzleDataStore) only; the boundary
   *     (lib/server/actions.ts) builds it after `requireContributor`. Omitting it (seed/stub/
   *     non-agreed path) records no license. The CLIENT never passes this — it cannot mint a
   *     license version or timestamp.
   *   - `noteLicenseAgreed` — the CLIENT-FACING consent boolean. The client facade
   *     (lib/data/index.ts) forwards it to `addClipAction`, which converts consent → a stamped
   *     `agreement` server-side. The server store ignores it (the boundary already converted it).
   * A `Clip.noteLicense*` smuggled on `clip` is stripped at the boundary — never trusted.
   */
  addClip(
    clip: Omit<Clip, "id" | "createdAt">,
    curatorId?: number,
    agreement?: { noteLicense: string; noteLicenseAgreedAt: Date },
    noteLicenseAgreed?: boolean
  ): Promise<Clip>;

  // NOTE (issue #45 fix round): `updateClip` / `deleteClip` are intentionally NOT on the
  // client-facing seam. They are DESTRUCTIVE and have no UI caller; with no auth until
  // issue C, exposing them anonymously would let any visitor edit/delete any clip. The
  // methods still exist on `DrizzleDataStore` (lib/db/drizzle-store.ts) for issue D + the
  // store-level tests, but they are NOT reachable through this boundary. When D adds
  // auth-gating + ownership, it can surface gated edit/delete actions then.

  // ── Sticky candidate dismissals (issue #45). ─────────────────────────────────────
  // Moved behind the store boundary so a dismissal is SHARED + DURABLE like a clip:
  // a candidate dismissed by anyone does not resurface for anyone (AC5), matched by the
  // (topicQid, platform, videoId) identity. (Was per-browser localStorage in the
  // prototype — lib/candidates/dismissals.ts.)
  /**
   * Persist a dismissal so the candidate does not resurface (idempotent on the identity).
   * As of issue C the dismissal is attributed to the REAL signed-in contributor: the boundary
   * resolves the session and passes `contributorId` (AC8). Optional only for the store-level
   * tests + the reference impl.
   */
  recordDismissal(
    input: {
      topicQid: string;
      platform: string;
      videoId: string;
    },
    contributorId?: number
  ): Promise<void>;
  /** The set of dismissed `platform:videoId` keys for a topic (for filtering candidates). */
  dismissedKeys(topicQid: string): Promise<string[]>;
}
