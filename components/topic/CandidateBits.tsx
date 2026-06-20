"use client";

import type { Candidate } from "@/lib/data/types";
import { VideoThumb } from "./VideoThumb";

// Shared candidate sub-parts. Candidates carry NO stance/accuracy chips and NO
// context note (CURATION §6) — only a compact match reason + a source pill.
//
// The "this is unvetted / auto-suggested / no context yet" SIGNAL reads ONCE per context
// (the ＋plus panel, the General band header, and the rail set header `CandidateSetHeader`),
// not per card. What stays per card is genuine per-clip INFORMATION: why THIS clip matched,
// and its source.

/**
 * Compact, quiet single-line match reason (#14 AC3) — per-clip information, not the
 * repeated unvetted signal. Decorative magnifier glyph `aria-hidden`; an `sr-only`
 * "Why suggested:" prefix makes the line self-describing to screen readers. The
 * source value is NOT here — it lives in the SourcePill (design §3 / AC4).
 */
export function MatchReason({ candidate }: { candidate: Candidate }) {
  return (
    <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-ink2">
      <span className="sr-only">Why suggested: </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
        className="mt-[1px] h-3 w-3 shrink-0 text-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <span>{candidate.matchReason}</span>
    </p>
  );
}

/**
 * Small text-labeled, outline source pill (#14 AC4 / design §6). Reads the
 * candidate's OWN `source` datum — never a hard-coded "YouTube" literal — so a
 * mixed-source result set renders each card's actual source without a redesign
 * (multi-source-extensibility hook). Sits in the slot the removed "SUGGESTED"
 * badge vacated.
 */
export function SourcePill({ candidate }: { candidate: Candidate }) {
  return (
    <span
      title={`Auto-suggested from ${candidate.source}`}
      className="inline-flex items-center gap-1 border-[1.5px] border-ink bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.06em] text-ink"
    >
      {candidate.source}
    </span>
  );
}

/** Curate / Not-relevant controls (design §3, AC9). Verb is "Curate" (was "Promote"). */
export function CandidateActions({
  candidate,
  onPromote,
  onDismiss,
}: {
  candidate: Candidate;
  // Handler name keeps the internal-mechanism term (promotion, CURATION §6); only
  // the user-facing verb on the button changes to "Curate" (#14 D1 / AC9/AC12).
  onPromote: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onPromote(candidate)}
        aria-label={`Curate this clip: ${candidate.caption}`}
        aria-haspopup="dialog"
        className="inline-flex min-h-[44px] items-center border-2 border-ink bg-brand px-2.5 py-1 text-[12px] font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
      >
        <span aria-hidden>✦</span>&nbsp;Curate
      </button>
      <button
        type="button"
        onClick={() => onDismiss(candidate)}
        aria-label={`Dismiss as not relevant: ${candidate.caption}`}
        className="inline-flex min-h-[44px] items-center border-2 border-ink bg-white px-2.5 py-1 text-[12px] font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C]"
      >
        <span aria-hidden>✕</span>&nbsp;Not relevant
      </button>
    </div>
  );
}

/**
 * One-time "unvetted set" header (#14 AC5 / design D2; issue #60 §5.3) atop the rail
 * candidate list. A single dashed-outline block — replaces v2's tiny eyebrow AND absorbs
 * the per-card "No context yet…" sentence. Names the `sources` (from data, never
 * hard-coded); carries NO count (the topic-wide volume lives once, in the ＋plus panel).
 *
 * Issue #60: in a MIXED rail (curated clips above it) it introduces the suggestion
 * *subset*, not the whole topic — the body copy switches to the "The suggested videos
 * below…" wording via `scope="subset"`. Empty-state copy ("the whole plus side is
 * suggestions") is unchanged from #14 and is the default. The eyebrow ("Suggested ·
 * uncurated") is a `<span>`, NOT a heading, so the heading outline is unbroken (AC15).
 */
export function CandidateSetHeader({
  sources,
  scope = "all",
}: {
  sources: string;
  /** "subset" → the mixed-state copy that scopes to the suggestion group; "all" → empty copy. */
  scope?: "all" | "subset";
}) {
  return (
    <div className="candsethead px-3 py-2.5">
      <div className="flex items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-violet"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <span className="text-[11px] font-bold uppercase tracking-widest text-violet">
          Suggested · uncurated
        </span>
      </div>
      {scope === "subset" ? (
        <p className="mt-1 text-[11px] leading-snug text-ink2">
          The suggested videos below are auto-found from{" "}
          <span className="font-bold text-ink">{sources}</span> — no context notes
          yet, not reviewed by a human.{" "}
          <span className="text-muted">Curate one to vouch for it.</span>
        </p>
      ) : (
        <p className="mt-1 text-[11px] leading-snug text-ink2">
          Auto-found from <span className="font-bold text-ink">{sources}</span>. No
          context notes yet — a human hasn&apos;t reviewed these.{" "}
          <span className="text-muted">Curate one to vouch for it.</span>
        </p>
      )}
    </div>
  );
}

