"use client";

import Link from "next/link";
import { useState } from "react";
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

function GeneralTile({ clip }: { clip: Clip }) {
  const [modalOpen, setModalOpen] = useState(false);
  const video = parseVideoUrl(clip.videoUrl);
  const thumbUrl = video?.thumbnailUrl;

  return (
    <>
      <article className="flex-shrink-0 w-72 bg-white border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C] overflow-hidden flex flex-col">
        {/* Thumbnail / play button */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="relative block w-full aspect-video bg-[#2C2C2C] overflow-hidden group focus-visible:outline-2 focus-visible:outline-[#676EB4]"
          aria-label={`Play: ${clip.title ?? "Video"}`}
          style={
            thumbUrl
              ? {
                  backgroundImage: `url(${thumbUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <span className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" aria-hidden="true" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="bg-white/95 rounded-full w-12 h-12 flex items-center justify-center shadow-lg">
              <span className="text-[#2C2C2C] text-xl ml-1">▶</span>
            </span>
          </span>
        </button>

        {/* Card body */}
        <div className="p-3 flex flex-col gap-2 flex-1">
          {/* Chips */}
          <div className="flex flex-wrap gap-1.5">
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 border border-[#676EB4] text-[#676EB4] rounded"
              style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
            >
              {STANCE_LABEL[clip.stance]}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 border rounded"
              style={{
                borderColor: ACCURACY_COLOR[clip.accuracyFlag],
                color: ACCURACY_COLOR[clip.accuracyFlag],
                fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif",
              }}
            >
              {ACCURACY_LABEL[clip.accuracyFlag]}
            </span>
          </div>

          {/* Context note */}
          <p
            className="text-[13px] leading-[1.5] text-[#2C2C2C] line-clamp-3"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {clip.contextNote}
          </p>

          {/* Creator */}
          <footer className="mt-auto text-[11px] text-[#54595d] flex items-center gap-1.5">
            <span className="font-bold">@{clip.creator.handle}</span>
            <span>·</span>
            <span className="capitalize">{clip.creator.platform}</span>
            {clip.upvotes != null && (
              <>
                <span className="ml-auto">↑ {clip.upvotes}</span>
              </>
            )}
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

interface GeneralStripProps {
  clips: Clip[];
  qid: string;
}

export function GeneralStrip({ clips, qid }: GeneralStripProps) {
  if (clips.length === 0) return null;

  return (
    <section
      className="w-full bg-[#676EB4] border-y-2 border-[#2C2C2C] my-6 py-5 px-5"
      aria-label="General videos about this topic"
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-baseline gap-3 mb-4">
          <span
            className="text-white font-black text-lg leading-none"
            style={{
              fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            ＋plus
          </span>
          <span
            className="text-white/90 text-[11px] uppercase tracking-widest font-bold"
            style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
          >
            general overview videos
          </span>
          <Link
            href={`/contribute?qid=${encodeURIComponent(qid)}`}
            className="ml-auto text-white/80 text-[12px] underline hover:text-white focus-visible:outline-2 focus-visible:outline-white rounded"
          >
            + Add video
          </Link>
        </div>

        <div
          className="flex gap-4 overflow-x-auto pb-2"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.3) transparent" }}
        >
          {clips.map((clip) => (
            <GeneralTile key={clip.id} clip={clip} />
          ))}
        </div>
      </div>
    </section>
  );
}
