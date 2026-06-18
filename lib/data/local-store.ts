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
  UpvoteToggle,
} from "./types";

const TOPICS_KEY = "wikiplus.topics";
const CLIPS_KEY = "wikiplus.clips";
const CANDIDATES_KEY = "wikiplus.candidates";
const DISMISSED_KEY = "wikiplus.dismissed_candidates";
const VOTES_KEY = "wikiplus.clip_votes";

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

export class LocalStorageDataStore implements DataStore {
  async listTopics(): Promise<Topic[]> {
    return read<Topic>(TOPICS_KEY);
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

  async listClips(topicQid: string): Promise<Clip[]> {
    return read<Clip>(CLIPS_KEY)
      .filter((c) => c.topicQid === topicQid)
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
      .filter((c) => c.curatedBy === username)
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
