"use client";

import { useEffect, useRef } from "react";

// The shared action area for the Promote / Add modals (issue #52 / D1, design §§5–6).
// Renders the in-modal notice (above the buttons, so it is seen at the point of retry) + the
// publish/cancel row, with the publish control's disabled/pending wiring.
//
// The publish button is `disabled` until the preconditions hold (design §3.2 / AC6 / AC10) and
// while a write is pending (no double-submit — §5 / AC11); its accessible "why unavailable"
// reason is wired via `aria-describedby` → the license statement (design §3.4). Cancel stays
// enabled throughout (the user can abandon mid-flight — §5).
//
// TWO notice VARIANTS (issue #57 / D5a, design §5.1 / §4 — AC3):
//   - "error" (default, D1): a real server/boundary FAILURE. RED alert (2px accred border,
//     #FDEDED fill, accred text), role="alert" (assertive), and it STEALS FOCUS so a keyboard/SR
//     user lands on it. Copy: "Couldn't publish — please try again." (or the per-modal override).
//   - "limit" (D5a): the per-identity write rate-limit. A CALM, NON-RED note (2px brand border,
//     pale bg2 fill, ink text), role="status" aria-live="polite" (informational, NOT assertive),
//     and it does NOT steal focus (the user is mid-action; focus stays on the idle publish control
//     they can retry after a moment). Copy: the §3 limit string. NO red, NO gold.
// The two are DISTINCT by words (different sentences), role (alert vs status), and treatment
// (red vs calm) — and the distinction survives with no color (the words carry it).
export function ModalActionRow({
  publishIdleLabel,
  publishBusyLabel,
  canPublish,
  pending,
  error,
  errorMessage = "Couldn't publish — please try again.",
  variant = "error",
  licenseStatementId,
  onCancel,
}: {
  /** e.g. "✓ Publish curation" / "＋ Add & curate" / "✓ Save changes". */
  publishIdleLabel: string;
  /** e.g. "Publishing…" / "Adding…" / "Saving…" (present-progressive busy WORD — §5). */
  publishBusyLabel: string;
  /** Preconditions met (note + agreement + any flow gate). When false, publish is disabled. */
  canPublish: boolean;
  pending: boolean;
  /** A notice is showing. With `variant="error"` it is the §6 failure; with "limit" the D5a notice. */
  error: boolean;
  /** The notice text. Defaults to the D1 publish wording; D5a passes the §3 limit string for "limit". */
  errorMessage?: string;
  /** Which notice treatment to render (issue #57 / D5a, design §5.1). Defaults to the D1 red error. */
  variant?: "error" | "limit";
  /** The always-visible license statement's id — the publish button's `aria-describedby`. */
  licenseStatementId: string;
  onCancel: () => void;
}) {
  const alertRef = useRef<HTMLDivElement>(null);

  // On a generic server error (design §6): send focus to the alert so a keyboard/SR user lands on
  // the message; the modal's focus trap keeps them inside the dialog. Announced via role="alert".
  // The "limit" variant is informational + polite (design §7) — it is announced via role="status"
  // WITHOUT stealing focus (the user is mid-retry; focus stays on the idle publish control).
  useEffect(() => {
    if (error && variant === "error") alertRef.current?.focus();
  }, [error, variant]);

  const disabled = !canPublish || pending;

  return (
    <>
      {error &&
        (variant === "limit" ? (
          // D5a: calm, non-red, informational — a NOTE, not an alarm (design §5.1 / §5.4).
          <div
            role="status"
            aria-live="polite"
            className="border-2 border-brand bg-bg2 px-3 py-2 text-[12px] font-semibold text-ink"
          >
            {errorMessage}
          </div>
        ) : (
          // D1: the generic red failure alert (assertive, focus-grabbing).
          <div
            ref={alertRef}
            role="alert"
            tabIndex={-1}
            className="border-2 border-accred bg-[#FDEDED] px-3 py-2 text-[12px] font-semibold text-accred"
          >
            {errorMessage}
          </div>
        ))}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={disabled}
          aria-describedby={licenseStatementId}
          className="border-2 border-ink bg-brand px-3 py-2 text-sm font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
        >
          {pending ? publishBusyLabel : publishIdleLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink"
        >
          Cancel
        </button>
      </div>
    </>
  );
}
