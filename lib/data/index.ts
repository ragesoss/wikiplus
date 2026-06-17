import { runCandidatePipeline } from "@/lib/candidates";
import { identityKey, videoIdOf } from "@/lib/candidates/dismissals";
import {
  addClipAction,
  dismissedKeysAction,
  getTopicAction,
  getTopicByTitleAction,
  listClipsAction,
  listTopicsAction,
  recordDismissalAction,
  upsertTopicAction,
} from "@/lib/server/actions";
import type { DataStore } from "./store";
import type { ArticleSection, Candidate, Clip, TopicStats } from "./types";

// ── The DataStore seam (issue #45). ────────────────────────────────────────────────────
// PRODUCTION shape: the concrete store is `DrizzleDataStore` (lib/db/drizzle-store.ts),
// running server-side and reached through the Server Actions boundary (lib/server/actions.ts).
// This file is the ONLY place that wires the client to the concrete store (the documented
// swap point — AC4). The localStorage `DataStore` is retired for the deployed app.
//
// HOW THE SPLIT WORKS (AC6/AC7/AC8):
//   - Every DB read/write below delegates to a Server Action — DB access is server-only, so
//     the pg driver + DATABASE_URL never enter the client bundle (AC7).
//   - `suggestCandidates` is the ONE method that stays CLIENT-SIDE: it runs the live YouTube
//     pipeline in the browser (reading the client-inlined key) — the server never calls
//     YouTube/Wikipedia (AC8). The dismissed set it needs is fetched via the server boundary
//     first (shared/durable dismissals) and passed into the pure pipeline.
//
// `store` is a `DataStore`-shaped client facade: callers keep the same `await store.*` shape
// they used against the localStorage store, so the call-site rewire is minimal (parity).
const clientStore: DataStore = {
  listTopics: () => listTopicsAction(),
  getTopic: (qid) => getTopicAction(qid),
  getTopicByTitle: (title) => getTopicByTitleAction(title),
  upsertTopic: (topic) => upsertTopicAction(topic),
  listClips: (topicQid) => listClipsAction(topicQid),
  // Seeded/fallback candidates are not DB rows (ARCHITECTURE: candidates are computed +
  // cached, only promote/dismiss persists). The server returns []; the live pipeline below
  // is the real client-side suggestion path.
  listCandidates: async () => [],
  // CLIENT-SIDE live YouTube pipeline (AC8). Runs in the browser; the seeded fallback is [].
  suggestCandidates: (input) => runCandidatePipeline(input),
  // Client → boundary: forward ONLY the per-submit consent boolean (issue #52 / D1, AC7).
  // The server stamps the license version + timestamp; the client never mints either. The
  // `curatorId` / server-`agreement` params of the seam are server-internal and unused here.
  addClip: (clip, _curatorId, _agreement, noteLicenseAgreed) =>
    addClipAction(clip, noteLicenseAgreed),
  recordDismissal: (input) => recordDismissalAction(input),
  dismissedKeys: (topicQid) => dismissedKeysAction(topicQid),
};

export const store: DataStore = clientStore;

/**
 * The set of `platform:videoId` identity keys already curated as clips for a topic —
 * passed to the live candidate pipeline so an already-curated video is never suggested
 * (AC8). Uses the same provider-video-identity parser as dismissal dedup.
 */
export function curatedVideoKeys(clips: Clip[]): Set<string> {
  const keys = new Set<string>();
  for (const c of clips) {
    const videoId = videoIdOf(c);
    if (videoId) keys.add(identityKey(c.platform, videoId));
  }
  return keys;
}

/**
 * Fetch the shared, durable dismissed-video keys for a topic (issue #45) as a Set, for the
 * live candidate pipeline's AC9 dedup. Thin wrapper over the server boundary so call sites
 * get a `Set<string>` ready to pass into `suggestCandidates`.
 */
export async function dismissedVideoKeys(topicQid: string): Promise<Set<string>> {
  return new Set(await store.dismissedKeys(topicQid));
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

// Re-export the candidate-pipeline input type so callers can type the `suggestCandidates`
// argument without reaching into lib/candidates.
export type { ArticleSection, Candidate };
