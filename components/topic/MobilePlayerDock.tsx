"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import type { Clip } from "@/lib/data/types";
import {
  CurationChips,
  CuratorNote,
  CurationContextBy,
} from "./CurationBlock";
import { HELD_ACCESSIBLE_NAME, HELD_EYEBROW } from "./HeldMarking";

// The unified MOBILE video player (issue #120, design docs/design/unified-player-mobile.md).
//
// ONE non-modal, movable, viewport-fit player used on mobile (< lg) for ANY video — curated or
// candidate. It generalizes the candidate `PinnedPlayer` into a single component whose supplemental
// info + action buttons parameterize by (kind: curated | candidate) × (signedIn). Everything else —
// frame, credit, Close, the park toggle, the maximize-on-rotate behavior, the non-modal contract —
// is shared and identical for every clip.
//
// NON-MODAL contract (§9, carried from PinnedPlayer): a labeled `<section aria-label="Video
// player">` landmark — NOT role=dialog, NO aria-modal, NO focus trap, NO backdrop, NO autofocus /
// focus-steal on open, NOT routed through ModalShell — even in maximized mode (a layout, not a
// modality). The iframe is created on mount (= an explicit play click in TopicView) and torn down
// on unmount (= on dismiss / state → null), preserving the embed-never-host facade. A second play
// SWAPS in place (TopicView re-sets the single `mobileDock` state), so React updates `src` rather
// than remounting — playback is never interrupted.
//
// MAXIMIZE is CSS-only (§6.5/§6.6): the SAME `<section>` and SAME iframe flip to `fixed inset-0`
// — never `requestFullscreen` (iPhone Safari has no Fullscreen API for our iframe; an
// orientationchange is not a qualifying user gesture, so even Android would reject it). The embed's
// own native-fullscreen button stays intact (`allowFullScreen`). Trigger = orientationchange to
// landscape (listener added only while open, removed on dismiss) + an explicit ⤢ Maximize/Exit
// button so it is keyboard/AT-reachable and works for vertical Shorts (no landscape trigger).

export type DockKind = "curated" | "candidate";

/**
 * The playable + supplemental payload the dock renders. It carries everything for BOTH kinds; the
 * supplemental row reads only the fields its `kind` needs. `Clip` and `Candidate` both already
 * carry these, so TopicView assembles this directly (no data-model change — #120).
 */
export interface MobileDockClip {
  /** YouTube embed URL. Required for a candidate (it never opens the dock without one); a curated
   *  clip MAY lack it (then the frame shows the "can't be embedded" message + the note). */
  embedUrl?: string;
  caption: string;
  orientation: "vertical" | "horizontal";
  /** Creator credit (CC BY-SA) — `handle · platformLabel`, present on every clip surface. */
  creator: { handle: string };
  platformLabel: string;
  /** Candidate only: the one-line match reason shown in place of the curation block. */
  matchReason?: string;
  /** Curated only: the full clip, for the shared curation block (chips / note / "context by"). */
  curated?: Clip;
}

