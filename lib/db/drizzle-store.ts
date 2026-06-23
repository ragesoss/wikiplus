import "server-only";

import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import type { DataStore } from "@/lib/data/store";
import type {
  ArticleSection,
  Candidate,
  Clip,
  ContributorClip,
  PublicContributor,
  Topic,
  TopicWithStats,
  UpvoteToggle,
} from "@/lib/data/types";
import { STUB_HANDLE } from "@/lib/curation/curator-attribution";
import { getDb, type Db } from "./client";
import {
  clipPatchToUpdate,
  clipToInsert,
  rowToClip,
  rowToPublicContributor,
  rowToTopic,
} from "./mappers";
import { clip, clipVote, contributor, dismissedCandidate, topic } from "./schema";

// The Postgres-backed DataStore (issue #45). Implements the FULL DataStore interface
// (lib/data/store.ts) server-side, behind the lib/data/index.ts seam (the swap point).
// Reached ONLY through the Server Actions boundary (lib/server/actions.ts) — never from
// the browser; `import "server-only"` enforces that at build time (AC7).
//
// What this store does NOT do (deliberately, per AC8): it never calls Wikipedia, Wikidata,
// or YouTube. Title→QID, the article body, the TOC, and the live YouTube candidate search
// all stay client-side. `suggestCandidates` here is the no-source no-op (returns null) —
// the live YouTube pipeline runs in the browser via lib/data/index.ts, not through this
// server store. Only topics, clips, the seeded-fallback `listCandidates`, and dismissals
// are DB-backed.

export class DrizzleDataStore implements DataStore {
  private db: Db;

  constructor(db: Db = getDb()) {
    this.db = db;
  }

  // ── Topics ───────────────────────────────────────────────────────────────────────
  async listTopics(): Promise<Topic[]> {
    // "Recently curated" ordering (homepage-recently-curated.md §4): most recently created-or-updated
    // topic first (`updated_at` advances on create + metadata upsert — the cheapest "recently active"
    // proxy, no join). A stable `title` tie-breaker keeps ordering deterministic when timestamps are
    // equal (e.g. a single seed batch), so the grid never reshuffles between loads.
    const rows = await this.db
      .select()
      .from(topic)
      .orderBy(desc(topic.updatedAt), topic.title);
    return rows.map(rowToTopic);
  }

  async listCuratedTopics(): Promise<TopicWithStats[]> {
    // The homepage "Recently curated" read (issue #126). ONE grouped aggregate over `clip` joined
    // to `topic` delivers the per-topic counts AND filters out zero-curation topics — no N-per-
    // topic reads, no second query (design topic-card-redesign.md §4 / §4.1).
    //
    // COUNT PARITY with the Topic overview card (the critical contract): the `videos`/`creators`/
    // `curators` here are computed over EXACTLY the set `listClips` returns — non-removed clips
    // (`removed_at IS NULL`), which INCLUDES held clips (`vetted = false` still counts). So the
    // join predicate matches `listClips`' filter, and the three counts mirror `deriveStats` term-
    // for-term:
    //   - videos   = count of those non-removed clips                  (deriveStats: clips.length)
    //   - creators = COUNT(DISTINCT creator_handle) among them         (deriveStats: distinct creator.handle)
    //   - curators = COUNT(DISTINCT curated_by) among them             (deriveStats: distinct non-empty curatedBy)
    // `curated_by` (the handle string) is the parity key — it is exactly the field `deriveStats`
    // dedups on; an INNER join naturally drops a NULL `curated_by` row from the distinct count, so
    // a clip with no curator handle adds to `videos` but not `curators`, matching `deriveStats`.
    //
    // FILTER (§4.1): an INNER join means a topic with no non-removed clip contributes no rows and
    // never appears — i.e. the section shows only topics with `videos ≥ 1`, for free. ORDERING:
    // the #125 `updated_at desc, title` recency order is applied to this surviving (curated) set.
    const rows = await this.db
      .select({
        qid: topic.wikidataQid,
        title: topic.title,
        description: topic.description,
        videos: count(clip.id),
        creators: countDistinct(clip.creatorHandle),
        curators: countDistinct(clip.curatedBy),
      })
      .from(topic)
      .innerJoin(
        clip,
        and(eq(clip.topicId, topic.id), isNull(clip.removedAt))
      )
      .groupBy(topic.id, topic.wikidataQid, topic.title, topic.description, topic.updatedAt)
      .orderBy(desc(topic.updatedAt), topic.title);
    return rows.map((r) => ({
      qid: r.qid,
      title: r.title,
      description: r.description ?? undefined,
      stats: {
        videos: Number(r.videos),
        creators: Number(r.creators),
        curators: Number(r.curators),
      },
    }));
  }

