"use server";

import { DrizzleDataStore } from "@/lib/db/drizzle-store";
import type { Clip, Topic } from "@/lib/data/types";

// The server data-access boundary (issue #45 — deliverable 1/4).
//
// CHOICE: Server Actions (not route handlers). Rationale — recorded in ARCHITECTURE.md:
//   - Server Actions are already enabled (#37) and are the idiomatic Next.js client→server
//     call for App Router; the client imports these as plain async functions, so the
//     call-site rewire is a near drop-in for the previous `store.*` await (parity).
//   - They are typed end-to-end (no hand-written fetch/JSON for each op) and serialize
//     args/results automatically, which suits a thin set of MECHANICAL store wrappers
//     (no product logic in B — that is issue D).
//   - DB access stays SERVER-ONLY: these functions run on the server; the DrizzleDataStore
//     they call imports `server-only`, so neither the pg driver nor DATABASE_URL can reach
//     the client bundle (AC7).
//
// Each function here is a thin wrapper over one DrizzleDataStore method — no auth-gating,
// no validation, no agreement capture (all of that is issue D). The store is instantiated
// lazily per call; the underlying DB connection is opened lazily + memoized in lib/db/client.
//
// NOT here (stays client-side, AC8): title→QID resolution, the article body/TOC fetch, and
// the live YouTube `suggestCandidates` pipeline. The server never calls Wikipedia/YouTube.

function store(): DrizzleDataStore {
  return new DrizzleDataStore();
}

// ── Topics ───────────────────────────────────────────────────────────────────────────
export async function listTopicsAction(): Promise<Topic[]> {
  return store().listTopics();
}

export async function getTopicAction(qid: string): Promise<Topic | null> {
  return store().getTopic(qid);
}

export async function getTopicByTitleAction(
  title: string
): Promise<Topic | null> {
  return store().getTopicByTitle(title);
}

export async function upsertTopicAction(topic: Topic): Promise<Topic> {
  return store().upsertTopic(topic);
}

// ── Clips ──────────────────────────────────────────────────────────────────────────────
export async function listClipsAction(topicQid: string): Promise<Clip[]> {
  return store().listClips(topicQid);
}

export async function addClipAction(
  input: Omit<Clip, "id" | "createdAt">
): Promise<Clip> {
  return store().addClip(input);
}

export async function updateClipAction(
  id: string,
  patch: Partial<Omit<Clip, "id">>
): Promise<Clip> {
  return store().updateClip(id, patch);
}

export async function deleteClipAction(id: string): Promise<void> {
  return store().deleteClip(id);
}

// ── Sticky dismissals (shared + durable — AC5) ──────────────────────────────────────────
export async function recordDismissalAction(input: {
  topicQid: string;
  platform: string;
  videoId: string;
}): Promise<void> {
  return store().recordDismissal(input);
}

export async function dismissedKeysAction(topicQid: string): Promise<string[]> {
  return store().dismissedKeys(topicQid);
}
