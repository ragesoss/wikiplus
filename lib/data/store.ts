import type {
  ArticleSection,
  Candidate,
  Clip,
  ContributorClip,
  PublicContributor,
  RecentCurationsPage,
  Topic,
  TopicWithStats,
  UpvoteToggle,
} from "./types";

// The `DataStore` interface — the data-access seam. `./index.ts` is the single place that
// wires the concrete implementation: `DrizzleDataStore` (shared Postgres,
// lib/db/drizzle-store.ts) reached through the Server Actions boundary (lib/server/actions.ts);
// the localStorage store is kept only as a reference impl + test double.
//
// This seam localizes *which store* is active to one file, but it is NOT a "swap one line"
// boundary: the store runs server-side behind the Server Actions boundary, and the call sites
// await it across the client/server split. Treat a store change as "pick the impl in index.ts +
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
  /**
   * The homepage "Recently curated" read (issue #126): topics that carry curation, each with
   * its at-a-glance counts. Returns ONLY topics with `videos ≥ 1` (a zero-curation topic isn't
   * "recently curated" — design topic-card-redesign.md §4.1), recency-ordered (`updated_at desc,
   * title`, the #125 ordering applied to the surviving set). The per-topic `stats` match the
   * Topic overview card exactly — `videos` = the topic's non-removed clip count (held clips
   * still count; `removed_at IS NULL` clips only — the same set `listClips` returns), `creators`
   * = distinct `creator.handle`, `curators` = distinct curator. Delivered via ONE grouped
   * aggregate over `clip` joined to `topic` (no N-per-topic reads), the same query that applies
   * the `videos ≥ 1` filter — see `docs/ARCHITECTURE.md` "Recently-curated read". Distinct from
   * `listTopics()`, which stays the unfiltered, no-stats `Topic[]` other callers rely on.
   */
  listCuratedTopics(): Promise<TopicWithStats[]>;
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

  /**
   * Set/clear a topic's "marked complete" / `closed_to_suggestions` flag (issue #159). Persists the
   * boolean on the `topic` row and returns the updated `Topic`. The CURATOR role-gate (any signed-in
   * contributor; reject a logged-out caller) lives in the Server Action (`setTopicClosedToSuggestions`
   * — mirroring the other gated writes); this store method only writes the flag it is handed. It
   * touches NO other topic field and NO clip/candidate (suppression is a presentation derivation over
   * the unchanged candidate pipeline — it never dismisses or rules out a candidate). Throws if the
   * topic does not exist (the topic must already be in the store — the curator control only renders
   * on a resolved topic).
   */
  setTopicClosedToSuggestions(qid: string, closed: boolean): Promise<Topic>;

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
   * This stays behind the seam, so component call sites are unaffected.
   */
  suggestCandidates(input: {
    topicQid: string;
    topicTitle: string;
    sections: ArticleSection[];
    /** `platform:videoId` keys already curated for this topic (AC8 dedup). */
    curatedVideoKeys: Set<string>;
    /**
     * `platform:videoId` keys dismissed for this topic (AC9 dedup). Dismissals are
     * shared/durable in Postgres; the client fetches them (via the server boundary) and
     * passes them in here so the live pipeline stays pure + client-side (AC8).
     */
    dismissedVideoKeys: Set<string>;
  }): Promise<Candidate[] | null>;

  /**
   * Persist a curated clip. The curator is the REAL signed-in contributor: the Server Action
   * boundary resolves the session and passes `curatorId` (the authenticated `contributor.id`);
   * the store does not fall back to the `@prototype` stub for new writes (AC6). `curatorId` is
   * optional only so the store-level tests + the localStorage reference impl can call it without
   * a session.
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

  /**
   * D5b (issue #58): set a clip's review-state and return the updated clip — the persistence behind
   * the role-gated hold / approve actions. `vetted = false` ⇒ HELD (in review); `vetted = true` ⇒
   * PUBLISHED (fully curated). The ROLE/OWNERSHIP gate lives in the Server Actions
   * (`holdClipAction`/`reviewClipAction`): this store method only writes the flag it is handed
   * (mirroring how `updateClip` only writes the patch the auth-gated boundary narrowed). It leaves
   * the note, chips, curator attribution, and every other field untouched. Returns the re-mapped
   * `Clip` (with its `held` flag updated) so the client reflects the new state with no reload (AC1/AC3).
   */
  setClipVetted(id: string, vetted: boolean): Promise<Clip>;

  /**
   * D5c (issue #59 / CURATION §7.2): MODERATOR-ONLY soft-removal of a clip — set the tombstone
   * (`removed_at`/`removed_by`/optional `removed_reason`) so the clip stops showing (the read
   * filters `removed_at IS NULL`) while the row PERSISTS as the §7 audit trail. DISTINCT from
   * `deleteClip` (D2's owner-gated HARD delete — the row is gone) and from `setClipVetted` (the
   * D5b reversible hold — the clip stays visible). The MODERATOR-ONLY role-gate (NO own-curator
   * arm — Decision 2) lives in the Server Action (`removeClipAction`): the store method only
   * persists the tombstone it is handed. `removedBy` is the acting moderator's contributor id;
   * `reason` is the OPTIONAL audit-only reason (never gates the removal, never shown to readers).
   * Returns the re-mapped `Clip` (the removed row) so the action resolves; the client filters the
   * clip out of the in-memory set for the no-reload reflect. `removedBy`/`reason` are
   * server-internal on the store impl — the client facade (lib/data/index.ts) routes the seam's
   * `removeClip(id, reason)` to the role-gated `removeClipAction`, which resolves `removedBy`.
   */
  removeClip(id: string, removedBy?: number, reason?: string | null): Promise<Clip>;

  // ── Per-user skin preference (issue #143 — the durable backstop behind the cookie). ──
  /**
   * Persist a logged-in contributor's chosen skin (`'zine'` | `'zine-dark'`, or `null` to clear).
   * The auth-gated `setSkinPreferenceAction` resolves the session via `requireContributor()` and
   * passes the contributor id; the client facade passes only the skin value. This is FIRE-AND-FORGET
   * from the control's perspective — the cookie + the live `data-skin` flip happen first and never
   * wait on this write (spec §6.1 / design §4.6). It is the DURABLE backstop the login mirrors into
   * the `wikiplus-skin` cookie (DB→cookie), so it NEVER enters the read/render path. `contributorId`
   * is server-internal (the boundary resolves it); it is optional only so the store-level tests +
   * the reference impl can call it without a session.
   */
  setSkinPreference(skin: string | null, contributorId?: number): Promise<void>;

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

  /**
   * The cross-topic RECENT-CURATIONS feed read (issue #160 / `/recent`, design §3.4). The global,
   * cursor-paginated analog of `listClipsByContributor`: every curated clip across ALL topics,
   * joined to its parent topic for the title + QID (the existing `ContributorClip` shape — NO model
   * change, §2), NEWEST FIRST. It is an ANONYMOUS read (no auth gate, like `listClips`); the feed is
   * browsable logged-out (§6).
   *
   * Ordering + cursor (the recency key, §3.4): ordered by `created_at DESC, id DESC` — the
   * authoritative persisted creation/curation timestamp (the same field `listClipsByContributor`
   * orders by; `Clip.curatedAt` is decorative). The page is a STABLE keyset over `(createdAt, id)`,
   * NEVER an offset (an offset drifts as new curations arrive — dupes/gaps; see
   * `lib/data/recent-cursor.ts`). `cursor` (opaque) ⇒ return strictly-older items; absent ⇒ start
   * from the head. `limit` defaults to `RECENT_PAGE_DEFAULT`. The result carries `nextCursor` (the
   * last item's encoded cursor when a full page came back, else `null` ⇒ exhausted, the end marker).
   *
   * Visibility (§3.4 / OQ resolution): only PUBLIC, VOUCHED clips appear — the same predicate the
   * topic read uses (`removed_at IS NULL`), PLUS held clips EXCLUDED (`vetted = true`). The feed is
   * the site's public "best recent curations" shopfront; a held clip is not yet the site's vouch, so
   * unlike the topic page it does not appear here. (Removed clips never appear, like every read.)
   */
  listRecentCurations(input?: {
    cursor?: string | null;
    limit?: number;
  }): Promise<RecentCurationsPage>;

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
