import type { Candidate, Clip, PublicContributor, Topic } from "@/lib/data/types";
import type { ClipRow, ContributorRow, TopicRow } from "./schema";

// Row ⇄ domain mappers (issue #45). The DB rows are normalized/snake_case with a numeric
// PK + topic_id FK; the app's domain types (lib/data/types.ts) are the flat shapes the
// components already consume (topicQid, nested creator{}, etc.). These keep the boundary's
// outputs byte-for-byte the shapes the localStorage store returned, so the call sites and
// every downstream component need no shape change (parity — AC12).

/** A clip row + its parent topic's QID → the app `Clip` shape. */
export function rowToClip(row: ClipRow, topicQid: string): Clip {
  return {
    id: String(row.id),
    topicQid,
    platform: row.platform as Clip["platform"],
    platformLabel: row.platformLabel,
    orientation: row.orientation as Clip["orientation"],
    watchUrl: row.watchUrl,
    embedUrl: row.embedUrl ?? undefined,
    thumbnailUrl: row.thumbnailUrl ?? undefined,
    thumbGrad: row.thumbGrad ?? undefined,
    caption: row.caption,
    creator: {
      handle: row.creatorHandle,
      name: row.creatorName,
      platform: row.creatorPlatform as Clip["creator"]["platform"],
      url: row.creatorUrl ?? undefined,
      avatarGrad: row.creatorAvatarGrad ?? undefined,
      followerCount: row.creatorFollowerCount ?? undefined,
    },
    general: row.general,
    sectionSlug: row.sectionSlug ?? undefined,
    sectionLabel: row.sectionLabel ?? undefined,
    contextNote: row.contextNote,
    stance: row.stance as Clip["stance"],
    stanceModifier: row.stanceModifier ?? undefined,
    accuracyFlag: row.accuracyFlag as Clip["accuracyFlag"],
    accuracyModifier: row.accuracyModifier ?? undefined,
    upvotes: row.upvotes ?? undefined,
    curatedBy: row.curatedBy ?? undefined,
    // The stable owner key, surfaced read-only for the owner-only Edit/Delete affordance
    // (issue #53 / D2, Decision 6 mechanism (a)). Null for legacy `@prototype` clips owned
    // by no current user → undefined → no affordance to anyone (AC8). NOT the security gate.
    curatorId: row.curatorId ?? undefined,
    curatedAt: row.curatedAt ?? undefined,
    // D5b (issue #58): the held marking flag, DERIVED from the clip's review-state column —
    // `held === (vetted === false)`. Rides `listClips` (Decision 4 / AC7) so every viewer sees
    // the same marking with no per-user work; only surfaced when held (omitted on a published
    // clip so a fully-curated clip is byte-for-byte its pre-D5b self — AC6/AC2).
    held: row.vetted ? undefined : true,
    // Note-license agreement (issue #52 / D1, AC7). Surfaced read-side so QA can confirm a
    // D1 clip carries the captured license version + timestamp and a seed/stub clip does not.
    noteLicense: row.noteLicense ?? undefined,
    noteLicenseAgreedAt: row.noteLicenseAgreedAt
      ? row.noteLicenseAgreedAt.toISOString()
      : undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * An app `Clip` (without id/createdAt) + its topic's numeric id → an insert row.
 *
 * The note-license agreement (issue #52 / D1, AC7) is passed SEPARATELY as a server-stamped
 * `agreement`, never read off `input`: the license version + agreement timestamp are the
 * boundary's call (the client only signals consent), so a forged `noteLicense` on the wire
 * can never reach the row. Omitting `agreement` writes no license (seed/stub/non-agreed path).
 */
export function clipToInsert(
  input: Omit<Clip, "id" | "createdAt">,
  topicId: number,
  curatorId: number | null,
  agreement?: { noteLicense: string; noteLicenseAgreedAt: Date }
) {
  return {
    topicId,
    platform: input.platform,
    platformLabel: input.platformLabel,
    orientation: input.orientation,
    watchUrl: input.watchUrl,
    embedUrl: input.embedUrl ?? null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    thumbGrad: input.thumbGrad ?? null,
    caption: input.caption,
    creatorHandle: input.creator.handle,
    creatorName: input.creator.name,
    creatorPlatform: input.creator.platform,
    creatorUrl: input.creator.url ?? null,
    creatorAvatarGrad: input.creator.avatarGrad ?? null,
    creatorFollowerCount: input.creator.followerCount ?? null,
    general: input.general,
    sectionSlug: input.sectionSlug ?? null,
    sectionLabel: input.sectionLabel ?? null,
    contextNote: input.contextNote,
    stance: input.stance,
    stanceModifier: input.stanceModifier ?? null,
    accuracyFlag: input.accuracyFlag,
    accuracyModifier: input.accuracyModifier ?? null,
    upvotes: input.upvotes ?? null,
    curatedBy: input.curatedBy ?? null,
    curatedAt: input.curatedAt ?? null,
    curatorId,
    // Server-stamped agreement only (never from `input`): present ⇒ a D1-published clip
    // with the captured license version + timestamp; absent ⇒ no license recorded.
    noteLicense: agreement?.noteLicense ?? null,
    noteLicenseAgreedAt: agreement?.noteLicenseAgreedAt ?? null,
  };
}

/** A topic row → the app `Topic` shape (qid is the canonical key the app uses). */
export function rowToTopic(row: TopicRow): Topic {
  return {
    qid: row.wikidataQid,
    title: row.title,
    description: row.description ?? undefined,
  };
}

/**
 * The fields of a `Clip` that are mutable via `updateClip` → a partial update row.
 * Only the columns the patch names are written. `id`/`topicQid`/`createdAt` are never
 * patchable through this path (the interface already excludes `id`).
 *
 * The note-license re-stamp (issue #53 / D2, AC9) is passed SEPARATELY as a server-built
 * `agreement`, never read off `patch`: a forged `noteLicense*` on the patch can never reach
 * the row (mirrors `clipToInsert`). Omitting `agreement` leaves both columns untouched
 * (a chip/section-only or whitespace-only edit — AC10).
 */
export function clipPatchToUpdate(
  patch: Partial<Omit<Clip, "id">>,
  agreement?: { noteLicense: string; noteLicenseAgreedAt: Date }
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) out[k] = v;
  };
  set("platform", patch.platform);
  set("platformLabel", patch.platformLabel);
  set("orientation", patch.orientation);
  set("watchUrl", patch.watchUrl);
  set("embedUrl", patch.embedUrl);
  set("thumbnailUrl", patch.thumbnailUrl);
  set("thumbGrad", patch.thumbGrad);
  set("caption", patch.caption);
  if (patch.creator) {
    set("creatorHandle", patch.creator.handle);
    set("creatorName", patch.creator.name);
    set("creatorPlatform", patch.creator.platform);
    set("creatorUrl", patch.creator.url ?? null);
    set("creatorAvatarGrad", patch.creator.avatarGrad ?? null);
    set("creatorFollowerCount", patch.creator.followerCount ?? null);
  }
  set("general", patch.general);
  set("sectionSlug", patch.sectionSlug);
  set("sectionLabel", patch.sectionLabel);
  set("contextNote", patch.contextNote);
  set("stance", patch.stance);
  set("stanceModifier", patch.stanceModifier);
  set("accuracyFlag", patch.accuracyFlag);
  set("accuracyModifier", patch.accuracyModifier);
  set("upvotes", patch.upvotes);
  set("curatedBy", patch.curatedBy);
  set("curatedAt", patch.curatedAt);
  // §5.3 re-affirmation re-stamp (server-built only): present ⇒ a fresh license version +
  // agreement timestamp; absent ⇒ both columns left as they were (AC9/AC10).
  if (agreement) {
    out.noteLicense = agreement.noteLicense;
    out.noteLicenseAgreedAt = agreement.noteLicenseAgreedAt;
  }
  out.updatedAt = new Date();
  return out;
}

/**
 * A `contributor` row → the PUBLIC-SAFE projection (issue #54 / D3, AC2 — the privacy boundary).
 *
 * Takes a `ContributorRow` (the `contributor` table only) and exposes id + handle (as `username`)
 * + the granted avatar. The `account.email` column is on a DIFFERENT table and is NEVER joined or
 * read on this path — so email (or any other non-public `account` field) can never reach the
 * profile page markup, the read's return shape, or the client bundle. The caller
 * (`getContributorByUsername`) must pass a `contributor` row it selected without touching
 * `account`; this mapper additionally guarantees the shape carries nothing beyond the three
 * public fields.
 */
export function rowToPublicContributor(
  // Only the PUBLIC fields are needed — the caller selects exactly these (never `account.email`,
  // and the D5b `is_moderator` role is intentionally NOT exposed on a public profile either). The
  // narrow `Pick` keeps that boundary honest as `contributor` grows new (private) columns.
  row: Pick<ContributorRow, "id" | "handle" | "avatarUrl">
): PublicContributor {
  return {
    id: row.id,
    username: row.handle,
    avatarUrl: row.avatarUrl ?? undefined,
  };
}

/** A `Candidate`-shaped video → its `(provider, providerVideoId)` for dismissal rows. */
export type DismissalIdentity = { provider: string; providerVideoId: string };
