"use client";

import { forwardRef, useState } from "react";
import type { Clip, AccuracyFlag, Stance } from "@/lib/data/types";
import { EmbedModal } from "@/components/EmbedModal";
import { parseVideoUrl } from "@/lib/embed/facade";

const ACCURACY_COLOR: Record<AccuracyFlag, string> = {
  accurate: "#2A8270",
  "mostly-accurate": "#1F6F95",
  mixed: "#1F6F95",
  misleading: "#C44949",
  inaccurate: "#C44949",
};

const ACCURACY_LABEL: Record<AccuracyFlag, string> = {
  accurate: "Accurate",
  "mostly-accurate": "Mostly accurate",
  mixed: "Mixed",
  misleading: "Misleading",
  inaccurate: "Inaccurate",
};

const STANCE_LABEL: Record<Stance, string> = {
  explainer: "Explainer",
  opinion: "Opinion",
  "myth-busting": "Myth-busting",
  "personal-experiment": "Personal experiment",
  "primary-source": "Primary source",
};

interface ClipCardFullProps {
  clip: Clip;
  sectionTitle?: string;
  isActive?: boolean;
  onSectionClick?: () => void;
}

export const ClipCardFull = forwardRef<HTMLElement, ClipCardFullProps>(
  function ClipCardFull({ clip, sectionTitle, isActive, onSectionClick }, ref) {
    const [modalOpen, setModalOpen] = useState(false);
    const video = parseVideoUrl(clip.videoUrl);
    const thumbUrl = video?.thumbnailUrl;

    return (
      <>
        <article
          ref={ref as React.RefObject<HTMLElement>}
          className={[
            "bg-white border-2 overflow-hidden transition-all duration-200",
            isActive
              ? "border-[#676EB4] shadow-[4px_4px_0_#676EB4]"
              : "border-[#2C2C2C] shadow-[2px_2px_0_#2C2C2C]",
          ].join(" ")}
          aria-label={clip.title ?? "Curated video clip"}
        >
          {/* Section label */}
          {sectionTitle && (
            <button
              type="button"
              onClick={onSectionClick}
              className="w-full text-left px-3 py-1.5 bg-[#f0f2ff] border-b-2 border-[#2C2C2C] text-[10px] font-bold uppercase tracking-widest text-[#676EB4] hover:bg-[#e8eaff] transition-colors focus-visible:outline-2 focus-visible:outline-[#676EB4]"
              style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
              aria-label={`Jump to section: ${sectionTitle}`}
            >
              § {sectionTitle}
            </button>
          )}

          {/* Thumbnail */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="relative block w-full bg-[#2C2C2C] overflow-hidden group focus-visible:outline-2 focus-visible:outline-[#676EB4]"
            style={{
              aspectRatio: clip.orientation === "portrait" ? "9/16" : "16/9",
              ...(thumbUrl
                ? {
                    backgroundImage: `url(${thumbUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {}),
            }}
            aria-label={`Play: ${clip.title ?? "Video"}`}
          >
            <span
              className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors"
              aria-hidden="true"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="bg-white/95 rounded-full w-10 h-10 flex items-center justify-center shadow">
                <span className="text-[#2C2C2C] text-base ml-0.5">▶</span>
              </span>
            </span>
          </button>

          {/* Card body */}
          <div className="p-3 space-y-2">
            {/* Chips */}
            <div className="flex flex-wrap gap-1.5">
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 bg-[#676EB4] text-white rounded"
                style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
              >
                {STANCE_LABEL[clip.stance]}
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 text-white rounded"
                style={{
                  backgroundColor: ACCURACY_COLOR[clip.accuracyFlag],
                  fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif",
                }}
              >
                {ACCURACY_LABEL[clip.accuracyFlag]}
              </span>
            </div>

            {/* Context note */}
            <p
              className="text-[13px] leading-[1.55] text-[#2C2C2C]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {clip.contextNote}
            </p>

            {/* Creator + meta */}
            <footer className="flex items-center justify-between text-[11px] text-[#54595d]">
              <span className="font-semibold">@{clip.creator.handle}</span>
              <div className="flex items-center gap-2">
                <span className="capitalize">{clip.creator.platform}</span>
                {clip.upvotes != null && (
                  <span aria-label={`${clip.upvotes} upvotes`}>↑ {clip.upvotes}</span>
                )}
              </div>
            </footer>
          </div>
        </article>

        {video && (
          <EmbedModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            video={video}
            title={clip.title}
          />
        )}
      </>
    );
  }
);