/**
 * "See N more" / "See fewer" toggle for the General suggestion pool (issue #60 §3.2 /
 * AC6/AC7/AC15). Presence is the CALLER's responsibility (render only when
 * `generalCandidates.length > GENERAL_SUGGESTION_DEFAULT`); this component just renders
 * the control. It is a native `<button>` (keyboard-reachable, Enter/Space, the project
 * `:focus-visible` ring), ≥44px tall, with the band's white-fill-on-indigo control
 * language. ARIA: `aria-expanded` announces collapsed/expanded; `aria-controls` points at
 * the suggestion-group container id; the visible label text is the accessible name (the
 * `▾`/`▴` glyph is decorative, `aria-hidden`). Focus stays on the button across toggle
 * (the button persists; the newly-revealed tiles come after it in source order).
 */
export function SeeMoreButton({
  expanded,
  remaining,
  controls,
  onToggle,
}: {
  expanded: boolean;
  /** Suggestions hidden when collapsed (`length − DEFAULT`) — shown in the collapsed label. */
  remaining: number;
  /** id of the suggestion-group container this toggle expands (`aria-controls`). */
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      className="inline-flex min-h-[44px] shrink-0 items-center self-center whitespace-nowrap border-2 border-ink bg-white px-3 py-1 text-[12px] font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C]"
    >
      {expanded ? (
        <>
          See fewer&nbsp;<span aria-hidden>▴</span>
        </>
      ) : (
        <>
          See {remaining} more&nbsp;<span aria-hidden>▾</span>
        </>
      )}
    </button>
  );
}

/** Candidate card in the rail (mirrors a clip card's footprint, dashed). */
export function CandidateCard({
  candidate,
  active = false,
  signedIn = false,
  onPlay,
  onPromote,
  onDismiss,
  cardRef,
}: {
  candidate: Candidate;
  /** Scroll-sync highlight — mirrors ClipCard's active pairing (design §6.5, D2). */
  active?: boolean;
  /**
   * #71 §5: gates the on-tile Curate / Not-relevant actions. Signed in → `CandidateActions`
   * renders as today; logged out → the tile is watch-only (no action buttons; the invitation to
   * curate moves into the `PinnedPlayer` — §6). Everything else (thumb, match reason, source pill,
   * caption, credit, dashed/unvetted treatment) is unchanged either way. Default `false` so an
   * anonymous read is watch-only without a host change.
   */
  signedIn?: boolean;
  /** YouTube-candidate play → non-modal PinnedPlayer (issue #10, AC1). Optional:
      without it (or for a non-embeddable clip) the thumb keeps its link-out. */
  onPlay?: (c: Candidate) => void;
  onPromote: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
  cardRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <article
      ref={cardRef}
      data-clip-section={candidate.general ? "__general" : candidate.sectionSlug}
      className={`candcard relative p-2.5${active ? " active" : ""}`}
    >
      {/* Header row: section label + source pill in the slot the badge vacated (AC4). */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-violet">
          {candidate.general ? "General" : candidate.sectionLabel ?? "Section"}
        </span>
        <SourcePill candidate={candidate} />
      </div>
      <VideoThumb
        video={candidate}
        candidate
        onPlay={
          onPlay && candidate.platform === "youtube" && candidate.embedUrl
            ? () => onPlay(candidate)
            : undefined
        }
      />
      <a
        href={candidate.creator.url}
        target="_blank"
        rel="noopener"
        className="mt-2 flex items-center gap-2"
      >
        <span
          aria-hidden
          className={`h-7 w-7 shrink-0 rounded-full border-2 border-ink bg-gradient-to-br ${
            candidate.creator.avatarGrad ?? "from-brand to-violet"
          }`}
        />
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-bold text-ink">
            {candidate.caption}
          </span>
          <span className="block truncate text-[11px] text-muted">
            {candidate.creator.handle} · {candidate.platformLabel}
          </span>
        </span>
      </a>
      <MatchReason candidate={candidate} />
      {/* #71 §5: on-tile actions only when signed in; logged out the tile is watch-only. */}
      {signedIn && (
        <CandidateActions
          candidate={candidate}
          onPromote={onPromote}
          onDismiss={onDismiss}
        />
      )}
    </article>
  );
}
