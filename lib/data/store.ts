import type {
  ArticleSection,
  Candidate,
  Clip,
  ContributorClip,
  PublicContributor,
  Topic,
  UpvoteToggle,
} from "./types";

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

  /**
   * Owner-only edit of a clip's curator-authored fields (issue #53 / D2, AC1). Surfaced on the
   * seam now that ownership exists (it was off the boundary pre-C, when an anonymous export
   * would have been edit-any). The client facade (lib/data/index.ts) routes it to the
   * auth-gated `updateClipAction`, which runs `requireContributor()` THEN the id-based ownership
   * gate (`clip.curatorId === session contributor id`), narrows the patch to the editable set
   * (Decision 2), and re-stamps the §5.3 note license only on a material note change (Decision
   * 3). The `patch` is the editable set only; `noteLicenseAgreed` is the client's consent signal
   * (the server decides whether to stamp). `curatorId`/`patch`/`agreement` are server-internal
   * on the store impl; the optional shape keeps the store-level tests + reference impl callable.
   */
  updateClip(
    id: string,
    patch: Partial<Omit<Clip, "id">>,
    /**
     * SERVER-STAMPED §5.3 re-affirmation capture, used by the DrizzleDataStore only — built by
     * the boundary when the note changed materially (mirrors `addClip`'s `agreement`). The
     * client never passes this; it cannot mint a license version or timestamp.
     */
    agreement?: { noteLicense: string; noteLicenseAgreedAt: Date },
    /**
     * The CLIENT-FACING consent boolean (mirrors `addClip`'s `noteLicenseAgreed`). The facade
     * forwards it to `updateClipAction`, which converts consent → a stamped re-affirmation
     * server-side IFF the note changed materially. The server store ignores it.
     */
    noteLicenseAgreed?: boolean
  ): Promise<Clip>;
  /**
   * Owner-only HARD delete of a clip (issue #53 / D2, AC3, Decision 4). Routed to the auth-gated,
   * owner-only `deleteClipAction` (same id-based gate as `updateClip`). No soft-delete / undo.
   */
  deleteClip(id: string): Promise<void>;

  // ── Public contributor profile reads (issue #54 / D3 — anonymous, no auth gate). ────
  // Both are READS, reached through read-only Server Actions with NO `requireContributor`
  // gate (like `listClips`): a public profile is browsable logged-out (AC1). They run ONLY
  // on the `/contributor/<username>` route — never on the cached Topic read path (AC9).
  /**
   * Resolve a Wikimedia username to its PUBLIC-SAFE identity (id + username + granted avatar),
   * or null when no contributor presents that handle (drives the not-found state, AC3). NEVER
   * returns `email` or any non-public `account` field (AC2 — the privacy boundary).
   *
   * `contributor.handle` is a NON-UNIQUE display column (issue C: two distinct Wikimedia subjects
   * may present the same username string and get distinct contributors). The lookup resolves
   * deterministically to a SINGLE identity by the lowest/earliest `contributor.id` for that handle
   * (Decision 1), so `/contributor/<username>` always maps to exactly one profile + clip list.
   *
   * The seeded `@prototype` STUB (`STUB_HANDLE`) is NOT a real person to profile (Decision 4 / C
   * Decision D6): it resolves to null (treated as not-found), so the stub has no browsable
   * profile (AC4).
   */
  getContributorByUsername(username: string): Promise<PublicContributor | null>;
  /**
   * The clips a contributor (by their resolved internal id) curated, joined to their parent topic
   * so each carries the topic title + QID for the profile row's "On <Topic>" link (AC1). Mapped
   * via `rowToClip`, newest-first (`createdAt` desc, the same order the topic list uses). Scoped
   * to exactly this contributor's `curatorId` — a clip curated by anyone else is excluded.
   */
  listClipsByContributor(contributorId: number): Promise<ContributorClip[]>;

  // ── Upvotes (issue #55 / D4 — a persisted, one-per-user, toggleable signal). ────────
  /**
   * Toggle the signed-in contributor's upvote on a clip (Decision 4). The auth-gated
   * `toggleUpvoteAction` resolves the session via `requireContributor()` FIRST (an anonymous
   * or expired call rejects with `AuthRequiredError` before any DB touch — AC4/AC5), then:
   * inserts a `clip_vote` row if absent (now voted) / deletes it if present (now un-voted).
   * The insert is an upsert (`onConflictDoNothing` on the `(clip, contributor)` unique
   * constraint) so a racing double-insert lands voted, not throwing (AC3). Returns the NEW
   * per-viewer state `{ voted, count }` (count = the DERIVED total `(clip.upvotes ?? 0) +
   * distinct vote rows` — Decision 2), so the client reconciles to the server's truth without
   * a reload. `contributorId` is server-internal (the boundary resolves it); the client facade
   * passes the clip id only — the optional shape keeps the store-level tests + reference impl
   * callable with an explicit contributor.
   */
  toggleUpvote(clipId: string, contributorId?: number): Promise<UpvoteToggle>;
  /**
   * The subset of `clipIds` the given viewer has upvoted (issue #55 / D4 — Decision 6). The
   * PER-VIEWER "have I voted?" read, resolved in the ALREADY-AUTHENTICATED client session and
   * scoped to the visible clips — NEVER baked into `listClips` or the cached/SSG topic shell, so
   * an anonymous topic load does ZERO voted-state work (AC6/AC7). Mirrors how D2/D3 compute the
   * owner affordance from `myContributorId` in the client session with no read-path cost. Routed
   * through `votedClipIdsAction` which gates on `requireContributor()` (a logged-out caller gets
   * an empty set, never a per-user query on the read path). The displayed COUNT is public and
   * rides the topic read (`listClips`); only this voted-state is off the read path.
   */
  votedClipIds(clipIds: string[], contributorId?: number): Promise<string[]>;

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
