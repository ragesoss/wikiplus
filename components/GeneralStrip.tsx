"use client";

import Link from "next/link";
import { useState } from "react";
import type { Clip, AccuracyFlag, Stance } from "@/lib/data/types";
import { EmbedModal } from "@/components/EmbedModal";
import { parseVideoUrl } from "@/lib/embed/facade";

const sansFont = "Source Sans 3, Source Sans Pro, system-ui, sans-serif";

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
              style={{ fontFamily: sansFont }}
            >
              {STANCE_LABEL[clip.stance]}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 border rounded"
              style={{
                borderColor: ACCURACY_COLOR[clip.accuracyFlag],
                color: ACCURACY_COLOR[clip.accuracyFlag],
                fontFamily: sansFont,
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
  topicTitle?: string;
}

export function GeneralStrip({ clips, qid, topicTitle }: GeneralStripProps) {
  const isEmpty = clips.length === 0;

  // Empty-state band: show "＋ Suggested videos" with Find more row
  if (isEmpty) {
    if (!topicTitle) return null;

    const tiktokUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(topicTitle)}`;
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${topicTitle} explained`)}`;

    return (
      <section
        className="w-full bg-[#676EB4] border-y-2 border-[#2C2C2C] my-6 py-5 px-5"
        aria-label="Suggested videos for this topic — not yet vetted"
      >
        <div className="max-w-[1200px] mx-auto">
          {/* Header row */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span
              className="text-2xl text-white font-black leading-none"
              style={{ fontFamily: sansFont, letterSpacing: "-0.02em" }}
            >
              ＋ Suggested videos
            </span>
            <span
              className="text-[11px] font-bold uppercase tracking-[0.18em] px-2 py-1 border-2 border-white text-white"
              style={{ fontFamily: sansFont }}
            >
              uncurated
            </span>
            <span
              className="text-sm text-white/80 font-normal"
              style={{ fontFamily: sansFont }}
            >
              — auto-found candidates, not yet vetted
            </span>
          </div>

          {/* Find more row */}
          <div
            className="flex items-center gap-2 flex-wrap"
            role="group"
            aria-label="Find videos to add"
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70"
              style={{ fontFamily: sansFont }}
            >
              Find more
            </span>
            <a
              href={tiktokUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border-2 border-[#2C2C2C] bg-white text-[#2C2C2C] text-[12px] font-bold px-2.5 py-1.5 hover:bg-pink-50 hover:shadow-[2px_2px_0_#2C2C2C] transition-shadow"
              style={{ fontFamily: sansFont }}
              aria-label="Search TikTok for this topic in a new tab"
            >
              <span className="text-pink-500" aria-hidden="true">✦</span>
              Search TikTok <span aria-hidden="true">↗</span>
            </a>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border-2 border-[#2C2C2C] bg-white text-[#2C2C2C] text-[12px] font-bold px-2.5 py-1.5 hover:bg-[#F0F1F3] hover:shadow-[2px_2px_0_#2C2C2C] transition-shadow"
              style={{ fontFamily: sansFont }}
              aria-label="Search YouTube for this topic in a new tab"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0 text-red-500"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M21.58 6.19a2.51 2.51 0 0 0-1.77-1.77C18.25 4 12 4 12 4s-6.25 0-7.81.42A2.51 2.51 0 0 0 2.42 6.19C2 7.75 2 12 2 12s0 4.25.42 5.81a2.51 2.51 0 0 0 1.77 1.77C5.75 20 12 20 12 20s6.25 0 7.81-.42a2.51 2.51 0 0 0 1.77-1.77C22 16.25 22 12 22 12s0-4.25-.42-5.81zM10 15.5v-7l6 3.5-6 3.5z" />
              </svg>
              Search YouTube <span aria-hidden="true">↗</span>
            </a>
            <Link
              href={`/contribute?qid=${encodeURIComponent(qid)}`}
              className="inline-flex items-center gap-1.5 border-2 border-[#2C2C2C] bg-[#2C2C2C] text-white text-[12px] font-bold px-2.5 py-1.5 hover:shadow-[2px_2px_0_rgba(0,0,0,0.4)] transition-shadow"
              style={{ fontFamily: sansFont }}
            >
              <span aria-hidden="true">＋</span> Add video
            </Link>
          </div>
        </div>
      </section>
    );
  }

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
              fontFamily: sansFont,
              letterSpacing: "-0.02em",
            }}
          >
            ＋plus
          </span>
          <span
            className="text-white/90 text-[11px] uppercase tracking-widest font-bold"
            style={{ fontFamily: sansFont }}
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
