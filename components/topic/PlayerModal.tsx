"use client";

import type { Clip } from "@/lib/data/types";
import { AccuracyChip, StanceChip } from "./Chips";
import { ContextByLink } from "./ContextByLink";
import { HeldMarking } from "./HeldMarking";
import { ModalShell } from "./ModalShell";

// Player modal (design §5.8 / AC11; issue #63 §4). The iframe is created ON OPEN (this
// component only mounts when a clip is activated) and removed on close — no embed loads
// on initial page render. Autoplay is set since the user explicitly clicked play.
//
// Issue #63 (§4): the modal now also renders a CURATION BLOCK beneath the video frame for
// any curated clip — the rail `ClipCard`'s chips + full "Curator note" + "context by" footer,
// lifted into the player (minus the upvote/manage rows — the player is a read-only viewing
// surface). To render it the player needs the curation fields, so `PlayerClip` widens to the
// full `Clip` (A1 — the `player` state at every mount site is already a `Clip`, so this is a
// pure render change, no new data fetch). The block lives INSIDE `ModalShell` (so it is inside
// the existing focus trap / Esc / backdrop / focus-return — §7.4) and BELOW the frame (the
// video stays the primary element). It still renders when the clip "can't be embedded" (§6).
export type PlayerClip = Clip;

export function PlayerModal({
  clip,
  onClose,
}: {
  clip: PlayerClip;
  onClose: () => void;
}) {
  const src = clip.embedUrl
    ? clip.embedUrl + (clip.embedUrl.includes("?") ? "&" : "?") + "autoplay=1"
    : undefined;
  const frame =
    clip.orientation === "vertical"
      ? "aspect-[9/16] max-h-[80vh] mx-auto"
      : "aspect-video w-full";

  return (
    <ModalShell onClose={onClose} ariaLabel="Video player" dark className="w-full max-w-3xl">
      <div className="border-2 border-ink bg-black">
        <div className="flex justify-end p-2">
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-sm font-semibold text-white hover:underline"
          >
            ✕ close
          </button>
        </div>
        <div className={`${frame} bg-black`}>
          {src ? (
            <iframe
              src={src}
              title={clip.caption}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <p className="p-6 text-center text-sm text-white">
              This clip can&apos;t be embedded.
            </p>
          )}
        </div>
      </div>
      {/* Curation block (issue #63 §4) — beneath the black frame, on a LIGHT surface so the note +
          chips read in the Indigo-Press light-card register (never white-on-black body text). It
          mounts inside the same dialog, so its links join the existing focus trap automatically
          (§7.4) and the close button stays the first focusable. The block reuses the rail
          `ClipCard`'s reading order (creator → held → chips → full note → context-by) so a reader
          who opens ANY curated clip — General or section-anchored — sees the identical block (AC4).
          The note block is OMITTED defensively on an empty note; chips + context-by still render
          (§6 empty-note guard). A curated clip ALWAYS opens here, so the block always renders for a
          real clip (candidates use the non-modal PinnedPlayer — out of scope). */}
      <div className="mt-3 border-2 border-ink bg-white p-4 text-left">
        {/* Creator credit (CURATION §5.2 / C10) — links OUT to the platform when there is a real
            `creator.url`; otherwise a non-linked span (never a dead/empty outbound link). Distinct
            from the "context by" attribution below, which links IN to the curator profile. */}
        <PlayerCreatorCredit clip={clip} />

        {/* Held "in review" marking (CURATION §7.1) — ABOVE the chips, banners the whole vouch.
            Rendered ONLY when held; coexists with the now-surfaced note/chips (AC7). */}
        {clip.held && <HeldMarking />}

        {/* Stance + accuracy chips — the standard AA-safe chips, identical to the rail (AC3/AC4).
            Their own dark fills carry the contrast, so the light panel behind them is fine. */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StanceChip stance={clip.stance} modifier={clip.stanceModifier} />
          <AccuracyChip flag={clip.accuracyFlag} modifier={clip.accuracyModifier} />
        </div>

        {/* Curator note (CURATION §1) — the rail card's "Curator note" block VERBATIM, full
            (untruncated) text. Omitted defensively when the note is empty (§6 empty-note guard;
            per A1 a curated clip always has a note, so this is a guard, not an expected state). */}
        {clip.contextNote ? (
          <div className="mt-2 border-l-4 border-brand bg-bg2 py-2 pl-3 pr-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet">
              Curator note
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-ink2">
              {clip.contextNote}
            </p>
          </div>
        ) : null}

        {/* "context by <curator>" attribution (CURATION §5.4 / Decision C7) — links IN to the
            curator profile; `@prototype` → the non-linked "seed clip · no curator" label (AC5).
            `surface="light"` (the block is a light panel) → the AA-safe `text-action` link tone. */}
        <p className="mt-2 text-[11px]">
          <ContextByLink curatedBy={clip.curatedBy} surface="light" />
        </p>
      </div>
    </ModalShell>
  );
}

/**
 * The creator credit for the player block (CURATION §5.2 / C10) — mirrors the rail `ClipCard`'s
 * `CreatorCredit`: links OUT to the creator's platform when `creator.url` is present; otherwise
 * (an unresolved add-by-link clip — issue #64) degrades to a NON-LINKED span so the player never
 * renders a dead/empty outbound link. The handle is dropped when absent (name-only credit, C10).
 */
function PlayerCreatorCredit({ clip }: { clip: Clip }) {
  const avatar = (
    <span
      aria-hidden
      className={`h-7 w-7 shrink-0 rounded-full border-2 border-ink bg-gradient-to-br ${
        clip.creator.avatarGrad ?? "from-brand to-violet"
      }`}
    />
  );
  const text = (
    <span className="min-w-0">
      <span className="block truncate text-[12px] font-bold text-ink">
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
