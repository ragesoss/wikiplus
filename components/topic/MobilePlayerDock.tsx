"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Clip } from "@/lib/data/types";
import {
  CurationChips,
  CuratorNote,
  CurationContextBy,
} from "./CurationBlock";
import { HELD_ACCESSIBLE_NAME, HELD_EYEBROW } from "./HeldMarking";

// The unified MOBILE video player (issue #120, launch correction issue #135).
// Design: docs/design/unified-player-mobile.md (the #120 contract) + docs/design/mobile-player-launch.md
// (the #135 launch correction — frame-first, fully visible on open, genuinely bounded).
//
// ONE non-modal, movable, viewport-fit player used on mobile (< lg) for ANY video — curated or
// candidate. It generalizes the candidate `PinnedPlayer` into a single component whose supplemental
// info + action buttons parameterize by (kind: curated | candidate) × (signedIn). Everything else —
// frame, credit, Close, the park toggle, the maximize-on-rotate behavior, the non-modal contract —
// is shared and identical for every clip.
//
// FRAME-FIRST LAUNCH (#135, design §1.1). On open the video frame is the hero: the dock is a fixed
// flex column `[slim title bar: shrink-0] → [frame: shrink-0] → [secondary region: flex-1 min-h-0
// overflow-y-auto]`. The frame and title bar NEVER shrink or scroll; the secondary region (chips ·
// "Context ▸" · CTA · the expanded note) is the SOLE scroll area. The order is identical top- and
// bottom-parked (only which viewport edge the whole bar hugs changes). The dock is bounded at
// `88dvh − insets` (design §2.6), so it can never fill the viewport — a meaningful article slice
// always remains. The frame being `shrink-0` + the secondary region being the only scroll area is
// the corrected fit invariant: the cap protects the article slice AND the frame at once.
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

/** What the dock reports up so TopicView can reserve the right amount of page scroll space at the
 *  parked edge (design §3). `height` is the dock's measured rendered height in CSS pixels;
 *  `docked` is false while maximized (which fills the viewport and needs no spacer). */
