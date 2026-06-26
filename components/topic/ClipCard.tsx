"use client";

import type { Clip } from "@/lib/data/types";
import { AccuracyChip, StanceChip } from "./Chips";
import { ContextByLink } from "./ContextByLink";
import { HeldMarking } from "./HeldMarking";
import { ReviewRow } from "./ReviewRow";
import { UpvoteControl } from "./UpvoteControl";
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
  signedIn = false,
  voted = false,
  onUpvote,
  onPlay,
  onGoToSection,
  onEdit,
  onDelete,
  canHold = false,
  canApprove = false,
  canRemove = false,
  reviewInFlight = false,
  onHold,
  onApprove,
  onRemove,
  cardRef,
}: {
  clip: Clip;
  active: boolean;
  /** The signed-in viewer owns this clip → show the Edit/Delete row (design §3.1). */
  owned?: boolean;
  /** D4 (issue #55): is the viewer signed in (a real toggle vs. the login gate — §3). */
  signedIn?: boolean;
  /** D4 (issue #55): has THIS viewer upvoted this clip (the per-viewer voted-state — §8). */
  voted?: boolean;
  /** D4 (issue #55): activate the upvote control — the host's optimistic toggle / gate route. */
  onUpvote?: (clip: Clip) => void;
  onPlay: (clip: Clip) => void;
  onGoToSection: (slug: string | undefined) => void;
  /** Open the Edit modal for this clip (owner only — design §2.1). */
  onEdit?: (clip: Clip) => void;
  /** Open the Delete confirm dialog for this clip (owner only — design §2.2). */
  onDelete?: (clip: Clip) => void;
  /** D5b (issue #58, design §4.1): show "Hold for review" (moderator-any OR own-curator, published). */
  canHold?: boolean;
  /** D5b (issue #58, design §4.1): show "Approve" (moderator only, held clip). */
  canApprove?: boolean;
  /** D5c (issue #59, design §4.1): show "Remove (moderator)" (moderator only, any clip — no own-curator arm). */
  canRemove?: boolean;
  /** D5b (issue #58, design §5.2): a hold/approve for THIS clip is in flight → busy word + disable. */
  reviewInFlight?: boolean;
  /** D5b (issue #58): activate Hold (host's runHold → role-gated holdClipAction). */
  onHold?: (clip: Clip) => void;
  /** D5b (issue #58): activate Approve (host's runApprove → role-gated reviewClipAction). */
  onApprove?: (clip: Clip) => void;
  /** D5c (issue #59): open the Remove confirm for this clip (host's setRemoveFor → removeClipAction). */
  onRemove?: (clip: Clip) => void;
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
        className="mb-1.5 block text-[11px] font-bold text-link hover:underline"
      >
        ↳ {clip.general ? "General" : clip.sectionLabel ?? "Section"}
      </button>

      <VideoThumb video={clip} onPlay={() => onPlay(clip)} />

      {/* creator credit (CURATION §5.2 / C10). The credit links OUT to the creator when there is a
          real `creator.url`. For an UNRESOLVED add-by-link clip (issue #64, C10) `creator.url` is
          absent — the credit must NOT render a dead/empty outbound link, so it degrades to a
          non-linked span (the read-path realization of "no fake/dead creator link"; design §7). The
          handle is shown only when present — an unresolved clip carries none (name-only). */}
      <CreatorCredit clip={clip} />

      {/* Held "in review" marking (D5b, design §3.2 / CURATION §7.1) — ABOVE the chips, so it reads
          as a status banner for the whole vouch. Rendered ONLY when the clip is held; a published
          clip is byte-for-byte its pre-D5b self. The chips/note/curator below stay intact. */}
      {clip.held && <HeldMarking />}

      {/* Chips row — stance + accuracy chips, then the upvote as the last item, so the upvote reads
          as "a tag among the chips" on every curated surface (matches the General band; design
          §"Curated-tile anatomy"). `items-center` aligns the chip-height tag with the chips. The
          upvote keeps its full state model via `appearance="tag"`: signed-in interactive
          `aria-pressed` toggle (▲/△ + "Voted"); logged-out non-interactive figure; count 0 → nothing. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StanceChip stance={clip.stance} modifier={clip.stanceModifier} />
        <AccuracyChip flag={clip.accuracyFlag} modifier={clip.accuracyModifier} />
        <UpvoteControl
          count={clip.upvotes ?? 0}
          voted={voted}
          signedIn={signedIn}
          surface="light"
          appearance="tag"
          onActivate={() => onUpvote?.(clip)}
        />
      </div>

      {/* curator note (CURATION §1) */}
      <div className="mt-2 border-l-4 border-brand bg-surface-2 py-2 pl-3 pr-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-violet">
          Curator note
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-ink2">
          {clip.contextNote}
        </p>
      </div>

      {/* Provenance footer — D3 (issue #54, design §6.2): the linked "context by <curator>"
          attribution (links IN to the curator's profile; distinct from the creator credit above which
          links OUT), with the relative `curatedAt` as trailing muted text. With the upvote now riding
          the chips row above (a tag among the chips), the footer is a single unpaired line — so it
          runs full-width, left-aligned, rather than balanced across a row. */}
      <footer className="mt-2 text-[11px]">
        <span className="block min-w-0 truncate">
          <ContextByLink curatedBy={clip.curatedBy} surface="light" />
          {clip.curatedAt ? (
            <span className="text-muted"> · {clip.curatedAt}</span>
          ) : null}
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
          className="mt-2 flex flex-wrap gap-2 border-t border-hardbox/15 pt-2"
        >
          <button
            type="button"
            onClick={() => onEdit?.(clip)}
            aria-label={`Edit your curation: ${clip.caption}`}
            className="border-2 border-hardbox bg-surface-raised px-2.5 py-1 text-[12px] font-bold text-ink-plus hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(clip)}
            aria-label={`Delete your curation: ${clip.caption}`}
            className="border-2 border-accred bg-surface-raised px-2.5 py-1 text-[12px] font-bold text-accred hover:bg-accred hover:text-white"
          >
            Delete
          </button>
        </div>
      )}

      {/* Reviewer-only Hold/Approve manage-row (D5b, design §4) — a SECOND group, parallel to and
          below the owner row, rendered ONLY for the authorized viewer. The server-side role-gate is
          the security control; this row mirrors but never replaces it. */}
      <ReviewRow
        clip={clip}
        canHold={canHold}
        canApprove={canApprove}
        canRemove={canRemove}
        inFlight={reviewInFlight}
        onHold={onHold}
        onApprove={onApprove}
        onRemove={onRemove}
        size="rail"
      />
    </article>
  );
}

