"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Clip } from "@/lib/data/types";
import { AUTH_COPY } from "@/lib/auth/microcopy";
import {
  REMOVAL_NOTE_MAXLENGTH,
  REMOVAL_REASON_LABELS,
  REMOVAL_REASON_NONE_LABEL,
  REMOVAL_REASON_ORDER,
  composeRemovalReason,
  type RemovalReasonCategory,
} from "@/lib/curation/removal-reason";
import { ModalShell } from "./ModalShell";
import type { SubmitOutcome } from "./useCurateSubmit";

// The moderator Remove confirmation dialog (issue #59 / D5c, design §5). PARALLELS the D2
// DeleteConfirmDialog (the same ModalShell yes/no, SubmitOutcome contract, `alive`/`pending`
// guards, Cancel-as-focused-default, pending word, role="alert" generic error / calm `limited`
// notice / expired-gate) and ADDS the OPTIONAL, AUDIT-ONLY removal-reason capture (§5.2). It is
// NOT a redesign and NOT the curate surface (there is nothing to edit) — a yes/no PLUS an optional
// reason. Distinct from D2 Delete: the WORD + SCOPE carries it ("Remove (moderator)" / "Remove
// clip"), and the body copy is the SOFT/REVERSIBLE framing (a tombstone, not a permanent erase).
//
//   - INITIAL FOCUS lands on CANCEL (the safe default, §5.4): a reflexive Enter/Space on open
//     cancels, never removes. Esc / backdrop also cancel (ModalShell).
//   - "Remove clip" is the destructive confirm: bg darkened to #B83A3A so white-on-red clears WCAG
//     AA (§7 — #C44949 is ≈4.0:1). The WORD is the signal; red reinforces (never color-alone).
//     Enabled REGARDLESS of whether a reason is chosen (Decision 4 — the reason NEVER gates it).
//   - The optional reason (§5.2): the C9 §7-category <select> (default "No reason given") + an
//     optional free-text note. Both OPTIONAL, NEVER pre-filled from the clip's chips, NEVER shown
//     to a reader. The eyebrow makes the audit-only / not-reader-facing rule legible at capture.
//   - states mirror D2 §9.3 / D5a §5.3: pending ("Removing…", no double-submit, Cancel stays
//     enabled); generic error keeps the dialog open with a role="alert" message; rate-limit keeps
//     it open with the calm role="status" notice; expired session routes to the gate.
//
// The host (TopicView) owns the write (`removeClipAction` via the seam), the in-place removal from
// the in-memory `clips` set (no reload), the post-removal focus move to the band heading, and the
// expired gate; it supplies `onConfirm(reason)`.
const DESTRUCTIVE_RED = "#B83A3A"; // AA-safe white-on-red (design §7; the D2 DESTRUCTIVE_RED)

