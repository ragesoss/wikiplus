"use client";

import type { CSSProperties } from "react";

// Persistent PINNED candidate player (issue #10, design docs/design/pinned-player.md).
//
// A NON-MODAL, persistent, single-instance YouTube-candidate player. Unlike
// PlayerModal it is NOT routed through ModalShell: no role=dialog, no aria-modal,
// no focus trap, no backdrop, no autofocus/focus-steal on open (§8, AC9/AC10). It
// docks in a fixed standard position that survives scroll (AC2) and never covers
// the plus rail or a candidate's Promote / Not-relevant controls (AC3): desktop
// bottom-LEFT corner (those controls live on the right), mobile a full-width
// bottom bar (the page reserves bottom space via a spacer in TopicView).
//
// The iframe is created on mount (= on an explicit play click in TopicView) and
// torn down on unmount (= on dismiss / state → null), preserving the
// embed-never-host facade. Swap (AC5) keeps THIS element mounted and only changes
// the playable payload, so React updates `src` in place rather than remounting.
//
// The dock exists ONLY when a real video is playing — a YouTube candidate with no
// embedUrl never reaches here (TopicView falls back to a new tab; design §9 State
// F). So `embedUrl` is required: no src-less iframe is ever rendered (AC7).
//
// The dock is three stacked regions (issue #123, docs/design/in-player-curation.md
// §3): a title bar (caption + creator credit + Close), the video frame (the hero),
// and a bottom ACTION ROW so the reader decides where they watched — signed in,
// Curate (primary) + Not relevant (secondary); logged out, a single Curate-this-
// video CTA (the dismiss is gated on the card, not shown here).

export interface PinnedClip {
  /** YouTube embed URL (required — the dock only opens for embeddable clips). */
  embedUrl: string;
  caption: string;
  orientation: "vertical" | "horizontal";
  /** Creator credit — `handle · platformLabel`. */
  creator: { handle: string };
  platformLabel: string;
}

