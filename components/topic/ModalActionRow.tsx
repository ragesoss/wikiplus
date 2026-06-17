"use client";

import { useEffect, useRef } from "react";

// The shared action area for the Promote / Add modals (issue #52 / D1, design §§5–6).
// Renders the in-modal server-error alert (above the buttons, so it is seen at the point of
// retry) + the publish/cancel row, with the publish control's disabled/pending wiring.
//
// The publish button is `disabled` until the preconditions hold (design §3.2 / AC6 / AC10) and
// while a write is pending (no double-submit — §5 / AC11); its accessible "why unavailable"
// reason is wired via `aria-describedby` → the license statement (design §3.4). Cancel stays
// enabled throughout (the user can abandon mid-flight — §5).
export function ModalActionRow({
  publishIdleLabel,
  publishBusyLabel,
  canPublish,
  pending,
  error,
  licenseStatementId,
  onCancel,
}: {
  /** e.g. "✓ Publish curation" / "＋ Add & curate". */
  publishIdleLabel: string;
  /** e.g. "Publishing…" / "Adding…" (present-progressive busy WORD — §5, not a spinner alone). */
  publishBusyLabel: string;
  /** Preconditions met (note + agreement + any flow gate). When false, publish is disabled. */
  canPublish: boolean;
  pending: boolean;
  error: boolean;
  /** The always-visible license statement's id — the publish button's `aria-describedby`. */
  licenseStatementId: string;
  onCancel: () => void;
}) {
  const alertRef = useRef<HTMLDivElement>(null);

  // On a server error (design §6): send focus to the alert so a keyboard/SR user lands on the
  // message; the modal's focus trap keeps them inside the dialog. Announced via role="alert".
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  const disabled = !canPublish || pending;

  return (
    <>
      {error && (
        <div
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="border-2 border-accred bg-[#FDEDED] px-3 py-2 text-[12px] font-semibold text-accred"
        >
          Couldn&apos;t publish — please try again.
        </div>
      )}
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
