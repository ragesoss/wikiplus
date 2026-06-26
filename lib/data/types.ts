// Core objects for the Topic page. The stance/accuracy vocabularies are the
// CLOSED controlled enums set by Curation / Editorial (docs/CURATION_STANDARD.md
// §2/§3, Decisions C2/C4); they supersede the earlier provisional placeholders.
// The enum→label/fill maps live in lib/curation/labels.ts — chip text is always
// derived from there, never free-texted (CURATION §4).

export type Platform = "youtube" | "tiktok" | "instagram" | "other";

export type Orientation = "vertical" | "horizontal";

/** Stance — what kind of clip this is / how to read it. CURATION §2 (closed). */
export type Stance =
  | "explainer"
  | "short"
  | "demonstration"
  | "classroom"
  | "opinion"
  | "myth_busting"
  | "personal_experiment";

/** Accuracy — how well the clip matches established material. CURATION §3 (closed). */
export type AccuracyFlag =
  | "accurate"
  | "accurate_with_caveat"
  | "primary_source"
  | "opinion"
  | "mixed"
  | "misleading"
  | "inaccurate";

/** The external person whose clip we reference and credit (never host). */
export interface Creator {
  handle: string;
  /** Display name shown on the card. */
  name: string;
  platform: Platform;
  /** Profile / channel URL the credit links out to. */
  url?: string;
  /** Tailwind gradient token for the avatar fallback (e.g. "from-green-400 to-emerald-600"). */
  avatarGrad?: string;
  followerCount?: number;
}

/** A single article section heading derived from the fetched article HTML. */
export interface ArticleSection {
  /** Stable slug, used for `#sec-<slug>` / `#h-<slug>` anchors and clip matching. */
  slug: string;
  /** Heading text as shown. */
  title: string;
  /** Heading level (2 = h2, 3 = h3, 4 = h4). Drives TOC indentation. */
  level: number;
}

/** Topic-level counts shown in the infobox + synced footer (derived from clips). */
export interface TopicStats {
  videos: number;
  creators: number;
  curators: number;
  /** Relative "synced N ago" label (decorative). */
  synced?: string;
}

export interface Topic {
  /** Wikidata QID — the canonical, stable key. */
  qid: string;
  /** Wikipedia article title. */
  title: string;
  description?: string;
  /**
   * "Marked complete" / closed to suggestions (issue #159). When `true`, the Topic page suppresses
   * all auto-suggestion chrome BY DEFAULT (for every viewer) and renders only curated content — a
   * curator's explicit "I've finished this topic" judgment. Persisted on the `topic` row
   * (`closed_to_suggestions`, `NOT NULL DEFAULT false`). DISTINCT from the auto-derived
   * `fully-curated` state (which `TopicView` computes from the counts and never stores): this flag
   * is explicit, holds even when suggestions exist, and is allowed at zero curated videos. It does
   * NOT touch the candidate pipeline — suppression is a PRESENTATION derivation in `TopicView`
   * (`suppressSuggestions = closedToSuggestions && !viewerOverride`), and a session-local per-viewer
   * override re-enables the normal presentation for one viewer. Set/cleared by any signed-in curator.
   *
   * OPTIONAL on the type so a topic CREATED/UPSERTED by a caller need not specify it (it defaults to
   * `false` via the DB column default — a curator marks complete later via the dedicated action).
   * The store READS always populate it concretely (the column is `NOT NULL`), so a topic loaded from
   * the store always carries a definite boolean; treat an absent value as `false`.
   */
  closedToSuggestions?: boolean;
  /**
   * Hero clip — the one prominent "must-watch" video per topic (issue #158). The stringified id of
   * the topic's hero `Clip` (matching `Clip.id`), or `undefined` when no hero is set. Persisted as a
   * nullable `topic.hero_clip_id` FK → `clip.id` (`ON DELETE SET NULL`): a topic-level REFERENCE, not
   * a clip-level boolean, so the at-most-one-per-topic invariant is STRUCTURAL (one column → one
   * value) and setting a new hero is one atomic UPDATE that replaces the prior. ELIGIBILITY is
   * curated + GENERAL clips only, enforced server-side (`setTopicHero`); a candidate is structurally
   * ineligible (not a clip row). The hero RIDES THIS TOPIC READ, so the strip marks a clip as the
   * hero by comparing `clip.id === heroClipId` — the prominence is identical for every viewer and the
   * cached read path does no per-user work (logged-out parity). Set/cleared by any signed-in curator.
   *
   * OPTIONAL on the type so a topic CREATED/UPSERTED by a caller need not specify it (it defaults to
   * NULL via the column). A deleted/removed hero clip clears the reference (`ON DELETE SET NULL`), and
   * the host treats a `heroClipId` that resolves to no visible general clip as "no hero" (no dangling
   * hero block).
   */
  heroClipId?: string;
}

