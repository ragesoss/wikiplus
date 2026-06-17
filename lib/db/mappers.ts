import type { Candidate, Clip, Topic } from "@/lib/data/types";
import type { ClipRow, TopicRow } from "./schema";

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
    curatedAt: row.curatedAt ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/** An app `Clip` (without id/createdAt) + its topic's numeric id → an insert row. */
export function clipToInsert(
  input: Omit<Clip, "id" | "createdAt">,
  topicId: number,
  curatorId: number | null
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
 */
export function clipPatchToUpdate(
  patch: Partial<Omit<Clip, "id">>
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
  out.updatedAt = new Date();
  return out;
}

/** A `Candidate`-shaped video → its `(provider, providerVideoId)` for dismissal rows. */
export type DismissalIdentity = { provider: string; providerVideoId: string };
