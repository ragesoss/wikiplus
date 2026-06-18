"use client";

import { useId } from "react";
import type { Candidate, Clip } from "@/lib/data/types";
import { AUTH_COPY } from "@/lib/auth/microcopy";
import { CurateFields } from "./CurateForm";
import { ModalActionRow } from "./ModalActionRow";
import { ModalShell } from "./ModalShell";
import { useCurateSubmit, type SubmitOutcome } from "./useCurateSubmit";
import { clipFromForm } from "./curate-clip";

// "Curate this clip" modal (design §6.8 + D1). Promotes a candidate into a persisted, curated,
// attributed clip (issue #52 / D1, AC1): assembles a `Clip` from the candidate's media/creator
// fields + the curate form values, requires the CC BY-SA agreement (AC6), and runs the real
// submit lifecycle (pending/success/error/expired — §§5–7). The host (TopicView) owns the write
// + clip-state update + candidate dedup + the expired-session gate; it supplies `onSubmit`.
export function CurateModal({
  candidate,
  sections,
  onClose,
  onSubmit,
}: {
  candidate: Candidate | null;
  sections: { slug: string; title: string }[];
  onClose: () => void;
  /**
   * Persist the assembled clip (host owns the write + state). Resolves `{ outcome: "added" }`
   * on success or `{ outcome: "expired" }` when the session expired (host shows the gate);
   * REJECTS on a generic server error (the modal stays open + shows the alert).
   */
  onSubmit: (
    clip: Omit<Clip, "id" | "createdAt">,
    agreed: boolean
  ) => Promise<SubmitOutcome>;
}) {
  const titleId = useId();
  const licenseStatementId = useId();
  const submit = useCurateSubmit();

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
          if (!candidate) return;
          const form = e.currentTarget;
          void submit.run(
            () =>
              onSubmit(clipFromForm(form, candidate, sections), submit.agreed),
            onClose
          );
        }}
      >
        <div className="flex items-center justify-between border-b-2 border-ink bg-brand px-3 py-2 text-white">
          <h2 id={titleId} className="plus-disp text-lg font-bold">
            Curate this clip
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
          {candidate && (
            <div className="border-l-4 border-brand bg-bg2 px-3 py-2">
              <p className="text-[13px] font-bold text-ink">{candidate.caption}</p>
              <p className="text-[11px] text-ink2">
                {candidate.creator.name} · {candidate.platformLabel} —
                auto-suggested, not yet curated
              </p>
            </div>
          )}
          <CurateFields
            sections={sections}
            defaultSection={
              candidate && !candidate.general
                ? candidate.sectionSlug ?? "__general"
                : "__general"
            }
            onPreconditionsChange={submit.setPreconditions}
            licenseStatementId={licenseStatementId}
          />
          <ModalActionRow
            publishIdleLabel="✓ Publish curation"
            publishBusyLabel="Publishing…"
            canPublish={
              submit.hasNote && (!submit.materialNote || submit.agreed)
            }
            pending={submit.pending}
            error={submit.error}
            // D5a (design §5.1): on the rate-limit outcome render the calm limit notice + copy;
            // otherwise the D1 generic red error (the default message).
            variant={submit.errorKind === "limited" ? "limit" : "error"}
            errorMessage={
              submit.errorKind === "limited"
                ? AUTH_COPY.rateLimit.notice
                : undefined
            }
            licenseStatementId={licenseStatementId}
            onCancel={onClose}
          />
        </div>
      </form>
    </ModalShell>
  );
}