/**
 * A topic carried alongside its at-a-glance curation counts — the shape the homepage
 * "Recently curated" card consumes (issue #126). The `stats` here are the SAME
 * videos/creators/curators the Topic overview card derives via `deriveStats` over the
 * topic's non-removed clip set (CARD PARITY: a card count equals the overview count for
 * the same topic). It is delivered by `listCuratedTopics()` via ONE grouped aggregate for
 * the whole list (no N-per-topic reads), and that same aggregate filters the list to
 * `videos ≥ 1` — a zero-curation topic never appears (design topic-card-redesign.md §4.1).
 * `synced` is omitted: the card shows no freshness this build.
 */
export interface TopicWithStats extends Topic {
  stats: Pick<TopicStats, "videos" | "creators" | "curators">;
}

/**
 * A contributor's PUBLIC-SAFE identity (issue #54 / D3, AC2). The ONLY fields a public profile
 * surface (`/contributor/<username>`) and the `getContributorByUsername` read may expose:
 * the stable internal id (used only to scope the clip list + the owner compare), the public
 * Wikimedia handle/username, and the granted avatar URL (may be absent — C is identify-scope).
 *
 * BINDING (AC2 / CURATION §5.4): the contributor's `email` and any other non-public `account`
 * field are NEVER selected, serialized, or carried here — this projection is the privacy
 * boundary. The mapper that builds it (`lib/db/mappers.ts` `rowToPublicContributor`) selects
 * only `contributor` columns; the `account.email` column is never read on this path.
 */
export interface PublicContributor {
  /** Stable internal `contributor.id` — scopes the clip list + the owner-affordance compare. */
  id: number;
  /** The Wikimedia username (the `contributor.handle`) — the public identity + the URL key. */
  username: string;
  /** Granted avatar URL, if the contributor granted one (C is identify-scope, so may be absent). */
  avatarUrl?: string;
}

/**
 * Media + creator fields shared by curated clips and unvetted candidates.
 * (A candidate is "the same video, before a human has vouched for it".)
 */
interface VideoBase {
  id: string;
  topicQid: string;
  platform: Platform;
  /** Platform named in words on the card (CURATION §5.2): "YouTube", "TikTok". */
  platformLabel: string;
  orientation: Orientation;
  /** Canonical watch URL (link-out target / TikTok playback). */
  watchUrl: string;
  /** Embed URL for the in-modal player (YouTube). */
  embedUrl?: string;
  thumbnailUrl?: string;
  /** Tailwind gradient token used if the thumbnail image fails to load. */
  thumbGrad?: string;
  caption: string;
  creator: Creator;
  /** True = whole-topic ("general") clip; otherwise anchored to a section. */
  general: boolean;
  /** Section slug this clip is anchored to (omitted/ignored when general). */
  sectionSlug?: string;
  /** Section heading text (display), kept alongside the slug per ARCHITECTURE. */
  sectionLabel?: string;
}