export function PinnedPlayer({
  clip,
  onClose,
  prefersReduced = false,
  signedIn = false,
  onCurate,
  onDismiss,
}: {
  clip: PinnedClip;
  onClose: () => void;
  /** Reuse TopicView's existing reduced-motion signal — gates the dock-in (AC12). */
  prefersReduced?: boolean;
  /**
   * #123 §3.4: is the viewer signed in. Signed in (`signedIn && onCurate && onDismiss`) the bottom
   * action row is the two-button Curate / Not relevant row; logged out (`!signedIn && onCurate`)
   * it is the single "Curate this video" CTA — one slot, two states.
   */
  signedIn?: boolean;
  /**
   * #123 §3.3/§5 (State I/J/K): the Curate action for the playing candidate — TopicView binds it to
   * `promote(candidate)`, which gates first (signed in → CurateModal; logged out → the `curate`
   * login gate; no new gate kind). Absent → no action row.
   */
  onCurate?: () => void;
  /**
   * #123 §3.3/§5 (State I/L): the Not-relevant action — TopicView binds it to `dismiss(candidate)`
   * (the existing optimistic-dismiss-with-rollback path). Rendered only when `signedIn && onCurate
   * && onDismiss`; logged out the dismiss is gated, not shown (State J).
   */
  onDismiss?: () => void;
}) {
  // iframe src/attrs reused VERBATIM from PlayerModal (AC1/AC5; design §9 C).
  const src =
    clip.embedUrl + (clip.embedUrl.includes("?") ? "&" : "?") + "autoplay=1";

  const vertical = clip.orientation === "vertical";

  // §6 sizing. The dock's outer footprint is capped; the FRAME is sized by
  // orientation. min()/env() caps go through inline style (Tailwind can't express
  // them cleanly), responsive layout through classes.
  //
  // Desktop (lg): fixed bottom-left, dock width min(380px, 100vw-2rem).
  //   16:9 → frame = full dock width (aspect-video).
  //   9:16 → frame height-capped at min(60vh,460px); dock narrows to the frame.
  // Mobile (<lg): fixed full-width bottom bar, safe-area padded.
  //   16:9 → full-width aspect-video.
  //   9:16 → frame height-capped min(55vh,420px), centered/letterboxed on black.
  const rootStyle: CSSProperties = {
    // Pad past the device home indicator on mobile (desktop the dock is bottom-left
    // with a 1rem gap, so the inset is harmless there).
    paddingBottom: "env(safe-area-inset-bottom)",
  };

  // Frame wrapper: black backing; height-capped for verticals so a Short never
  // towers (§6). Vertical caps differ by breakpoint: mobile min(55vh,420px),
  // desktop min(60vh,460px). The 9:16 aspect-ratio + the height give the column its
  // width (≈260px @460 tall), and the dock narrows to it (lg:w-auto above). Centered
  // (mx-auto) so it letterboxes on the black bar on mobile.
  const frameClass = vertical
    ? "mx-auto w-auto bg-black [aspect-ratio:9/16]" +
      " h-[min(55vh,420px)] max-h-[min(55vh,420px)]" +
      " lg:h-[min(60vh,460px)] lg:max-h-[min(60vh,460px)]"
    : // landscape: fills the available width at 16:9
      "w-full bg-black aspect-video";

  return (
    <section
      aria-label="Video preview"
      style={rootStyle}
      className={
        // Shared: fixed layer below modals (z-40 < ModalShell z-50, §8), ink box,
        // 2px ink border. No backdrop, occupies only its own box (AC3).
        "fixed z-40 border-2 border-ink bg-ink text-white" +
        // Mobile: full-width bottom bar.
        " inset-x-0 bottom-0" +
        // Desktop: detach to the bottom-LEFT corner, capped width, offset shadow.
        " lg:inset-x-auto lg:bottom-4 lg:left-4 lg:right-auto" +
        " lg:w-[min(380px,calc(100vw-2rem))] lg:shadow-[6px_6px_0_#2C2C2C]" +
        // Vertical desktop dock narrows to its (height-capped) frame column.
        (vertical ? " lg:w-auto" : "") +
        // Reduced-motion-gated dock-in (AC12): class only when motion is allowed.
        (prefersReduced ? "" : " pinned-dock-in")
      }
    >
      {/* Title bar (the dock chrome): caption + credit (left) · Close (right).
          White on ink ≈ 15:1 — clears AA/AAA (AC13). */}
      <div className="flex items-start gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="plus-disp text-[11px] font-bold uppercase tracking-wide text-white/70">
            ＋plus
          </p>
          <p className="line-clamp-1 text-[13px] font-bold leading-snug text-white">
            {clip.caption}
          </p>
          <p className="truncate text-[11px] text-white/70">
            {clip.creator.handle} · {clip.platformLabel}
          </p>
        </div>
        {/* Dismiss (AC6/AC11/AC13): a real <button> in normal tab order, the global
            focus-visible ring applies, the WORD "Close" + glyph (never color-alone). */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close video preview"
          className="shrink-0 px-2 py-1 text-sm font-semibold text-white hover:underline"
        >
          ✕ Close
        </button>
      </div>

      {/* Video frame: black backing; iframe attrs reused verbatim from PlayerModal. */}
      <div className={frameClass}>
        <iframe
          src={src}
          title={clip.caption}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* #123 §3.1/§3.3: the action row — the dock's bottom region, BELOW the frame, so the dock
          reads top-to-bottom as watch → decide (metadata → frame → act). It is one slot with two
          renderings (§3.4):
            - signed in (`signedIn && onCurate && onDismiss`): the two-button row — ✦ Curate
              (primary, brand fill, flex-1 so it dominates) + ✕ Not relevant (secondary, white fill,
              intrinsic width). Curate leads (positive intent; matches the card order).
            - logged out (`!signedIn && onCurate`): the single full-width ✦ Curate this video CTA.
              No Not relevant button (State J — a logged-out dismiss has no honest optimistic hide,
              so it is gated on the card, not offered in the watch surface).
          Both renderings live in this NON-MODAL `<section>`: real tabbable `<button>`s, present but
          NOT focused on open/swap (§7 no focus-steal), the global `:focus-visible` ring applies, and
          the WORD carries the meaning (✦/✕ are decorative `aria-hidden`, never color-alone). The
          buttons reuse the exact treatment of the on-card `CandidateActions` and the #71 CTA — one
          visual language across all three sites. No gold; the 2px ink border carries each button's
          boundary on the ink bar (§7). */}
      {signedIn && onCurate && onDismiss ? (
        <div className="flex flex-wrap gap-2 px-3 pb-3 pt-2">
          <button
            type="button"
            onClick={onCurate}
            aria-haspopup="dialog"
            aria-label={`Curate this clip: ${clip.caption}`}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center border-2 border-ink bg-brand px-3 py-1 text-[13px] font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
          >
            <span aria-hidden>✦</span>&nbsp;Curate
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Dismiss as not relevant: ${clip.caption}`}
            className="inline-flex min-h-[44px] items-center justify-center border-2 border-ink bg-white px-3 py-1 text-[13px] font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C]"
          >
            <span aria-hidden>✕</span>&nbsp;Not relevant
          </button>
        </div>
      ) : (
        !signedIn &&
        onCurate && (
          <div className="px-3 pb-3 pt-2">
            <button
              type="button"
              onClick={onCurate}
              aria-haspopup="dialog"
              aria-label="Curate this video — log in to write a context note and vouch for it"
              className="inline-flex min-h-[44px] w-full items-center justify-center border-2 border-ink bg-brand px-3 py-1 text-[13px] font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
            >
              <span aria-hidden>✦</span>&nbsp;Curate this video
            </button>
          </div>
        )
      )}
    </section>
  );
}
