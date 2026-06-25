"use server";

import { DrizzleDataStore } from "@/lib/db/drizzle-store";
import type {
  Clip,
  ContributorClip,
  Platform,
  PublicContributor,
  RecentCurationsPage,
  Topic,
  TopicWithStats,
  UpvoteToggle,
} from "@/lib/data/types";
import { ACCURACY_ORDER, STANCE_ORDER } from "@/lib/curation/labels";
import { NOTE_LICENSE } from "@/lib/curation/note-license";
import { isMaterialNoteChange } from "@/lib/curation/note-text";
import { requireContributor } from "@/lib/auth/require-session";
import { checkWriteRateLimit, recordWriteEvent } from "@/lib/auth/rate-limit";
import { isModeratorContributor } from "@/lib/auth/moderators";
import { getDb } from "@/lib/db/client";

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
// Each READ here is a thin wrapper over one DrizzleDataStore method. The WRITE actions
// (`upsertTopicAction`, `addClipAction`, `recordDismissalAction`, `toggleUpvoteAction`,
// `updateClipAction`, `deleteClipAction`) are AUTH-GATED (AC7/AC8, Decision D1): they resolve the
// signed-in contributor via `requireContributor()` and REJECT (throw `AuthRequiredError`) when
// there is no session — the gate is in the Server Action, not only a hidden client button — then
// attribute the write to the REAL contributor (not the `@prototype` stub). Reads stay anonymous
// (no `requireContributor`), so the cached read path adds no per-user/auth work (AC11).
//
// RATE LIMIT (issue #57 / D5a): every COUNTED gated write passes a per-identity window check
// (`checkWriteRateLimit`) AFTER the auth gate and BEFORE any persisting DB write — the
// gate→limit→write contract. Over the cap (default N=60 / W=60s per `contributor.id`, env-
// overridable) it throws `RateLimitedError` with NO side effect, so the write does not happen (AC2);
// under the cap the write proceeds and `recordWriteEvent` appends ONE `write_event` ledger row AFTER
// it lands (counting only successful writes). Reads are NEVER limited and write no ledger row (AC6).
// The store is instantiated lazily per call; the underlying DB connection is opened lazily +
// memoized in lib/db/client.
//
// NOT here (stays client-side, AC8): title→QID resolution, the article body/TOC fetch, and
// the live YouTube `suggestCandidates` pipeline. The server never calls Wikipedia/YouTube.

function store(): DrizzleDataStore {
  return new DrizzleDataStore();
}

// ── Input validation on the write boundary ──────────────────────────────────────────────
// Cheap server-side guards that run alongside the auth gate + rate limit above: a length cap on
// free text so a write can't store absurd blobs, and a closed-set guard so the curation enums
// (stance / accuracy / platform) can't be poisoned with out-of-vocabulary values that would
// break chip rendering downstream.

/** Max length for free-text fields (`context_note`, `caption`). A sane cap, not a UX limit. */
const MAX_TEXT = 5000;

/**
 * Max length for short modifier / slug / label fields (`stance_modifier`, `accuracy_modifier`,
 * `section_slug`, `section_label`). The UX enforces ≤24 chars; 512 is a belt-and-suspenders
 * server guard — generous enough to never false-positive on valid input, tight enough to
 * prevent absurd blob storage.
 */
const MAX_MODIFIER = 512;

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

function capModifier(value: string, field: string): string {
  if (value.length > MAX_MODIFIER) {
    throw new Error(`${field} exceeds the ${MAX_MODIFIER}-character limit.`);
  }
  return value;
}