  async getTopic(qid: string): Promise<Topic | null> {
    const rows = await this.db
      .select()
      .from(topic)
      .where(eq(topic.wikidataQid, qid))
      .limit(1);
    return rows[0] ? rowToTopic(rows[0]) : null;
  }

  async getTopicByTitle(title: string): Promise<Topic | null> {
    // Match the localStorage store's behavior: normalize `_`/space + case so a wikilink
    // title (`Calvin_cycle`) finds the seeded topic. Done in SQL with lower(replace()),
    // so a single indexed-shaped lookup parallels the production plan.
    const norm = title.replace(/_/g, " ").trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(topic)
      .where(sql`lower(replace(${topic.title}, '_', ' ')) = ${norm}`)
      .limit(1);
    return rows[0] ? rowToTopic(rows[0]) : null;
  }

  async upsertTopic(input: Topic): Promise<Topic> {
    const rows = await this.db
      .insert(topic)
      .values({
        wikidataQid: input.qid,
        title: input.title,
        description: input.description ?? null,
      })
      .onConflictDoUpdate({
        target: topic.wikidataQid,
        set: {
          title: input.title,
          description: input.description ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rowToTopic(rows[0]);
  }

  /** Resolve a QID → the topic's internal numeric id (or null if not present). */
  private async topicIdForQid(qid: string): Promise<number | null> {
    const rows = await this.db
      .select({ id: topic.id })
      .from(topic)
      .where(eq(topic.wikidataQid, qid))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  // ── Clips ────────────────────────────────────────────────────────────────────────
  async listClips(topicQid: string): Promise<Clip[]> {
    const topicId = await this.topicIdForQid(topicQid);
    if (topicId === null) return [];
    // Issue #59 / D5c (Decision 1 / AC1/AC7): a REMOVED clip leaves the read. The query gains a
    // `removed_at IS NULL` predicate alongside the `topicId` filter, so a moderator-removed clip is
    // NOT returned to readers — it disappears from the Topic page, the General band, and the topic
    // counts. The removed-state rides the read as an EXCLUSION (a property of the clip, the same for
    // every viewer), so the cached read path does NO per-user work for it (AC7). The row persists in
    // the DB (the tombstone audit trail); it is simply filtered out here. This is DISTINCT from the
    // D5b held filter: a HELD clip (`vetted = false`, `removed_at IS NULL`) STILL lists (shown-but-
    // marked); only a REMOVED clip (`removed_at` set) is excluded (AC5).
    const rows = await this.db
      .select()
      .from(clip)
      .where(and(eq(clip.topicId, topicId), isNull(clip.removedAt)))
      .orderBy(desc(clip.createdAt));
    // Issue #55 / D4: the DISPLAYED count is DERIVED (Decision 2) — the frozen `clip.upvotes`
    // seed baseline PLUS the count of distinct real `clip_vote` rows. It is PUBLIC (the same for
    // every viewer), so it may ride this topic read (AC7); only the PER-VIEWER voted-state is off
    // the read path (`votedClipIds`). The legacy `clip.upvotes` column is NEVER mutated — the
    // derivation reads it as a baseline and adds the live vote count on top, so the count can
    // never drift from the set of real voters. One grouped COUNT for all the topic's clips.
    const counts = await this.voteCountsForClips(rows.map((r) => r.id));
    return rows.map((r) => {
      const mapped = rowToClip(r, topicQid);
      const derived = (r.upvotes ?? 0) + (counts.get(r.id) ?? 0);
      // Surface the derived total as `upvotes` for the UI. When there is neither a seed baseline
      // nor a real vote (both 0/absent), keep it `undefined` so the footer renders no count for a
      // never-seeded, never-voted clip — matching the pre-D4 "no number" affordance.
      return {
        ...mapped,
        upvotes: derived > 0 || r.upvotes != null ? derived : undefined,
      };
    });
  }

  /**
   * Count of distinct `clip_vote` rows per clip id, as a Map (issue #55 / D4 — the public, derived
   * count's vote component). One grouped query; missing ids carry 0 (no real votes). Drives both
   * the `listClips` derivation and the `toggleUpvote` return.
   */
  private async voteCountsForClips(
    clipIds: number[]
  ): Promise<Map<number, number>> {
    if (clipIds.length === 0) return new Map();
    const rows = await this.db
      .select({ clipId: clipVote.clipId, n: count() })
      .from(clipVote)
      .where(inArray(clipVote.clipId, clipIds))
      .groupBy(clipVote.clipId);
    return new Map(rows.map((r) => [r.clipId, Number(r.n)]));
  }

  /** The derived public count for ONE clip: seed baseline + distinct vote rows (Decision 2). */
  private async derivedUpvoteCount(clipId: number): Promise<number> {
    const baseRows = await this.db
      .select({ upvotes: clip.upvotes })
      .from(clip)
      .where(eq(clip.id, clipId))
      .limit(1);
    const baseline = baseRows[0]?.upvotes ?? 0;
    const voteRows = await this.db
      .select({ n: count() })
      .from(clipVote)
      .where(eq(clipVote.clipId, clipId));
    return baseline + Number(voteRows[0]?.n ?? 0);
  }

  async listCandidates(_topicQid: string): Promise<Candidate[]> {
    // Seeded/fallback candidates are NOT stored as rows (ARCHITECTURE: candidates are
    // computed + cached, only promote/dismiss persists). In B the seeded mock candidates
    // were a localStorage convenience for the empty-state demo; with shared Postgres the
    // empty state's suggestions come from the live YouTube pipeline (client-side) when a
    // key is present, and are otherwise empty. So the server fallback is [] — there is no
    // DB candidate table by design. The client still runs `suggestCandidates` itself.
    void _topicQid;
    return [];
  }

  async suggestCandidates(_input: {
    topicQid: string;
    topicTitle: string;
    sections: ArticleSection[];
    curatedVideoKeys: Set<string>;
    dismissedVideoKeys: Set<string>;
  }): Promise<Candidate[] | null> {
    // AC8: the server NEVER runs the YouTube pipeline (no key at runtime, no network call).
    // The live candidate search stays client-side (lib/data/index.ts → runCandidatePipeline).
    // Returning null is the "no source enabled" signal the caller already handles.
    void _input;
    return null;
  }

  async addClip(
    input: Omit<Clip, "id" | "createdAt">,
    curatorId?: number,
    agreement?: { noteLicense: string; noteLicenseAgreedAt: Date }
  ): Promise<Clip> {
    const topicId = await this.topicIdForQid(input.topicQid);
    if (topicId === null) {
      throw new Error(
        `addClip: no topic for QID ${input.topicQid} — upsert the topic first.`
      );
    }
    // Issue C: attribute to the REAL signed-in contributor passed by the auth-gated
    // boundary (AC6). Only when none is supplied (store-level tests / seed / reference
    // impl) do we fall back to the seeded "@prototype" stub — the deployed write path
    // always passes the authenticated contributor.
    const attributedId =
      curatorId ?? (await getStubContributorId(this.db));
    // Issue #52 / D1 (AC7): persist the server-stamped note-license agreement when present.
    // It comes from the boundary (lib/server/actions.ts), never from the client `input`.
    const rows = await this.db
      .insert(clip)
      .values(clipToInsert(input, topicId, attributedId, agreement))
      .returning();
    return rowToClip(rows[0], input.topicQid);
  }

  async updateClip(
    id: string,
    patch: Partial<Omit<Clip, "id">>,
    /**
     * The §5.3 re-affirmation re-stamp (issue #53 / D2, AC9), built by the auth-gated
     * boundary when the note text changed materially. Present ⇒ re-stamp `note_license` +
     * `note_license_agreed_at`; absent ⇒ leave both untouched (a chip/section-only or
     * whitespace-only edit — AC10). The store never decides materiality (the boundary does);
     * it only writes the capture it is handed. Never read off the client patch.
     */
    agreement?: { noteLicense: string; noteLicenseAgreedAt: Date }
  ): Promise<Clip> {
    const numId = Number(id);
    const rows = await this.db
      .update(clip)
      .set(clipPatchToUpdate(patch, agreement))
      .where(eq(clip.id, numId))
      .returning();
    if (!rows[0]) throw new Error(`Clip ${id} not found`);
    // Re-resolve the parent topic's QID for the returned shape.
    const t = await this.db
      .select({ qid: topic.wikidataQid })
      .from(topic)
      .where(eq(topic.id, rows[0].topicId))
      .limit(1);
    return rowToClip(rows[0], t[0]?.qid ?? patch.topicQid ?? "");
  }

  async deleteClip(id: string): Promise<void> {
    await this.db.delete(clip).where(eq(clip.id, Number(id)));
  }

  async setClipVetted(id: string, vetted: boolean): Promise<Clip> {
    const numId = Number(id);
    // Write ONLY the review-state flag (+ updatedAt) — the note, chips, curator attribution, and
    // every other field are left untouched (CURATION §7.1: a held clip keeps everything but its
    // confirmed vouch). The role/ownership gate ran already in the Server Action; this just persists.
    const rows = await this.db
      .update(clip)
      .set({ vetted, updatedAt: new Date() })
      .where(eq(clip.id, numId))
      .returning();
    if (!rows[0]) throw new Error(`Clip ${id} not found`);
    const t = await this.db
      .select({ qid: topic.wikidataQid })
      .from(topic)
      .where(eq(topic.id, rows[0].topicId))
      .limit(1);
    return rowToClip(rows[0], t[0]?.qid ?? "");
  }

  async removeClip(
    id: string,
    removedBy?: number,
    reason?: string | null
  ): Promise<Clip> {
    const numId = Number(id);
    // The boundary (`removeClipAction`) always passes the acting MODERATOR's contributor id after
    // its server-side role-gate; the optional shape only keeps the store-level tests callable. A
    // removal MUST be attributable (the §7 audit trail anchors on `removed_by`), so refuse a
    // store-level call with no remover rather than write a removerless tombstone.
    if (removedBy === undefined) {
      throw new Error("removeClip: no moderator to attribute the removal to.");
    }
    // Issue #59 / D5c (Decision 1): the SOFT-REMOVAL write — mirrors `setClipVetted` (a column-flip-
    // and-return), NOT `deleteClip` (a hard `db.delete`). Set the tombstone (`removed_at = now()`,
    // `removed_by` = the acting moderator, the OPTIONAL `removed_reason`) + `updatedAt`; every other
    // field — the note, chips, curator, `vetted` — is left UNTOUCHED, so the row persists as the §7
    // audit trail and a removed clip is independent of its held state (AC5). The MODERATOR-ONLY
    // role-gate already ran in `removeClipAction` (no own-curator arm — Decision 2); this just
    // persists. Returns the re-mapped `Clip` so the action's caller has the removed row's shape;
    // the client drops it from the in-memory set for the no-reload reflect (the read excludes it).
    const rows = await this.db
      .update(clip)
      .set({ removedAt: new Date(), removedBy, removedReason: reason ?? null, updatedAt: new Date() })
      .where(eq(clip.id, numId))
      .returning();
    if (!rows[0]) throw new Error(`Clip ${id} not found`);
    const t = await this.db
      .select({ qid: topic.wikidataQid })
      .from(topic)
      .where(eq(topic.id, rows[0].topicId))
      .limit(1);
    return rowToClip(rows[0], t[0]?.qid ?? "");
  }

  /**
   * Load just the ownership key + the stored note for a clip (issue #53 / D2). The auth-gated
   * boundary uses this to (a) evaluate the id-based ownership gate (`curatorId === session
   * contributor id`) and (b) recompute §5.3 materiality from the stored note vs. the patch —
   * both SERVER-SIDE, never trusting a client flag. Returns null when the clip does not exist.
   */
  async clipOwnership(
    id: string
  ): Promise<{ curatorId: number | null; contextNote: string } | null> {
    const rows = await this.db
      .select({ curatorId: clip.curatorId, contextNote: clip.contextNote })
      .from(clip)
      .where(eq(clip.id, Number(id)))
      .limit(1);
    return rows[0] ?? null;
  }

  // ── Public contributor profile reads (issue #54 / D3 — anonymous; AC1–AC4) ──────────
  async getContributorByUsername(
    username: string
  ): Promise<PublicContributor | null> {
    // The seeded `@prototype` stub is not a real person to profile (Decision 4 / AC4): treat it
    // as not-found BEFORE any DB read, so `/contributor/@prototype` never resolves to a browsable
    // profile of the stub's clips. (The stub also never receives a "context by" link — its clips
    // show the non-linked `seed clip · no curator` label client-side.)
    if (username === STUB_HANDLE) return null;
    // Resolve the NON-UNIQUE handle to a SINGLE identity deterministically: the lowest/earliest
    // `contributor.id` for that handle (Decision 1). The stub handle is excluded defensively
    // (`ne(...)`) so a real contributor who somehow shares the stub string is never silently
    // shadowed and the stub can never be the resolved identity. SELECT only `contributor` columns
    // — `account.email` (a different table) is never touched on this path, the AC2 privacy boundary.
    const rows = await this.db
      .select({
        id: contributor.id,
        handle: contributor.handle,
        avatarUrl: contributor.avatarUrl,
        displayName: contributor.displayName,
        createdAt: contributor.createdAt,
      })
      .from(contributor)
      .where(
        and(eq(contributor.handle, username), ne(contributor.handle, STUB_HANDLE))
      )
      .orderBy(asc(contributor.id))
      .limit(1);
    return rows[0] ? rowToPublicContributor(rows[0]) : null;
  }

  async listClipsByContributor(
    contributorId: number
  ): Promise<ContributorClip[]> {
    // Exactly this contributor's clips, joined to their parent topic for the "On <Topic>" link
    // context (the topic title + QID), newest-first (`createdAt` desc — same order as `listClips`).
    // The `curatorId` filter scopes it to this contributor; another contributor's clips are excluded.
    const rows = await this.db
      .select({ clip, topicQid: topic.wikidataQid, topicTitle: topic.title })
      .from(clip)
      .innerJoin(topic, eq(clip.topicId, topic.id))
      // Issue #59 / D5c: a removed clip leaves the read on the profile too (`removed_at IS NULL`),
      // same as `listClips` — a clip a moderator removed is gone from its curator's public profile,
      // consistent with the Topic page. The tombstone row persists; it is filtered from the read.
      .where(and(eq(clip.curatorId, contributorId), isNull(clip.removedAt)))
      .orderBy(desc(clip.createdAt));
    return rows.map((r) => ({
      ...rowToClip(r.clip, r.topicQid),
      topicTitle: r.topicTitle,
    }));
  }

  // ── Sticky dismissals (shared + durable — AC5) ─────────────────────────────────────
  async recordDismissal(
    input: {
      topicQid: string;
      platform: string;
      videoId: string;
    },
    contributorId?: number
  ): Promise<void> {
    const topicId = await this.topicIdForQid(input.topicQid);
    if (topicId === null) return; // nothing to dismiss against an unknown topic
    // Issue C: the dismissal is attributed to the REAL signed-in contributor passed by the
    // auth-gated boundary (AC8); fall back to the stub only for store-level tests / seed.
    const attributedId =
      contributorId ?? (await getStubContributorId(this.db));
    await this.db
      .insert(dismissedCandidate)
      .values({
        topicId,
        provider: input.platform,
        providerVideoId: input.videoId,
        contributorId: attributedId,
      })
      // Idempotent on the (topic, provider, provider_video_id) unique identity (AC5):
      // re-dismissing the same candidate is a no-op, not a duplicate-key error.
      .onConflictDoNothing({
        target: [
          dismissedCandidate.topicId,
          dismissedCandidate.provider,
          dismissedCandidate.providerVideoId,
        ],
      });
  }

  async dismissedKeys(topicQid: string): Promise<string[]> {
    const topicId = await this.topicIdForQid(topicQid);
    if (topicId === null) return [];
    const rows = await this.db
      .select({
        provider: dismissedCandidate.provider,
        videoId: dismissedCandidate.providerVideoId,
      })
      .from(dismissedCandidate)
      .where(eq(dismissedCandidate.topicId, topicId));
    return rows.map((r) => `${r.provider}:${r.videoId}`);
  }

  // ── Upvotes (issue #55 / D4 — one-per-user, toggleable; AC1–AC3/AC8/AC9) ───────────
  async toggleUpvote(
    clipId: string,
    contributorId?: number
  ): Promise<UpvoteToggle> {
    const numClipId = Number(clipId);
    // The boundary always passes the authenticated contributor; the optional path (stub) keeps
    // the store-level tests + reference impl callable without a session. NO self-vote special
    // case (Decision 3) — `clip.curatorId` is never consulted here.
    const voterId =
      contributorId ?? (await getStubContributorId(this.db));
    if (voterId === null) {
      throw new Error("toggleUpvote: no contributor to attribute the vote to.");
    }
    // Toggle: is there already a vote row for (clip, me)? The one-per-user invariant is the DB
    // `unique(clip_id, contributor_id)` constraint (AC3) — the read-then-act below is the toggle
    // DIRECTION, not the uniqueness guarantee; the insert is `onConflictDoNothing` so a racing
    // double-insert collides on the constraint and lands voted (not a second row, not a throw).
    const existing = await this.db
      .select({ id: clipVote.id })
      .from(clipVote)
      .where(
        and(eq(clipVote.clipId, numClipId), eq(clipVote.contributorId, voterId))
      )
      .limit(1);

    let voted: boolean;
    if (existing[0]) {
      // Present → un-vote (delete). Deleting an absent row is a no-op landing in "not voted"
      // (AC2 idempotent). The post-state is "no row for (clip, me)".
      await this.db
        .delete(clipVote)
        .where(
          and(
            eq(clipVote.clipId, numClipId),
            eq(clipVote.contributorId, voterId)
          )
        );
      voted = false;
    } else {
      // Absent → vote (insert). `onConflictDoNothing` on the unique identity: a concurrent
      // double-insert collides on the constraint, leaving exactly ONE row (AC3) — the toggle's
      // contract is "end in the flipped state," not "error on a race." Post-state is "voted".
      await this.db
        .insert(clipVote)
        .values({ clipId: numClipId, contributorId: voterId })
        .onConflictDoNothing({
          target: [clipVote.clipId, clipVote.contributorId],
        });
      voted = true;
    }

    // The returned count is the DERIVED total (seed baseline + distinct rows) — the authoritative
    // value the client reconciles to. `clip.upvotes` is read as a frozen baseline, never written.
    const count = await this.derivedUpvoteCount(numClipId);
    return { voted, count };
  }

  async votedClipIds(
    clipIds: string[],
    contributorId?: number
  ): Promise<string[]> {
    // The boundary passes the authenticated contributor; an absent one (no session) yields no
    // votes — never a per-user query for a logged-out caller (AC7). The store-level tests pass
    // an explicit id.
    if (contributorId === undefined || clipIds.length === 0) return [];
    const numIds = clipIds.map((id) => Number(id));
    const rows = await this.db
      .select({ clipId: clipVote.clipId })
      .from(clipVote)
      .where(
        and(
          eq(clipVote.contributorId, contributorId),
          inArray(clipVote.clipId, numIds)
        )
      );
    return rows.map((r) => String(r.clipId));
  }
}

// ── Stub contributor (interim attribution until issue C — AC13) ───────────────────────
// Until real sign-in lands, every write is attributed to a single seeded "prototype"
// contributor. Its id is resolved lazily and memoized per process; the seed (scripts/
// seed.ts) inserts it, but this also self-heals if the row is missing. `STUB_HANDLE` is the
// canonical client-safe constant (lib/curation/curator-attribution.ts), shared with the seed
// + the client `ContextByLink` so the stub handle is defined once.
let stubId: number | null = null;

/** Reset the memoized stub-contributor id. TEST-ONLY: each fresh pglite DB needs a clean id. */
export function _resetStubContributorCache(): void {
  stubId = null;
}

export async function getStubContributorId(db: Db): Promise<number | null> {
  if (stubId !== null) return stubId;
  // The "@prototype" stub is a singleton: pre-auth clips attribute to it (D6). Because
  // `contributor.handle` is non-unique (the identity anchor is the account row, not the handle),
  // we cannot ON CONFLICT (handle); read-first, insert only if absent. The seed creates the stub
  // once on deploy and this is memoized, so there is no contended path here.
  const existing = await db
    .select({ id: contributor.id })
    .from(contributor)
    .where(eq(contributor.handle, STUB_HANDLE))
    .limit(1);
  if (existing[0]) {
    stubId = existing[0].id;
    return stubId;
  }
  const rows = await db
    .insert(contributor)
    .values({ handle: STUB_HANDLE, displayName: "Prototype curator" })
    .returning({ id: contributor.id });
  stubId = rows[0]?.id ?? null;
  return stubId;
}
