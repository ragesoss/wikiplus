"use server";

import { DrizzleDataStore } from "@/lib/db/drizzle-store";
import type { Clip, Platform, Topic } from "@/lib/data/types";
import { ACCURACY_ORDER, STANCE_ORDER } from "@/lib/curation/labels";

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

// ── Minimal input stopgap on the PUBLIC write boundary (issue #45 fix round) ────────────
// These anonymous write actions are reachable by anyone (no auth until issue C). This is a
// CHEAP server-side stopgap before D's full validation/auth: a length cap on free text so an
// open endpoint can't be used to store absurd blobs, and a closed-set guard so the curation
// enums (stance / accuracy / platform) can't be poisoned with out-of-vocabulary values that
// would break chip rendering downstream. It is deliberately minimal — D owns real validation,
// auth-gating, ownership, and the CC BY-SA agreement capture.

/** Max length for free-text fields (`context_note`, `caption`). A sane cap, not a UX limit. */
const MAX_TEXT = 5000;

const STANCES = new Set<string>(STANCE_ORDER);
const ACCURACY = new Set<string>(ACCURACY_ORDER);
// The closed `Platform` enum (lib/data/types.ts). `parseVideoUrl` only ever yields these.
const PLATFORMS = new Set<Platform>(["youtube", "tiktok", "instagram", "other"]);

function capText(value: string, field: string): string {
  if (value.length > MAX_TEXT) {
    throw new Error(`${field} exceeds the ${MAX_TEXT}-character limit.`);
  }
  return value;
}

/** Closed-set + length-cap guard for an incoming clip add (the public `addClip` boundary). */
function validateClipInput(
  input: Omit<Clip, "id" | "createdAt">
): Omit<Clip, "id" | "createdAt"> {
  capText(input.contextNote ?? "", "contextNote");
  capText(input.caption ?? "", "caption");
  if (!STANCES.has(input.stance)) {
    throw new Error(`Unknown stance: ${input.stance}`);
  }
  if (!ACCURACY.has(input.accuracyFlag)) {
    throw new Error(`Unknown accuracy flag: ${input.accuracyFlag}`);
  }
  if (!PLATFORMS.has(input.platform)) {
    throw new Error(`Unknown platform: ${input.platform}`);
  }
  return input;
}

/** Length-cap guard for an incoming topic upsert (the public `upsertTopic` boundary). */
function validateTopicInput(input: Topic): Topic {
  capText(input.title ?? "", "title");
  if (input.description) capText(input.description, "description");
  return input;
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
  // Validate FIRST (before constructing the store / touching the DB) so an out-of-bounds
  // input is rejected at the boundary regardless of DB availability.
  const valid = validateTopicInput(topic);
  return store().upsertTopic(valid);
}

// ── Clips ──────────────────────────────────────────────────────────────────────────────
export async function listClipsAction(topicQid: string): Promise<Clip[]> {
  return store().listClips(topicQid);
}

export async function addClipAction(
  input: Omit<Clip, "id" | "createdAt">
): Promise<Clip> {
  // Validate FIRST (before constructing the store / touching the DB).
  const valid = validateClipInput(input);
  return store().addClip(valid);
}

// NOT exposed at the boundary (issue #45 fix round): `updateClip` / `deleteClip` are
// DESTRUCTIVE and have NO UI caller. With no auth until issue C, a boundary export would
// let any anonymous visitor edit or delete ANY clip — an over-broad capability. The
// methods stay on `DrizzleDataStore` (for issue D + the store-level tests), but the
// anonymous Server-Action boundary deliberately does NOT surface them. When D adds
// auth-gating + ownership checks, it can add gated actions then.

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