/** Closed-set + length-cap guard for an incoming clip add (the public `addClip` boundary). */
function validateClipInput(
  input: Omit<Clip, "id" | "createdAt">
): Omit<Clip, "id" | "createdAt"> {
  capText(input.contextNote ?? "", "contextNote");
  capText(input.caption ?? "", "caption");
  if (input.stanceModifier !== undefined)
    capModifier(input.stanceModifier, "stanceModifier");
  if (input.accuracyModifier !== undefined)
    capModifier(input.accuracyModifier, "accuracyModifier");
  if (input.sectionSlug !== undefined)
    capModifier(input.sectionSlug, "sectionSlug");
  if (input.sectionLabel !== undefined)
    capModifier(input.sectionLabel, "sectionLabel");
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

/**
 * The homepage "Recently curated" read (issue #126): curated topics + their at-a-glance counts,
 * filtered to `videos ≥ 1` and recency-ordered by the store's single grouped aggregate (no
 * N-per-topic reads). Anonymous like the other reads (no `requireContributor` — the cached read
 * path adds no per-user work).
 */
export async function listCuratedTopicsAction(): Promise<TopicWithStats[]> {
  return store().listCuratedTopics();
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
  const { contributorId } = await requireContributor();
  // LIMIT SECOND (issue #57 / D5a — the gate→limit→write contract): reject + write nothing if this
  // identity is over its per-window cap (AC2). The check is a pure read with no side effect; the
  // event is recorded after the write lands. One shared per-identity budget across all kinds.
  const db = getDb();
  await checkWriteRateLimit(db, contributorId);
  const valid = validateTopicInput(topic);
  const result = await store().upsertTopic(valid);
  await recordWriteEvent(db, contributorId, "upsert");
  return result;
}

// ── "Marked complete" / closed-to-suggestions (issue #159 — a curator-set topic flag) ────────
// Set or clear the topic-level `closed_to_suggestions` flag (the user-facing "mark complete" /
// "reopen"). A CURATION act available to ANY signed-in curator (the same bar as adding/curating —
// no moderation lock, no ownership restriction); a logged-out reader cannot set or clear it (AC4).
//
// THE SECURITY CONTROL IS HERE, not the affordance: the curator control in `Infobox` is only
// rendered when `signedIn`, but that is an affordance gate — this action re-checks the signed-in
// curator SERVER-SIDE via `requireContributor()` FIRST and REJECTS an anonymous/expired caller
// before any DB write, so a direct boundary invocation with no session changes nothing (AC4). It
// slots into the same gate→limit→write contract as the other gated writes: a counted gated write
// (recorded in the `write_event` ledger as `topic-complete`), so a mark/un-mark flood is bounded
// like add/dismiss. It is NON-destructive and fully reversible (no confirm dialog in the UI).
export async function setTopicClosedToSuggestionsAction(
  qid: string,
  closed: boolean
): Promise<Topic> {
  // GATE FIRST (AC4): reject an unauthenticated mark/un-mark before any DB write.
  const { contributorId } = await requireContributor();
  // LIMIT SECOND (issue #57 / D5a — the gate→limit→write contract): reject + write nothing if this
  // identity is over its per-window cap. Pure-read check; the event is recorded after the write.
  const db = getDb();
  await checkWriteRateLimit(db, contributorId);
  const result = await store().setTopicClosedToSuggestions(qid, closed);
  await recordWriteEvent(db, contributorId, "topic-complete");
  return result;
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
  // LIMIT SECOND (issue #57 / D5a): reject + write NO clip row if this identity is over its
  // per-window cap (AC2). add is one of the two load-bearing spam vectors (Decision 2). Pure-read
  // check; the event is recorded after the clip lands.
  const db = getDb();
  await checkWriteRateLimit(db, contributorId);
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
  const result = await store().addClip(
    { ...rest, curatedBy: username },
    contributorId,
    agreement
  );
  await recordWriteEvent(db, contributorId, "add");
  return result;
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
  if (patch.stanceModifier !== undefined)
    out.stanceModifier = capModifier(patch.stanceModifier, "stanceModifier");
  if (patch.accuracyFlag !== undefined) {
    if (!ACCURACY.has(patch.accuracyFlag)) {
      throw new Error(`Unknown accuracy flag: ${patch.accuracyFlag}`);
    }
    out.accuracyFlag = patch.accuracyFlag;
  }
  if (patch.accuracyModifier !== undefined) {
    out.accuracyModifier = capModifier(patch.accuracyModifier, "accuracyModifier");
  }
  if (patch.general !== undefined) out.general = patch.general;
  if (patch.sectionSlug !== undefined)
    out.sectionSlug = capModifier(patch.sectionSlug, "sectionSlug");
  if (patch.sectionLabel !== undefined)
    out.sectionLabel = capModifier(patch.sectionLabel, "sectionLabel");
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
  // LIMIT SECOND (issue #57 / D5a): an edit is a counted gated write (Decision 2 — included for
  // budget consistency; not the load-bearing spam vector). Reject + write nothing if over cap (AC2);
  // the check is a pure read before the ownership check. The event is recorded after the update.
  const db = getDb();
  await checkWriteRateLimit(db, contributorId);
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
  const result = await s.updateClip(clipId, editable, agreement);
  await recordWriteEvent(db, contributorId, "edit");
  return result;
}

/**
 * Owner-only HARD delete (AC3/AC5/AC6/AC8, Decision 4). Same gate as edit; on pass the row is
 * removed (no soft-delete / undo — Decision 4). A non-owner / anonymous / legacy-clip call is
 * rejected and removes nothing.
 */
export async function deleteClipAction(clipId: string): Promise<void> {
  const { contributorId } = await requireContributor(); // GATE FIRST (AC6)
  // LIMIT SECOND (issue #57 / D5a): a delete is a counted gated write (Decision 2). Reject + remove
  // nothing if over cap (AC2) — a pure read before the ownership check. Event recorded after delete.
  const db = getDb();
  await checkWriteRateLimit(db, contributorId);
  const s = store();
  const owner = await s.clipOwnership(clipId);
  if (!owner) throw new Error(`Clip ${clipId} not found`);
  if (owner.curatorId !== contributorId) {
    throw new Error("Not your clip to delete.");
  }
  await s.deleteClip(clipId);
  await recordWriteEvent(db, contributorId, "delete");
}

// ── Review-hold: hold / approve (issue #58 / D5b — AC1/AC3/AC3a/AC4/AC5, Decision 3) ─────────
// The §7 review-hold's two role-gated writes — the FIRST privileged actions in the product, and
// the minimal role model D5c reuses. Both slot into the established gate→limit→role→write order:
// `requireContributor()` FIRST (reject anonymous — the C/D1 gate), THEN the D5a rate-limit (both
// are counted gated writes), THEN the SERVER-SIDE role/ownership check, THEN the write. A failing
// role/ownership check rejects and writes NOTHING (AC4/AC5). The role is resolved SERVER-SIDE
// (`isModeratorContributor` — the DB column OR the env allowlist; lib/auth/moderators.ts) — NEVER a
// client "isModerator" flag and NEVER a hidden button. **This rejection at the action, on the role,
// is the load-bearing security behavior of D5b.**

/**
 * Put a clip into review (publish → held, `vetted = false`). Allowed for a MODERATOR (any clip)
 * OR the clip's OWN CURATOR (their own clip only — Decision 3, the D2 "revise/retract my own vouch"
 * parallel). A signed-in contributor who is neither, and an anonymous caller, are rejected
 * server-side and the clip stays published (AC5). Returns the updated `Clip` (with `held = true`)
 * so the client reflects the held marking with no reload (AC1).
 */
export async function holdClipAction(clipId: string): Promise<Clip> {
  // GATE FIRST (AC5): an anonymous caller is rejected before the rate-limit or role check.
  const { contributorId } = await requireContributor();
  // LIMIT SECOND (D5a, gate→limit→role→write): reject + write nothing if over cap (a pure read).
  const db = getDb();
  await checkWriteRateLimit(db, contributorId);
  // ROLE/OWNERSHIP CHECK THIRD (Decision 3 / AC5): load the clip's owner, then allow iff the actor
  // is a moderator OR the clip's own curator. Server-side, id-based — never a client flag. A
  // non-authorized (non-moderator, non-owner) caller is rejected and writes nothing.
  const s = store();
  const owner = await s.clipOwnership(clipId);
  if (!owner) throw new Error(`Clip ${clipId} not found`);
  const isModerator = await isModeratorContributor(db, contributorId);
  const ownsClip = owner.curatorId === contributorId;
  if (!isModerator && !ownsClip) {
    throw new Error("Not authorized to hold this clip.");
  }
  const result = await s.setClipVetted(clipId, false);
  await recordWriteEvent(db, contributorId, "hold");
  return result;
}

/**
 * Approve a held clip back to live (held → published, `vetted = true`). MODERATOR-ONLY (Decision 3
 * / CURATION §7.1): a curator may NOT self-approve — not even their own held clip — because the
 * vouch must be confirmed by someone OTHER than its author. A non-moderator (INCLUDING the clip's
 * own curator) and an anonymous caller are rejected server-side and the clip stays held. **This
 * rejection, at the action, on the role resolved server-side, is the load-bearing role-gate of
 * D5b (AC4).** Returns the updated `Clip` (with `held` cleared) so the client restores the full
 * vouch with no reload (AC3).
 */
export async function reviewClipAction(clipId: string): Promise<Clip> {
  const { contributorId } = await requireContributor(); // GATE FIRST (AC5)
  const db = getDb();
  await checkWriteRateLimit(db, contributorId); // LIMIT SECOND (D5a)
  const s = store();
  const owner = await s.clipOwnership(clipId);
  if (!owner) throw new Error(`Clip ${clipId} not found`);
  // ROLE CHECK THIRD — MODERATOR-ONLY (AC4, the load-bearing security test): a curator (even the
  // clip's own) is rejected here. No self-approve. Resolved server-side, never a client flag.
  const isModerator = await isModeratorContributor(db, contributorId);
  if (!isModerator) {
    throw new Error("Not authorized to approve this clip.");
  }
  const result = await s.setClipVetted(clipId, true);
  await recordWriteEvent(db, contributorId, "review");
  return result;
}

// ── Moderator removal: soft-remove any clip (issue #59 / D5c — AC1–AC7, Decisions 1–4) ───────
// The §7 "removable content" enforcement: a MODERATOR removes an ABUSIVE clip (CURATION §7.2). The
// THIRD privileged action, reusing D5b's role model exactly — the SECOND capability gated on the
// same server-side `isModeratorContributor` (D5b's reviewer approves/holds; D5c's moderator
// removes). It slots into the established gate→limit→role→write order, but with the KEY contrast:
// the role check is MODERATOR-ONLY — there is NO own-curator OR-arm (unlike `holdClipAction`).
// Removal of ANYONE's clip is the privileged reach; a curator wanting THEIR OWN clip gone uses D2
// owner-delete. A non-moderator (INCLUDING the clip's own curator acting as a non-moderator) and an
// anonymous caller are rejected server-side and the clip stays live (AC2/AC3 — the load-bearing
// security tests, at the action on the ROLE, never a hidden button).
//
// The removal is a SOFT tombstone (Decision 1), NOT a hard delete (the contrast with
// `deleteClipAction`): `removed_at`/`removed_by`/optional `removed_reason` are set, the row PERSISTS
// as the §7 audit trail, and the clip leaves the read (`listClips` filters `removed_at IS NULL`).
// DISTINCT from the D5b `vetted` hold (an independent column — Decision 3 / AC5). The action NEVER
// gates on or reads `accuracy_flag` (Decision 2 / C9) — a human moderator judges abuse; an honest
// `opinion`/`mixed`/`inaccurate` clip with a fair note is legitimately curatable, NOT removable.

/**
 * Soft-remove a clip (publish/held → removed). MODERATOR-ONLY (Decision 2): allowed iff the acting
 * contributor is a moderator (`isModeratorContributor` — the D5b resolver, DB column OR env
 * allowlist, server-side authority, NEVER a client flag). There is NO own-curator arm — a
 * non-moderator (including the clip's own curator) and an anonymous caller are rejected server-side
 * and the clip stays live (AC2/AC3). On pass, sets the soft-removal tombstone (`removed_at = now()`,
 * `removed_by` = the acting moderator, the OPTIONAL audit-only `reason`) so the clip stops showing
 * while its row persists. The `reason` NEVER gates the removal (Decision 4) and is NEVER shown to a
 * reader (it is audit metadata only). Returns the removed `Clip` so the client filters it out of the
 * in-memory set with no reload (AC1). A `remove` `kind` is appended to `write_event` (no schema
 * change — the `kind` column already exists).
 */
export async function removeClipAction(
  clipId: string,
  reason?: string | null
): Promise<Clip> {
  // GATE FIRST (AC3): an anonymous caller is rejected before the rate-limit or role check.
  const { contributorId } = await requireContributor();
  // LIMIT SECOND (D5a, gate→limit→role→write): reject + write nothing if over cap (a pure read).
  const db = getDb();
  await checkWriteRateLimit(db, contributorId);
  // ROLE CHECK THIRD — MODERATOR-ONLY (Decision 2 / AC2, the load-bearing security test): NO
  // own-curator arm. Load the clip to confirm it exists, then allow ONLY if the actor is a
  // moderator. A non-moderator (incl. the clip's own curator) is rejected here and writes nothing.
  // Resolved server-side via `isModeratorContributor` (DB OR env), never a client "isModerator".
  const s = store();
  const owner = await s.clipOwnership(clipId);
  if (!owner) throw new Error(`Clip ${clipId} not found`);
  const isModerator = await isModeratorContributor(db, contributorId);
  if (!isModerator) {
    throw new Error("Not authorized to remove this clip.");
  }
  // NEVER gate on or read `accuracy_flag` (Decision 2 / C9) — the role is the only gate. The reason
  // is captured as-supplied (a closed-set + free-text string composed client-side); cap its length
  // as the cheap server-side stopgap on free text (it is never reader-facing, but still input).
  const auditReason =
    typeof reason === "string" && reason.length > 0
      ? capText(reason, "removedReason")
      : null;
  const result = await s.removeClip(clipId, contributorId, auditReason);
  await recordWriteEvent(db, contributorId, "remove");
  return result;
}

// ── Public contributor profile reads (issue #54 / D3 — AC1–AC4) ──────────────────────────
// Both are READS and are deliberately ANONYMOUS — NO `requireContributor()` gate, exactly like
// `listClips`/`getTopic` above. A public profile is browsable logged-out (AC1); gating it would
// be wrong. They run only on the `/contributor/<username>` route, so the cached Topic read path
// gains no per-user work (AC9). The DrizzleDataStore enforces the AC2 privacy boundary (the
// projection selects only `contributor` columns — email is never read), the Decision-1 handle
// tie-break, and the Decision-4 `@prototype` not-found — see drizzle-store.ts.

/** Resolve a Wikimedia username → the public-safe identity (id/username/avatar), or null. */
export async function getContributorByUsernameAction(
  username: string
): Promise<PublicContributor | null> {
  return store().getContributorByUsername(username);
}

/** A contributor's curated clips (by resolved id), joined to topic context, newest-first. */
export async function listClipsByContributorAction(
  contributorId: number
): Promise<ContributorClip[]> {
  return store().listClipsByContributor(contributorId);
}

// ── Recent-curations feed (issue #160 / `/recent`) ───────────────────────────────────────
// One cross-topic, cursor-paginated, newest-first READ — ANONYMOUS, no `requireContributor` gate
// (like `listClips`/`listClipsByContributor`): the feed is browsable logged-out (§6). It returns
// VOUCHED, non-removed clips only (held excluded — §3.4), as `ContributorClip`s joined to their
// parent topic for the jump-to-topic link. The `/recent` route is a DYNAMIC (uncached) render
// (`export const dynamic = "force-dynamic"`): a global chronological list changes on every
// curation, so it does NOT sit on the (future) static/ISR shell — see ARCHITECTURE "/recent".
export async function listRecentCurationsAction(input?: {
  cursor?: string | null;
  limit?: number;
}): Promise<RecentCurationsPage> {
  return store().listRecentCurations(input);
}

// ── Upvotes (issue #55 / D4 — a persisted, one-per-user, toggleable signal) ──────────────
// One auth-gated WRITE (`toggleUpvoteAction`) + one auth-gated, viewer-scoped READ
// (`votedClipIdsAction`). The toggle is the gated CONTRIBUTION (CURATION §7) — `requireContributor`
// FIRST, before any DB touch, so an anonymous/expired direct call writes NOTHING (AC4/AC5), exactly
// like the add/dismiss writes. The voted-state read is gated too (it is per-viewer; a logged-out
// caller gets an empty set, never a per-user query) and runs ONLY in the already-authenticated
// client session — it is NEVER reached on the cached topic read path (`listClips` issues no
// per-user vote query — AC6/AC7). The displayed COUNT is public and rides `listClips` (derived
// there: seed baseline + distinct vote rows — Decision 2); only the per-viewer voted-state is here.

/**
 * Toggle the signed-in contributor's upvote on a clip (Decision 4). GATE FIRST (AC4/AC5): an
 * unauthenticated or expired call is rejected by `requireContributor()` before any `clip_vote`
 * write — no row inserted or deleted. Then insert-if-absent / delete-if-present (the store uses an
 * `onConflictDoNothing` upsert so a race lands voted, not doubled — AC3) and return the new
 * `{ voted, count }` (count = the DERIVED total — Decision 2). NO self-vote special case (Decision
 * 3): a contributor may upvote a clip they curated, exactly like any other (AC9).
 */
export async function toggleUpvoteAction(
  clipId: string
): Promise<UpvoteToggle> {
  const { contributorId } = await requireContributor();
  // LIMIT SECOND (issue #57 / D5a): upvote-toggle is the other load-bearing spam vector
  // (high-frequency by nature — Decision 2). Reject + write NO clip_vote row if over cap (AC2). A
  // toggle (insert OR delete) is one counted write; the event is recorded after the toggle lands.
  const db = getDb();
  await checkWriteRateLimit(db, contributorId);
  const result = await store().toggleUpvote(clipId, contributorId);
  await recordWriteEvent(db, contributorId, "upvote");
  return result;
}

/**
 * The subset of `clipIds` the signed-in viewer has upvoted (Decision 6 — the per-viewer
 * voted-state read, OFF the cached read path). Gated: `requireContributor()` resolves the viewer,
 * so this only ever runs in the already-authenticated client session — an anonymous topic load
 * never calls it (AC7). Scoped to the viewer + the visible clip ids. The COUNT is NOT here (it is
 * public and rides `listClips`); this returns only WHICH of these clips THIS viewer has voted on.
 */
export async function votedClipIdsAction(
  clipIds: string[]
): Promise<string[]> {
  const { contributorId } = await requireContributor();
  return store().votedClipIds(clipIds, contributorId);
}

// ── Per-user skin preference (issue #143 — the durable backstop behind the cookie) ───────
// A logged-in toggle persists the chosen skin to the contributor row so it follows the user
// cross-device (the login mirrors it back into the `wikiplus-skin` cookie — spec §6.1). This is a
// PRESENTATIONAL write, fire-and-forget from the control's perspective: the cookie + the live
// `data-skin` flip happen on the client FIRST and never wait on this (design §4.6). It is NEVER on
// the read/render path — the server never reads `skin_preference` to render `data-skin`, so the
// cache-agnostic guarantee (AC9/AC10) holds. GATE FIRST (`requireContributor`): an anonymous direct
// call writes nothing (a logged-out reader has the cookie only — no DB row to write). It is NOT rate-
// limited (a low-frequency preference flip, not a spam vector like add/upvote) and writes no
// `write_event` ledger row.

/** The closed skin set the preference column may store (spec A3.2 / §6.1). */
const SKINS = new Set<string>(["zine", "zine-dark"]);

/**
 * Persist the signed-in contributor's chosen skin (`'zine'` | `'zine-dark'`, or `null` to clear).
 * GATE FIRST (an anonymous call is rejected before any DB touch). A value outside the closed skin
 * set is rejected (the column never stores an out-of-vocabulary skin). Returns nothing — the client
 * fired this alongside the instant cookie/`data-skin` switch and does not await the result for the
 * visual change.
 */
export async function setSkinPreferenceAction(
  skin: string | null
): Promise<void> {
  const { contributorId } = await requireContributor();
  if (skin !== null && !SKINS.has(skin)) {
    throw new Error(`Unknown skin: ${skin}`);
  }
  await store().setSkinPreference(skin, contributorId);
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
  // LIMIT SECOND (issue #57 / D5a): a dismiss is a counted gated write (Decision 2 — a dismiss is a
  // write and a dismiss-flood is undesirable; not a high-value vector). Reject if over cap (AC2);
  // pure-read check, the event recorded after the dismissal lands.
  const db = getDb();
  await checkWriteRateLimit(db, contributorId);
  await store().recordDismissal(input, contributorId);
  await recordWriteEvent(db, contributorId, "dismiss");
}

export async function dismissedKeysAction(topicQid: string): Promise<string[]> {
  return store().dismissedKeys(topicQid);
}
