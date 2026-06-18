"use client";

import type { Clip } from "@/lib/data/types";
import { AccuracyChip, StanceChip } from "./Chips";
import { VideoThumb } from "./VideoThumb";

// Anchored clip card in the plus rail (design §5.9, AC9/AC10/AC12/AC13).
//
// D2 (issue #53, design §3): when the signed-in viewer OWNS this clip, an additive owner-only
// Edit/Delete action row renders below the provenance footer. `owned` is decided by the host
// (TopicView) by comparing `clip.curatorId` to the session contributor id (Decision 6 (a)) — a
// convenience/clarity layer, NOT the security control (the server-side id-based gate is). When
// `owned` is false (a clip you don't own, logged out, or a legacy `@prototype` clip) the row is
// absent and the card is byte-for-byte its D1 self.
export function ClipCard({
  clip,
  active,
  owned = false,
  onPlay,
  onGoToSection,
  onEdit,
  onDelete,
  cardRef,
}: {
  clip: Clip;
  active: boolean;
  /** The signed-in viewer owns this clip → show the Edit/Delete row (design §3.1). */
  owned?: boolean;
  onPlay: (clip: Clip) => void;
  onGoToSection: (slug: string | undefined) => void;
  /** Open the Edit modal for this clip (owner only — design §2.1). */
  onEdit?: (clip: Clip) => void;
  /** Open the Delete confirm dialog for this clip (owner only — design §2.2). */
  onDelete?: (clip: Clip) => void;
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

      {/* Owner-only manage row (D2, design §3.2/§3.3) — additive, below the footer, rendered
          ONLY for the signed-in owner. Both are text-labeled native <button>s (the WORD is the
          signal, never color-alone — §10): "Edit" is the `.srcbtn` secondary; "Delete" carries
          the `accred` destructive border + text (one step from a confirm, not the destroy). */}
      {owned && (
        <div
          role="group"
          aria-label="Manage your curated clip"
          className="mt-2 flex flex-wrap gap-2 border-t border-ink/15 pt-2"
        >
          <button
            type="button"
            onClick={() => onEdit?.(clip)}
            aria-label={`Edit your curation: ${clip.caption}`}
            className="border-2 border-ink bg-white px-2.5 py-1 text-[12px] font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(clip)}
            aria-label={`Delete your curation: ${clip.caption}`}
            className="border-2 border-accred bg-white px-2.5 py-1 text-[12px] font-bold text-accred hover:bg-accred hover:text-white"
          >
            Delete
          </button>
        </div>
      )}
    </article>
  );
}
