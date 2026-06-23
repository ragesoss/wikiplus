"use client";

import { useId } from "react";
import type { Clip } from "@/lib/data/types";
import { AUTH_COPY } from "@/lib/auth/microcopy";
import { CurateFields } from "./CurateForm";
import { ModalActionRow } from "./ModalActionRow";
import { ModalShell } from "./ModalShell";
import { useCurateSubmit, type SubmitOutcome } from "./useCurateSubmit";
import { patchFromForm, type ClipEditFormPatch } from "./curate-clip";

// "Edit curation" modal (issue #53 / D2, design §6). A clone of D1's `CurateModal` that reuses
// the SAME surface (`CurateFields` / `ModalActionRow` / `ModalShell` / `useCurateSubmit`) with
// three deltas:
//   - PRE-FILLED from the clip (note / stance / accuracy / section — §6.2), not empty.
//   - the read-only clip summary shows the curated clip (caption + creator), WITHOUT D1's
//     "auto-suggested, not yet curated" line (this is a curated clip, not a candidate — §6.1).
//   - the §5.3 agreement is CONDITIONAL (`alwaysRequired={false}` + `initialNote`): hidden on
//     open, revealed + required only on a material note change (§4 — CurateFields owns this).
// The Save microcopy is "✓ Save changes" / "Saving…" (a revise, not a first publish). The host
// (TopicView) owns the write (the auth-gated `updateClipAction` via the seam), the in-place
// re-render, and the expired-session gate; it supplies `onSubmit`. Reached ONLY for the owner
// (the affordance renders only then) — but the SERVER gate is the real control regardless.
export function EditModal({
  clip,
  sections,
  onClose,
  onSubmit,
}: {
  clip: Clip;
  sections: { slug: string; title: string }[];
  onClose: () => void;
  /**
   * Persist the edit (host owns the write + in-place state). Resolves `{ outcome: "added" }` on
   * success (the modal closes; "added" is the shared success outcome) or `{ outcome: "expired" }`
   * when the session expired (host shows the gate); REJECTS on a generic server error (the modal
   * stays open with the edits intact + the §6 alert).
   */
  onSubmit: (patch: ClipEditFormPatch, agreed: boolean) => Promise<SubmitOutcome>;
}) {
  const titleId = useId();
  const licenseStatementId = useId();
  const submit = useCurateSubmit();

  // Pre-select the current section: "General" when the clip is general, else its slug (§6.2).
  const defaultSection = clip.general ? "__general" : clip.sectionSlug ?? "__general";

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={titleId}
      className="w-full max-w-lg"
      initialFocusSelector="textarea[name=note]"
    >
      <form
        className="plus-card max-h-[90vh] overflow-y-auto"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          void submit.run(
            () => onSubmit(patchFromForm(form, sections), submit.agreed),
            onClose
          );
        }}
      >
        <div className="flex items-center justify-between border-b-2 border-hardbox bg-brand px-3 py-2 text-white">
          <h2 id={titleId} className="plus-disp text-lg font-bold">
            Edit curation
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="text-lg font-bold"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-4">
          {/* Read-only clip summary (§6.1): the curated clip's caption + creator/platform —
              NO "auto-suggested" line (this is a curated clip). The media/creator identity is
              NOT editable (Decision 2). */}
          <div className="border-l-4 border-brand bg-surface-2 px-3 py-2">
            <p className="text-[13px] font-bold text-ink-plus">{clip.caption}</p>
            <p className="text-[11px] text-ink2">
              Your curation · {clip.creator.name} · {clip.platformLabel}
            </p>
          </div>
          <CurateFields
            sections={sections}
            defaultSection={defaultSection}
            onPreconditionsChange={submit.setPreconditions}
            licenseStatementId={licenseStatementId}
            // EDIT: the agreement is conditional on a material note change (§4), not always
            // required; pre-fill from the clip's current values (§6.2).
            alwaysRequired={false}
            initialNote={clip.contextNote}
            initialStance={clip.stance}
            initialAccuracy={clip.accuracyFlag}
          />
          <ModalActionRow
            publishIdleLabel="✓ Save changes"
            publishBusyLabel="Saving…"
            canPublish={submit.hasNote && (!submit.materialNote || submit.agreed)}
            pending={submit.pending}
            error={submit.error}
            // D5a (design §5.1/§5.3): the edit modal is a counted gated write — on the rate-limit
            // outcome show the calm limit notice; otherwise the D2 generic "Couldn't save" red error.
            variant={submit.errorKind === "limited" ? "limit" : "error"}
            errorMessage={
              submit.errorKind === "limited"
                ? AUTH_COPY.rateLimit.notice
                : "Couldn't save — please try again."
            }
            licenseStatementId={licenseStatementId}
            onCancel={onClose}
          />
        </div>
      </form>
    </ModalShell>
  );
}
