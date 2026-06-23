"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Clip } from "@/lib/data/types";
import { AUTH_COPY } from "@/lib/auth/microcopy";
import { ModalShell } from "./ModalShell";
import type { SubmitOutcome } from "./useCurateSubmit";

// The Delete confirmation dialog (issue #53 / D2, design §9). A hard delete is irreversible
// (no undo / no trash — Decision 4), so this confirmation is the ONLY guard against an
// accidental destroy — a deliberate second act. A small yes/no `ModalShell` dialog (NOT the
// curate surface — there is nothing to edit):
//   - INITIAL FOCUS lands on CANCEL (the safe default, §9.2): a reflexive Enter/Space on open
//     cancels, never destroys. Esc / backdrop also cancel (ModalShell).
//   - "Delete clip" is the destructive confirm: `bg-accred` darkened to #B83A3A so white-on-red
//     clears WCAG AA (§10 — #C44949 is ≈4.0:1; QA verifies). The WORD is the signal; red
//     reinforces (never color-alone, CURATION §4).
//   - states mirror D1 §5/§6 (§9.3): pending ("Deleting…", no double-submit, Cancel stays
//     enabled); server error keeps the dialog open with a role="alert" message; expired session
//     routes to the gate (the host's `showExpiredGate`).
// The host (TopicView) owns the write (`deleteClipAction` via the seam), the in-place removal,
// the post-delete focus move to the band heading, and the expired gate; it supplies `onConfirm`.
const DESTRUCTIVE_RED = "#B83A3A"; // AA-safe white-on-red (design §10)

export function DeleteConfirmDialog({
  clip,
  onClose,
  onConfirm,
}: {
  clip: Clip;
  /** Cancel / close (no delete). Focus returns to the Delete trigger (ModalShell prevActive). */
  onClose: () => void;
  /**
   * Run the delete (host owns the write + removal + focus). Resolves `{ outcome: "added" }` on
   * success (the dialog closes; the host removed the clip) or `{ outcome: "expired" }` when the
   * session expired (host shows the gate); REJECTS on a generic server error (dialog stays open
   * + shows the alert).
   */
  onConfirm: () => Promise<SubmitOutcome>;
}) {
  const titleId = useId();
  const [pending, setPending] = useState(false);
  // Which notice is showing (issue #57 / D5a §5.3): "none", the generic red failure, or the calm
  // rate-limit notice. The dialog renders the limit calmly (non-red role="status") per its surface.
  const [noticeKind, setNoticeKind] = useState<"none" | "generic" | "limited">(
    "none"
  );
  const alertRef = useRef<HTMLDivElement>(null);
  // `alive` guard (design §9.3 / §5): a resolve after the dialog is gone (cancelled mid-flight)
  // must not flip state. Mirrors useCurateSubmit's pattern.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // On a GENERIC server error, send focus to the alert (announced via role="alert"); the focus
  // trap keeps the keyboard/SR user inside the dialog. The "limited" notice is informational +
  // polite (role="status") and does NOT steal focus (design §7) — the user stays on the controls.
  useEffect(() => {
    if (noticeKind === "generic") alertRef.current?.focus();
  }, [noticeKind]);

  async function confirm() {
    if (pending) return; // double-submit guard (§9.3)
    setNoticeKind("none");
    setPending(true);
    try {
      const res = await onConfirm();
      if (!alive.current) return; // cancelled mid-flight — ignore the late resolve (§9.3)
      if (res.outcome === "added" || res.outcome === "expired") {
        // Both success and the expired-session route close the dialog (the host removed the clip
        // or showed the expired gate).
        onClose();
      } else {
        // res.outcome === "limited" (D5a §5.3): the delete is a counted gated write and hit the
        // per-identity cap. KEEP the dialog open with the CALM limit notice; the confirm returns
        // to idle so the owner can wait a moment and retry. Nothing was deleted (AC2).
        setPending(false);
        setNoticeKind("limited");
      }
    } catch {
      if (!alive.current) return;
      setPending(false);
      setNoticeKind("generic");
    }
  }

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={titleId}
      className="w-full max-w-sm"
      // Initial focus on Cancel — the safe default (§9.2).
      initialFocusSelector="button[data-delete-cancel]"
    >
      <div className="plus-card">
        <div className="flex items-center justify-between border-b-2 border-hardbox bg-brand px-3 py-2 text-white">
          <h2 id={titleId} className="plus-disp text-lg font-bold">
            Delete this curation?
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
          <p className="text-[12px] font-bold text-ink-plus">{clip.caption}</p>
          <p className="text-[13px] leading-snug text-ink2">
            This permanently removes your context note, the stance and accuracy
            assessment, and this clip from the topic. This can&apos;t be undone.
          </p>
          {noticeKind === "generic" && (
            <div
              ref={alertRef}
              role="alert"
              tabIndex={-1}
              className="border-2 border-accred bg-[#FDEDED] px-3 py-2 text-[12px] font-semibold text-accred"
            >
              Couldn&apos;t delete — please try again.
            </div>
          )}
          {/* D5a §5.3/§5.4: the calm, non-red rate-limit notice — a NOTE, not an alarm. role="status"
              polite, ink-on-bg2, brand border. NO red, NO gold. The words carry the meaning (AC3). */}
          {noticeKind === "limited" && (
            <div
              role="status"
              aria-live="polite"
              className="border-2 border-brand bg-surface-2 px-3 py-2 text-[12px] font-semibold text-ink-plus"
            >
              {AUTH_COPY.rateLimit.notice}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-delete-cancel
              data-testid="delete-cancel"
              onClick={onClose}
              className="border-2 border-hardbox bg-surface-raised px-3 py-2 text-sm font-bold text-ink-plus"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={pending}
              style={{ backgroundColor: DESTRUCTIVE_RED }}
              className="border-2 border-hardbox px-3 py-2 text-sm font-bold text-white hover:shadow-[2px_2px_0_var(--color-hardbox-offset)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
            >
              {pending ? "Deleting…" : "Delete clip"}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
