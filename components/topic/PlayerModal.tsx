"use client";

import type { Clip } from "@/lib/data/types";
import { CurationBlock } from "./CurationBlock";
import { ModalShell } from "./ModalShell";

// Player modal (design §5.8 / AC11; issue #63 §4). The iframe is created ON OPEN (this
// component only mounts when a clip is activated) and removed on close — no embed loads
// on initial page render. Autoplay is set since the user explicitly clicked play.
//
// Issue #63 (§4): the modal renders a CURATION BLOCK beneath the video frame for any curated
// clip — the rail `ClipCard`'s chips + full "Curator note" + "context by" footer, lifted into the
// player (minus the upvote/manage rows — the player is a read-only viewing surface). The block is
// the shared `CurationBlock` (the single source of truth shared with the mobile `MobilePlayerDock`
// — issue #120). To render it the player needs the curation fields, so `PlayerClip` is the full
// `Clip` (A1 — the `player` state at every mount site is already a `Clip`, so this is a pure
// render change, no new data fetch). The block lives INSIDE `ModalShell` (so it is inside the
// existing focus trap / Esc / backdrop / focus-return — §7.4) and BELOW the frame (the video stays
// the primary element). It still renders when the clip "can't be embedded" (§6).
export type PlayerClip = Clip;

export function PlayerModal({
  clip,
  onClose,
  signedIn = false,
  onJoin,
}: {
  clip: PlayerClip;
  onClose: () => void;
  /**
   * #71 §7: is the viewer signed in. The logged-out "Log in to curate videos for this topic" join
   * nudge renders only when `!signedIn && onJoin`; signed in the modal is the unchanged read-only
   * viewing surface (AC7).
   */
  signedIn?: boolean;
  /**
   * #71 §7: routes the logged-out join nudge through the existing `curate` login gate (no new gate
   * kind). TopicView binds it to `requireLogin({ gate: "curate", … })`. Absent → no nudge.
   */
  onJoin?: () => void;
}) {
  const src = clip.embedUrl
    ? clip.embedUrl + (clip.embedUrl.includes("?") ? "&" : "?") + "autoplay=1"
    : undefined;
  // Frame height cap (§9 responsive). For a 9:16 vertical clip the frame is height-capped so a
  // tall clip can't consume the whole dialog and push the curation block off-screen. It is capped
  // to ~60vh so the frame + close bar + the start of the curation block fit, and the rest scrolls
  // — see the `max-h-[90vh] overflow-y-auto` wrapper below (DEFECT 1 fix, #63).
  const frame =
    clip.orientation === "vertical"
      ? "aspect-[9/16] max-h-[60vh] mx-auto"
      : "aspect-video w-full";

  // The dialog content is wrapped in a single VIEWPORT-CAPPED, SCROLLABLE column so that when the
  // video frame + curation block together exceed a short viewport (the reported case: 390×620 with
  // a 9:16 clip), the dialog SCROLLS instead of centering-and-clipping (design §4.1 / §9). This
  // keeps the ✕ close button and the full note + "context by" reachable by scroll. The scroll
  // container lives INSIDE ModalShell's dialog (children), so the focus trap / Esc / backdrop /
  // focus-return contract is untouched, and DOM order is unchanged: close button first, "context
  // by" link last (the focus-model tests stay green). On open ModalShell focuses the close button,
  // which the browser scrolls into view, so the reader always starts at the top of the frame.
  return (
    <ModalShell onClose={onClose} ariaLabel="Video player" dark className="w-full max-w-3xl">
      <div className="max-h-[90vh] overflow-y-auto">
      <div className="border-2 border-hardbox bg-black">
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
          chips read in the Indigo-Press light-card register. It mounts inside the same dialog, so
          its links join the existing focus trap automatically (§7.4) and the close button stays the
          first focusable. The block is the shared `CurationBlock` (#120 single source of truth) —
          the rail card's reading order (creator → held → chips → full note → context-by) plus the
          logged-out join nudge last, so a reader who opens ANY curated clip sees the identical block
          (AC4). The note is OMITTED defensively on an empty note; chips + context-by still render. */}
      <CurationBlock clip={clip} signedIn={signedIn} onJoin={onJoin} />
      </div>
    </ModalShell>
  );
}
