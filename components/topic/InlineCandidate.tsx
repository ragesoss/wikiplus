"use client";

import type { Candidate } from "@/lib/data/types";
import { CandidateActions, MatchReason, SuggestedBadge } from "./CandidateBits";
import { VideoThumb } from "./VideoThumb";

// Inline section candidate (design §6.4, AC16) — rendered AFTER a section's article
// paragraphs, never interrupting them. Empty state only.
export function InlineCandidate({
  candidate,
  topicTitle,
  onPromote,
  onDismiss,
}: {
  candidate: Candidate;
  topicTitle: string;
  onPromote: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
}) {
  const sectionFind = `https://www.tiktok.com/search?q=${encodeURIComponent(
    `${topicTitle} ${candidate.sectionLabel ?? ""}`.trim()
  )}`;
  return (
    <aside
      className="candcard clear-both my-4 p-3"
      aria-label={`Suggested video for ${candidate.sectionLabel ?? "this section"}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <SuggestedBadge />
        <span className="text-[11px] font-bold text-violet">
          Suggested for this section
        </span>
      </div>
      <div className="flex gap-3">
        <div className="shrink-0">
          <VideoThumb video={candidate} variant="inline" candidate />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink">{candidate.caption}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {candidate.creator.name} · {candidate.creator.handle} ·{" "}
            {candidate.platformLabel}
          </p>
          <div className="mt-2">
            <MatchReason candidate={candidate} />
          </div>
          <CandidateActions
            candidate={candidate}
            onPromote={onPromote}
            onDismiss={onDismiss}
          />
        </div>
      </div>
      <div className="mt-3 border-t border-dashed border-ink/40 pt-2">
        <a
          href={sectionFind}
          target="_blank"
          rel="noopener"
          className="text-[11px] font-semibold text-violet hover:underline"
        >
          Search TikTok for &lsquo;{candidate.sectionLabel}&rsquo; ↗
        </a>
      </div>
    </aside>
  );
}