/** A curated, contextualized clip (CURATION §1–§3). Carries chips + a context note. */
export interface Clip extends VideoBase {
  /** wiki+'s original contribution: separates fact from the creator's opinion. */
  contextNote: string;
  stance: Stance;
  /** Optional display-only modifier rendered as "Label · modifier" (CURATION C6, ≤24 chars). */
  stanceModifier?: string;
  accuracyFlag: AccuracyFlag;
  accuracyModifier?: string;
  upvotes?: number;
  /** wiki+ curator handle who curated it (distinct from the creator). */
  curatedBy?: string;
  /**
   * The curating contributor's stable internal id (`contributor.id`). Surfaced READ-ONLY on
   * the client `Clip` (issue #53 / D2, Decision 6 mechanism (a)) so the Topic page can decide
   * which clips to show the owner-only Edit/Delete affordances on — by comparing this to
   * `session.user.contributorId`, matching the server gate exactly (no username-collision
   * corner case). It is NOT a secret (an internal row id, not the Wikimedia identity) and is
   * NOT a security control: the authoritative check is the server-side, id-based gate inside
   * `updateClipAction` / `deleteClipAction` (the affordance only mirrors it). Undefined for
   * legacy `@prototype` clips owned by no current user — so they show no affordance to anyone.
   */
  curatorId?: number;
  /** Relative date label (decorative). */
  curatedAt?: string;
  /**
   * D5b (issue #58 / CURATION §7.1): is this clip HELD for review — the third clip-state? `true`
   * ⇒ the clip's vouch is not yet reviewer-confirmed (`clip.vetted === false` server-side), so it
   * renders the calm "In review · not yet vouched" marking (ClipCard / GeneralStrip) while KEEPING
   * its note, chips, and curator attribution. `false`/undefined ⇒ published / fully curated (the
   * site's full vouch). It is a property of the CLIP (the same for every viewer), so it rides
   * `listClips` and the cached read path does NO per-user work to render it (Decision 4 / AC7).
   * This is the clip review-state — DISTINCT from the `Candidate.vetted: false` discriminant below
   * (a candidate is an auto-suggested non-clip with no note/chips/curator), never conflated with it.
   */
  held?: boolean;
  /**
   * The note-license version the contributor agreed to release this note under, captured
   * at publish (CURATION §5.3 / Decision D1-1). `"CC-BY-SA-4.0"` for a D1-published clip;
   * undefined for seed/stub clips that predate the captured agreement (AC7). A version
   * string, not a boolean, so a future license bump is expressible. Stamped by the
   * Server-Actions boundary on agreement — never trusted from the client.
   */
  noteLicense?: string;
  /** ISO timestamp of the per-submit agreement (paired with `noteLicense`; D1-1/AC7). */
  noteLicenseAgreedAt?: string;
  createdAt: string;
}

/**
 * The result of `toggleUpvoteAction` / the seam's `toggleUpvote` (issue #55 / D4, Decision 4).
 * The server returns the NEW per-viewer state so the client reconciles to the authoritative
 * truth, not a client-side guess: `voted` = does THIS viewer now have a `clip_vote` row, and
 * `count` = the DERIVED public total `(clip.upvotes ?? 0) + COUNT(distinct clip_vote rows)`
 * (Decision 2 — never a mutated counter, so it cannot drift).
 */
export interface UpvoteToggle {
  voted: boolean;
  count: number;
}

/**
 * A clip as listed on a contributor's PUBLIC PROFILE (issue #54 / D3, AC1). It is an ordinary
 * `Clip` carried OUT of its Topic-page setting, so it additionally names its parent topic for
 * the profile row's "On <Topic>" link (design §5.1): the topic title (display) drives the link
 * text + the canonical `/topic/<Title>/` href; `topicQid` is already on `Clip`. The clip's
 * `curatedBy` is the profile owner's handle (the per-row "context by" attribution is suppressed
 * on the profile — design §5.4 — but the field still rides along on the clip).
 */
export interface ContributorClip extends Clip {
  /** Parent Wikipedia article title (display) — the profile row's "On <Topic>" link text/href. */
  topicTitle: string;
}

/** Default page size for the recent-curations feed (`listRecentCurations` — issue #160 / §3.4). */
export const RECENT_PAGE_DEFAULT = 12;

/**
 * One page of the cross-topic recent-curations feed (`/recent`, issue #160 / design §3.4). The
 * items are the existing `ContributorClip` shape — a curated `Clip` carried out of its topic, plus
 * the parent `topicTitle` for the jump-to-topic link (the feed needs NO new per-item field; §2). The
 * feed is the global, cursor-paginated analog of `listClipsByContributor`, newest-first.
 *
 * `nextCursor` is an OPAQUE, STABLE keyset cursor over `(createdAt, id)` (never an offset — an
 * offset drifts as new curations arrive between page loads; a keyset cursor is stable, so paging
 * back through history has no dupes and no gaps). `null` ⇒ the feed is exhausted (the end-of-feed
 * marker). The cursor's encoding is a Development detail (`lib/data/recent-cursor.ts`); a caller
 * only round-trips the string back into the next `listRecentCurations({ cursor })` call.
 */
export interface RecentCurationsPage {
  items: ContributorClip[];
  nextCursor: string | null;
}

/**
 * An auto-suggested, unvetted candidate (empty state). By CURATION §6 it carries
 * NO stance, NO accuracy, NO context note — only a match reason. Promotion turns
 * it into a Clip.
 */
export interface Candidate extends VideoBase {
  vetted: false;
  /** Where it came from, e.g. "YouTube". */
  source: string;
  /** Why it matched, shown in place of a context note (CURATION §6). */
  matchReason: string;
}
