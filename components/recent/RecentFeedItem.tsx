"use client";

import Link from "next/link";
import { useState } from "react";
import type { ContributorClip } from "@/lib/data/types";
import { CurationBlock } from "@/components/topic/CurationBlock";
import { UpvoteControl } from "@/components/topic/UpvoteControl";
import { topicHref } from "@/lib/wiki/topicRoute";

// One item of the recent-curations feed (`/recent`, issue #160 / design §2). A full-viewport "stage"
// carrying ONE curated `ContributorClip` out of its topic, with its full wiki+ trust layer. Two
// regions, stacked on mobile / side-by-side on desktop (§9):
//
//   • The video stage (the hero, §2.3 / §3.2): a black-backed, orientation-letterboxed frame holding
//     a click-to-play poster FACADE — nothing loads until the reader plays it. On play (owned by the
//     parent — single active player + auto-pause, §3.3) the poster is replaced IN PLACE by the embed
//     iframe, the SAME frame box so there is no layout shift. A non-embeddable clip (no `embedUrl`)
//     gets a link-out affordance instead (§3.2).
//   • The curation panel (§2.1 / §2.2): the clip caption, then the shared `CurationBlock` rendered
//     VERBATIM (signedIn, NO onJoin — §6.4), then the jump-to-topic link (§2.4), then the read-only
//     upvote count (§6.2). The panel is the item's sole internal scroll region (§3.1).
//
// EMBED FACADE PARITY (§3.2): the iframe `src` (+autoplay=1), `allow`, and `allowFullScreen` are
// lifted VERBATIM from PinnedPlayer / MobilePlayerDock — no new embed is authored here. The
// orientation→frame cap mechanic (`[aspect-ratio]` + `mx-auto` + `bg-black`) is the same one those
// players use, so a 9:16 clip is height-capped/centred and a 16:9 clip letterboxes cleanly.

export function RecentFeedItem({
  clip,
  signedIn,
  index,
  total,
  isPlaying,
  onPlay,
  registerStage,
}: {
  clip: ContributorClip;
  signedIn: boolean;
  /** 1-based position, for the item's accessible label ("…, curation N of M"). */
  index: number;
  /** Total loaded count, for the accessible label (it grows as pages load — honest "of N so far"). */
  total: number;
  /** Is THIS item the one currently playing (parent owns single-active + auto-pause — §3.3). */
  isPlaying: boolean;
  /** Ask the parent to make this item the active player (mounts the iframe; stops any prior). */
  onPlay: () => void;
  /** Register the stage element so the parent's IntersectionObserver can auto-pause on scroll-away. */
  registerStage: (el: HTMLElement | null) => void;
}) {
  const vertical = clip.orientation === "vertical";
  const embeddable = Boolean(clip.embedUrl);

  // The orientation→frame box (§2.3) — the SAME cap mechanic as MobilePlayerDock/PinnedPlayer:
  // 9:16 is height-capped + centred on black (letterboxed L/R when the stage is wider); 16:9 fills
  // the stage width at 16:9 (letterboxed T/B when the stage is taller). The poster and the iframe
  // share this box, so play causes no layout jump.
  const frameClass = vertical
    ? "mx-auto w-auto bg-black [aspect-ratio:9/16]" +
      " h-[min(48vh,420px)] max-h-[min(48vh,420px)]" +
      " lg:h-[min(70vh,560px)] lg:max-h-[min(70vh,560px)]"
    : "w-full max-w-full bg-black aspect-video";

  return (
    <article
      aria-label={`${clip.caption} — curation ${index} of ${total}`}
      className="flex h-full min-h-0 flex-col lg:flex-row lg:items-stretch lg:gap-0"
    >
      {/* ── The video stage (the hero). Black backing, the orientation-letterboxed frame centred. On
          mobile it is the top region; on desktop the larger left column. The stage never scrolls. ── */}
      <div
        ref={registerStage}
        className="flex shrink-0 items-center justify-center bg-black lg:min-h-0 lg:flex-1"
      >
        <div className={frameClass}>
          {isPlaying && embeddable ? (
            // iframe attrs lifted VERBATIM from PinnedPlayer / MobilePlayerDock (§3.2). autoplay=1 is
            // honest — the reader clicked. allowFullScreen keeps the embed's OWN native fullscreen
            // button (no custom maximize). The iframe replaces the poster in the same box.
            <iframe
              src={
                clip.embedUrl! +
                (clip.embedUrl!.includes("?") ? "&" : "?") +
                "autoplay=1"
              }
              title={clip.caption}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <StagePoster clip={clip} embeddable={embeddable} onPlay={onPlay} />
          )}
        </div>
      </div>

      {/* ── The curation panel (§2.2). The light register. Caption → CurationBlock (verbatim) →
          jump-to-topic → read-only count. It is the item's sole internal scroll region (§3.1): on a
          long note it scrolls while the stage stays put. On desktop it is the fixed reading column. ── */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-content-white)] px-5 py-4 lg:w-[380px] lg:max-w-[380px] lg:flex-none lg:border-l-2 lg:border-hardbox">
        {/* The caption — the clip's own title, bold, ≤2 lines (§2.2 item 2). Distinct from the
            CurationBlock's creator credit. */}
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-ink-plus">
          {clip.caption}
        </p>

        {/* The shared curation block, VERBATIM (§2.1): creator credit → held marking → chips → full
            note → "context by @curator". signedIn keeps it honest; NO onJoin so no join nudge in the
            feed (§6.4) — the feed's join path is the jump-to-topic link + header auth. */}
        <CurationBlock clip={clip} signedIn={signedIn} />

        {/* The tail row (§2.2 items 4–5): jump-to-topic link + the read-only upvote count. */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hardbox/15 pt-3">
          {/* Jump-to-topic (§2.4) — the feed's one navigational control. A real <Link> to the
              canonical title route (the SAME helper the profile's "On <Topic>" uses). text-link tone,
              the word carries the meaning (never color-alone); the → glyph is decorative. */}
          <Link
            href={topicHref(clip.topicTitle)}
            aria-label={`Go to the ${clip.topicTitle} topic`}
            className="text-[13px] font-bold text-link hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
          >
            Curated on {clip.topicTitle} <span aria-hidden>→</span>
          </Link>

          {/* Read-only social proof (§6.2): the static, non-interactive, unfocusable "N upvotes"
              label — the SAME read-only rendering UpvoteControl gives logged-out (signedIn=false
              forces the static label even when the reader is signed in; the feed never shows the
              interactive toggle — §6.3). A count of 0 renders nothing. `onActivate` is unused here. */}
          <UpvoteControl
            count={clip.upvotes ?? 0}
            voted={false}
            signedIn={false}
            surface="light"
            onActivate={() => {}}
          />
        </div>
      </div>
    </article>
  );
}

