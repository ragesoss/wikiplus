"use server";

import { DrizzleDataStore } from "@/lib/db/drizzle-store";
import type { Clip, Platform, Topic } from "@/lib/data/types";
import { ACCURACY_ORDER, STANCE_ORDER } from "@/lib/curation/labels";
import { NOTE_LICENSE } from "@/lib/curation/note-license";
import { isMaterialNoteChange } from "@/lib/curation/note-text";
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
  input: Omit<Clip, "id" | "createdAt">,
  /**
   * The contributor's per-submit CC BY-SA agreement (issue #52 / D1 — Decision D1-1, AC6/AC7).
   * The client signals consent (`true`) when the curator checked the required agreement; the
   * boundary then STAMPS the license version + a server-side timestamp. A bare boolean on the
   * wire is all the client may assert — it can neither set the version nor backdate the
   * timestamp, and any `noteLicense*` it tries to smuggle on `input` is stripped below.
   */
  noteLicenseAgreed = false
): Promise<Clip> {
  // GATE FIRST (AC7): reject an unauthenticated add before any DB write. The resolved
  // contributor attributes the clip (AC6): `curatorId` → the real contributor, and
  // `curatedBy` → their Wikimedia username (so the vouch shows a real name and the infobox
  // curator count reflects real contributors). A caller-supplied `curatedBy` is overridden —
  // attribution is the boundary's call, not the client's.
  const { contributorId, username } = await requireContributor();
  const valid = validateClipInput(input);
  // Strip any client-supplied license fields: the agreement record is the boundary's to
  // stamp, never trusted off the wire (mirrors the `curatedBy` override above). The client's
  // ONLY input to the agreement is the `noteLicenseAgreed` consent boolean.
  const {
    noteLicense: _ignoreLicense,
    noteLicenseAgreedAt: _ignoreAgreedAt,
    ...rest
  } = valid;
  void _ignoreLicense;
  void _ignoreAgreedAt;
  // Capture the agreement only when the client signalled consent (Decision D1-1): version
  // `CC-BY-SA-4.0` + a server timestamp, bound to this clip + contributor. A non-agreed write
  // records NO license (per AC6 the client blocks publish until agreed; the boundary is the
  // belt-and-suspenders — it simply won't stamp a license without the consent signal).
  const agreement = noteLicenseAgreed
    ? { noteLicense: NOTE_LICENSE, noteLicenseAgreedAt: new Date() }
    : undefined;
  return store().addClip(
    { ...rest, curatedBy: username },
    contributorId,
    agreement
  );
}

// ── Owner-only edit / delete (issue #53 / D2 — AC1–AC12, Decisions 1–6) ──────────────────
// `updateClip` / `deleteClip` were deliberately OFF the boundary until ownership existed (issue
// #45 fix round): with no auth, an anonymous boundary export would let any visitor edit/delete
// ANY clip. C supplied the missing half — a stable owner per clip (`clip.curatorId`) — so D2
// surfaces both as AUTH-GATED, OWNER-ONLY actions. The gate is server-side and ID-BASED
// (Decision 6, fixed): `requireContributor()` FIRST, then the loaded clip's `curatorId` must
// equal the session contributor id — NEVER by username, NEVER trusting a client "isOwner" flag.
// A non-owner / anonymous / legacy-`@prototype`-clip call is rejected and writes nothing.

/**
 * The editable set (Decision 2): ONLY the curator-authored fields a vouch comprises — the note,
 * the stance/accuracy assessment (+ their display modifiers), and the section placement. The
 * clip's IDENTITY is intentionally absent (video/embed/watch URLs, platform, creator,
 * orientation, thumbnail, parent `topicQid`, `curatorId`/`curatedBy`, `createdAt`, `upvotes`):
 * changing the video would make it a different clip — that is delete + add, not an edit. A patch
 * is narrowed to exactly these keys at the boundary (`pickEditable`), so a FORGED patch carrying
 * any other field is ignored (AC1) and can never change attribution/provenance.
 */
export type ClipEditPatch = {
  contextNote?: string;
  stance?: Clip["stance"];
  stanceModifier?: string;
  accuracyFlag?: Clip["accuracyFlag"];
  accuracyModifier?: string;
  general?: boolean;
  sectionSlug?: string;
  sectionLabel?: string;
};

