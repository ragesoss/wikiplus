"use client";

import { useState } from "react";
import { GENERAL_SUGGESTION_DEFAULT } from "@/lib/candidates";
import { isStubCurator } from "@/lib/curation/curator-attribution";
import type { Candidate, Clip } from "@/lib/data/types";
import { CandidateActions, SeeMoreButton } from "./CandidateBits";
import { AccuracyChip, StanceChip } from "./Chips";
import { ContextByLink } from "./ContextByLink";
import { CuratorBadge } from "./CuratorBadge";
import { HeldPill } from "./HeldMarking";
import { ReviewRow } from "./ReviewRow";
import { UpvoteControl } from "./UpvoteControl";
import { VideoThumb } from "./VideoThumb";

// Full-bleed indigo band after the lead — the one crossover (design §5.5 / §6.3;
// issue #60 §2.1 / §5.3 — coexistence).
//
// Issue #60 retires the binary `mode`. The band derives three states from two facts —
// `generalClips` (curated, the priority content) and `generalCandidates` (remaining
// suggestions) — and renders BOTH groups when both exist, curated ALWAYS first:
//
//   - empty          (0 curated)             → `＋ Suggested videos` + `uncurated` pill;
//                                               the Find-more cluster; the suggestion tiles
//                                               capped at GENERAL_SUGGESTION_DEFAULT with the
//                                               "See N more" control. No curated group, no divider.
//   - mixed          (≥1 curated, ≥1 sugg.)  → `＋ General` + the curated `N video` count; the
//                                               Find-more cluster; the curated tiles (full, uncapped)
//                                               FIRST; then the "Suggested · uncurated" divider
//                                               (§5.3); then the capped suggestion group + "See N more".
//   - fully-curated  (≥1 curated, 0 sugg.)   → `＋ General` + count; the curated tiles only; only the
//                                               quiet "＋ Add video" control (no Search-platform links,
//                                               no divider, no suggestion group, no "See more").
//
// The cap applies ONLY to the suggestion group (a pure slice over the already-ordered
// `generalCandidates` — never a re-fetch/re-order). Curated tiles are never capped (AC6).
// `expanded` is local UI state independent of the candidate list, so curating/dismissing
// a suggestion does not collapse an expanded pool (AC10).
const SUGGESTION_GROUP_ID = "general-suggestion-group";