// ── The click-to-play poster facade (§3.2). The whole poster is the affordance — a large tap/focus
// target. EMBEDDABLE → a <button> that asks the parent to play (mount the iframe). NON-EMBEDDABLE
// (no embedUrl — e.g. TikTok / an unresolved add-by-link clip) → a full-stage link-out <a> opening
// the watch URL in a new tab; a corner pill carries the WORD platformLabel so the reader knows it
// leaves the site (never glyph-alone — §3.2 / §8.4). Either way the curation panel renders fully —
// the note is worth reading even when the clip can't be embedded in place.
function StagePoster({
  clip,
  embeddable,
  onPlay,
}: {
  clip: ContributorClip;
  embeddable: boolean;
  onPlay: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = clip.thumbnailUrl && !imgFailed;

  // The shared poster picture: the thumbnail (lazy) with the gradient fallback (the existing
  // VideoThumb fallback behavior — §2.3), an indigo duotone overlay, and the centred play glyph.
  const poster = (
    <>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={clip.thumbnailUrl}
          alt=""
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <span
          aria-hidden
          className={`absolute inset-0 bg-gradient-to-br ${
            clip.thumbGrad ?? "from-brand to-violet"
          }`}
        />
      )}
      {/* Decorative indigo duotone, matching the rail/profile poster language. */}
      <span aria-hidden className="absolute inset-0 bg-brand/20 mix-blend-multiply" />
      {/* The play / link-out glyph, centred. White-on-black ≥ AA (§8.4). */}
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/80 bg-black/55 text-white shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition-transform motion-safe:group-hover:scale-110">
        {embeddable ? (
          <span className="ml-1 border-y-[10px] border-l-[16px] border-y-transparent border-l-white" />
        ) : (
          <span className="text-2xl leading-none">↗</span>
        )}
      </span>
      {/* Non-embeddable corner pill — the WORD platformLabel (never glyph-alone), so the reader
          knows the affordance leaves the site (§3.2 / §8.4). */}
      {!embeddable && (
        <span className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
          ↗ {clip.platformLabel}
        </span>
      )}
    </>
  );

  const shared =
    "group relative flex h-full w-full items-center justify-center overflow-hidden bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  if (embeddable) {
    return (
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play: ${clip.caption}`}
        className={shared}
      >
        {poster}
      </button>
    );
  }
  return (
    <a
      href={clip.watchUrl}
      target="_blank"
      rel="noopener"
      aria-label={`Watch on ${clip.platformLabel} (opens in a new tab): ${clip.caption}`}
      className={shared}
    >
      {poster}
    </a>
  );
}
