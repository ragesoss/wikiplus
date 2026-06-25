import { runCandidatePipeline } from "@/lib/candidates";
import { identityKey, videoIdOf } from "@/lib/candidates/dismissals";
import {
  addClipAction,
  deleteClipAction,
  dismissedKeysAction,
  getContributorByUsernameAction,
  getTopicAction,
  getTopicByTitleAction,
  holdClipAction,
  listClipsAction,
  listClipsByContributorAction,
  listCuratedTopicsAction,
  listRecentCurationsAction,
  listTopicsAction,
  recordDismissalAction,
  removeClipAction,
  reviewClipAction,
  setSkinPreferenceAction,
  toggleUpvoteAction,
  updateClipAction,
  upsertTopicAction,
  votedClipIdsAction,
  type ClipEditPatch,
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
  listCuratedTopics: () => listCuratedTopicsAction(),
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
  // Client → boundary: pass the clip id, the editable-set patch, and ONLY the consent boolean
  // (issue #53 / D2). The server gates ownership + decides the §5.3 re-stamp; the client never
  // mints a license. The seam's server-`agreement` param is server-internal and unused here.
  updateClip: (id, patch, _agreement, noteLicenseAgreed) =>
    updateClipAction(id, patch as ClipEditPatch, noteLicenseAgreed),
  deleteClip: (id) => deleteClipAction(id),
  // D5b (issue #58): the review-hold writes. The seam's `setClipVetted(id, vetted)` routes to the
  // two ROLE-GATED Server Actions — `reviewClipAction` (approve, moderator-only) when setting
  // vetted=true, `holdClipAction` (hold, moderator-or-own-curator) when setting vetted=false. The
  // client passes only the clip id + the target state; the server resolves the role and gates the
  // write (the host's runHold/runApprove call this — never a client role flag).
  setClipVetted: (id, vetted) =>
    vetted ? reviewClipAction(id) : holdClipAction(id),
  // D5c (issue #59): the moderator-only soft-removal. The seam's `removeClip(id, _removedBy, reason)`
  // routes to the role-gated `removeClipAction` — the client passes only the clip id + the OPTIONAL
  // audit reason; the server resolves the acting moderator (`removedBy`) and gates the write
  // MODERATOR-ONLY (no own-curator arm). The seam's `removedBy` param is server-internal, unused
  // here (the boundary resolves it from the session — never a client-supplied remover).
  removeClip: (id, _removedBy, reason) => removeClipAction(id, reason),
  // Public contributor profile reads (issue #54 / D3) — anonymous, like `listClips`.
  getContributorByUsername: (username) =>
    getContributorByUsernameAction(username),
  listClipsByContributor: (contributorId) =>
    listClipsByContributorAction(contributorId),
  // Recent-curations feed (issue #160) — anonymous, cursor-paginated, like the other reads. The
  // client passes the opaque cursor + limit straight through; the boundary applies the visibility
  // predicate + keyset paging server-side.
  listRecentCurations: (input) => listRecentCurationsAction(input),
  // Upvotes (issue #55 / D4). The toggle forwards the clip id only — the boundary resolves the
  // contributor (the seam's `contributorId` param is server-internal, unused here). `votedClipIds`
  // is the per-viewer voted-state read; the host calls it ONLY in the authenticated session (it is
  // gated, so a logged-out call would reject — TopicView guards on `myContributorId`).
  toggleUpvote: (clipId) => toggleUpvoteAction(clipId),
  votedClipIds: (clipIds) => votedClipIdsAction(clipIds),
  recordDismissal: (input) => recordDismissalAction(input),
  dismissedKeys: (topicQid) => dismissedKeysAction(topicQid),
  // Issue #143: the per-user skin preference write. The client forwards only the chosen skin value —
  // the boundary resolves the contributor (the seam's `contributorId` param is server-internal,
  // unused here). FIRE-AND-FORGET from the toggle (spec §6.1): the cookie + the live `data-skin` flip
  // happen first and never await this.
  setSkinPreference: (skin) => setSkinPreferenceAction(skin),
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
