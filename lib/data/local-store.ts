import { runCandidatePipeline } from "@/lib/candidates";
import { STUB_HANDLE } from "@/lib/curation/curator-attribution";
import type { DataStore } from "./store";
import type {
  ArticleSection,
  Candidate,
  Clip,
  ContributorClip,
  PublicContributor,
  Topic,
  TopicWithStats,
  UpvoteToggle,
} from "./types";

const TOPICS_KEY = "wikiplus.topics";
const CLIPS_KEY = "wikiplus.clips";
const CANDIDATES_KEY = "wikiplus.candidates";
const DISMISSED_KEY = "wikiplus.dismissed_candidates";
const VOTES_KEY = "wikiplus.clip_votes";
const SKIN_PREF_KEY = "wikiplus.skin_preference";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]") as T[];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function uid(): string {
  return "c_" + Math.random().toString(36).slice(2, 10);
}

// D5c (issue #59): the private soft-removal tombstone marker the reference impl stamps on a stored
// clip row (NOT part of the public `Clip` type — Decision 5: the client carries no removed field).
// A removed clip keeps its row in storage but is excluded from the reads via `isRemoved`, the
// reference parallel of the DrizzleDataStore's `removed_at IS NULL` read filter.
type RemovedMarker = {
  __removedAt?: string;
  __removedBy?: number | null;
  __removedReason?: string | null;
};

function isRemoved(c: Clip): boolean {
  return Boolean((c as Clip & RemovedMarker).__removedAt);
}

export class LocalStorageDataStore implements DataStore {
  async listTopics(): Promise<Topic[]> {
    return read<Topic>(TOPICS_KEY);
  }

  async listCuratedTopics(): Promise<TopicWithStats[]> {
    // Reference parallel of the DrizzleDataStore aggregate (issue #126): derive each topic's
    // counts over its OWN non-removed clip set (the same set `listClips` returns — `isRemoved`
    // excluded, held clips still counted), filter to `videos ≥ 1`, and carry the at-a-glance
    // stats. The counts mirror `deriveStats` term-for-term (videos = clip count, creators =
    // distinct creator.handle, curators = distinct non-empty curatedBy) so a card count equals
    // the overview count for the same topic (CARD PARITY, design topic-card-redesign.md §4).
    const clips = read<Clip>(CLIPS_KEY).filter((c) => !isRemoved(c));
    const out: TopicWithStats[] = [];
    for (const t of read<Topic>(TOPICS_KEY)) {
      const own = clips.filter((c) => c.topicQid === t.qid);
      if (own.length === 0) continue; // §4.1: zero-curation topics are hidden
      out.push({
        qid: t.qid,
        title: t.title,
        description: t.description,
        // Issue #159: carried for type parity. A stored topic that predates the field reads as
        // not-complete (the `?? false` default), matching the DB column default.
        closedToSuggestions: t.closedToSuggestions ?? false,
        stats: {
          videos: own.length,
          creators: new Set(own.map((c) => c.creator.handle)).size,
          curators: new Set(
            own.map((c) => c.curatedBy).filter((x): x is string => !!x)
          ).size,
        },
      });
    }
    return out;
  }

  async getTopic(qid: string): Promise<Topic | null> {
    return read<Topic>(TOPICS_KEY).find((t) => t.qid === qid) ?? null;
  }

  async getTopicByTitle(title: string): Promise<Topic | null> {
    const norm = (s: string) => s.replace(/_/g, " ").trim().toLowerCase();
    const want = norm(title);
    return read<Topic>(TOPICS_KEY).find((t) => norm(t.title) === want) ?? null;
  }

  async upsertTopic(topic: Topic): Promise<Topic> {
    const topics = read<Topic>(TOPICS_KEY);
    const i = topics.findIndex((t) => t.qid === topic.qid);
    if (i >= 0) topics[i] = topic;
    else topics.push(topic);
    write(TOPICS_KEY, topics);
    return topic;
  }

  // Issue #159: set/clear the topic's "marked complete" flag (reference impl). The production
  // CURATOR role-gate lives in `setTopicClosedToSuggestionsAction`; this just persists the boolean
  // on the stored topic row, touching no other field and no clip/candidate.
  async setTopicClosedToSuggestions(
    qid: string,
    closed: boolean
  ): Promise<Topic> {
    const topics = read<Topic>(TOPICS_KEY);
    const i = topics.findIndex((t) => t.qid === qid);
    if (i < 0) throw new Error(`Topic ${qid} not found`);
    topics[i] = { ...topics[i], closedToSuggestions: closed };
    write(TOPICS_KEY, topics);
    return topics[i];
  }

