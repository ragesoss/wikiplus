import { vi } from "vitest";
import { runCandidatePipeline } from "@/lib/candidates";
import { identityKey, videoIdOf } from "@/lib/candidates/dismissals";
import { LocalStorageDataStore } from "@/lib/data/local-store";
import {
  PHOTOSYNTHESIS_QID,
  UNCURATED_DEMO_QID,
  seedCandidates,
  seedClips,
} from "@/lib/data/seed";
import type { Candidate, Clip, TopicStats } from "@/lib/data/types";

// Test double for the @/lib/data seam (issue #45). The production seam routes DB reads/writes
// through Server Actions → DrizzleDataStore (server-only, needs Postgres) — not runnable in
// jsdom. So the view/integration tests `vi.mock("@/lib/data", buildDataMock)` to get a
// localStorage-backed store + a test `seedIfEmpty`, preserving the pre-#45 test behavior
// (the component's state machine is what these tests exercise; the data backend is incidental).
//
// This keeps the SAME observable seam surface the rewired call sites use: `store.*`,
// `deriveStats`, `curatedVideoKeys`, `dismissedVideoKeys`, plus a `seedIfEmpty` the tests call.

const local = new LocalStorageDataStore();

const SEED_FLAG = "wikiplus.seedVersion";
const SEED_VERSION = "topic-page-v1";

/** Seed demo topics + clips + candidates into localStorage (test-only — mirrors the old path).
 *  Exported so tests can `import { seedIfEmpty } from "./helpers/data-mock"` — it shares the
 *  same `local` store instance the mocked `store` uses, so seeded data is visible to the view. */
export async function seedIfEmpty(): Promise<void> {
  if (
    typeof window !== "undefined" &&
    window.localStorage.getItem(SEED_FLAG) === SEED_VERSION
  ) {
    return;
  }
  await local.upsertTopic({
    qid: PHOTOSYNTHESIS_QID,
    title: "Photosynthesis",
    description: "Biological process converting light into chemical energy",
  });
  await local.upsertTopic({
    qid: UNCURATED_DEMO_QID,
    title: "Cellular respiration",
    description: "How cells release energy from nutrients",
  });
  await local.upsertTopic({ qid: "Q146", title: "Cat" });

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

function curatedVideoKeys(clips: Clip[]): Set<string> {
  const keys = new Set<string>();
  for (const c of clips) {
    const videoId = videoIdOf(c);
    if (videoId) keys.add(identityKey(c.platform, videoId));
  }
  return keys;
}

async function dismissedVideoKeys(topicQid: string): Promise<Set<string>> {
  return new Set(await local.dismissedKeys(topicQid));
}

function deriveStats(clips: Clip[]): TopicStats {
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

/**
 * The `vi.mock("@/lib/data", buildDataMock)` factory. The localStorage store stands in for
 * the Server Actions boundary; `suggestCandidates` still runs the real client pipeline (so
 * the live-flow tests drive it end-to-end with the network mocked, as before).
 */
export function buildDataMock() {
  const store = {
    listTopics: () => local.listTopics(),
    getTopic: (qid: string) => local.getTopic(qid),
    getTopicByTitle: (title: string) => local.getTopicByTitle(title),
    upsertTopic: (t: Parameters<typeof local.upsertTopic>[0]) =>
      local.upsertTopic(t),
    listClips: (qid: string) => local.listClips(qid),
    listCandidates: (qid: string) => local.listCandidates(qid),
    suggestCandidates: (input: Parameters<typeof runCandidatePipeline>[0]) =>
      runCandidatePipeline(input),
    addClip: (c: Parameters<typeof local.addClip>[0]) => local.addClip(c),
    updateClip: (
      id: string,
      patch: Parameters<typeof local.updateClip>[1]
    ) => local.updateClip(id, patch),
    deleteClip: (id: string) => local.deleteClip(id),
    recordDismissal: (input: Parameters<typeof local.recordDismissal>[0]) =>
      local.recordDismissal(input),
    dismissedKeys: (qid: string) => local.dismissedKeys(qid),
  };
  return {
    store,
    seedIfEmpty,
    curatedVideoKeys,
    dismissedVideoKeys,
    deriveStats,
    PHOTOSYNTHESIS_QID,
    UNCURATED_DEMO_QID,
  };
}

// Make the factory a default-friendly vi.mock target too.
export const dataMockFactory = vi.fn(buildDataMock);
