"use client";

import Link from "next/link";
import type { ContributorClip } from "@/lib/data/types";
import { AccuracyChip, StanceChip } from "@/components/topic/Chips";
import { VideoThumb } from "@/components/topic/VideoThumb";
import { topicHref } from "@/lib/wiki/topicRoute";

// A single clip ROW on a contributor's public profile (issue #54 / D3, design §5). It reuses the
// clip-card CONTENT LANGUAGE the reader already knows — thumbnail facade, the §5.2 creator credit
// (links OUT), the stance/accuracy chips, and the context note — but it is NOT the scroll-sync rail
// card (no active nub, no section-jump; there is no article beside it). It adds the NEW context:
// the parent-topic "On <Topic>" link (§5.1) so the clip is meaningful out of the Topic-page setting.
//
// The per-row "context by <curator>" attribution is SUPPRESSED here (design §5.4 / a deliberate
// decision): every row is by the SAME curator (the profile owner), whose identity the §4 header
// already asserts once — repeating it per row would be redundant noise. The creator credit (which
// differs per clip and links OUT) stays.
//
// When the viewer is the profile's OWNER, an owner-only Edit/Delete action row renders below the
// note (§9.3) — reusing D2's modals via the host's `onEdit`/`onDelete`, identical to the rail card.
export function ProfileClipRow({
  clip,
  owned = false,
  onPlay,
  onEdit,
  onDelete,
}: {
  clip: ContributorClip;
  /** The viewer owns this clip (is the profile owner) → show the Edit/Delete row (§9.3). */
  owned?: boolean;
  onPlay: (clip: ContributorClip) => void;
  /** Open D2's Edit modal (owner only). */
  onEdit?: (clip: ContributorClip) => void;
  /** Open D2's Delete confirm dialog (owner only). */
  onDelete?: (clip: ContributorClip) => void;
}) {
  return (
    <article className="plus-card p-3">
      {/* §5.1 parent-topic line — the NEW context (top of the row). The whole topic title is an
          in-SPA link to `/topic/<Title>/` (the canonical route, via topicHref); "On" is a muted
          prefix. Tells the reader WHICH article this clip contextualizes (AC1). */}
      <p className="mb-2 text-[13px]">
        <span className="text-muted">On </span>
        <Link
          href={topicHref(clip.topicTitle)}
          aria-label={`On ${clip.topicTitle} — view this topic`}
          className="font-bold text-action hover:underline"
        >
          {clip.topicTitle}
        </Link>
        {/* Small enrichment (design §5.1): the placement (General / section) after the title. */}
        <span className="text-muted">
          {" · "}
          {clip.general ? "General" : clip.sectionLabel ?? "Section"}
        </span>
      </p>

      <VideoThumb video={clip} onPlay={() => onPlay(clip)} />

      {/* §5.2 creator credit — links OUT to the platform (CURATION §5.2, unchanged; the OUT half
          of the distinctness pair). Identical treatment to the clip card. */}
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

      {/* §5.3 chips + context note — reused unchanged from the clip card. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StanceChip stance={clip.stance} modifier={clip.stanceModifier} />
        <AccuracyChip flag={clip.accuracyFlag} modifier={clip.accuracyModifier} />
      </div>
      <div className="mt-2 border-l-4 border-brand bg-bg2 py-2 pl-3 pr-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-violet">
          Curator note
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-ink2">
          {clip.contextNote}
        </p>
      </div>

      {/* §9.3 owner-only Edit/Delete — only when the viewer is the profile's owner. Reuses D2's
          modals via the host; the WORD is the signal (never color-alone). `.srcbtn`-shaped
          secondary "Edit" + the `accred`-bordered destructive "Delete", a comfortable touch
          target on the profile (≥40px). */}
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
            className="border-2 border-ink bg-white px-3 py-1.5 text-[12px] font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(clip)}
            aria-label={`Delete your curation: ${clip.caption}`}
            className="border-2 border-accred bg-white px-3 py-1.5 text-[12px] font-bold text-accred hover:bg-accred hover:text-white"
          >
            Delete
          </button>
        </div>
      )}
    </article>
  );
}