export function MobilePlayerDock({
  kind,
  clip,
  signedIn = false,
  prefersReduced = false,
  onClose,
  onCurate,
  onJoin,
  onEdgeChange,
}: {
  kind: DockKind;
  clip: MobileDockClip;
  signedIn?: boolean;
  /** Reuse TopicView's existing reduced-motion signal — gates the dock-in + maximize (§9). */
  prefersReduced?: boolean;
  onClose: () => void;
  /** Candidate, logged out: routes the playing candidate into the gated curate flow. Absent → no CTA. */
  onCurate?: () => void;
  /** Curated, logged out: the topic-level join nudge through the `curate` gate. Absent → no CTA. */
  onJoin?: () => void;
  /** Reports the current parked edge up so TopicView can move the edge-aware page spacer (§6.6). */
  onEdgeChange?: (edge: "top" | "bottom") => void;
}) {
  // ── Internal layout state the dock owns (§12). Reset per open (a swap re-keys via the mount in
  //    TopicView keyed on the clip identity, so a fresh open / swap starts collapsed + bottom). ──
  const [edge, setEdge] = useState<"top" | "bottom">("bottom");
  const [maximized, setMaximized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const noteId = useId();

  const vertical = clip.orientation === "vertical";
  const embeddable = Boolean(clip.embedUrl);
  const src = embeddable
    ? clip.embedUrl! + (clip.embedUrl!.includes("?") ? "&" : "?") + "autoplay=1"
    : undefined;

  // Curated note is expandable only when there is a note to expand to (§5.3 empty-note guard);
  // candidates are never expandable (A2 — only a one-line match reason).
  const hasNote = kind === "curated" && Boolean(clip.curated?.contextNote);

  // ── Maximize-on-rotate (§6.5). Listen for landscape ONLY while the dock is open; toggle the
  //    `maximized` layout state (never requestFullscreen). Rotating back to portrait un-maximizes.
  //    The explicit ⤢ button below is the keyboard/AT/Short path. The listener is removed on
  //    unmount (= dismiss) so nothing fires when nothing is playing (§9 listener hygiene). ──
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(orientation: landscape)");
    const apply = (landscape: boolean) => setMaximized(landscape);
    // Seed from the current orientation (a clip opened already-landscape maximizes).
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggleEdge() {
    setEdge((prev) => {
      const next = prev === "bottom" ? "top" : "bottom";
      onEdgeChange?.(next);
      return next;
    });
  }

  // ── Frame sizing (§6.2/§6.3/§6.4). ──
  // Docked: 16:9 fills the full width (aspect-video, ~0.56·VW); 9:16 is height-capped at
  // min(45vh,420px) so a Short can't tower, centered + letterboxed on black. The vertical cap is
  // 45vh (not 55vh) so the frame + an expanded note fit within the dock height-cap (§6.2) at the
  // shortest in-scope width (360px) WITHOUT internal scroll in the common case; the dock-level cap
  // + internal scroll below is the hard guarantee for any note length / viewport.
  // Maximized: 16:9 fills the full landscape rectangle; 9:16 fills the full height upright,
  // centered/letterboxed — both via flex centering inside the inset-0 section.
  const frameClass = maximized
    ? vertical
      ? "mx-auto h-full w-auto bg-black [aspect-ratio:9/16] max-w-full"
      : "h-full w-full bg-black"
    : vertical
      ? "mx-auto w-auto bg-black [aspect-ratio:9/16]" +
        " h-[min(45vh,420px)] max-h-[min(45vh,420px)]"
      : "w-full bg-black aspect-video";

  const rootStyle: CSSProperties = {
    // Reserve the safe-area insets so chrome never hides under a notch / home indicator (§6.1).
    // Docked: pad the parked edge. Maximized (§6.3/§6.4): the condensed Close/Exit bar sits at the
    // very top/right edge, so pad top + right (and bottom) so it always clears a notch / curved
    // corner / home indicator in landscape — the safe area applies in BOTH layout modes.
    paddingTop: maximized
      ? "env(safe-area-inset-top)"
      : edge === "top"
        ? "env(safe-area-inset-top)"
        : undefined,
    paddingRight: maximized ? "env(safe-area-inset-right)" : undefined,
    paddingLeft: maximized ? "env(safe-area-inset-left)" : undefined,
    paddingBottom: maximized
      ? "env(safe-area-inset-bottom)"
      : edge === "bottom"
        ? "env(safe-area-inset-bottom)"
        : undefined,
    // Docked dock-height cap (§6.2 fit guarantee, the no-overflow safety net): the WHOLE dock can
    // never exceed the viewport minus the safe-area insets, so however tall the chrome + frame +
    // an expanded note sum, the bottom-pinned dock can't grow upward past the top edge and clip the
    // title bar (credit / Move / Maximize / Close) off-screen. The title bar is pinned and the
    // frame + supplemental/note region is the internal scroll area (the flex layout below) — the
    // same scroll-not-clip discipline PlayerModal uses. Maximized is inset-0, so no cap there.
    maxHeight: maximized
      ? undefined
      : "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
  };

  const rootClass =
    // Shared: a fixed layer below modals (z-40 < ModalShell z-50, §9), ink box, 2px ink border,
    // white-on-ink chrome. No backdrop, occupies only its own box (docked) or the whole viewport
    // (maximized). No offset shadow on mobile (it would clip at the viewport edge). A flex column in
    // BOTH modes so the title bar can be pinned and the body region scrolls within the height cap.
    "fixed z-40 flex flex-col border-2 border-ink bg-ink text-white" +
    (maximized
      ? // Maximized: the SAME section grows to fill the viewport (CSS, not native fullscreen).
        " inset-0"
      : // Docked: full-width bar pinned to the parked edge.
        " inset-x-0" + (edge === "top" ? " top-0" : " bottom-0")) +
    // Reduced-motion-gated dock-in (§9): class only when motion is allowed and not maximized
    // (a maximize fill has its own short ease; under reduce both are no-ops via globals.css).
    (prefersReduced || maximized ? "" : " pinned-dock-in");

  return (
    <section aria-label="Video player" style={rootStyle} className={rootClass}>
      {/* ── Title bar (shared, §5.1): ＋plus eyebrow + caption + creator credit (left) · the
          park / maximize / Close controls (right). White on ink ≈ 15:1 — clears AA/AAA. In
          maximized mode the chrome condenses to a thin Close bar (caption credit only; park
          hidden — §6.3/§6.4). PINNED (shrink-0) so the dock-height cap never scrolls or clips
          the credit / Move / Maximize / Close off-screen (§6.2 fit guarantee). ── */}
      <div className="flex shrink-0 items-start gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="plus-disp text-[11px] font-bold uppercase tracking-wide text-white/70">
            ＋plus
          </p>
          <p className="line-clamp-1 text-[13px] font-bold leading-snug text-white">
            {clip.caption}
          </p>
          {/* CC BY-SA creator credit — in the shared title bar, so present in EVERY state
              (collapsed, expanded, both maximized). CURATION §5.2. */}
          <p className="truncate text-[11px] text-white/70">
            {clip.creator.handle} · {clip.platformLabel}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {/* Maximize / Exit toggle (§6.5): glyph + WORD, so it is keyboard/AT-reachable and works
              for a vertical Short with no landscape trigger. Never calls requestFullscreen. */}
          <button
            type="button"
            onClick={() => setMaximized((m) => !m)}
            aria-label={
              maximized ? "Exit full-screen video" : "Maximize video to fill the screen"
            }
            className="px-2 py-1 text-sm font-semibold text-white hover:underline"
          >
            <span aria-hidden>⤢</span> {maximized ? "Exit" : "Maximize"}
          </button>
          {/* Park toggle (§7): names the DESTINATION; glyph + WORD (never glyph/color alone).
              Hidden in maximized mode (parking is meaningless when the dock is the screen). */}
          {!maximized && (
            <button
              type="button"
              onClick={toggleEdge}
              aria-label={
                edge === "bottom"
                  ? "Move player to top of screen"
                  : "Move player to bottom of screen"
              }
              className="px-2 py-1 text-sm font-semibold text-white hover:underline"
            >
              <span aria-hidden>{edge === "bottom" ? "⤒" : "⤓"}</span>{" "}
              {edge === "bottom" ? "Move to top" : "Move to bottom"}
            </button>
          )}
          {/* Close (shared, §5.1): glyph + WORD; tearing it down removes the dock + iframe. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video player"
            className="px-2 py-1 text-sm font-semibold text-white hover:underline"
          >
            <span aria-hidden>✕</span> Close
          </button>
        </div>
      </div>

      {/* ── Dock body (supplemental row + frame). Docked: the INTERNAL SCROLL AREA — `min-h-0
          flex-1 overflow-y-auto` under the pinned title bar and within the section's dock-height
          cap (§6.2). However tall the chrome + frame + an expanded note sum, the title bar stays
          visible and this region scrolls (Close / Move / Maximize / credit are never pushed
          off-screen). Maximized: `flex flex-1` so the inner frame-fill div fills the viewport. ── */}
      <div
        className={
          maximized ? "flex min-h-0 flex-1 flex-col" : "min-h-0 flex-1 overflow-y-auto"
        }
      >
      {/* ── Supplemental row (parameterized, §5.2). Hidden in maximized mode (the reader is
          watching, not reading — §6.3/§6.4); it returns on exit. ── */}
      {!maximized && (
        <div className="px-3 pb-2">
          {kind === "candidate" ? (
            <>
              {/* Candidate: the one-line match reason in place of a note (CURATION §6). */}
              {clip.matchReason && (
                <p className="line-clamp-2 text-[12px] leading-snug text-white/80">
                  {clip.matchReason}
                </p>
              )}
              {/* Logged-out: "✦ Curate this video" — solid brand fill, white bold, 2px ink border,
                  44px min target. Routes the playing candidate into the gated curate flow. */}
              {!signedIn && onCurate && (
                <button
                  type="button"
                  onClick={onCurate}
                  aria-haspopup="dialog"
                  aria-label="Curate this video — log in to write a context note and vouch for it"
                  className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center border-2 border-ink bg-brand px-3 py-1 text-[13px] font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
                >
                  <span aria-hidden>✦</span>&nbsp;Curate this video
                </button>
              )}
            </>
          ) : (
            <>
              {/* Curated collapsed curation block (§5.3): held marking (if held) → chips →
                  "Context ▸" expander. The credit lives in the title bar (the canonical mobile
                  credit), so the curation block's own credit/avatar is not duplicated here. */}
              {clip.curated?.held && (
                <p className="mb-2 flex items-center gap-1.5 border-l-[3px] border-white/50 pl-2 text-[10px] font-bold uppercase tracking-wide text-white/80">
                  <span className="sr-only">{HELD_ACCESSIBLE_NAME}</span>
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
                  <span aria-hidden>{HELD_EYEBROW}</span>
                </p>
              )}
              {clip.curated && (
                <CurationChips clip={clip.curated} className="flex flex-wrap gap-1.5" />
              )}
              {/* "Context ▸" expander — a real <button>; the WORD "Context" + a rotating caret
                  (shape, never color-alone); aria-expanded/aria-controls carry the state to AT.
                  Rendered only when there is a note to expand to (§5.3 empty-note guard). */}
              {hasNote && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  aria-expanded={expanded}
                  aria-controls={noteId}
                  className="mt-2 inline-flex items-center text-[12px] font-bold text-white hover:underline"
                >
                  Context <span aria-hidden className="ml-1">{expanded ? "▾" : "▸"}</span>
                </button>
              )}
              {/* Expanded: the full note panel (light surface) + "context by", scrolling inside a
                  bounded region so even a long note never grows the dock past its cap or pushes
                  Close/Move off-screen (§5.3 / §6.2). The frame keeps its size; playback continues. */}
              {hasNote && expanded && clip.curated && (
                <div
                  id={noteId}
                  className="mt-2 max-h-[min(40vh,320px)] overflow-y-auto border-2 border-ink bg-white p-3 text-left"
                >
                  <CuratorNote clip={clip.curated} />
                  <CurationContextBy clip={clip.curated} />
                </div>
              )}
              {/* Logged-out curated: the softer topic-level join nudge — white fill, 2px ink border,
                  bold ink text, 44px min target. Routes through the same `curate` gate. */}
              {!signedIn && onJoin && (
                <button
                  type="button"
                  onClick={onJoin}
                  aria-haspopup="dialog"
                  className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center border-2 border-ink bg-white px-3 py-1 text-[13px] font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C]"
                >
                  Log in to curate videos for this topic
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Video frame (shared, §5.1): black backing; the iframe (autoplay) at the
          orientation-correct size, OR — for a curated clip with no embedUrl — the
          "can't be embedded" message (the curation block above still renders). iframe attrs reused
          VERBATIM from PlayerModal / PinnedPlayer. In maximized mode the frame flexes to fill. ── */}
      <div className={maximized ? "flex flex-1 items-center justify-center bg-black" : ""}>
        <div className={frameClass}>
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
      </div>
    </section>
  );
}
