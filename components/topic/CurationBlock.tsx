"use client";

import type { Clip } from "@/lib/data/types";
import { AccuracyChip, StanceChip } from "./Chips";
import { ContextByLink } from "./ContextByLink";
import { HeldMarking } from "./HeldMarking";

// The shared curated curation block — the single source of truth for the curated viewing
// surface's metadata, rendered by BOTH the desktop `PlayerModal` and the mobile
// `MobilePlayerDock`. It is the rail `ClipCard`'s reading order lifted into the player (minus
// the upvote/manage rows — the player is a read-only viewing surface): creator credit → held
// marking → stance/accuracy chips → full "Curator note" → "context by" attribution.
//
// CURATION §1–§5: the note separates fact from the creator's opinion; the chips carry the
// fact-vs-opinion signal; the creator credit is the CC BY-SA attribution (links OUT to the
// platform); the "context by" attribution links IN to the curator. The note block is omitted
// defensively when the note is empty (§6 empty-note guard).
//
// The pieces are exported individually so the dock can compose its compact collapsed form
// (chips + held inline, note one tap away) without re-typing the markup; `CurationBlock`
// renders the full desktop block in one call.

/**
 * The creator credit (CURATION §5.2 / C10) — links OUT to the creator's platform when
 * `creator.url` is present; otherwise (an unresolved add-by-link clip) a NON-LINKED span so the
 * player never renders a dead/empty outbound link. The handle is dropped when absent (name-only
 * credit, C10).
 */
export function PlayerCreatorCredit({ clip }: { clip: Clip }) {
  const avatar = (
    <span
      aria-hidden
      className={`h-7 w-7 shrink-0 rounded-full border-2 border-hardbox bg-gradient-to-br ${
        clip.creator.avatarGrad ?? "from-brand to-violet"
      }`}
    />
  );
  const text = (
    <span className="min-w-0">
      <span className="block truncate text-[12px] font-bold text-ink-plus">
        {clip.creator.name}
      </span>
      <span className="block truncate text-[11px] text-muted">
        {clip.creator.handle
          ? `${clip.creator.handle} · ${clip.platformLabel}`
          : clip.platformLabel}
      </span>
    </span>
  );

  if (clip.creator.url) {
    return (
      <a
        href={clip.creator.url}
        target="_blank"
        rel="noopener"
        className="flex items-center gap-2"
      >
        {avatar}
        {text}
      </a>
    );
  }
  return <span className="flex items-center gap-2">{avatar}{text}</span>;
}

/**
 * The stance + accuracy chips row (CURATION §2–§4) — the standard AA-safe chips, identical to the
 * rail. Their own dark fills carry the contrast, so any light/dark panel behind them is fine. The
 * caller owns the wrapper's top margin via `className`.
 */
export function CurationChips({
  clip,
  className = "mt-2 flex flex-wrap gap-1.5",
}: {
  clip: Clip;
  className?: string;
}) {
  return (
    <div className={className}>
      <StanceChip stance={clip.stance} modifier={clip.stanceModifier} />
      <AccuracyChip flag={clip.accuracyFlag} modifier={clip.accuracyModifier} />
    </div>
  );
}

/**
 * The "Curator note" panel (CURATION §1) — the full (untruncated) `clip.contextNote` under its
 * eyebrow, on the Indigo-Press light register (`text-ink2`), NEVER white-on-black body text.
 * Returns `null` when the note is empty (§6 empty-note guard) — the caller's expander then has
 * nothing to expand to.
 */
export function CuratorNote({ clip }: { clip: Clip }) {
  if (!clip.contextNote) return null;
  return (
    <div className="mt-2 border-l-4 border-brand bg-surface-2 py-2 pl-3 pr-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-violet">
        Curator note
      </p>
      <p className="mt-0.5 text-[12px] leading-snug text-ink2">
        {clip.contextNote}
      </p>
    </div>
  );
}

/**
 * The "context by <curator>" attribution (CURATION §5.4 / Decision C7) — links IN to the curator
 * profile; `@prototype` → the non-linked "seed clip · no curator" label. `surface="light"` picks
 * the AA-safe `text-link` link tone (both the modal block and the dock's expanded note panel
 * are light surfaces).
 */
export function CurationContextBy({ clip }: { clip: Clip }) {
  return (
    <p className="mt-2 text-[11px]">
      <ContextByLink curatedBy={clip.curatedBy} surface="light" />
    </p>
  );
}

/**
 * The full curated curation block for the DESKTOP `PlayerModal` (issue #63 §4): a LIGHT card
 * (white fill, 2px ink border) beneath the black video frame, in the reading order
 * creator → held → chips → full note → "context by" → (logged-out) join nudge. The block always
 * renders for a real curated clip — including when the clip "can't be embedded" (§6), since the
 * note is worth reading even when the frame can't play.
 *
 * The logged-out join nudge is the END element (after "context by"): a softer topic-level
 * invitation, rendered ONLY logged out with a bound `onJoin`. It is a real `<button>` last in the
 * dialog's DOM, so it joins ModalShell's focus trap and sits last in tab order (the ✕ close button
 * stays first-focused). Secondary, text-forward treatment (white fill, 2px ink border, bold ink
 * text); the word "Log in" carries the meaning (never color-alone). No gold.
 */
export function CurationBlock({
  clip,
  signedIn = false,
  onJoin,
}: {
  clip: Clip;
  signedIn?: boolean;
  onJoin?: () => void;
}) {
  return (
    <div className="mt-3 border-2 border-hardbox bg-surface-raised p-4 text-left">
      <PlayerCreatorCredit clip={clip} />
      {clip.held && <HeldMarking />}
      <CurationChips clip={clip} />
      <CuratorNote clip={clip} />
      <CurationContextBy clip={clip} />
      {!signedIn && onJoin && (
        <button
          type="button"
          onClick={onJoin}
          aria-haspopup="dialog"
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center border-2 border-hardbox bg-surface-raised px-3 py-1 text-[13px] font-bold text-ink-plus hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
        >
          Log in to curate videos for this topic
        </button>
      )}
    </div>
  );
}
