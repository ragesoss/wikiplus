"use client";

import { ModalShell } from "./ModalShell";

// Player modal (design §5.8 / AC11). The iframe is created ON OPEN (this component
// only mounts when a clip is activated) and removed on close — no embed loads on
// initial page render. Autoplay is set since the user explicitly clicked play.
export interface PlayerClip {
  embedUrl?: string;
  caption: string;
  orientation: "vertical" | "horizontal";
}

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
    </ModalShell>
  );
}
