// Core objects, per docs/VISION.md. The vocabularies below are PROVISIONAL —
// the Curation / Editorial role owns the final sets (docs/CURATION_STANDARD.md).

export type Platform = "youtube" | "tiktok" | "instagram" | "other";

export type Stance =
  | "explainer"
  | "opinion"
  | "myth-busting"
  | "personal-experiment"
  | "primary-source";

export type AccuracyFlag =
  | "accurate"
  | "mostly-accurate"
  | "mixed"
  | "misleading"
  | "inaccurate";

export interface Creator {
  handle: string;
  displayName: string;
  platform: Platform;
  followerCount?: number;
}

export interface Topic {
  /** Wikidata QID — the canonical, stable key. */
  qid: string;
  /** Wikipedia article title. */
  title: string;
  description?: string;
}

export interface Clip {
  id: string;
  topicQid: string;
  videoUrl: string;
  platform: Platform;
  videoId: string;
  title?: string;
  creator: Creator;
  /** wiki+'s original contribution: what's fact vs. the creator's opinion. */
  contextNote: string;
  stance: Stance;
  accuracyFlag: AccuracyFlag;
  timestampSeconds?: number;
  /** e.g. "Light-dependent_reactions" */
  sectionAnchor?: string;
  createdAt: string;
}
