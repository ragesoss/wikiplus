import type {
  AccuracyFlag,
  Clip,
  Creator,
  Orientation,
  Platform,
  Stance,
} from "@/lib/data/types";

// Assemble the `Clip` to persist from the curate form values + a media source (issue #52 / D1,
// AC1/AC4). Shared by Promote (source = a Candidate) and Add-by-link (source = the parsed link
// + minimal creator). The form carries ONLY the curation fields (note/stance/accuracy/section);
// the media/creator fields come from the source. Attribution (`curatorId`/`curatedBy`) and the
// note-license stamp are NOT set here — the auth-gated boundary owns both (Product spec C AC6 /
// D1 §3.5). The note-license `agreed` consent is passed separately to the action.

/** The media/creator fields a clip carries, independent of the curation values. */
export interface ClipMediaSource {
  topicQid: string;
  platform: Platform;
  platformLabel: string;
  orientation: Orientation;
  watchUrl: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  thumbGrad?: string;
  caption: string;
  creator: Creator;
}

/**
 * Read the curate-form values + resolve the section, then merge with the media source into the
 * clip shape the boundary persists. `general` is true when the section select is "__general";
 * otherwise the slug + its display label (looked up from `sections`) anchor the clip.
 */
export function clipFromForm(
  form: HTMLFormElement,
  source: ClipMediaSource,
  sections: { slug: string; title: string }[] = []
): Omit<Clip, "id" | "createdAt"> {
  const data = new FormData(form);
  const note = String(data.get("note") ?? "").trim();
  const stance = String(data.get("stance") ?? "explainer") as Stance;
  const accuracyFlag = String(data.get("accuracy") ?? "accurate") as AccuracyFlag;
  const sectionValue = String(data.get("section") ?? "__general");
  const general = sectionValue === "__general";
  const sectionLabel = general
    ? undefined
    : sections.find((s) => s.slug === sectionValue)?.title;

  return {
    topicQid: source.topicQid,
    platform: source.platform,
    platformLabel: source.platformLabel,
    orientation: source.orientation,
    watchUrl: source.watchUrl,
    embedUrl: source.embedUrl,
    thumbnailUrl: source.thumbnailUrl,
    thumbGrad: source.thumbGrad,
    caption: source.caption,
    creator: source.creator,
    general,
    sectionSlug: general ? undefined : sectionValue,
    sectionLabel,
    contextNote: note,
    stance,
    accuracyFlag,
  };
}