/**
 * Narrow an incoming patch to the editable set (Decision 2). Anything outside it — even on a
 * forged patch trying to set `curatorId`/`curatedBy`/`createdAt`/video/creator/`upvotes`/
 * `topicQid`/`noteLicense*` — is dropped here, so it can never reach the row (AC1). The closed
 * stance/accuracy enums + the free-text length cap (the D1 stopgap) are applied on the named
 * fields only. The stance/accuracy MODIFIERS are PRESERVED, not cleared (D2 adds no modifier
 * UI): an absent modifier on the patch leaves the stored value untouched (the store's
 * `clipPatchToUpdate` only writes `!== undefined` keys), so a chip change never wipes a modifier.
 */
function pickEditable(patch: ClipEditPatch): ClipEditPatch {
  const out: ClipEditPatch = {};
  if (patch.contextNote !== undefined) {
    out.contextNote = capText(patch.contextNote, "contextNote");
  }
  if (patch.stance !== undefined) {
    if (!STANCES.has(patch.stance)) {
      throw new Error(`Unknown stance: ${patch.stance}`);
    }
    out.stance = patch.stance;
  }
  if (patch.stanceModifier !== undefined) out.stanceModifier = patch.stanceModifier;
  if (patch.accuracyFlag !== undefined) {
    if (!ACCURACY.has(patch.accuracyFlag)) {
      throw new Error(`Unknown accuracy flag: ${patch.accuracyFlag}`);
    }
    out.accuracyFlag = patch.accuracyFlag;
  }
  if (patch.accuracyModifier !== undefined) {
    out.accuracyModifier = patch.accuracyModifier;
  }
  if (patch.general !== undefined) out.general = patch.general;
  if (patch.sectionSlug !== undefined) out.sectionSlug = patch.sectionSlug;
  if (patch.sectionLabel !== undefined) out.sectionLabel = patch.sectionLabel;
  return out;
}

/**
 * Owner-only edit of the curator-authored fields (AC1/AC2/AC4/AC6/AC9/AC10). The order is the
 * security contract: GATE (auth) → LOAD owner → OWNERSHIP CHECK (id-based) → narrow patch →
 * decide §5.3 re-stamp from the STORED note → write.
 */
export async function updateClipAction(
  clipId: string,
  patch: ClipEditPatch,
  /**
   * The client's §5.3 re-agreement signal (mirrors `addClipAction`'s consent boolean). The
   * client sets it true only when it revealed the required agreement on a material note change
   * (design §4). The SERVER independently recomputes materiality from the stored note vs. the
   * patch and is the authority on whether to re-stamp — this boolean is a necessary consent
   * signal, never the trigger by itself (a material change with no consent does not re-stamp).
   */
  noteLicenseAgreed = false
): Promise<Clip> {
  // GATE FIRST (AC6): an anonymous caller is rejected before the ownership check even runs.
  const { contributorId } = await requireContributor();
  const s = store();
  const owner = await s.clipOwnership(clipId);
  if (!owner) throw new Error(`Clip ${clipId} not found`);
  // OWNERSHIP GATE (Decision 6, AC4/AC8): id-based, server-side. A legacy `@prototype` clip has
  // a `curatorId` matching no current contributor, so this fails for everyone (correct, AC8).
  if (owner.curatorId !== contributorId) {
    throw new Error("Not your clip to edit.");
  }
  const editable = pickEditable(patch);
  // §5.3 re-affirmation (Decision 3, AC9/AC10): the SERVER decides materiality from the STORED
  // note vs. the (narrowed) incoming note. Re-stamp ONLY when the note text changed materially
  // AND the client signalled consent; a chip/section-only or whitespace-only edit re-stamps
  // nothing (the existing license/timestamp are left untouched).
  const noteChangedMaterially =
    editable.contextNote !== undefined &&
    isMaterialNoteChange(owner.contextNote, editable.contextNote);
  const agreement =
    noteChangedMaterially && noteLicenseAgreed
      ? { noteLicense: NOTE_LICENSE, noteLicenseAgreedAt: new Date() }
      : undefined;
  return s.updateClip(clipId, editable, agreement);
}

/**
 * Owner-only HARD delete (AC3/AC5/AC6/AC8, Decision 4). Same gate as edit; on pass the row is
 * removed (no soft-delete / undo — Decision 4). A non-owner / anonymous / legacy-clip call is
 * rejected and removes nothing.
 */
export async function deleteClipAction(clipId: string): Promise<void> {
  const { contributorId } = await requireContributor(); // GATE FIRST (AC6)
  const s = store();
  const owner = await s.clipOwnership(clipId);
  if (!owner) throw new Error(`Clip ${clipId} not found`);
  if (owner.curatorId !== contributorId) {
    throw new Error("Not your clip to delete.");
  }
  await s.deleteClip(clipId);
}

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
