"use client";

import { useState } from "react";
import type { Platform } from "@/lib/data/types";

// Click-to-load facade (design §5.7, AC10/AC11). The thumbnail is a <button> —
// nothing loads until clicked. YouTube → onPlay (parent opens the player modal);
// any other platform → open the watch URL in a new tab (embed-never-host).
const PLATFORM_FILL: Record<Platform, string> = {
  youtube: "#C4302B",
  tiktok: "#C03060", // AA-safe TikTok-ish pink (white text ≈4.7:1)
  instagram: "#A1306B",
  other: "var(--color-hardbox)",
};

export interface ThumbVideo {
  platform: Platform;
  platformLabel: string;
  orientation: "vertical" | "horizontal";
  caption: string;
  watchUrl: string;
  thumbnailUrl?: string;
  thumbGrad?: string;
}

export function VideoThumb({
  video,
  variant = "card",
  candidate = false,
  onPlay,
}: {
  video: ThumbVideo;
  /** "card" = rail card, "strip" = uniform search tile, "inline" = inline candidate,
   *  "hero" = the full-bleed General hero (uniform 16:9, no own border — the band/card frames it),
   *  "stripcard" = the General-strip white-card tile (uniform 3:2, only a bottom seam border —
   *  the enclosing white card supplies the rest). */
  variant?: "card" | "strip" | "inline" | "hero" | "stripcard";
  candidate?: boolean;
  /** Called for YouTube clips (parent opens the player modal). */
  onPlay?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const isYouTube = video.platform === "youtube" && !!video.thumbnailUrl;

  const aspect =
    variant === "stripcard"
      ? // The General-strip white-card tile (design general-strip-fullbleed.md §2): a uniform, taller
        // 3:2 frame at the card's full width — the picture leads, and 3:2 crops a vertical clip less
        // than 16:9 did. `w-full` is added below; the tile width lives in GeneralStrip.
        "aspect-[3/2]"
      : variant === "strip" || variant === "hero"
      ? // Thumbnail-forward General strip + hero (TOPIC_PAGE_DESIGN §"The General strip"): a true
        // 16:9 frame that scales with the column width, so the picture is the dominant element.
        // `w-full` is added below; the tile/hero widths live in GeneralStrip. Uniform landscape
        // for every strip tile keeps the scroll row even; the hero uses the same uniform 16:9 so
        // the docked curation card layout is stable regardless of the clip's orientation.
        "aspect-video"
      : video.orientation === "vertical"
        ? variant === "inline"
          ? "aspect-[9/16] w-28"
          : "aspect-[9/16] max-h-72 w-44 mx-auto"
        : "aspect-video w-full";

  const action =
    video.platform === "youtube"
      ? `Play: ${video.caption}`
      : `Open on ${video.platformLabel}: ${video.caption}`;

  function activate() {
    if (video.platform === "youtube" && onPlay) onPlay();
    else window.open(video.watchUrl, "_blank", "noopener");
  }

  const showImg = video.thumbnailUrl && !imgFailed;

  return (
    <button
      type="button"
      onClick={activate}
      aria-label={action}
      className={`group relative block overflow-hidden ${aspect} ${
        // The hero bleeds (band + docked card frame it → no border). The strip-card tile carries only
        // a bottom seam (the enclosing white card supplies the rest). Every other variant keeps the
        // full 2px Indigo-Press frame. Strip / hero / strip-card fill their column width.
        variant === "hero"
          ? ""
          : variant === "stripcard"
            ? "border-b-2 border-hardbox"
            : "border-2 border-hardbox"
      } ${variant === "strip" || variant === "hero" || variant === "stripcard" ? "w-full" : ""}`}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnailUrl}
          alt=""
          loading="lazy"
          onError={() => setImgFailed(true)}
          className={`h-full w-full object-cover ${
            candidate ? "saturate-[.55] contrast-[.95]" : ""
          }`}
        />
      ) : (
        <span
          aria-hidden
          className={`absolute inset-0 bg-gradient-to-br ${
            video.thumbGrad ?? "from-brand to-violet"
          } ${candidate ? "saturate-[.55] contrast-[.95]" : ""}`}
        />
      )}
      {/* candidate hatch overlay (design §6.5) — desaturated + hatched = "candidate" */}
      {candidate && <span aria-hidden className="candthumb absolute inset-0" />}
      {/* indigo duotone multiply overlay (decorative) */}
      <span
        aria-hidden
        className="absolute inset-0 bg-brand/30 mix-blend-multiply"
      />
      {/* platform tag, named in words (CURATION §5.2) */}
      <span
        className="absolute left-1.5 top-1.5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
        style={{ background: PLATFORM_FILL[video.platform] }}
      >
        {video.platformLabel}
      </span>
      {/* play affordance */}
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-hardbox bg-brand text-white shadow-[3px_3px_0_var(--color-hardbox-offset)] transition-transform motion-safe:group-hover:scale-110"
      >
        <span className="ml-0.5 border-y-[7px] border-l-[11px] border-y-transparent border-l-white" />
      </span>
      {!isYouTube && (
        <span className="absolute bottom-1.5 right-1.5 bg-hardbox/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          opens ↗
        </span>
      )}
    </button>
  );
}