/**
 * The creator credit (CURATION §5.2 / C10). Links OUT to the creator's platform when `creator.url`
 * is present; otherwise (an UNRESOLVED add-by-link clip — issue #64) degrades to a NON-LINKED span
 * so the card never renders a dead/empty outbound link (design §7, the read-path realization of
 * C10's "no fake/dead creator link"). The "{handle} · {platform}" line drops the handle when it is
 * absent (an unresolved clip carries no handle — name-only credit, C10), showing the platform alone.
 */
function CreatorCredit({ clip }: { clip: Clip }) {
  const avatar = (
    <span
      aria-hidden
      className={`h-7 w-7 shrink-0 rounded-full border-2 border-hardbox bg-gradient-to-br ${
        clip.creator.avatarGrad ?? "from-brand to-violet"
      }`}
    />
  );
  const text = (
    <span className="min-w-0">
      <span className="block truncate text-[12px] font-bold text-ink-plus">
        {clip.creator.name}
      </span>
      <span className="block truncate text-[11px] text-muted">
        {clip.creator.handle
          ? `${clip.creator.handle} · ${clip.platformLabel}`
          : clip.platformLabel}
      </span>
    </span>
  );

  if (clip.creator.url) {
    return (
      <a
        href={clip.creator.url}
        target="_blank"
        rel="noopener"
        className="mt-2 flex items-center gap-2"
      >
        {avatar}
        {text}
      </a>
    );
  }
  // No outbound link (unresolved credit, C10): a non-linked span, never an empty/dead <a>.
  return <span className="mt-2 flex items-center gap-2">{avatar}{text}</span>;
}
