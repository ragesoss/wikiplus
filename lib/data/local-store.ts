import type { DataStore } from "./store";
import type { Clip, Topic } from "./types";

const TOPICS_KEY = "wikiplus.topics";
const CLIPS_KEY = "wikiplus.clips";

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

  async updateClip(
    id: string,
    patch: Partial<Omit<Clip, "id">>
  ): Promise<Clip> {
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
}