  async listClips(topicQid: string): Promise<Clip[]> {
    // D5c (issue #59): a soft-removed clip leaves the read (the reference parallel of the
    // DrizzleDataStore's `removed_at IS NULL` filter). The reference impl marks a removed clip with
    // a private `__removedAt` on the persisted row (the client `Clip` carries NO removed field —
    // Decision 5) and excludes it here, mirroring the production read exclusion.
    return read<Clip>(CLIPS_KEY)
      .filter((c) => c.topicQid === topicQid && !isRemoved(c))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listCandidates(topicQid: string): Promise<Candidate[]> {
    // Seeded/fallback candidates (no-key path / pre-article). The live YouTube pipeline
    // is `suggestCandidates` below; this stays the graceful no-op result (AC1).
    return read<Candidate>(CANDIDATES_KEY).filter((c) => c.topicQid === topicQid);
  }

  async suggestCandidates(input: {
    topicQid: string;
    topicTitle: string;
    sections: ArticleSection[];
    curatedVideoKeys: Set<string>;
    dismissedVideoKeys: Set<string>;
  }): Promise<Candidate[] | null> {
    // Live path (AC2): the pluggable source pipeline (YouTube only this round) does the
    // single search + section matching + dedup + 24h cache. Returns null when no source
    // is enabled (no key) — the caller falls back to listCandidates (seed). The pipeline
    // never throws (sources swallow all errors → degrade to seeded/empty, AC14).
    return runCandidatePipeline(input);
  }

  async addClip(input: Omit<Clip, "id" | "createdAt">): Promise<Clip> {
    const clips = read<Clip>(CLIPS_KEY);
    const clip: Clip = {
      ...input,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    clips.push(clip);
    write(CLIPS_KEY, clips);
    return clip;
  }

  async updateClip(id: string, patch: Partial<Omit<Clip, "id">>): Promise<Clip> {
    const clips = read<Clip>(CLIPS_KEY);
    const i = clips.findIndex((c) => c.id === id);
    if (i < 0) throw new Error(`Clip ${id} not found`);
    clips[i] = { ...clips[i], ...patch };
    write(CLIPS_KEY, clips);
    return clips[i];
  }

  async deleteClip(id: string): Promise<void> {
    write(
      CLIPS_KEY,
      read<Clip>(CLIPS_KEY).filter((c) => c.id !== id)
    );
  }

  // D5b (issue #58): set the review-state (reference impl). `vetted=false` ⇒ held; the client `Clip`
  // carries `held` (derived from `vetted` on the DrizzleDataStore), so the reference impl mirrors
  // that mapping — set `held: true` when held, clear it when published.
  async setClipVetted(id: string, vetted: boolean): Promise<Clip> {
    const clips = read<Clip>(CLIPS_KEY);
    const i = clips.findIndex((c) => c.id === id);
    if (i < 0) throw new Error(`Clip ${id} not found`);
    clips[i] = { ...clips[i], held: vetted ? undefined : true };
    write(CLIPS_KEY, clips);
    return clips[i];
  }

  // D5c (issue #59): the moderator soft-removal (reference impl). The production role-gate lives in
  // `removeClipAction` (moderator-only, no own-curator arm); this reference impl just persists the
  // tombstone marker. SOFT — the row PERSISTS in storage with a private `__removedAt` (NOT a hard
  // `deleteClip`), so a removed clip leaves the read (`listClips`/`listClipsByContributor` exclude
  // it via `isRemoved`) while the row remains — the parallel of the DB tombstone. `vetted`/`held`
  // is left untouched (a removed clip is independent of its held state). The reason is recorded on
  // the marker for parity; it is never reader-facing.
  async removeClip(
    id: string,
    removedBy?: number,
    reason?: string | null
  ): Promise<Clip> {
    const clips = read<Clip>(CLIPS_KEY);
    const i = clips.findIndex((c) => c.id === id);
    if (i < 0) throw new Error(`Clip ${id} not found`);
    const marked = {
      ...clips[i],
      __removedAt: new Date().toISOString(),
      __removedBy: removedBy ?? null,
      __removedReason: reason ?? null,
    } as Clip & RemovedMarker;
    clips[i] = marked;
    write(CLIPS_KEY, clips);
    return marked;
  }

  // ── Per-user skin preference (issue #143 — reference impl). ─────────────────────────
  // The localStorage store has no `contributor` table (clips carry only the `curatedBy` handle), so
  // the reference impl persists the chosen skin to a single per-browser key. This keeps the seam
  // contract satisfiable in non-DB tests; the production per-user round-trip is exercised against the
  // real DrizzleDataStore (pglite). The cookie is the real client source of truth for rendering
  // (spec §6.1) — this is only the durable-backstop stand-in.
  async setSkinPreference(skin: string | null): Promise<void> {
    if (typeof window === "undefined") return;
    if (skin === null) window.localStorage.removeItem(SKIN_PREF_KEY);
    else window.localStorage.setItem(SKIN_PREF_KEY, skin);
  }

  // ── Public contributor profile reads (issue #54 / D3 — reference impl over `curatedBy`). ──
  // The localStorage store has no `contributor` table — clips carry only the `curatedBy` handle
  // string. The reference impl therefore derives a STABLE synthetic id from the sorted set of
  // distinct real (non-`@prototype`) handles, so `getContributorByUsername` and
  // `listClipsByContributor` round-trip consistently with each other. The PRODUCTION path uses
  // `DrizzleDataStore` (real `contributor.id` + the privacy projection + the Decision-1 tie-break);
  // this exists only for parity in the reference impl / non-DB tests.
  private distinctHandles(): string[] {
    const set = new Set<string>();
    for (const c of read<Clip>(CLIPS_KEY)) {
      if (c.curatedBy && c.curatedBy !== STUB_HANDLE) set.add(c.curatedBy);
    }
    return [...set].sort();
  }

  async getContributorByUsername(
    username: string
  ): Promise<PublicContributor | null> {
    // `@prototype` is never a browsable profile (Decision 4).
    if (username === STUB_HANDLE) return null;
    const handles = this.distinctHandles();
    const i = handles.indexOf(username);
    if (i < 0) return null;
    // Synthetic but stable id (1-based) so listClipsByContributor can reverse it.
    return { id: i + 1, username };
  }

  async listClipsByContributor(
    contributorId: number
  ): Promise<ContributorClip[]> {
    const handles = this.distinctHandles();
    const username = handles[contributorId - 1];
    if (!username) return [];
    const topics = read<Topic>(TOPICS_KEY);
    return read<Clip>(CLIPS_KEY)
      // D5c (issue #59): a soft-removed clip leaves the profile read too (`!isRemoved`), parallel to
      // the DrizzleDataStore's `removed_at IS NULL` filter on `listClipsByContributor`.
      .filter((c) => c.curatedBy === username && !isRemoved(c))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => ({
        ...c,
        topicTitle:
          topics.find((t) => t.qid === c.topicQid)?.title ?? c.topicQid,
      }));
  }

  // ── Sticky dismissals (issue #45). Ported from lib/candidates/dismissals.ts so the
  // localStorage store implements the FULL DataStore interface and the carried-forward
  // contract tests cover it. Keyed `topicQid|platform|videoId`; the read returns the
  // `platform:videoId` keys for a topic (the filter identity).
  async recordDismissal(input: {
    topicQid: string;
    platform: string;
    videoId: string;
  }): Promise<void> {
    if (typeof window === "undefined") return;
    const all = read<{ k: string }>(DISMISSED_KEY);
    const k = `${input.topicQid}|${input.platform}|${input.videoId}`;
    if (!all.some((e) => e.k === k)) {
      all.push({ k });
      write(DISMISSED_KEY, all);
    }
  }

  async dismissedKeys(topicQid: string): Promise<string[]> {
    const prefix = `${topicQid}|`;
    const out = new Set<string>();
    for (const { k } of read<{ k: string }>(DISMISSED_KEY)) {
      if (!k.startsWith(prefix)) continue;
      const [, platform, videoId] = k.split("|");
      if (platform && videoId) out.add(`${platform}:${videoId}`);
    }
    return [...out];
  }

  // ── Upvotes (issue #55 / D4 — reference impl). ─────────────────────────────────────
  // The localStorage store is a single-browser, single-"user" reference impl with no real
  // `contributor` identity (the production path is `DrizzleDataStore` with the real per-user
  // `clip_vote` table + the `(clip,contributor)` unique constraint). Here a vote is just the set
  // of clip ids this browser has voted, so the toggle is a Set add/remove and the derived count is
  // the seed baseline + 1 when voted. This keeps the seam contract satisfiable in the reference
  // impl / non-DB tests; the one-per-user DB invariant + the gate are exercised against the real
  // DrizzleDataStore (pglite).
  async toggleUpvote(clipId: string): Promise<UpvoteToggle> {
    const voted = new Set(read<string>(VOTES_KEY));
    const nowVoted = !voted.has(clipId);
    if (nowVoted) voted.add(clipId);
    else voted.delete(clipId);
    write(VOTES_KEY, [...voted]);
    const baseline = read<Clip>(CLIPS_KEY).find((c) => c.id === clipId)?.upvotes ?? 0;
    return { voted: nowVoted, count: baseline + (nowVoted ? 1 : 0) };
  }

  async votedClipIds(clipIds: string[]): Promise<string[]> {
    const voted = new Set(read<string>(VOTES_KEY));
    return clipIds.filter((id) => voted.has(id));
  }

  /** Seed helpers (used by lib/data/index.ts). */
  _seedClips(clips: Clip[]): void {
    write(CLIPS_KEY, clips);
  }
  _seedCandidates(cands: Candidate[]): void {
    write(CANDIDATES_KEY, cands);
  }
}
