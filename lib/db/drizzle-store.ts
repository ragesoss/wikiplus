import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import type { DataStore } from "@/lib/data/store";
import type {
  ArticleSection,
  Candidate,
  Clip,
  Topic,
} from "@/lib/data/types";
import { getDb, type Db } from "./client";
import {
  clipPatchToUpdate,
  clipToInsert,
  rowToClip,
  rowToTopic,
} from "./mappers";
import { clip, contributor, dismissedCandidate, topic } from "./schema";

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
    const rows = await this.db
      .select()
      .from(topic)
      .orderBy(topic.title);
    return rows.map(rowToTopic);
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
    const rows = await this.db
      .select()
      .from(clip)
      .where(eq(clip.topicId, topicId))
      .orderBy(desc(clip.createdAt));
    return rows.map((r) => rowToClip(r, topicQid));
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

  async updateClip(id: string, patch: Partial<Omit<Clip, "id">>): Promise<Clip> {
    const numId = Number(id);
    const rows = await this.db
      .update(clip)
      .set(clipPatchToUpdate(patch))
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
}

// ── Stub contributor (interim attribution until issue C — AC13) ───────────────────────
// Until real sign-in lands, every write is attributed to a single seeded "prototype"
// contributor. Its id is resolved lazily and memoized per process; the seed (scripts/
// seed.ts) inserts it, but this also self-heals if the row is missing.
const STUB_HANDLE = "@prototype";
let stubId: number | null = null;

/** Reset the memoized stub-contributor id. TEST-ONLY: each fresh pglite DB needs a clean id. */
export function _resetStubContributorCache(): void {
  stubId = null;
}

export async function getStubContributorId(db: Db): Promise<number | null> {
  if (stubId !== null) return stubId;
  // The "@prototype" stub is a singleton kept alive by D6 (pre-C clips attribute to it). Now that
  // `contributor.handle` is non-unique (issue C fix round — the identity anchor is the account
  // row, not the handle), we can no longer ON CONFLICT (handle); read-first, insert only if
  // absent. The seed creates the stub once on deploy and this is memoized, so there is no
  // contended path here.
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