export interface DockMetrics {
  edge: "top" | "bottom";
  height: number;
  docked: boolean;
}

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
  onDockMetrics,
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
  /** Reports the dock's measured rendered height (+ edge) up so TopicView reserves EXACTLY that
   *  much scroll space at the parked edge (design §3 — the spacer is the dock's actual height, not
   *  a fixed guess). Fires on mount and whenever the dock resizes (expand/collapse, swap, park). */
  onDockMetrics?: (m: DockMetrics) => void;
}) {
  // ── Internal layout state the dock owns (§12). Reset per open (a swap re-keys via the mount in
  //    TopicView keyed on the clip identity, so a fresh open / swap starts collapsed + bottom). ──
  const [edge, setEdge] = useState<"top" | "bottom">("bottom");
  const [maximized, setMaximized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const noteId = useId();
  const rootRef = useRef<HTMLElement | null>(null);

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
  //    unmount (= dismiss) so nothing fires when nothing is playing (§9 listener hygiene).
  //    AC-7 (open-seed sanity): the mount-time seed reads the CURRENT orientation, so a clip
  //    opened in PORTRAIT opens DOCKED (mq.matches is false in portrait) — only an already-landscape
  //    open maximizes, and a real rotation maximizes thereafter (unchanged from #120). ──
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(orientation: landscape)");
    const apply = (landscape: boolean) => setMaximized(landscape);
    // Seed from the current orientation (a clip opened already-landscape maximizes; portrait docks).
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ── Measured-height report (design §3). The dock observes its own rendered height and reports it
  //    (with the current edge) up to TopicView, which reserves EXACTLY that much scroll space at the
  //    parked edge. A ResizeObserver fires on mount + on every height change (expand/collapse the
  //    note, swap to a different-aspect clip, park to the other edge), so the spacer tracks the dock
  //    live; on dismiss the dock unmounts and TopicView clears the spacer. Maximized is inset-0 and
  //    needs no spacer, so we report 0 while maximized (TopicView drops the spacer then). ──
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !onDockMetrics) return;
    if (maximized) {
      onDockMetrics({ edge, height: 0, docked: false });
      return;
    }
    const report = () =>
      onDockMetrics({
        edge,
        height: Math.ceil(el.getBoundingClientRect().height),
        docked: true,
      });
    report();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onDockMetrics, edge, maximized, expanded, kind, clip, signedIn]);

  function toggleEdge() {
    setEdge((prev) => {
      const next = prev === "bottom" ? "top" : "bottom";
      onEdgeChange?.(next);
      return next;
    });
  }

  // ── Frame sizing (design §2.2/§2.3, #120 §6.3/§6.4). ──
  // Docked: 16:9 fills the full width (aspect-video, ~0.56·VW); 9:16 is height-capped at
  // min(46vh,380px) so a Short can't tower, centered + letterboxed on black. The 46vh cap (with the
  // slim title bar + a one-line secondary strip) keeps the whole dock clear of the in-scope 780px
  // stress viewport with a meaningful article slice (design §2.3/§2.5). The frame is `shrink-0` in
  // the docked column (the secondary region is the sole scroll area — §2.4), so the frame is never
  // compressed or clipped.
  // Maximized: 16:9 fills the full landscape rectangle; 9:16 fills the full height upright,
  // centered/letterboxed — both via flex centering inside the inset-0 section.
  const frameClass = maximized
    ? vertical
      ? "mx-auto h-full w-auto bg-black [aspect-ratio:9/16] max-w-full"
      : "h-full w-full bg-black"
    : vertical
      ? "mx-auto w-auto bg-black [aspect-ratio:9/16]" +
        " h-[min(46vh,380px)] max-h-[min(46vh,380px)]"
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
    // Docked dock-height CEILING (design §2.6, the corrected bound): the WHOLE dock can never exceed
    // 88dvh minus the safe-area insets — NOT 100dvh. This guarantees ≥ 12dvh of article always
    // visible at the un-parked edge, so the dock can never fill the viewport (AC-2). It is a
    // ceiling, not the normal height: at every in-scope width the content height is far below it, so
    // the dock sizes to its content; the cap only engages on a pathologically short viewport or a
    // very long expanded note, and even then the SECONDARY REGION scrolls inside it (the frame +
    // title bar are `shrink-0` and stay pinned/visible — AC-1). `dvh` tracks the visual viewport as
    // mobile browser chrome shows/hides, so the dock is never clipped by a retracting URL bar.
    // Maximized is inset-0, so no cap there.
    maxHeight: maximized
      ? undefined
      : "calc(88dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
  };

  const rootClass =
    // Shared: a fixed layer below modals (z-40 < ModalShell z-50, §9), ink box, 2px ink border,
    // white-on-ink chrome. No backdrop, occupies only its own box (docked) or the whole viewport
    // (maximized). No offset shadow on mobile (it would clip at the viewport edge). A flex column in
    // BOTH modes so the title bar + frame stay pinned (shrink-0) and the secondary region scrolls
    // within the height cap.
    "fixed z-40 flex flex-col border-2 border-ink bg-ink text-white" +
    (maximized
      ? // Maximized: the SAME section grows to fill the viewport (CSS, not native fullscreen).
        " inset-0"
      : // Docked: full-width bar pinned to the parked edge.
        " inset-x-0" + (edge === "top" ? " top-0" : " bottom-0")) +
    // Reduced-motion-gated dock-in (§9): class only when motion is allowed and not maximized
    // (a maximize fill has its own short ease; under reduce both are no-ops via globals.css).
    (prefersReduced || maximized ? "" : " pinned-dock-in");

  // ── The slim title bar (shared, design §1.3/§1.4). Frame-first launch: this is the ONLY chrome
  //    ABOVE the frame — ~56–64px, two clamped text lines (eyebrow+caption / creator credit) on the
  //    left, and ONE compact horizontal controls row (Maximize · Move · Close), right-aligned, on
  //    the right. Each control stays a separate focusable <button> with a 44px touch target (the
  //    inline padding); collapsing them into a row does NOT merge them. PINNED (`shrink-0`) so the
  //    height cap never scrolls or clips the credit / Move / Maximize / Close off-screen. The
  //    creator credit lives here, present in EVERY state (collapsed, expanded, top-parked, candidate,
  //    no-embed) — AC-4. In maximized mode the chrome condenses to a thin Close bar (credit caption;
  //    park hidden — §6.3/§6.4). ──
  const titleBar = (
    <div className="flex shrink-0 items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        {/* Eyebrow + caption share ONE clamped line to save vertical space (design §1.3.2). */}
        <p className="line-clamp-1 text-[13px] font-bold leading-snug text-white">
          <span className="plus-disp mr-1.5 text-[11px] font-bold uppercase tracking-wide text-white/70">
            ＋plus
          </span>
          {clip.caption}
        </p>
        {/* CC BY-SA creator credit — present in EVERY state (AC-4). CURATION §5.2. */}
        <p className="truncate text-[11px] text-white/70">
          {clip.creator.handle} · {clip.platformLabel}
        </p>
      </div>
      {/* The ONE compact horizontal controls row (design §1.3.1) — right-aligned, vertically
          centered against the two text lines. Maximize · (Move) · Close, each a separate
          focusable <button> with a 44px min target. */}
      <div className="flex shrink-0 flex-row items-center gap-1">
        {/* Maximize / Exit toggle (§6.5): glyph + WORD, so it is keyboard/AT-reachable and works
            for a vertical Short with no landscape trigger. Never calls requestFullscreen. */}
        <button
          type="button"
          onClick={() => setMaximized((m) => !m)}
          aria-label={
            maximized ? "Exit full-screen video" : "Maximize video to fill the screen"
          }
          className="inline-flex min-h-[44px] items-center px-2 py-1 text-sm font-semibold text-white hover:underline"
        >
          <span aria-hidden>⤢</span>&nbsp;{maximized ? "Exit" : "Maximize"}
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
            className="inline-flex min-h-[44px] items-center px-2 py-1 text-sm font-semibold text-white hover:underline"
          >
            <span aria-hidden>{edge === "bottom" ? "⤒" : "⤓"}</span>&nbsp;
            {edge === "bottom" ? "Move to top" : "Move to bottom"}
          </button>
        )}
        {/* Close (shared, §5.1): glyph + WORD; tearing it down removes the dock + iframe. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close video player"
          className="inline-flex min-h-[44px] items-center px-2 py-1 text-sm font-semibold text-white hover:underline"
        >
          <span aria-hidden>✕</span>&nbsp;Close
        </button>
      </div>
    </div>
  );

  // ── The video frame (shared, design §1.1 the hero / #120 §5.1): black backing; the iframe
  //    (autoplay) at the orientation-correct size, OR — for a curated clip with no embedUrl — the
  //    "can't be embedded" message (the secondary region below still renders). iframe attrs reused
  //    VERBATIM from PlayerModal / PinnedPlayer. `shrink-0` in the docked column so the frame is
  //    NEVER compressed or scrolled (AC-1). A `data-dock-frame` hook lets the fit e2e measure this
  //    exact box (AC-9). In maximized mode the frame flexes to fill. ──
  const frame = (
    <div
      data-dock-frame
      className={
        maximized
          ? "flex flex-1 items-center justify-center bg-black"
          : "shrink-0"
      }
    >
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
  );

  // ── The secondary region (parameterized, design §1.3/§2.4). Frame-first launch: everything that
  //    is NOT the frame or the title bar lives BELOW the frame here — chips + "Context ▸" (curated)
  //    or the match reason (candidate), plus the logged-out CTA, plus the expanded note. This is the
  //    SOLE `overflow-y-auto` area (`flex-1 min-h-0`): when the dock's height ceiling engages, THIS
  //    is what scrolls — never the frame, never the title bar. At launch its content is short and
  //    shows in full without scrolling at every in-scope width. Hidden in maximized mode (the reader
  //    is watching, not reading — §6.3/§6.4); it returns on exit. ──
  const secondary = !maximized && (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-2">
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
              "Context ▸" expander, now BELOW the frame. The credit lives in the title bar (the
              canonical mobile credit), so the curation block's own credit/avatar is not duplicated. */}
          {clip.curated?.held && (
            <p className="mb-2 flex items-center gap-1.5 border-l-[3px] border-white/50 pl-2 text-[10px] font-bold uppercase tracking-wide text-white/80">
              <span className="sr-only">{HELD_ACCESSIBLE_NAME}</span>
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
              <span aria-hidden>{HELD_EYEBROW}</span>
            </p>
          )}
          {/* Chips as a compact one-line strip (design §1.3.3): `flex-nowrap` on one line, may
              scroll horizontally if a held marking + two chips overflow a narrow width (rare); they
              never stack into multiple rows at launch. */}
          {clip.curated && (
            <CurationChips
              clip={clip.curated}
              className="flex flex-nowrap gap-1.5 overflow-x-auto"
            />
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
          {/* Expanded: the full note panel (light surface) + "context by", scrolling inside its own
              bounded region so even a long note never grows the dock past its cap. The note panel
              scrolls within the (already-scrollable) secondary region; the FRAME stays its size and
              stays fully visible above (it is `shrink-0`), and the title bar stays pinned. */}
          {hasNote && expanded && clip.curated && (
            <div
              id={noteId}
              className="mt-2 max-h-[min(40vh,320px)] overflow-y-auto border-2 border-ink bg-white p-3 text-left"
            >
              <CuratorNote clip={clip.curated} />
              <CurationContextBy clip={clip.curated} />
            </div>
          )}
          {/* Logged-out curated: the softer topic-level join nudge, now BELOW the frame — white
              fill, 2px ink border, bold ink text, 44px min target. Routes through the `curate` gate. */}
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
  );

  return (
    <section
      ref={rootRef}
      aria-label="Video player"
      style={rootStyle}
      className={rootClass}
    >
      {/* Fixed flex column. DOCKED order (identical top- and bottom-parked — design §1.1): slim
          title bar (shrink-0) → frame (shrink-0, the hero) → secondary region (flex-1 min-h-0
          overflow-y-auto, the sole scroll area). MAXIMIZED: the title bar condenses + the frame
          flexes to fill; the secondary region is hidden. */}
      {titleBar}
      {frame}
      {secondary}
    </section>
  );
}
