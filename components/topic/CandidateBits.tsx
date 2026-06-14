"use client";

import type { Candidate } from "@/lib/data/types";
import { VideoThumb } from "./VideoThumb";

// Shared candidate sub-parts (design §6.5/§6.6, AC15/AC19). Candidates carry NO
// stance/accuracy chips and NO context note (CURATION §6) — only a match reason.

/** Outline "SUGGESTED" badge — distinct from a filled badge (AC15). */
export function SuggestedBadge() {
  return (
    <span className="inline-flex items-center border-2 border-ink bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink">
      Suggested
    </span>
  );
}

/** Match-reason block — replaces the curator note (CURATION §6). */
export function MatchReason({ candidate }: { candidate: Candidate }) {
  return (
    <div className="border-l-4 border-dashed border-brand bg-bg2 py-2 pl-3 pr-2">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet">
        <span aria-hidden>🔍</span> Auto-suggested
      </p>
      <p className="mt-0.5 text-[12px] leading-snug text-ink2">
        {candidate.source} · {candidate.matchReason}
      </p>
      <p className="mt-1 text-[11px] italic text-muted">
        No context yet — a human hasn&apos;t reviewed this.
      </p>
    </div>
  );
}

/** Promote / Not-relevant controls (design §6.6, AC19). */
export function CandidateActions({
  candidate,
  onPromote,
  onDismiss,
}: {
  candidate: Candidate;
  onPromote: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onPromote(candidate)}
        aria-label={`Promote and curate: ${candidate.caption}`}
        aria-haspopup="dialog"
        className="border-2 border-ink bg-brand px-2.5 py-1 text-[12px] font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
      >
        ✓ Promote
      </button>
      <button
        type="button"
        onClick={() => onDismiss(candidate)}
        aria-label={`Dismiss as not relevant: ${candidate.caption}`}
        className="border-2 border-ink bg-white px-2.5 py-1 text-[12px] font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C]"
      >
        ✕ Not relevant
      </button>
    </div>
  );
}

/** Candidate card in the rail (mirrors a clip card's footprint, dashed). */
export function CandidateCard({
  candidate,
  onPromote,
  onDismiss,
  cardRef,
}: {
  candidate: Candidate;
  onPromote: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
  cardRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <article
      ref={cardRef}
      data-clip-section={candidate.general ? "__general" : candidate.sectionSlug}
      className="candcard relative p-2.5"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <SuggestedBadge />
        <span className="text-[11px] font-bold text-violet">
          {candidate.general ? "General" : candidate.sectionLabel ?? "Section"}
        </span>
      </div>
      <VideoThumb video={candidate} candidate />
      <a
        href={candidate.creator.url}
        target="_blank"
        rel="noopener"
        className="mt-2 flex items-center gap-2"
      >
        <span
          aria-hidden
          className={`h-7 w-7 shrink-0 rounded-full border-2 border-ink bg-gradient-to-br ${
            candidate.creator.avatarGrad ?? "from-brand to-violet"
          }`}
        />
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-bold text-ink">
            {candidate.caption}
          </span>
          <span className="block truncate text-[11px] text-muted">
            {candidate.creator.handle} · {candidate.platformLabel}
          </span>
        </span>
      </a>
      <div className="mt-2">
        <MatchReason candidate={candidate} />
      </div>
      <CandidateActions
        candidate={candidate}
        onPromote={onPromote}
        onDismiss={onDismiss}
      />
    </article>
  );
}
