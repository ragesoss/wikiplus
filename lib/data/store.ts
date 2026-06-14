import type { Clip, Topic } from "./types";

// The seam between the GitHub Pages prototype (localStorage) and production
// (Server Actions + Drizzle/Postgres). Only ./index.ts decides which
// implementation is active — swap it there, not at call sites.
export interface DataStore {
  listTopics(): Promise<Topic[]>;
  getTopic(qid: string): Promise<Topic | null>;
  upsertTopic(topic: Topic): Promise<Topic>;

  listClips(topicQid: string): Promise<Clip[]>;
  addClip(clip: Omit<Clip, "id" | "createdAt">): Promise<Clip>;
  updateClip(id: string, patch: Partial<Omit<Clip, "id">>): Promise<Clip>;
  deleteClip(id: string): Promise<void>;
}
