"use client";

import type { Candidate, Clip } from "@/lib/data/types";
import { pluralize } from "@/lib/format";
import { CandidateActions, MatchReason, SuggestedBadge } from "./CandidateBits";
import { VideoThumb } from "./VideoThumb";

// Full-bleed indigo band after the lead — the one crossover (design §5.5 / §6.3).
// Curated mode = "＋ General" overview tiles (AC8). Empty mode = "Suggested videos
// · uncurated" with the manual-source actions + candidate tiles (AC16/AC18/AC19).
export function GeneralStrip({
  mode,
  topicTitle,
  generalClips,
  generalCandidates,
  totalGeneral,
  onPlay,
  onPromote,
  onDismiss,
  onAdd,
  bandRef,
}: {
  mode: "curated" | "empty";
  topicTitle: string;
  generalClips: Clip[];
  generalCandidates: Candidate[];
  totalGeneral: number;
  onPlay: (clip: Clip) => void;
  onPromote: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
  onAdd: () => void;
  bandRef?: (el: HTMLElement | null) => void;
}) {
  const tiktok = `https://www.tiktok.com/search?q=${encodeURIComponent(topicTitle)}`;
  const youtube = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    topicTitle
  )}`;

  return (
    <section
      ref={bandRef}
      id="general-band"
      aria-label={mode === "curated" ? "General overview videos" : "Suggested videos"}
      className="my-7 border-y-2 border-ink bg-brand text-white"
    >
      <div className="mx-auto max-w-[1200px] px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="plus-disp text-2xl font-bold sm:text-3xl">
            ＋ {mode === "curated" ? "General" : "Suggested videos"}
          </h2>
          {mode === "empty" && (
            <span className="border-2 border-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
              uncurated
            </span>
          )}
          <span className="text-sm text-white/80">
            {mode === "curated"
              ? "— quick visual overview across both columns"
              : "— auto-found candidates, not yet vetted"}
          </span>
          <span className="border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
            {pluralize(totalGeneral, mode === "curated" ? "video" : "candidate")}
          </span>
        </div>

        {mode === "empty" && (
          <div
            role="group"
            aria-label="Add videos from a source manually"
            className="mt-3 flex flex-wrap items-center gap-2"
          >
            <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">
              Find more
            </span>
            <a
              href={tiktok}
              target="_blank"
              rel="noopener"
              className="border-2 border-ink bg-white px-2.5 py-1 text-[12px] font-bold text-ink hover:bg-[#C03060] hover:text-white"
            >
              Search TikTok ↗
            </a>
            <a
              href={youtube}
              target="_blank"
              rel="noopener"
              className="border-2 border-ink bg-white px-2.5 py-1 text-[12px] font-bold text-ink hover:bg-brand hover:text-white"
            >
              Search YouTube ↗
            </a>
            <button
              type="button"
              onClick={onAdd}
              aria-haspopup="dialog"
              className="border-2 border-ink bg-brand px-2.5 py-1 text-[12px] font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
            >
              ＋ Add video
            </button>
          </div>
        )}

        <ul role="list" className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {mode === "curated"
            ? generalClips.map((clip) => (
                <li key={clip.id} role="listitem" className="w-44 shrink-0">
                  <VideoThumb video={clip} variant="strip" onPlay={() => onPlay(clip)} />
                  <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-snug text-white">
                    {clip.caption}
                  </p>
                  <p className="truncate text-[11px] text-white/70">
                    {clip.creator.handle} · {clip.platformLabel}
                  </p>
                </li>
              ))
            : generalCandidates.map((c) => (
                <li key={c.id} role="listitem" className="w-44 shrink-0">
                  <VideoThumb video={c} variant="strip" candidate />
                  <div className="mt-1 flex items-center gap-1.5">
                    <SuggestedBadge />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-snug text-white">
                    {c.caption}
                  </p>
                  <p className="truncate text-[11px] text-white/70">
                    {c.creator.handle} · {c.platformLabel}
                  </p>
                  <div className="mt-1 rounded bg-white p-1.5 text-ink">
                    <MatchReason candidate={c} />
                  </div>
                  <CandidateActions
                    candidate={c}
                    onPromote={onPromote}
                    onDismiss={onDismiss}
                  />
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}
