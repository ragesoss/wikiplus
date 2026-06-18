"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shared submit state machine for the Promote (CurateModal) and Add (AddModal) flows
// (issue #52 / D1, design §§5–6). Both modals run the SAME real submit lifecycle —
// preconditions → pending → success/error — so it lives here once.
//
// The host (TopicView) owns the write + the clip-state update + the expired-session gate
// (it holds `useRequireLogin`), so it supplies a `submit` callback that:
//   - RESOLVES `{ outcome: "added" }`   → the write succeeded; the modal closes (host already
//                                           added the clip / deduped the candidate).
//   - RESOLVES `{ outcome: "expired" }` → an AuthRequiredError; the host has shown the
//                                           expired-session gate; the modal closes WITHOUT an
//                                           in-modal error (design §7.2 / AC9).
//   - REJECTS (any other error)         → a server/boundary failure; the modal STAYS OPEN with
//                                           the note + fields intact and shows the §6 alert
//                                           (AC11). Pending returns to idle so the curator can
//                                           retry; the agreement stays checked.
export type SubmitOutcome = { outcome: "added" | "expired" };

export interface CurateSubmitState {
  /** Non-empty trimmed note present (design §3.3 / AC10). */
  hasNote: boolean;
  /** CC BY-SA agreement checked (design §3.2 / AC6). */
  agreed: boolean;
  /**
   * Whether the agreement is currently REQUIRED (design §4). On the ADD path this is always
   * `true` (the agreement is always shown + required). On the EDIT path it is `true` only on a
   * material note change — so Save is gated on `hasNote && (!materialNote || agreed)`, letting a
   * chip/section-only edit save without re-agreeing (AC10) while a note rewrite must (AC9).
   */
  materialNote: boolean;
  /** A write is in flight (publish disabled + busy label; no double-submit — §5/AC11). */
  pending: boolean;
  /** A generic server/boundary error occurred; keep the modal open with the §6 alert (AC11). */
  error: boolean;
  setPreconditions: (s: {
    hasNote: boolean;
    agreed: boolean;
    materialNote: boolean;
  }) => void;
  /** Run the gated submit. No-op while pending (double-submit guard) or preconditions unmet. */
  run: (
    submit: () => Promise<SubmitOutcome>,
    onClose: () => void,
    extraReady?: boolean
  ) => Promise<void>;
}

export function useCurateSubmit(): CurateSubmitState {
  const [hasNote, setHasNote] = useState(false);
  const [agreed, setAgreed] = useState(false);
  // Defaults to `true` so the ADD path (which never reports `materialNote=false`) gates exactly
  // as before — the agreement is required. The EDIT path reports `false` for a non-material edit.
  const [materialNote, setMaterialNote] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  // `alive` guard (design §5): a write that resolves AFTER the modal is gone (cancelled
  // mid-flight) must not flip state / reopen / fire a stray close. Mirrors TopicView's pattern.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const setPreconditions = useCallback(
    (s: { hasNote: boolean; agreed: boolean; materialNote: boolean }) => {
      setHasNote(s.hasNote);
      setAgreed(s.agreed);
      setMaterialNote(s.materialNote);
    },
    []
  );

  const run = useCallback(
    async (
      submit: () => Promise<SubmitOutcome>,
      onClose: () => void,
      extraReady = true
    ) => {
      // Client-side publish/save preconditions (design §3.2/§3.3 + §4, AC9/AC10): a non-empty
      // note, the agreement WHEN it is required (always on add; only on a material note change
      // on edit), and any flow-specific gate (add-by-link's resolved link). Also a no-op while
      // pending (double-submit guard). The agreement clause `(!materialNote || agreed)` mirrors
      // the modal's `canPublish` so the button and the run-gate never disagree.
      if (pending || !hasNote || (materialNote && !agreed) || !extraReady) return;
      setError(false);
      setPending(true);
      try {
        const res = await submit();
        if (!alive.current) return; // cancelled mid-flight — ignore the late resolve (§5)
        // Both success and the expired-session route close the modal; the host has already
        // either added the clip (added) or shown the expired gate (expired).
        if (res.outcome === "added" || res.outcome === "expired") {
          onClose();
        }
      } catch {
        // Generic server/boundary error (NOT auth — the host converts that to "expired"):
        // keep the modal open, surface the alert, return publish to idle (AC11).
        if (!alive.current) return;
        setPending(false);
        setError(true);
        return;
      }
      if (alive.current) setPending(false);
    },
    [pending, hasNote, agreed, materialNote]
  );

  return {
    hasNote,
    agreed,
    materialNote,
    pending,
    error,
    setPreconditions,
    run,
  };
}
