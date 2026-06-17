import { runCandidatePipeline } from "@/lib/candidates";
import type { DataStore } from "./store";
import type { ArticleSection, Candidate, Clip, Topic } from "./types";

const TOPICS_KEY = "wikiplus.topics";
const CLIPS_KEY = "wikiplus.clips";
const CANDIDATES_KEY = "wikiplus.candidates";
const DISMISSED_KEY = "wikiplus.dismissed_candidates";

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

  /** Seed helpers (used by lib/data/index.ts). */
  _seedClips(clips: Clip[]): void {
    write(CLIPS_KEY, clips);
  }
  _seedCandidates(cands: Candidate[]): void {
    write(CANDIDATES_KEY, cands);
  }
}