export function GeneralStrip({
  topicTitle,
  generalClips,
  generalCandidates,
  loading = false,
  prefersReduced = false,
  onPlay,
  onPlayCandidate,
  onPromote,
  onDismiss,
  onAdd,
  ownsClip,
  onEdit,
  onDelete,
  signedIn = false,
  votedClip,
  onUpvote,
  canHold,
  canApprove,
  canRemove,
  reviewInFlight,
  onHold,
  onApprove,
  onRemove,
  heroClipId,
  onSetHero,
  onClearHero,
  settingHero = false,
  suppressed = false,
  bandRef,
}: {
  topicTitle: string;
  generalClips: Clip[];
  generalCandidates: Candidate[];
  /** The live candidate search is in flight (design §5.4). */
  loading?: boolean;
  /** Reduced-motion: skeletons render static (no shimmer) + the curated fade is off (§6 / §8). */
  prefersReduced?: boolean;
  /** Curated tiles → blocking PlayerModal (unchanged). */
  onPlay: (clip: Clip) => void;
  /** Candidate tiles → non-modal PinnedPlayer (issue #10, AC1). Optional so the
      component still renders without a play wiring (then candidate thumbs link out). */
  onPlayCandidate?: (c: Candidate) => void;
  onPromote: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
  onAdd: () => void;
  /**
   * D3 (issue #54, design §9.2): the owner-affordance predicate — true iff the signed-in viewer
   * owns this General-band clip (`clip.curatorId === session contributor id`, the SAME
   * already-authenticated client-session compare the rail uses, never the security control).
   * Default `() => false` so logged-out / others' / `@prototype` tiles show no affordance and the
   * read-path render is byte-for-byte unchanged for an anonymous reader (AC9).
   */
  ownsClip?: (clip: Clip) => boolean;
  /** Open D2's Edit modal for an owned General clip (owner only — design §9.2). */
  onEdit?: (clip: Clip) => void;
  /** Open D2's Delete confirm dialog for an owned General clip (owner only — design §9.2). */
  onDelete?: (clip: Clip) => void;
  /** D4 (issue #55): is the viewer signed in (a real toggle vs. the login gate — §3/§5.3). */
  signedIn?: boolean;
  /**
   * D4 (issue #55, design §5/§8): has THIS viewer upvoted this General clip — the per-viewer
   * voted-state predicate, computed in the already-authenticated client session (off the cached
   * read path). Default `() => false` so an anonymous load does no per-user voted-state work (AC7).
   */
  votedClip?: (clip: Clip) => boolean;
  /** D4 (issue #55): activate the upvote control on a General clip (host's toggle / gate route). */
  onUpvote?: (clip: Clip) => void;
  /**
   * D5b (issue #58, design §4.1): the reviewer-affordance predicates, computed in the already-
   * authenticated client session (off the read path, like `ownsClip`/`votedClip`). `canHold` →
   * show "Hold for review" (moderator-any OR own-curator, published clip); `canApprove` → show
   * "Approve" (moderator only, held clip). Default `() => false` so an anonymous / non-moderator
   * tile shows no reviewer affordance and the read-path render is byte-for-byte unchanged (AC7).
   */
  canHold?: (clip: Clip) => boolean;
  canApprove?: (clip: Clip) => boolean;
  /**
   * D5c (issue #59, design §4.1/§4.2): the moderator Remove-affordance predicate — MODERATOR ONLY,
   * any clip (NO own-curator arm). Computed in the already-authenticated client session (off the
   * read path). Default `() => false` so an anonymous / non-moderator tile shows no Remove
   * affordance and the read-path render is byte-for-byte unchanged (AC7).
   */
  canRemove?: (clip: Clip) => boolean;
  /** D5b (issue #58, §5.2): is a hold/approve for this clip in flight → busy word + disable. */
  reviewInFlight?: (clip: Clip) => boolean;
  /** D5b (issue #58): activate Hold / Approve on a General clip (host's runHold / runApprove). */
  onHold?: (clip: Clip) => void;
  onApprove?: (clip: Clip) => void;
  /** D5c (issue #59): open the Remove confirm on a General clip (host's setRemoveFor). */
  onRemove?: (clip: Clip) => void;
  /**
   * Issue #158: the topic's hero clip id (`topic.heroClipId`), or undefined when no hero is set. The
   * matching general clip renders prominently at the FRONT of the strip (the hero block), removed
   * from the uniform scroll row. It rides the topic read, so the prominence is the same for every
   * viewer (logged-out parity). A `heroClipId` that matches no visible general clip ⇒ no hero block.
   */
  heroClipId?: string;
  /** Issue #158: mark a curated GENERAL clip as the hero (host's optimistic-with-rollback). Shown on
   *  peer tiles only when signed-in (the affordance gate; the Server Action is the security control). */
  onSetHero?: (clip: Clip) => void;
  /** Issue #158: clear the topic's hero (host's optimistic-with-rollback). The hero block's control. */
  onClearHero?: () => void;
  /** Issue #158: a hero mark/unmark write is in flight → the activated control shows a busy word and
   *  is disabled (the visual flip is optimistic, so the busy word is brief). */
  settingHero?: boolean;
  /**
   * The band is in its marked-complete **suppressed** presentation (`topic.closedToSuggestions` AND
   * this viewer hasn't overridden — the `suppressSuggestions` seam in TopicView). When true, the
   * curator find-more controls (Search links + ＋ Add video) do NOT render: a finished topic offers
   * no "add more". A per-viewer override (re-showing suggestions) clears it, so the controls return
   * for that viewer.
   */
  suppressed?: boolean;
  bandRef?: (el: HTMLElement | null) => void;
}) {
  // ── The three-state derivation (issue #60 §0). Two independent facts; no `mode`. ──
  const hasCurated = generalClips.length > 0;
  const hasSuggestions = generalCandidates.length > 0;

  // ── Hero split (issue #158). The hero is the general clip whose id matches `topic.heroClipId`,
  // pulled OUT of the uniform scroll row and rendered prominently at the FRONT of the band. A
  // `heroClipId` that resolves to no visible general clip (cleared / deleted / removed) ⇒ no hero
  // block (`heroClip` is undefined), and the band renders exactly as before. `peerClips` are the
  // remaining general clips (never re-ordered) for the uniform scroll row.
  const heroClip = heroClipId
    ? generalClips.find((c) => c.id === heroClipId)
    : undefined;
  const peerClips = heroClip
    ? generalClips.filter((c) => c.id !== heroClip.id)
    : generalClips;
  const hasPeers = peerClips.length > 0;
  // Runtime suggestion-region faces (design §5.4 / §5.2): loading skeleton, the honest
  // zero line, or the populated/capped group. The loading + zero faces apply ONLY to the
  // suggestion region and NEVER disturb the curated group (AC10 / §7.4/§7.5).
  const showLoading = loading;
  // ── Marked-complete suppressed-empty guard (design complete-toggle-rail.md §5). When the band is
  // `suppressed` (marked complete, this viewer hasn't overridden) and has no curated tiles, no shown
  // suggestions, and nothing loading, it must NOT show the empty-state "＋ Suggested videos" unvetted
  // bootstrap — a finished topic has no suggestions to bootstrap. The "show suggestions anyway" reveal
  // is NOT here: it lives in the plus rail (TopicView), which also OMITS this band entirely in this
  // case, so this is a defensive clean-empty face (the sr-only heading only).
  const suppressedEmptyBand =
    suppressed && !hasCurated && !hasSuggestions && !showLoading;
  // The honest zero line shows only when there are no suggestions AND nothing is loading AND there
  // are no curated clips either (empty state with no results). In a curated band a zero suggestion
  // count simply reads as fully-curated — no suggestion chrome. On a `suppressed` complete band the
  // rail's toggle card carries the state, so this misleading "no videos found" line is suppressed.
  const showZero = !loading && !hasSuggestions && !hasCurated && !suppressed;

  // Hero top-bleed (design general-hero-layout.md §2.2): the hero `<article>` breaks out of the
  // centered header container (`-mx-5`) and bleeds to the band's TOP edge (`-mt-4` cancels the header
  // container's `pt-4`). NOTHING renders above the hero in any state — the curated heading is
  // `sr-only` and the curator find-more controls ride the full-bleed scroll row BELOW. The header
  // container carries no bottom padding, so a hero that is the band's last element is already flush
  // to the band bottom (no bottom-bleed margin needed).

  // Curator find-more controls (Search TikTok / Search YouTube + ＋ Add video). They ride the END of
  // the horizontal scroll row (after the videos that are there) — never a separate toolbar above the
  // hero — so they add NO vertical band space. Signed-in only (curator tools), and hidden entirely
  // when the band is `suppressed` (marked complete — a finished topic offers no "add more"). The
  // Search links are the empty/mixed discovery aid (dropped once content leads — fully-curated);
  // ＋ Add video is the standing action.
  const showCuratorTools = signedIn && !suppressed;
  const showSearchLinks = !hasCurated || hasSuggestions;

  // §3: the "See N more" overflow over the General suggestion pool. A PURE display slice
  // over the already-ordered `generalCandidates` — never a re-fetch/re-order. `expanded`
  // is local UI state independent of the candidate list, so curating/dismissing a
  // suggestion just shortens the list and never collapses an expanded pool (AC10).
  const [expanded, setExpanded] = useState(false);
  const overflowing = generalCandidates.length > GENERAL_SUGGESTION_DEFAULT;
  const shownCandidates = expanded
    ? generalCandidates
    : generalCandidates.slice(0, GENERAL_SUGGESTION_DEFAULT);
  const remaining = generalCandidates.length - GENERAL_SUGGESTION_DEFAULT;

  // §6 (optional fade): a light, reduced-motion-gated fade-in on curated tiles. It is
  // polish over an already-stable layout — the suggestion group never re-keys or re-fades,
  // so the stability (AC10) is independent of it. Off under reduced motion (instant).
  const curatedFade = prefersReduced ? "" : " gs-fade-in";

  const tiktok = `https://www.tiktok.com/search?q=${encodeURIComponent(topicTitle)}`;
  const youtube = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    topicTitle
  )}`;

  return (
    <section
      ref={bandRef}
      id="general-band"
      aria-label={
        hasCurated
          ? "General overview videos"
          : suppressedEmptyBand
            ? "Videos"
            : "Suggested videos"
      }
      className="my-7 border-y-2 border-hardbox bg-brand text-white"
    >
      {/* Header region — centered to the content column; top padding only when it carries visible
          content (the hero, or the empty-state heading). The full-bleed scroll row + the zero line are
          siblings BELOW (design general-strip-fullbleed.md §3), so the scroll row can span the full
          band width and seat its scrollbar flush at the band's bottom. */}
      <div className={`mx-auto max-w-[1200px] px-5${heroClip || !hasCurated ? " pt-4" : ""}`}>
        {/* Curated states lead with the video itself — no visible heading or count pill (the volume
            already lives in the ＋plus overview card). An sr-only `<h2>` keeps heading navigation and
            the region's accessible name. The EMPTY state keeps its visible `＋ Suggested videos`
            heading + the UNCURATED pill + the unvetted subtitle — that line is the once-per-context
            unvetted signal (required, not chrome); the transient "Finding videos…" tag rides it. */}
        {hasCurated || suppressedEmptyBand ? (
          // Curated band — and the defensive suppressed-empty band (zero curated, marked complete) —
          // lead with an sr-only heading: never the visible "＋ Suggested videos" unvetted bootstrap on
          // a complete topic (the rail's toggle card carries the state — complete-toggle-rail.md §5).
          <h2 className="sr-only">General videos</h2>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="plus-disp text-2xl font-bold sm:text-3xl">
              ＋ Suggested videos
            </h2>
            <span className="border-2 border-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
              uncurated
            </span>
            <span className="text-sm text-white/80">
              — auto-found candidates, not yet vetted
            </span>
            {showLoading && (
              <span className="border-2 border-hardbox bg-surface-raised px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
                Finding videos…
              </span>
            )}
          </div>
        )}

        {/* The curator find-more controls do NOT sit here as a toolbar above the hero — they ride the
            END of the scroll row below (see `showCuratorTools`), so they add no vertical band space
            and follow the videos. */}

        {/* ── Hero block (issue #158, redesigned — design `general-hero-layout.md`). The one prominent
            must-watch clip at the FRONT of the band: the VIDEO bleeds (a uniform 16:9 frame flush to
            the band's content-box left edge, and its top/bottom when the hero is the band's first/last
            element — no white card padding/border around it), and the curation info is its OWN card
            docked to the video's side (right on ≥ sm, below on narrow), floating on the indigo, NOT
            overlapping. The card is white so its small text clears AA over the band. It reuses every
            trust signal — chips + inline upvote tag, note, context-by, held marking, owner/reviewer
            rows — so prominence is placement only. The gold ★ marker sits in the card's upper-right
            (its meaning carried by the star shape + the region's accessible label — never color
            alone). `-mx-5` (+ conditional `-mt-4`/`-mb-4`) breaks the article out of the band's
            padding without disturbing the other band states. */}
        {heroClip && (
          <article
            aria-label={`Hero video: ${heroClip.caption}`}
            className={`-mx-5 -mt-4 flex flex-col sm:flex-row sm:items-center${curatedFade}`}
          >
            {/* The video — full-bleed left (and top/bottom when first/last). Uniform 16:9, no own
                border; the band + the card's seam frame it. Click-to-play facade (unchanged). */}
            <div className="sm:basis-[60%] sm:shrink-0">
              <VideoThumb
                video={heroClip}
                variant="hero"
                onPlay={() => onPlay(heroClip)}
              />
            </div>
            {/* The curation card — its own card docked beside the video (`sm:pr-5` restores the right
                gutter so it aligns with page content); below the video on narrow (a 2px top seam,
                full width, no offset shadow). The article's `sm:items-center` floats the (shorter)
                card centred against the taller video without overlapping it. */}
            <div className="min-w-0 sm:flex-1 sm:pr-5">
              <div className="w-full border-t-2 border-hardbox bg-surface-raised p-4 text-ink-plus sm:max-w-[400px] sm:border-2 sm:shadow-[4px_4px_0_var(--color-hardbox-offset)]">
                {heroClip.held && (
                  <p className="mb-2">
                    <HeldPill />
                  </p>
                )}
                {/* Card header: title + the gold ★ hero marker upper-right (a flex row so the marker
                    never overlaps the wrapping title). The ★'s meaning is the region's aria-label +
                    the star shape; gold reinforces (never color alone). */}
                <div className="flex items-start gap-2.5">
                  <p className="min-w-0 flex-1 text-base font-bold leading-snug text-ink-plus sm:text-lg">
                    {heroClip.caption}
                  </p>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden
                    className="mt-0.5 h-5 w-5 shrink-0 fill-gold-accent"
                  >
                    <path d="M12 2l2.94 5.96 6.58.96-4.76 4.64 1.12 6.56L12 17.98l-5.88 3.1 1.12-6.56L2.48 9.92l6.58-.96z" />
                  </svg>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-muted">
                  {heroClip.creator.handle} · {heroClip.platformLabel}
                </p>
                {/* Chips + the inline upvote tag — one matched-height row. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StanceChip stance={heroClip.stance} modifier={heroClip.stanceModifier} />
                  <AccuracyChip flag={heroClip.accuracyFlag} modifier={heroClip.accuracyModifier} />
                  <UpvoteControl
                    count={heroClip.upvotes ?? 0}
                    voted={votedClip?.(heroClip) ?? false}
                    signedIn={signedIn}
                    surface="light"
                    appearance="tag"
                    onActivate={() => onUpvote?.(heroClip)}
                  />
                </div>
                {heroClip.contextNote ? (
                  <div className="mt-2 border-l-4 border-brand bg-surface-2 py-2 pl-3 pr-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-violet">
                      Curator note
                    </p>
                    <p className="mt-0.5 line-clamp-4 text-[13px] leading-snug text-ink2">
                      {heroClip.contextNote}
                    </p>
                  </div>
                ) : null}
                <p className="mt-1.5 truncate text-[12px]">
                  <ContextByLink curatedBy={heroClip.curatedBy} surface="light" />
                </p>
                {/* Owner-only Edit/Delete (mirrors the tile). */}
                {(ownsClip?.(heroClip) ?? false) && (
                  <div
                    role="group"
                    aria-label="Manage your curated clip"
                    className="mt-2 flex flex-wrap gap-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => onEdit?.(heroClip)}
                      aria-label={`Edit your curation: ${heroClip.caption}`}
                      className="border-2 border-hardbox bg-surface-raised px-2 py-1 text-[11px] font-bold text-ink-plus hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(heroClip)}
                      aria-label={`Delete your curation: ${heroClip.caption}`}
                      className="border-2 border-accred bg-surface-raised px-2 py-1 text-[11px] font-bold text-accred hover:bg-accred hover:text-white"
                    >
                      Delete
                    </button>
                  </div>
                )}
                {/* Reviewer Hold/Approve + moderator Remove (mirrors the tile). */}
                <ReviewRow
                  clip={heroClip}
                  canHold={canHold?.(heroClip) ?? false}
                  canApprove={canApprove?.(heroClip) ?? false}
                  canRemove={canRemove?.(heroClip) ?? false}
                  inFlight={reviewInFlight?.(heroClip) ?? false}
                  onHold={onHold}
                  onApprove={onApprove}
                  onRemove={onRemove}
                  size="tile"
                />
                {/* Issue #158: the curator Unmark-hero control — signed-in only (affordance gate; the
                    Server Action is the security control). A quiet secondary action; the WORD states
                    what tapping does. Busy word + disabled while a hero write is in flight. */}
                {signedIn && onClearHero && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={onClearHero}
                      disabled={settingHero}
                      aria-label="Unmark this video as the topic's hero"
                      className="inline-flex min-h-[44px] items-center border-2 border-hardbox bg-surface-raised px-2.5 py-1 text-[12px] font-bold text-ink-plus hover:shadow-[2px_2px_0_var(--color-hardbox-offset)] disabled:cursor-default disabled:opacity-60"
                    >
                      {settingHero ? "Clearing…" : "Unmark hero"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </article>
        )}
      </div>

      {/* The full-bleed horizontally-scrollable row (design general-strip-fullbleed.md §3): it spans
          the FULL band width via `.general-scroller` (not the centered column), starting at the content
          column's left edge, scrolling into the full width, with its scrollbar flush at the band's
          bottom (no indigo beneath it). Curated cards first, then the divider (mixed only), then the
          capped suggestion cards + "See N more". The marked-complete "show suggestions" toggle lives in
          the plus rail now (complete-toggle-rail.md), not here. `relative` keeps it a containing block
          for the cards' absolute thumbnail overlays. */}
      {(hasPeers || hasSuggestions || showLoading || showCuratorTools) && (
        <ul role="list" className="general-scroller relative flex items-start gap-2 overflow-x-auto">
            {/* Curator find-more controls — the LEADING item in the scroll row (before the videos),
                so they're always visible right after the hero without horizontal scrolling, never sit
                above the hero, and add no vertical band space. Search links in empty/mixed (the
                discovery aid); ＋ Add video is the standing action. Hidden entirely when the band is
                suppressed (marked complete — a finished topic offers no "add more"). A top-aligned
                vertical stack. */}
            {showCuratorTools && (
              <li role="listitem" className="flex shrink-0 self-start">
                <div
                  role="group"
                  aria-label="Add videos from a source manually"
                  className="flex flex-col gap-2"
                >
                  {showSearchLinks && (
                    <>
                      <a
                        href={tiktok}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex min-h-[44px] items-center border-2 border-hardbox bg-surface-raised px-2.5 py-1 text-[12px] font-bold text-ink-plus hover:bg-[#C03060] hover:text-white"
                      >
                        Search TikTok ↗
                      </a>
                      <a
                        href={youtube}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex min-h-[44px] items-center border-2 border-hardbox bg-surface-raised px-2.5 py-1 text-[12px] font-bold text-ink-plus hover:bg-brand hover:text-white"
                      >
                        Search YouTube ↗
                      </a>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={onAdd}
                    aria-haspopup="dialog"
                    className="inline-flex min-h-[44px] items-center border-2 border-hardbox bg-brand px-2.5 py-1 text-[12px] font-bold text-white hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
                  >
                    ＋ Add video
                  </button>
                </div>
              </li>
            )}
            {/* Curated group (§2.1 — always first, never capped). Full Indigo-Press chrome. The hero
                clip (issue #158) is pulled out into the prominent block above; `peerClips` is the
                remaining general clips in their existing order. */}
            {peerClips.map((clip) => {
              const owned = ownsClip?.(clip) ?? false;
              return (
                <li key={clip.id} role="listitem" className={`w-72 shrink-0${curatedFade}`}>
                  {/* The curated tile is one white zine card (design general-strip-fullbleed.md §2): a
                      3:2 thumbnail bled to the card top + compact info below. White surface so all the
                      small body text clears AA over the indigo band (every tile is now a card). */}
                  <div className="overflow-hidden border-2 border-hardbox bg-surface-raised text-ink-plus shadow-[3px_3px_0_var(--color-hardbox-offset)]">
                    <VideoThumb video={clip} variant="stripcard" onPlay={() => onPlay(clip)} />
                    <div className="p-2.5">
                      {clip.held && (
                        <p className="mb-1.5">
                          <HeldPill />
                        </p>
                      )}
                      <p className="line-clamp-2 text-[13px] font-bold leading-snug text-ink-plus">
                        {clip.caption}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {clip.creator.handle} · {clip.platformLabel}
                      </p>
                      {/* Stance + accuracy chips + the upvote tag — one inline row (the chips carry
                          their own AA-safe fills + ink border; the upvote is the outline tag). */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StanceChip stance={clip.stance} modifier={clip.stanceModifier} />
                        <AccuracyChip flag={clip.accuracyFlag} modifier={clip.accuracyModifier} />
                        <UpvoteControl
                          count={clip.upvotes ?? 0}
                          voted={votedClip?.(clip) ?? false}
                          signedIn={signedIn}
                          surface="light"
                          appearance="tag"
                          onActivate={() => onUpvote?.(clip)}
                        />
                      </div>
                      {/* The curation note — kept BORDERED for emphasis (design §2.1, the key info),
                          a 2-line preview with the curator credit as a corner initial-badge overlapping
                          the note's lower-right border (`CuratorBadge`; hover/focus → full name). The
                          FULL note lives in the opened player. On an EMPTY note, fall back to a compact
                          "context by" line so the curator is still credited. */}
                      {clip.contextNote ? (
                        <div className="relative mt-2 border-l-4 border-brand bg-surface-2 py-2 pl-3 pr-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-violet">
                            Curator note
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink2">
                            {clip.contextNote}
                          </p>
                          <CuratorBadge curatedBy={clip.curatedBy} />
                        </div>
                      ) : null}
                      {/* Curator credit: the corner badge covers a real curator on a note tile.
                          Otherwise — no note, OR a seed/stub clip with no profile (the badge returns
                          null) — show the compact "context by" / "seed clip · no curator" line so the
                          curator / seed status is still stated. */}
                      {(!clip.contextNote || isStubCurator(clip.curatedBy)) && (
                        <p className="mt-1.5 truncate text-[11px]">
                          <ContextByLink curatedBy={clip.curatedBy} surface="light" />
                        </p>
                      )}
                      {/* D3 §9.2: owner-only Edit/Delete. */}
                      {owned && (
                        <div
                          role="group"
                          aria-label="Manage your curated clip"
                          className="mt-2 flex flex-wrap gap-1.5"
                        >
                          <button
                            type="button"
                            onClick={() => onEdit?.(clip)}
                            aria-label={`Edit your curation: ${clip.caption}`}
                            className="border-2 border-hardbox bg-surface-raised px-2 py-1 text-[11px] font-bold text-ink-plus hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete?.(clip)}
                            aria-label={`Delete your curation: ${clip.caption}`}
                            className="border-2 border-accred bg-surface-raised px-2 py-1 text-[11px] font-bold text-accred hover:bg-accred hover:text-white"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      {/* D5b/D5c (design §4): the reviewer-only Hold/Approve + moderator Remove row. */}
                      <ReviewRow
                        clip={clip}
                        canHold={canHold?.(clip) ?? false}
                        canApprove={canApprove?.(clip) ?? false}
                        canRemove={canRemove?.(clip) ?? false}
                        inFlight={reviewInFlight?.(clip) ?? false}
                        onHold={onHold}
                        onApprove={onApprove}
                        onRemove={onRemove}
                        size="tile"
                      />
                      {/* Issue #158: the curator "★ Make hero" control (signed-in only). */}
                      {signedIn && onSetHero && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => onSetHero(clip)}
                            disabled={settingHero}
                            aria-label={`Mark as this topic's hero video: ${clip.caption}`}
                            className="inline-flex min-h-[44px] items-center border-2 border-hardbox bg-surface-raised px-2 py-1 text-[11px] font-bold text-ink-plus hover:shadow-[2px_2px_0_var(--color-hardbox-offset)] disabled:cursor-default disabled:opacity-60"
                          >
                            {settingHero ? "Setting…" : <><span aria-hidden>★</span> Make hero</>}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}

            {/* §2.1 divider — the inline, scroll-with-the-row "Suggested · uncurated" group label.
                Renders ONLY in MIXED (curated group above AND ≥1 suggestion): in empty the band
                header IS the once-per-context signal (no divider), in fully-curated there are no
                suggestions. A `<span>`, NOT a heading (the band already has the one `<h2>` — §5.3).
                The WORD carries the unvetted meaning (AC14/AC15 — not the dashed border alone). */}
            {hasCurated && hasSuggestions && (
              <li
                role="listitem"
                className="flex shrink-0 items-center self-stretch border-l-2 border-white pl-3"
              >
                {/* The once-per-context signal in WORDS (AC14/AC15) — read by AT, not just
                    a border. Vertical eyebrow (bottom-to-top) so it reads as a hairline
                    divider attached to the suggestion group, scrolling with the row. */}
                <span className="block whitespace-nowrap text-[11px] font-bold uppercase tracking-widest text-white [writing-mode:vertical-rl] rotate-180">
                  Suggested · uncurated
                </span>
              </li>
            )}

            {/* Suggestion group (§2.1 / §3) — after the curated group, capped at the default with
                the trailing "See N more". The container carries the id `aria-controls` targets. */}
            {hasSuggestions && (
              <li
                id={SUGGESTION_GROUP_ID}
                role="listitem"
                className="flex shrink-0 gap-2"
              >
                {shownCandidates.map((c) => (
                  // Suggested (uncurated) tile (design general-strip-fullbleed.md §2.2): the same
                  // white-card shape with the dashed/desaturated `candcard`/`candthumb` unvetted
                  // treatment. A 3:2 thumbnail bled to the card top + a compact context section
                  // (caption → creator → signed-in Curate / Not relevant). NO per-tile match line or
                  // "SUGGESTED" badge — the once-per-context unvetted signal lives in the divider.
                  <div key={c.id} className="candcard w-72 shrink-0 overflow-hidden">
                    <VideoThumb
                      video={c}
                      variant="stripcard"
                      candidate
                      onPlay={
                        onPlayCandidate && c.platform === "youtube" && c.embedUrl
                          ? () => onPlayCandidate(c)
                          : undefined
                      }
                    />
                    <div className="p-2.5">
                      <p className="line-clamp-2 text-[13px] font-bold leading-snug text-ink-plus">
                        {c.caption}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {c.creator.handle} · {c.platformLabel}
                      </p>
                      {/* #71 §5: on-tile actions only when signed in; logged out → watch-only. */}
                      {signedIn && (
                        <CandidateActions
                          candidate={c}
                          onPromote={onPromote}
                          onDismiss={onDismiss}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </li>
            )}

            {/* §3.2: the "See N more" / "See fewer" control — the trailing item in the row, only
                when the suggestion pool exceeds the default. Toggles only suggestion visibility. */}
            {overflowing && (
              <li role="listitem" className="flex shrink-0 items-stretch">
                <SeeMoreButton
                  expanded={expanded}
                  remaining={remaining}
                  controls={SUGGESTION_GROUP_ID}
                  onToggle={() => setExpanded((v) => !v)}
                />
              </li>
            )}

            {/* Loading skeleton (design §5.4): 3 skeleton tiles in the suggestion region — AFTER
                the curated group (mixed) or alone (empty), announced via aria-busy. NEVER disturbs
                the curated group (AC10). Shown while a fetch is in flight and no suggestions yet. */}
            {showLoading && !hasSuggestions && (
              <li role="listitem" className="shrink-0">
                <ul
                  role="list"
                  aria-busy="true"
                  aria-label="Looking for suggested videos"
                  className="flex gap-2"
                >
                  {[0, 1, 2].map((i) => (
                    // Match the candidate card width + 3:2 frame so the skeleton stands in 1:1.
                    <li key={i} role="listitem" className="w-72 shrink-0">
                      <div
                        className={`aspect-[3/2] w-full border-2 border-white/40 bg-surface-raised/15${
                          prefersReduced ? "" : " animate-pulse"
                        }`}
                      />
                      <div
                        className={`mt-2 h-3 w-5/6 bg-surface-raised/25${
                          prefersReduced ? "" : " animate-pulse"
                        }`}
                      />
                      <div
                        className={`mt-1 h-2.5 w-1/2 bg-surface-raised/15${
                          prefersReduced ? "" : " animate-pulse"
                        }`}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            )}

          </ul>
        )}

        {/* Zero-results face (design §5.2): the honest line, no tile chrome — centered to the content
            column (the scroll row is absent here). Also covers the error/quota silent-degrade case
            (§5.5) — same honest line, never an error UI. */}
        {showZero && (
          <div className="mx-auto max-w-[1200px] px-5 py-4">
            <p className="max-w-prose text-sm leading-relaxed text-white">
              {/* Logged-out readers have no curator controls, so their line stays purely informational;
                  the signed-in line names the Search / ＋ Add-video controls (which ride the scroll row
                  with the band's actions) without a stale directional "below". */}
              {signedIn
                ? "No videos found for this topic yet — search a platform or add one by link to start."
                : "No videos found for this topic yet — check back as people curate this topic."}
            </p>
          </div>
        )}
    </section>
  );
}