export function RemoveConfirmDialog({
  clip,
  onClose,
  onConfirm,
}: {
  clip: Clip;
  /** Cancel / close (no removal). Focus returns to the Remove trigger (ModalShell prevActive). */
  onClose: () => void;
  /**
   * Run the removal (host owns the write + removal + focus). Receives the OPTIONAL composed reason
   * (null when none chosen). Resolves `{ outcome: "added" }` on success (the dialog closes; the
   * host filtered the clip out), `{ outcome: "expired" }` on an expired session (host shows the
   * gate), or `{ outcome: "limited" }` on the rate-limit cap (dialog stays open, calm notice);
   * REJECTS on a generic server error (dialog stays open + shows the alert).
   */
  onConfirm: (reason: string | null) => Promise<SubmitOutcome>;
}) {
  const titleId = useId();
  const eyebrowId = useId();
  const categoryId = useId();
  const noteId = useId();
  const [pending, setPending] = useState(false);
  const [noticeKind, setNoticeKind] = useState<"none" | "generic" | "limited">(
    "none"
  );
  // The OPTIONAL reason capture (§5.2). Default = no reason: category "" (the "No reason given"
  // first option) + empty free-text. NEVER pre-filled from the clip's chips (§5.3); a removal with
  // no reason is valid (Decision 4) — neither control gates "Remove clip".
  const [category, setCategory] = useState<RemovalReasonCategory | "">("");
  const [note, setNote] = useState("");
  const alertRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // On a GENERIC server error, send focus to the alert (announced via role="alert"); the focus
  // trap keeps the keyboard/SR user inside the dialog. The "limited" notice is informational +
  // polite (role="status") and does NOT steal focus (§5.5) — the user stays on the controls.
  useEffect(() => {
    if (noticeKind === "generic") alertRef.current?.focus();
  }, [noticeKind]);

  async function confirm() {
    if (pending) return; // double-submit guard (§5.5)
    setNoticeKind("none");
    setPending(true);
    try {
      // Compose the optional, audit-only reason from the two controls (null when neither is given).
      const reason = composeRemovalReason(category || null, note);
      const res = await onConfirm(reason);
      if (!alive.current) return; // cancelled mid-flight — ignore the late resolve (§5.5)
      if (res.outcome === "added" || res.outcome === "expired") {
        // Success and the expired-session route both close the dialog (the host filtered the clip
        // out, or showed the expired gate).
        onClose();
      } else {
        // res.outcome === "limited" (D5a §5.3): the removal is a counted gated write and hit the
        // per-identity cap. KEEP the dialog open with the CALM limit notice; the confirm returns
        // to idle so the moderator can wait a moment and retry. Nothing was removed (AC2).
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
      // Initial focus on Cancel — the safe default (§5.4).
      initialFocusSelector="button[data-remove-cancel]"
    >
      <div className="plus-card">
        <div className="flex items-center justify-between border-b-2 border-hardbox bg-brand px-3 py-2 text-white">
          <h2 id={titleId} className="plus-disp text-lg font-bold">
            Remove this clip?
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
          {/* The SOFT/REVERSIBLE framing (§5.1, verbatim) — the deliberate contrast with D2's
              "permanently … can't be undone." A moderator removal is a tombstone, not an erase. */}
          <p className="text-[13px] leading-snug text-ink2">
            This removes the clip so it no longer shows on the topic. It&apos;s
            recorded for moderators and can be restored by an admin — not
            permanently deleted.
          </p>

          {/* The OPTIONAL, AUDIT-ONLY reason capture (§5.2). The eyebrow makes the C9 "audit-only,
              never reader-facing" rule + the optionality legible at the point of capture. */}
          <div className="space-y-2 border-t border-hardbox/15 pt-3">
            <p
              id={eyebrowId}
              className="text-[10px] font-bold uppercase tracking-wide text-violet"
            >
              Reason (optional — for moderators only, not shown to readers)
            </p>
            <div>
              <label
                htmlFor={categoryId}
                className="block text-[11px] font-semibold text-ink2"
              >
                Category
              </label>
              <select
                id={categoryId}
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as RemovalReasonCategory | "")
                }
                className="mt-0.5 w-full border-2 border-hardbox bg-surface-raised px-2 py-1.5 text-[12px] text-ink-plus"
              >
                <option value="">{REMOVAL_REASON_NONE_LABEL}</option>
                {REMOVAL_REASON_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {REMOVAL_REASON_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={noteId}
                className="block text-[11px] font-semibold text-ink2"
              >
                Add a note (optional)
              </label>
              <textarea
                id={noteId}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={REMOVAL_NOTE_MAXLENGTH}
                rows={2}
                placeholder="Specifics for the audit trail — e.g. affiliate links in the note to vendor X."
                className="mt-0.5 w-full resize-none border-2 border-hardbox bg-surface-raised px-2 py-1.5 text-[12px] text-ink-plus placeholder:text-muted"
              />
            </div>
          </div>

          {noticeKind === "generic" && (
            <div
              ref={alertRef}
              role="alert"
              tabIndex={-1}
              className="border-2 border-accred bg-[#FDEDED] px-3 py-2 text-[12px] font-semibold text-accred"
            >
              Couldn&apos;t remove — please try again.
            </div>
          )}
          {/* D5a §5.3/§5.4: the calm, non-red rate-limit notice — a NOTE, not an alarm. role="status"
              polite, ink-on-bg2, brand border. NO red, NO gold. The words carry the meaning. */}
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
              data-remove-cancel
              data-testid="remove-cancel"
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
              {pending ? "Removing…" : "Remove clip"}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
