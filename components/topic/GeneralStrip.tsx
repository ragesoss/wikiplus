"use client";

import type { Candidate, Clip } from "@/lib/data/types";
import { pluralize } from "@/lib/format";
import { CandidateActions, MatchReason } from "./CandidateBits";
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
  loading = false,
  prefersReduced = false,
  onPlay,
  onPlayCandidate,
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
  /** Empty mode only: the live candidate search is in flight (design §5.4). */
  loading?: boolean;
  /** Reduced-motion: skeletons render static (no shimmer) (design §5.4 / §8). */
  prefersReduced?: boolean;
  /** Curated tiles → blocking PlayerModal (unchanged). */
  onPlay: (clip: Clip) => void;
  /** Candidate tiles → non-modal PinnedPlayer (issue #10, AC1). Optional so the
      component still renders without a play wiring (then candidate thumbs link out). */
  onPlayCandidate?: (c: Candidate) => void;
  onPromote: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
  onAdd: () => void;
  bandRef?: (el: HTMLElement | null) => void;
}) {
  // Empty-mode runtime faces (design §5): loading (skeleton), zero-results (honest
  // line), or populated. Curated mode is unaffected.
  const showLoading = mode === "empty" && loading;
  const showZero =
    mode === "empty" && !loading && generalCandidates.length === 0;
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
          {/* #14 AC6/D2-v3.1: the General band no longer renders a candidate count
              — it states the KIND of content once and defers the volume to the ＋plus
              panel ("N auto-suggestions from {sources}"). Curated keeps its "N video"
              count; empty keeps only the transient "Finding videos…" loading tag. */}
          {(mode === "curated" || showLoading) && (
            <span className="border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
              {showLoading ? "Finding videos…" : pluralize(totalGeneral, "video")}
            </span>
          )}
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
              className="inline-flex min-h-[44px] items-center border-2 border-ink bg-white px-2.5 py-1 text-[12px] font-bold text-ink hover:bg-[#C03060] hover:text-white"
            >
              Search TikTok ↗
            </a>
            <a
              href={youtube}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-[44px] items-center border-2 border-ink bg-white px-2.5 py-1 text-[12px] font-bold text-ink hover:bg-brand hover:text-white"
            >
              Search YouTube ↗
            </a>
            <button
              type="button"
              onClick={onAdd}
              aria-haspopup="dialog"
              className="inline-flex min-h-[44px] items-center border-2 border-ink bg-brand px-2.5 py-1 text-[12px] font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
            >
              ＋ Add video
            </button>
          </div>
        )}

        {/* Loading face (design §5.4): 3 skeleton tiles, announced via aria-busy. */}
        {showLoading && (
          <ul
            role="list"
            aria-busy="true"
            aria-label="Looking for suggested videos"
            className="mt-4 flex gap-3 overflow-x-auto pb-2"
          >
            {[0, 1, 2].map((i) => (
              <li key={i} role="listitem" className="w-44 shrink-0">
                <div
                  className={`aspect-video w-full border-2 border-white/40 bg-white/15${
                    prefersReduced ? "" : " animate-pulse"
                  }`}
                />
                <div
                  className={`mt-2 h-3 w-5/6 bg-white/25${
                    prefersReduced ? "" : " animate-pulse"
                  }`}
                />
                <div
                  className={`mt-1 h-2.5 w-1/2 bg-white/15${
                    prefersReduced ? "" : " animate-pulse"
                  }`}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Zero-results face (design §5.2): honest line, no tile chrome. Keeps the
            "Find more" group above as the next step. Also covers the error/quota
            silent-degrade case (§5.5) — same honest line, never an error UI. */}
        {showZero && (
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-white">
            No videos found for this topic yet. Try a manual search below, or add
            one by link.
          </p>
        )}

        {!showLoading && !showZero && (
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
                // #14: candidate tile on a candcard surface (dashed/unvetted retained,
                // AC8). No per-tile "SUGGESTED" badge (AC1); the compact match line
                // sits on a white panel so its ink text clears AA on the indigo band.
                <li
                  key={c.id}
                  role="listitem"
                  className="candcard w-44 shrink-0 p-2"
                >
                  <VideoThumb
                    video={c}
                    variant="strip"
                    candidate
                    onPlay={
                      onPlayCandidate && c.platform === "youtube" && c.embedUrl
                        ? () => onPlayCandidate(c)
                        : undefined
                    }
                  />
                  <p className="mt-1.5 line-clamp-2 text-[12px] font-bold leading-snug text-ink">
                    {c.caption}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {c.creator.handle} · {c.platformLabel}
                  </p>
                  <MatchReason candidate={c} />
                  <CandidateActions
                    candidate={c}
                    onPromote={onPromote}
                    onDismiss={onDismiss}
                  />
                </li>
              ))}
        </ul>
        )}
      </div>
    </section>
  );
}
