"use client";

import { useState } from "react";
import type { ParsedVideo } from "@/lib/embed/facade";

// Click-to-load facade — embed by reference, never host. No third-party iframe
// loads until the user explicitly asks for it.
export function EmbedFacade({
  video,
  title,
}: {
  video: ParsedVideo;
  title?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe
          src={video.embedUrl}
          title={title || "Embedded video"}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      aria-label={`Load video${title ? `: ${title}` : ""}`}
      className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-ink text-white focus:outline-none focus:ring-2 focus:ring-action"
      style={
        video.thumbnailUrl
          ? {
              backgroundImage: `url(${video.thumbnailUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <span className="absolute inset-0 bg-black/30 transition group-hover:bg-black/20" />
      <span className="relative rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-ink">
        ▶ Load video
      </span>
    </button>
  );
}
