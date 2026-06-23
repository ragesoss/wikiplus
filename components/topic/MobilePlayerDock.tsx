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

// The unified, SLIM MOBILE video player (issue #120 / #135 lineage; slim default #123 coherence).
// Design: docs/design/mobile-player-slim.md (THE contract — the locked one-row slim model) +
// docs/design/unified-player-mobile.md (#120) + docs/design/mobile-player-launch.md (#135) for the
// preserved invariants.
//
// ONE non-modal, movable, viewport-fit player used on mobile (< lg) for ANY video — curated or
// candidate. THE SLIM MODEL (spec §1): a playing mobile video is the video frame PLUS ONE thin 46px
// control row of four equal glyph-above-word cells — Close · Move · Curate · See context — and
// nothing else in the default chrome. No caption, creator, description, or chips appear in the
// default: all metadata lives behind the See context expander, all curation behind the Curate
// expander. The reader keeps reading the article beside the picture while the clip plays.
//
// FRAME-FIRST (spec §0.1, carried from #135). The dock is a fixed flex column
// `[frame: shrink-0] → [control bar: shrink-0] → [expander region: flex-1 min-h-0 overflow-y-auto]`.
// The frame and bar NEVER shrink or scroll; the expander region (an open Curate or See context body)
// is the SOLE scroll area. The order is identical top- and bottom-parked (only which viewport edge
// the whole dock hugs changes). The dock is bounded at `88dvh − insets` (spec §6.2) — with the slim
// default this is NON-BINDING (the default dock is far below it, ~69% article visible for a 16:9
// clip); the cap only ever engages when an open expander's body exceeds the budget, and then the
// expander body scrolls while the frame + bar stay pinned.
//
// NON-MODAL contract (spec §0.1, carried from PinnedPlayer): a labeled `<section aria-label="Video
// player">` landmark — NOT role=dialog, NO aria-modal, NO focus trap, NO backdrop, NO autofocus /
// focus-steal on open, NOT routed through ModalShell. The two reveals (Curate, See context) are
// INLINE EXPANDERS inside this section — never bottom-sheets — so they introduce no modal layer
// (spec §3.1). The iframe is created on mount (= an explicit play click in TopicView) and torn down
// on unmount (= on dismiss / state → null), preserving the embed-never-host facade. A second play
// SWAPS in place (TopicView re-sets the single `mobileDock` state), so React updates `src` rather
// than remounting — playback is never interrupted.
//
// MAXIMIZE is CSS-only + AUTOMATIC (spec §5): there is NO custom Maximize/fullscreen control. The
// embed's own native-fullscreen button inside the iframe owns the explicit path (`allowFullScreen`).
// Rotate-to-maximize stays automatic: while the dock is open an orientationchange to landscape flips
// the SAME `<section>` + SAME iframe to `fixed inset-0` via CSS (never `requestFullscreen`); rotating
// back to portrait restores the slim dock. In landscape the four-cell bar is hidden while the video
// fills the screen, and a thin Close remains reachable.

export type DockKind = "curated" | "candidate";

/** What the dock reports up so TopicView can reserve the right amount of page scroll space at the
 *  parked edge (spec §0.1 / §6.4). `height` is the dock's measured rendered height in CSS pixels;
 *  `docked` is false while maximized (which fills the viewport and needs no spacer). The collapsed
 *  slim default reports a small height (frame + 46px bar); opening a reveal grows it. */
export interface DockMetrics {
  edge: "top" | "bottom";
  height: number;
  docked: boolean;
}

/**
 * The playable + supplemental payload the dock renders. It carries everything for BOTH kinds; the
 * reveals read only the fields their `kind` needs. `Clip` and `Candidate` both already carry these,
 * so TopicView assembles this directly (no data-model change — #120).
 */
