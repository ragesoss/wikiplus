"use client";

import { useEffect, useRef } from "react";
import type { ParsedVideo } from "@/lib/embed/facade";

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: ParsedVideo;
  title?: string;
}

export function EmbedModal({ isOpen, onClose, video, title }: EmbedModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    // Focus the close button when modal opens
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && dialog) {
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isPortrait =
    video.platform === "tiktok" || video.platform === "instagram";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Video: ${title}` : "Video"}
    >
      <div
        ref={dialogRef}
        className={[
          "relative bg-black shadow-2xl border-2 border-[#2C2C2C]",
          isPortrait ? "w-[min(340px,90vw)]" : "w-[min(800px,95vw)]",
        ].join(" ")}
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/90 hover:text-white bg-[#2C2C2C] px-3 py-1 text-sm font-bold z-10 focus-visible:outline-2 focus-visible:outline-[#676EB4]"
          aria-label="Close video"
        >
          ✕ Close
        </button>

        {/* Embed */}
        <div className={isPortrait ? "aspect-[9/16]" : "aspect-video"}>
          <iframe
            src={video.embedUrl}
            title={title ?? "Video"}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
