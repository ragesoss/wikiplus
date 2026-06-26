"use client";

import { useState } from "react";
import { GENERAL_SUGGESTION_DEFAULT } from "@/lib/candidates";
import type { Candidate, Clip } from "@/lib/data/types";
import { pluralize } from "@/lib/format";
import {
  CandidateActions,
  MatchReason,
  SeeMoreButton,
} from "./CandidateBits";
import { AccuracyChip, StanceChip } from "./Chips";
import { ContextByLink } from "./ContextByLink";
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
  // The honest zero line shows only when there are no suggestions AND nothing is loading
  // AND there are no curated clips either (empty state with no results). In a curated
  // band a zero suggestion count simply reads as fully-curated — no suggestion chrome.
  const showZero = !loading && !hasSuggestions && !hasCurated;

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
      aria-label={hasCurated ? "General overview videos" : "Suggested videos"}
      className="my-7 border-y-2 border-hardbox bg-brand text-white"
    >
      <div className="mx-auto max-w-[1200px] px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* §5.3: exactly one `<h2>` per state — `＋ General` in mixed/fully-curated (the band
              leads with curated general clips), `＋ Suggested videos` only in empty. */}
          <h2 className="plus-disp text-2xl font-bold sm:text-3xl">
            ＋ {hasCurated ? "General" : "Suggested videos"}
          </h2>
          {!hasCurated && (
            <span className="border-2 border-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
              uncurated
            </span>
          )}
          <span className="text-sm text-white/80">
            {hasCurated
              ? "— quick visual overview across both columns"
              : "— auto-found candidates, not yet vetted"}
          </span>
          {/* The curated `N video` count pill (mixed + fully-curated); the transient
              "Finding videos…" loading tag. The empty band states the KIND once and
              defers the volume to the ＋plus panel (#14 AC6). */}
          {(hasCurated || showLoading) && (
            <span className="border-2 border-hardbox bg-surface-raised px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
              {showLoading && !hasCurated
                ? "Finding videos…"
                : pluralize(generalClips.length, "video")}
            </span>
          )}
        </div>

        {/* Find-more cluster (§7.2/§7.3): the full cluster (Search TikTok / Search YouTube /
            ＋ Add video) in empty + mixed; only the quiet "＋ Add video" in fully-curated (the
            Search-platform links are an empty-state discovery aid that's noise on a finished
            curated overview, but Add-video is a standing action that must not be stranded). */}
        {!hasCurated || hasSuggestions ? (
          <div
            role="group"
            aria-label="Add videos from a source manually"
            className="mt-3 flex flex-wrap items-center gap-2"
          >
            <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">
              Find more
            </span>
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
            <button
              type="button"
              onClick={onAdd}
              aria-haspopup="dialog"
              className="inline-flex min-h-[44px] items-center border-2 border-hardbox bg-brand px-2.5 py-1 text-[12px] font-bold text-white hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
            >
              ＋ Add video
            </button>
          </div>
        ) : (
          // Fully-curated: keep ONLY the Add-video path reachable (a single quiet control).
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAdd}
              aria-haspopup="dialog"
              className="inline-flex min-h-[44px] items-center border-2 border-hardbox bg-brand px-2.5 py-1 text-[12px] font-bold text-white hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
            >
              ＋ Add video
            </button>
          </div>
        )}

        {/* ── Hero block (issue #158) — the one prominent must-watch clip, at the FRONT of the band,
            above the uniform scroll row. A full-width bordered card on a WHITE (surface-raised) fill
            so its small body text + note clear AA over the indigo band (the same reason the tile note
            panel is white). Horizontal on ≥ sm (large thumbnail left, metadata right); stacks on
            narrow (thumbnail above), still visibly larger than a peer tile. Reuses every standard
            trust signal — chips, note, context-by, upvote, held marking, owner/reviewer rows — so
            prominence is placement only. The "★ Hero" eyebrow carries the meaning in WORDS (never
            color, never gold). The region is labeled so AT announces it as the lead video. */}
        {heroClip && (
          <article
            aria-label={`Hero video: ${heroClip.caption}`}
            className={`mt-4 border-2 border-hardbox bg-surface-raised text-ink-plus${curatedFade}`}
          >
            <div className="flex flex-col gap-4 p-3 sm:flex-row sm:p-4">
              <div className="sm:w-64 sm:shrink-0 lg:w-72">
                <VideoThumb
                  video={heroClip}
                  variant="card"
                  onPlay={() => onPlay(heroClip)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="plus-sans text-[11px] font-bold uppercase tracking-widest text-violet">
                  <span aria-hidden>★</span> Hero
                </p>
                {heroClip.held && (
                  <p className="mt-1.5">
                    <HeldPill />
                  </p>
                )}
                <p className="mt-1 text-base font-bold leading-snug text-ink-plus sm:text-lg">
                  {heroClip.caption}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-muted">
                  {heroClip.creator.handle} · {heroClip.platformLabel}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StanceChip stance={heroClip.stance} modifier={heroClip.stanceModifier} />
                  <AccuracyChip flag={heroClip.accuracyFlag} modifier={heroClip.accuracyModifier} />
                </div>
                {heroClip.contextNote ? (
                  <div className="mt-2 border-2 border-hardbox bg-surface-2 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-violet">
                      Curator note
                    </p>
                    <p className="mt-0.5 line-clamp-4 text-[13px] leading-snug text-ink2">
                      {heroClip.contextNote}
                    </p>
                  </div>
                ) : null}
                <p className="mt-1 truncate text-[12px]">
                  <ContextByLink curatedBy={heroClip.curatedBy} surface="light" />
                </p>
                <div className="mt-1.5">
                  <UpvoteControl
                    count={heroClip.upvotes ?? 0}
                    voted={votedClip?.(heroClip) ?? false}
                    signedIn={signedIn}
                    surface="light"
                    onActivate={() => onUpvote?.(heroClip)}
                  />
                </div>
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

        {/* The one horizontally-scrollable row: curated group FIRST (uncapped), then the
            divider (mixed only), then the capped suggestion group + "See N more". */}
        {(hasPeers || hasSuggestions || showLoading) && (
          // `relative` makes the <ul> a containing block for the absolute overlays inside the cards
          // (thumbnail wash, brand wash, play circle, badge), so overflow-x clips them instead of
          // letting them escape the scroller and expand the document width beyond the viewport on mobile.
          <ul role="list" className="relative mt-4 flex gap-3 overflow-x-auto pb-2">
            {/* Curated group (§2.1 — always first, never capped). Full Indigo-Press chrome. The hero
                clip (issue #158) is pulled out into the prominent block above; `peerClips` is the
                remaining general clips in their existing order. */}
            {peerClips.map((clip) => {
              const owned = ownsClip?.(clip) ?? false;
              return (
                <li
                  key={clip.id}
                  role="listitem"
                  className={`w-44 shrink-0${curatedFade}`}
                >
                  <VideoThumb video={clip} variant="strip" onPlay={() => onPlay(clip)} />
                  {/* D5b (design §3.3): the compact held marking — eyebrow-only on a white-fill pill
                      (AA on the indigo band), ABOVE the caption so the status reads first. */}
                  {clip.held && (
                    <p className="mt-1">
                      <HeldPill />
                    </p>
                  )}
                  <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-snug text-white">
                    {clip.caption}
                  </p>
                  <p className="truncate text-[11px] text-white/70">
                    {clip.creator.handle} · {clip.platformLabel}
                  </p>
                  {/* #63 §3 (AC2): the stance + accuracy chips, the same AA-safe chips the rail
                      `ClipCard` uses — their own dark fills + 2px ink border carry the contrast, so
                      the indigo band behind them never touches the chip text (no re-tint — §7.2).
                      `flex-wrap` so a long pair stacks to two rows within the `w-44` tile (§9). */}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <StanceChip stance={clip.stance} modifier={clip.stanceModifier} />
                    <AccuracyChip flag={clip.accuracyFlag} modifier={clip.accuracyModifier} />
                  </div>
                  {/* #63 §3.1 (AC1 preview): the 2-line context-note PREVIEW, on a WHITE panel + 2px
                      ink border so its small body text clears AA over the indigo `#676EB4` band
                      (ink/ink2 on white, never small body text on bare indigo — §7.2). It is the rail
                      card's "Curator note" block re-skinned for the indigo band + `line-clamp-2`; the
                      FULL note lives in the opened player (§2/§4). The whole tile thumbnail is already
                      the click-to-open affordance, so there is NO separate "read more" control (§2).
                      Omitted defensively on an empty note — render nothing rather than an empty panel
                      (§6 empty-note guard; chips above still render). */}
                  {clip.contextNote ? (
                    <div className="mt-1.5 border-2 border-hardbox bg-surface-raised px-2 py-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-violet">
                        Curator note
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink2">
                        {clip.contextNote}
                      </p>
                    </div>
                  ) : null}
                  {/* D3 §6.3: the linked "context by <curator>" attribution. */}
                  <p className="mt-0.5 truncate text-[11px]">
                    <ContextByLink curatedBy={clip.curatedBy} surface="indigo" />
                  </p>
                  {/* D4 §5: the interactive upvote control on the General tile. */}
                  <div className="mt-1">
                    <UpvoteControl
                      count={clip.upvotes ?? 0}
                      voted={votedClip?.(clip) ?? false}
                      signedIn={signedIn}
                      surface="indigo"
                      onActivate={() => onUpvote?.(clip)}
                    />
                  </div>
                  {/* D3 §9.2: owner-only Edit/Delete on the General tile. */}
                  {owned && (
                    <div
                      role="group"
                      aria-label="Manage your curated clip"
                      className="mt-1.5 flex flex-wrap gap-1.5"
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
                  {/* Issue #158: the curator "★ Make hero" control on a peer General tile — signed-in
                      only (the affordance gate; the Server Action is the security control). Every peer
                      tile here is a general clip, so eligibility holds. Marking replaces any prior hero
                      (the at-most-one invariant is structural). Busy + disabled while a hero write is
                      in flight. The WORD carries the action; the ★ is decorative. */}
                  {signedIn && onSetHero && (
                    <div className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => onSetHero(clip)}
                        disabled={settingHero}
                        aria-label={`Mark as this topic's hero video: ${clip.caption}`}
                        className="border-2 border-hardbox bg-surface-raised px-2 py-1 text-[11px] font-bold text-ink-plus hover:shadow-[2px_2px_0_var(--color-hardbox-offset)] disabled:cursor-default disabled:opacity-60"
                      >
                        {settingHero ? "Setting…" : <><span aria-hidden>★</span> Make hero</>}
                      </button>
                    </div>
                  )}
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
                className="flex shrink-0 gap-3"
              >
                {shownCandidates.map((c) => (
                  // #14: candidate tile on a candcard surface (dashed/unvetted retained). No
                  // per-tile "SUGGESTED" badge (AC1/§5.3); the compact match line on a white
                  // panel so its ink text clears AA on the indigo band.
                  <div key={c.id} className="candcard w-44 shrink-0 p-2">
                    <VideoThumb
                      video={c}
                      variant="strip"
                      candidate
                      onPlay={
                        onPlayCandidate && c.platform === "youtube" && c.embedUrl
                          ? () => onPlayCandidate(c)
                          : undefined
                      }
                    />
                    <p className="mt-1.5 line-clamp-2 text-[12px] font-bold leading-snug text-ink-plus">
                      {c.caption}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {c.creator.handle} · {c.platformLabel}
                    </p>
                    <MatchReason candidate={c} />
                    {/* #71 §5: on-tile actions only when signed in; logged out → watch-only. */}
                    {signedIn && (
                      <CandidateActions
                        candidate={c}
                        onPromote={onPromote}
                        onDismiss={onDismiss}
                      />
                    )}
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
                  className="flex gap-3"
                >
                  {[0, 1, 2].map((i) => (
                    <li key={i} role="listitem" className="w-44 shrink-0">
                      <div
                        className={`aspect-video w-full border-2 border-white/40 bg-surface-raised/15${
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

        {/* Zero-results face (design §5.2): the honest line, no tile chrome — only in the
            empty-with-no-results case. Also covers the error/quota silent-degrade case (§5.5)
            — same honest line, never an error UI. In a curated band a zero suggestion count
            simply reads as fully-curated. */}
        {showZero && (
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-white">
            No videos found for this topic yet. Try a manual search below, or add
            one by link.
          </p>
        )}
      </div>
    </section>
  );
}
