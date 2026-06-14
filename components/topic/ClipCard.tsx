"use client";

import type { Clip } from "@/lib/data/types";
import { AccuracyChip, StanceChip } from "./Chips";
import { VideoThumb } from "./VideoThumb";

// Anchored clip card in the plus rail (design §5.9, AC9/AC10/AC12/AC13).
export function ClipCard({
  clip,
  active,
  onPlay,
  onGoToSection,
  cardRef,
}: {
  clip: Clip;
  active: boolean;
  onPlay: (clip: Clip) => void;
  onGoToSection: (slug: string | undefined) => void;
  cardRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <article
      ref={cardRef}
      data-clip-section={clip.general ? "__general" : clip.sectionSlug}
      className={`vcard relative plus-card p-2.5 ${
        active ? "active-glow border-brand" : ""
      }`}
    >
      {/* active nub (decorative) */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -left-2.5 top-6 border-y-8 border-r-8 border-y-transparent border-r-brand transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* section link */}
      <button
        type="button"
        onClick={() => onGoToSection(clip.general ? "__general" : clip.sectionSlug)}
        className="mb-1.5 block text-[11px] font-bold text-action hover:underline"
      >
        ↳ {clip.general ? "General" : clip.sectionLabel ?? "Section"}
      </button>

      <VideoThumb video={clip} onPlay={() => onPlay(clip)} />

      {/* creator credit (CURATION §5.2) */}
      <a
        href={clip.creator.url}
        target="_blank"
        rel="noopener"
        className="mt-2 flex items-center gap-2"
      >
        <span
          aria-hidden
          className={`h-7 w-7 shrink-0 rounded-full border-2 border-ink bg-gradient-to-br ${
            clip.creator.avatarGrad ?? "from-brand to-violet"
          }`}
        />
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-bold text-ink">
            {clip.creator.name}
          </span>
          <span className="block truncate text-[11px] text-muted">
            {clip.creator.handle} · {clip.platformLabel}
          </span>
        </span>
      </a>

      {/* chips row */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StanceChip stance={clip.stance} modifier={clip.stanceModifier} />
        <AccuracyChip flag={clip.accuracyFlag} modifier={clip.accuracyModifier} />
      </div>

      {/* curator note (CURATION §1) */}
      <div className="mt-2 border-l-4 border-brand bg-bg2 py-2 pl-3 pr-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-violet">
          Curator note
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-ink2">
          {clip.contextNote}
        </p>
      </div>

      {/* provenance footer (decorative) */}
      <footer className="mt-2 flex items-center justify-between text-[11px] text-muted">
        {typeof clip.upvotes === "number" && (
          <span className="font-bold text-brand">▲ {clip.upvotes}</span>
        )}
        <span className="truncate">
          {clip.curatedBy ? `${clip.curatedBy} · ` : ""}
          {clip.curatedAt ?? ""}
        </span>
      </footer>
    </article>
  );
}
