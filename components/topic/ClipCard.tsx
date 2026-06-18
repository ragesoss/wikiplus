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

      {/* Held "in review" marking (D5b, design §3.2 / CURATION §7.1) — ABOVE the chips, so it reads
          as a status banner for the whole vouch. Rendered ONLY when the clip is held; a published
          clip is byte-for-byte its pre-D5b self. The chips/note/curator below stay intact. */}
      {clip.held && <HeldMarking />}

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

      {/* Provenance footer — D3 (issue #54, design §6.2) + D4 (issue #55, design §4): the bare
          `{curatedBy}` text evolved into the linked "context by <curator>" attribution (links IN
          to the curator's profile; distinct from the creator credit above which links OUT). D4
          replaces the static `▲ {upvotes}` span on the LEFT with the interactive `UpvoteControl`
          (the count + the per-viewer voted-state, a real `<button aria-pressed>`); the attribution
          sits on the right (where `curatedBy` was), with the relative `curatedAt` as trailing
          muted text. The DISPLAYED count is the DERIVED total `listClips` already computed
          (Decision 2). The control reads as "Log in to upvote" logged out (count still visible —
          §4.3); the per-viewer voted-state is off the cached read path (§8). */}
      <footer className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <UpvoteControl
          count={clip.upvotes ?? 0}
          voted={voted}
          signedIn={signedIn}
          surface="light"
          onActivate={() => onUpvote?.(clip)}
        />
        <span className="min-w-0 truncate text-right">
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
