import { identityKey, videoIdOf } from "@/lib/candidates/dismissals";
import { LocalStorageDataStore } from "./local-store";
import {
  PHOTOSYNTHESIS_QID,
  UNCURATED_DEMO_QID,
  seedCandidates,
  seedClips,
} from "./seed";
import type { DataStore } from "./store";
import type { Candidate, Clip, TopicStats } from "./types";

// Prototype phase: localStorage. Production swaps this single line for a
// Drizzle/Postgres store invoked via Server Actions — see docs/ARCHITECTURE.md.
// This is the ONLY place that names the concrete store (AC20 swap point).
const local = new LocalStorageDataStore();
export const store: DataStore = local;

const SEED_VERSION = "topic-page-v1";
const SEED_FLAG = "wikiplus.seedVersion";

/** Seed the demo topics + clips + candidates so both states are exercised. */
export async function seedIfEmpty(): Promise<void> {
  if (typeof window !== "undefined") {
    // Re-seed when the seed shape changes so stale localStorage doesn't mask v1.
    if (window.localStorage.getItem(SEED_FLAG) === SEED_VERSION) return;
  } else if ((await store.listTopics()).length > 0) {
    return;
  }

  await store.upsertTopic({
    qid: PHOTOSYNTHESIS_QID,
    title: "Photosynthesis",
    description: "Biological process converting light into chemical energy",
  });
  await store.upsertTopic({
    qid: UNCURATED_DEMO_QID,
    title: "Cellular respiration",
    description: "How cells release energy from nutrients",
  });
  // Keep the original tiny demo topic discoverable too (uncurated → empty state).
  await store.upsertTopic({ qid: "Q146", title: "Cat" });

  const clips: Clip[] = seedClips.map((c, i) => ({
    ...c,
    id: `seed_clip_${i + 1}`,
    createdAt: new Date(Date.now() - i * 3_600_000).toISOString(),
  }));
  local._seedClips(clips);

  const cands: Candidate[] = seedCandidates.map((c, i) => ({
    ...c,
    id: `seed_cand_${i + 1}`,
  }));
  local._seedCandidates(cands);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SEED_FLAG, SEED_VERSION);
  }
}

/**
 * The set of `platform:videoId` identity keys already curated as clips for a topic —
 * passed to the live candidate pipeline so an already-curated video is never suggested
 * (AC8). Uses the same provider-video-identity parser as dismissal dedup (Decision 3).
 */
export function curatedVideoKeys(clips: Clip[]): Set<string> {
  const keys = new Set<string>();
  for (const c of clips) {
    const videoId = videoIdOf(c);
    if (videoId) keys.add(identityKey(c.platform, videoId));
  }
  return keys;
}

/** Derive the infobox counts (videos / creators / curators) from a clip set (AC7). */
export function deriveStats(clips: Clip[]): TopicStats {
  const creators = new Set(clips.map((c) => c.creator.handle));
  const curators = new Set(
    clips.map((c) => c.curatedBy).filter((x): x is string => !!x)
  );
  return {
    videos: clips.length,
    creators: creators.size,
    curators: curators.size,
    synced: "2h ago",
  };
}

export { PHOTOSYNTHESIS_QID, UNCURATED_DEMO_QID } from "./seed";
export type { DataStore } from "./store";