export interface MobileDockClip {
  /** YouTube embed URL. Required for a candidate (it never opens the dock without one); a curated
   *  clip MAY lack it (then the frame shows the "can't be embedded" message + the note). */
  embedUrl?: string;
  caption: string;
  orientation: "vertical" | "horizontal";
  /** Creator credit — `handle · platformLabel`, shown only inside the See context reveal (spec §4).
   *  A reference norm on a nonfree third-party embed; not a CC BY-SA obligation (CURATION §5/§5.2). */
  creator: { handle: string };
  platformLabel: string;
  /** Candidate only: the one-line match reason shown under "Why suggested" in See context. */
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
  onDismiss,
  onJoin,
  onEdgeChange,
  onDockMetrics,
}: {
  kind: DockKind;
  clip: MobileDockClip;
  signedIn?: boolean;
  /** Reuse TopicView's existing reduced-motion signal — gates the dock-in + maximize (spec §8). */
  prefersReduced?: boolean;
  onClose: () => void;
  /** The Curate action for the playing clip (spec §3). Signed-in candidate → routes to the curate
   *  flow (CurateModal / `curate` gate); logged-out candidate → the gated login flow. Bound by
   *  TopicView to `promote(candidate)`. Absent → no Curate action rendered. */
  onCurate?: () => void;
  /** Signed-in candidate only (spec §3.2): the Not-relevant action → the existing optimistic-hide +
   *  rollback dismiss; TopicView then closes the dock + focuses the band heading (desktop #123 State
   *  L). Bound to `dismiss(candidate)`. Rendered only when `signedIn && onCurate && onDismiss`. */
  onDismiss?: () => void;
  /** Curated, logged out: the topic-level join nudge through the `curate` gate. Absent → no CTA. */
  onJoin?: () => void;
  /** Reports the current parked edge up so TopicView can move the edge-aware page spacer (spec §2.2). */
  onEdgeChange?: (edge: "top" | "bottom") => void;
  /** Reports the dock's measured rendered height (+ edge) up so TopicView reserves EXACTLY that
   *  much scroll space at the parked edge (spec §0.1 / §6.4 — the spacer is the dock's actual
   *  height, not a fixed guess). Fires on mount and whenever the dock resizes (reveal open/close,
   *  swap, park). */
  onDockMetrics?: (m: DockMetrics) => void;
}) {
  // ── Internal layout state the dock owns. Reset per open (a swap re-keys via the mount in
  //    TopicView keyed on the clip identity, so a fresh open / swap starts collapsed + bottom). ──
  const [edge, setEdge] = useState<"top" | "bottom">("bottom");
  const [maximized, setMaximized] = useState(false);
  // The two inline reveals (spec §3/§4). At most ONE is open at a time (spec §8): opening one closes
  // the other. `null` = the slim default (no reveal); otherwise which expander body is shown.
  const [reveal, setReveal] = useState<null | "curate" | "context">(null);
  const curateId = useId();
  const contextId = useId();
  const rootRef = useRef<HTMLElement | null>(null);

  const vertical = clip.orientation === "vertical";
  const embeddable = Boolean(clip.embedUrl);
  const src = embeddable
    ? clip.embedUrl! + (clip.embedUrl!.includes("?") ? "&" : "?") + "autoplay=1"
    : undefined;

  const curatedClip = kind === "curated" ? clip.curated : undefined;
  const hasNote = Boolean(curatedClip?.contextNote);

  // Toggle a reveal: re-activating the open one closes it; opening one closes the other (spec §8 —
  // only one open at a time). No focus-steal (spec §8): toggling never autofocuses into the body.
  function toggleReveal(which: "curate" | "context") {
    setReveal((prev) => (prev === which ? null : which));
  }

  // ── Maximize-on-rotate (spec §5). Listen for landscape ONLY while the dock is open; toggle the
  //    `maximized` layout state (never requestFullscreen). Rotating back to portrait un-maximizes.
  //    There is no custom maximize button — this is the only maximize trigger besides the embed's
  //    own native-fullscreen button. The listener is removed on unmount (= dismiss) so nothing fires
  //    when nothing is playing (listener hygiene). Open-seed sanity: the mount-time seed reads the
  //    CURRENT orientation, so a clip opened in PORTRAIT opens DOCKED (mq.matches is false in
  //    portrait); only an already-landscape open maximizes, and a real rotation maximizes thereafter. ──
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(orientation: landscape)");
    const apply = (landscape: boolean) => setMaximized(landscape);
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ── Measured-height report (spec §6.4). The dock observes its own rendered height and reports it
  //    (with the current edge) up to TopicView, which reserves EXACTLY that much scroll space at the
  //    parked edge. A ResizeObserver fires on mount + on every height change (a reveal open/close, a
  //    swap to a different-aspect clip, a park to the other edge), so the spacer tracks the dock
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
  }, [onDockMetrics, edge, maximized, reveal, kind, clip, signedIn]);

  function toggleEdge() {
    setEdge((prev) => {
      const next = prev === "bottom" ? "top" : "bottom";
      onEdgeChange?.(next);
      return next;
    });
  }

  // ── Frame sizing (spec §6.2, #120 §6.3/§6.4). ──
  // Docked: 16:9 fills the full width (aspect-video, ~0.56·VW); 9:16 is height-capped at
  // min(46vh,380px) so a Short can't tower, centered + letterboxed on black. The frame is `shrink-0`
  // in the docked column (the reveal region is the sole scroll area), so it is never compressed or
  // clipped. Maximized: 16:9 fills the full landscape rectangle; 9:16 fills the full height upright,
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
    // Reserve the safe-area insets so chrome never hides under a notch / home indicator.
    // Docked: pad the parked edge. Maximized: the condensed Close bar sits at the top/right edge, so
    // pad top + right (and bottom) so it always clears a notch / curved corner / home indicator.
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
    // Docked dock-height CEILING (spec §6.2): the WHOLE dock can never exceed 88dvh minus the
    // safe-area insets — NOT 100dvh. This guarantees ≥ 12dvh of article always visible at the
    // un-parked edge. With the slim default it is NON-BINDING (the default dock is far below it); it
    // only engages when an open reveal's body would exceed the budget, and then the REVEAL REGION
    // scrolls inside it (the frame + bar are `shrink-0` and stay pinned). `dvh` tracks the visual
    // viewport as mobile browser chrome shows/hides. Maximized is inset-0, so no cap there.
    maxHeight: maximized
      ? undefined
      : "calc(88dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
  };

  const rootClass =
    // Shared: a fixed layer below modals (z-40 < ModalShell z-50, spec §8), ink box, 2px ink border,
    // white-on-ink chrome. No backdrop, occupies only its own box (docked) or the whole viewport
    // (maximized). A flex column in BOTH modes so the frame + bar stay pinned (shrink-0) and the
    // reveal region scrolls within the height cap.
    "fixed z-40 flex flex-col border-2 border-ink bg-ink text-white" +
    (maximized
      ? " inset-0"
      : " inset-x-0" + (edge === "top" ? " top-0" : " bottom-0")) +
    (prefersReduced || maximized ? "" : " pinned-dock-in");

  // ── The video frame (shared, the hero — spec §1/§2): black backing; the iframe (autoplay) at the
  //    orientation-correct size, OR — for a curated clip with no embedUrl — the "can't be embedded"
  //    message (the reveals below still work). iframe attrs reused VERBATIM from PlayerModal /
  //    PinnedPlayer; `allowFullScreen` keeps the embed's OWN native-fullscreen button (spec §5).
  //    `shrink-0` so the frame is NEVER compressed or scrolled. A `data-dock-frame` hook lets the
  //    fit e2e measure this exact box. In maximized mode the frame flexes to fill. ──
  const frame = (
    <div
      data-dock-frame
      className={
        maximized ? "flex flex-1 items-center justify-center bg-black" : "shrink-0"
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

  // ── The four-cell control bar (spec §2.1/§2.6) — the WHOLE default chrome. ONE 46px row of four
  //    equal-width cells, each a real ≥46px `<button>` laid out glyph-above-word: a small plain
  //    `aria-hidden` glyph stacked over a full WORD (the affordance + accessible name; never
  //    glyph/color-alone). Order: Close · Move · Curate · See context. `flex-wrap` is the long-locale
  //    2×2 overflow fallback only (spec §2.5) — at every in-scope English width this is one row. The
  //    bar is `shrink-0` and the edge-most-after-frame row. Curate / See context are the inline
  //    expander triggers (aria-expanded / aria-controls). In maximized mode the bar is hidden (the
  //    video fills the screen); only a thin Close remains reachable. AA: white-on-ink (≈15:1); the
  //    global :focus-visible ring applies; no gold. ──
  const cellClass =
    "flex min-h-[46px] min-w-[46px] flex-1 basis-[46px] flex-col items-center justify-center gap-0.5 px-1 py-1 text-center text-[11px] font-semibold leading-tight text-white hover:bg-white/10";
  const controlBar = !maximized && (
    <div className="flex shrink-0 flex-row flex-wrap border-t border-white/15">
      {/* Close — tears down the dock + iframe (playback stops). */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close video player"
        className={cellClass}
      >
        <span aria-hidden className="text-base leading-none">✕</span>
        <span>Close</span>
      </button>
      {/* Move — the park toggle; the WORD names the DESTINATION (spec §2.3). */}
      <button
        type="button"
        onClick={toggleEdge}
        aria-label={
          edge === "bottom"
            ? "Move player to top of screen"
            : "Move player to bottom of screen"
        }
        className={cellClass}
      >
        <span aria-hidden className="text-base leading-none">⇅</span>
        <span>{edge === "bottom" ? "Move to top" : "Move to bottom"}</span>
      </button>
      {/* Curate — inline expander revealing the curation directions (spec §3). */}
      <button
        type="button"
        onClick={() => toggleReveal("curate")}
        aria-expanded={reveal === "curate"}
        aria-controls={curateId}
        aria-label="Curate"
        className={cellClass}
      >
        <span aria-hidden className="text-base leading-none">✦</span>
        <span>Curate</span>
      </button>
      {/* See context — inline expander revealing all metadata (spec §4). */}
      <button
        type="button"
        onClick={() => toggleReveal("context")}
        aria-expanded={reveal === "context"}
        aria-controls={contextId}
        aria-label="See context"
        className={cellClass}
      >
        <span aria-hidden className="text-base leading-none">ⓘ</span>
        <span>See context</span>
      </button>
    </div>
  );

  // ── The condensed maximized Close (spec §5) — in maximized/landscape the four-cell bar is hidden
  //    so the video fills the screen, but a thin Close stays reachable so the reader is NEVER stuck.
  //    Same handler + `aria-label` as the bar's Close cell; glyph-above-word (never glyph-alone),
  //    ≥44px target, top/right against the safe-area insets (reserved on the root in maximized mode),
  //    the global :focus-visible ring. Non-modal contract preserved (no focus-steal). ──
  const maximizedClose = maximized && (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close video player"
      className="absolute right-2 top-2 z-10 flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded bg-black/60 px-2 py-1 text-center text-[11px] font-semibold leading-tight text-white hover:bg-black/80"
    >
      <span aria-hidden className="text-base leading-none">✕</span>
      <span>Close</span>
    </button>
  );

  // ── The Curate reveal (spec §3) — the "act". Reuses the desktop #123 treatment, microcopy, and
  //    aria-labels verbatim so mobile + desktop read as one family. Candidate signed-in → ✦ Curate
  //    (brand-primary, leads) + ✕ Not relevant (quiet secondary); candidate logged-out → a single
  //    ✦ Curate this video CTA, NO dismiss (a logged-out dismiss can't honestly optimistic-hide —
  //    spec §3.3, desktop #123 State J); curated → the #65 vote/manage slot (placement only — this
  //    pass renders the existing curated affordance or, absent one, an empty-state line; it does NOT
  //    build voting). ──
  const curateBody = (
    <div className="border-t border-white/15 px-3 pb-3 pt-2">
      {kind === "candidate" ? (
        signedIn && onCurate && onDismiss ? (
          <div className="flex flex-wrap gap-2">
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
          // Candidate, logged out: a single gated CTA, no dismiss (spec §3.3).
          onCurate && (
            <button
              type="button"
              onClick={onCurate}
              aria-haspopup="dialog"
              aria-label="Curate this video — log in to write a context note and vouch for it"
              className="inline-flex min-h-[44px] w-full items-center justify-center border-2 border-ink bg-brand px-3 py-1 text-[13px] font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
            >
              <span aria-hidden>✦</span>&nbsp;Curate this video
            </button>
          )
        )
      ) : (
        // Curated: the #65 vote/manage "act" slot (placement only — spec §3.4). Voting mechanics are
        // owned by #65 and out of scope here; render the logged-out join nudge in this slot when
        // logged out, else an empty-state line so the slot is never blank.
        <>
          {!signedIn && onJoin ? (
            <button
              type="button"
              onClick={onJoin}
              aria-haspopup="dialog"
              className="inline-flex min-h-[44px] w-full items-center justify-center border-2 border-ink bg-white px-3 py-1 text-[13px] font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C]"
            >
              Log in to curate videos for this topic
            </button>
          ) : (
            <p className="text-[12px] leading-snug text-white/70">
              Voting and manage controls appear here.
            </p>
          )}
        </>
      )}
    </div>
  );

  // ── The See context reveal (spec §4) — ALL metadata. Caption, creator credit (the ONLY place the
  //    creator appears — spec §4/§9), and the why/note/chips. Candidate → caption · creator · "Why
  //    suggested" match reason. Curated → caption · creator · held marking (if held) · chips ·
  //    "Context note" · "Context by @curator". The note panel is bounded so a long note scrolls
  //    inside the reveal body. The creator credit is a plain reference norm — no "(CC BY-SA)" framing
  //    (CURATION §5/§5.2). ──
  const contextBody = (
    <div className="border-t border-white/15 px-3 pb-3 pt-2 text-left">
      <p className="text-[13px] font-bold leading-snug text-white">
        {clip.caption}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-white/70">
        {clip.creator.handle} · {clip.platformLabel}
      </p>
      {kind === "candidate" ? (
        clip.matchReason && (
          <div className="mt-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">
              Why suggested
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-white/80">
              {clip.matchReason}
            </p>
          </div>
        )
      ) : (
        curatedClip && (
          <>
            {curatedClip.held && (
              <p className="mt-3 flex items-center gap-1.5 border-l-[3px] border-white/50 pl-2 text-[10px] font-bold uppercase tracking-wide text-white/80">
                <span className="sr-only">{HELD_ACCESSIBLE_NAME}</span>
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/60"
                />
                <span aria-hidden>{HELD_EYEBROW}</span>
              </p>
            )}
            <CurationChips
              clip={curatedClip}
              className="mt-3 flex flex-nowrap gap-1.5 overflow-x-auto"
            />
            {hasNote && (
              <div className="mt-3 max-h-[min(40vh,320px)] overflow-y-auto border-2 border-ink bg-white p-3">
                <CuratorNote clip={curatedClip} />
                <CurationContextBy clip={curatedClip} />
              </div>
            )}
          </>
        )
      )}
    </div>
  );

  // ── The reveal region (spec §0.1) — the SOLE `overflow-y-auto` scroll area (`flex-1 min-h-0`):
  //    when the dock's height ceiling engages, THIS is what scrolls — never the frame, never the
  //    bar. It holds the open reveal's body (Curate or See context); the collapsed default has no
  //    body, so the slim default is frame + bar only. DOM order places each body adjacent to its
  //    trigger's grammar (Curate before See context) so visual + tab order agree (spec §8). Hidden
  //    in maximized mode (the reader is watching, not reading); it returns on exit. ──
  const revealRegion = !maximized && reveal && (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {reveal === "curate" && (
        <div id={curateId}>{curateBody}</div>
      )}
      {reveal === "context" && (
        <div id={contextId}>{contextBody}</div>
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
      {/* Fixed flex column. DOCKED order (identical top- and bottom-parked — spec §2.2): frame
          (shrink-0, the hero) → the four-cell control bar (shrink-0) → the reveal region (flex-1
          min-h-0 overflow-y-auto, the sole scroll area, present only when a reveal is open).
          MAXIMIZED: the frame flexes to fill; the bar + reveals are hidden, but a thin condensed
          Close stays reachable (spec §5) so the reader is never stuck. */}
      {frame}
      {maximizedClose}
      {controlBar}
      {revealRegion}
    </section>
  );
}
