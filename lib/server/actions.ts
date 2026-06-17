"use server";

import { DrizzleDataStore } from "@/lib/db/drizzle-store";
import type { Clip, Platform, Topic } from "@/lib/data/types";
import { ACCURACY_ORDER, STANCE_ORDER } from "@/lib/curation/labels";
import { requireContributor } from "@/lib/auth/require-session";

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
// Each READ here is a thin wrapper over one DrizzleDataStore method. The three WRITE actions
// (`upsertTopicAction`, `addClipAction`, `recordDismissalAction`) are AUTH-GATED as of issue C
// (AC7/AC8, Decision D1): they resolve the signed-in contributor via `requireContributor()`
// and REJECT (throw `AuthRequiredError`) when there is no session — the gate is in the Server
// Action, not only a hidden client button — then attribute the write to the REAL contributor
// (no more `@prototype` for new writes). Reads stay anonymous (no `requireContributor`), so the
// cached read path adds no per-user/auth work (AC11). Full validation/ownership/agreement
// capture is still issue D. The store is instantiated lazily per call; the underlying DB
// connection is opened lazily + memoized in lib/db/client.
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
  // GATE FIRST (AC7): `upsertTopic` is a write and is the PREREQUISITE of `addClip` in the
  // contribute flow (a logged-out user must not create a topic-as-a-side-effect-of-adding).
  // An unauthenticated call is rejected before any validation or DB touch.
  await requireContributor();
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
  // GATE FIRST (AC7): reject an unauthenticated add before any DB write. The resolved
  // contributor attributes the clip (AC6): `curatorId` → the real contributor, and
  // `curatedBy` → their Wikimedia username (so the vouch shows a real name and the infobox
  // curator count reflects real contributors). A caller-supplied `curatedBy` is overridden —
  // attribution is the boundary's call, not the client's.
  const { contributorId, username } = await requireContributor();
  const valid = validateClipInput(input);
  return store().addClip({ ...valid, curatedBy: username }, contributorId);
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
  // GATE FIRST (AC8): an unauthenticated dismiss is rejected before any DB write (no
  // `dismissed_candidate` row); a signed-in one is attributed to the real contributor.
  const { contributorId } = await requireContributor();
  return store().recordDismissal(input, contributorId);
}

export async function dismissedKeysAction(topicQid: string): Promise<string[]> {
  return store().dismissedKeys(topicQid);
}
