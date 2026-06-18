"use client";

import type { Clip } from "@/lib/data/types";

// The reviewer-only Hold / Approve manage-row (issue #58 / D5b — design §4). A SECOND `role="group"`
// row parallel to the D2 owner Edit/Delete row ("Manage your curated clip"), gated on the REVIEWER
// predicates, NOT ownership-to-edit. It is the CONVENIENCE layer — the server-side role-gate inside
// `holdClipAction`/`reviewClipAction` is the security control (AC4/AC5); this row mirrors but never
// replaces it. Rendered ONLY for the authorized viewer (the host decides `canHold`/`canApprove` from
// the off-read-path `isModerator` + `ownsClip` session checks — §4.1); an anonymous reader and a
// plain non-moderator see nothing here, so the read-path render is byte-for-byte unchanged.
//
//   - "Hold for review" (ink secondary — a neutral review pause, never accred/red): a moderator on
//     any PUBLISHED clip, or the clip's own curator on their own published clip (§4.1).
//   - "Approve" (action-blue affirming — restore the vouch): a MODERATOR on a HELD clip only (§4.1).
//   - "Remove (moderator)" (D5c, issue #59, design §4.2): the §7 abuse-removal act — MODERATOR-ONLY,
//     on ANY clip (NO own-curator arm). Placed LAST (after Hold/Approve) so the moderator acts read
//     least-destructive → most-destructive. RESTRAINED `accred` destructive treatment (white fill +
//     accred border/text; hover → accred fill + white) — the SAME red family as D2 Delete, but the
//     WORD + SCOPE ("(moderator)") is the tell (§3). It opens the RemoveConfirmDialog (it does NOT
//     remove directly — design §4.3), so it carries NO in-flight busy word on the affordance itself.
//
// Busy state shows the busy WORD ("Holding…" / "Approving…") and disables the control (no
// double-submit — the host's per-clip in-flight guard). The WORD is the signal (never color-alone).

export function ReviewRow({
  clip,
  canHold,
  canApprove,
  canRemove = false,
  inFlight = false,
  onHold,
  onApprove,
  onRemove,
  size = "rail",
}: {
  clip: Clip;
  /** Show "Hold for review" — moderator (any) OR own-curator, on a published clip (§4.1). */
  canHold: boolean;
  /** Show "Approve" — moderator only, on a held clip (§4.1). */
  canApprove: boolean;
  /** D5c (issue #59, §4.1): show "Remove (moderator)" — MODERATOR ONLY, any clip (NO own-curator arm). */
  canRemove?: boolean;
  /** A hold/approve for THIS clip is in flight (the host's per-clip guard) → disable + busy word. */
  inFlight?: boolean;
  onHold?: (clip: Clip) => void;
  onApprove?: (clip: Clip) => void;
  /** D5c (issue #59): open the RemoveConfirmDialog for this clip (moderator only — design §4.3). */
  onRemove?: (clip: Clip) => void;
  /** "rail" = ClipCard sizing; "tile" = the narrow w-44 GeneralStrip tile (smaller text/padding). */
  size?: "rail" | "tile";
}) {
  if (!canHold && !canApprove && !canRemove) return null;

  const rail = size === "rail";
  const text = rail ? "text-[12px]" : "text-[11px]";
  const pad = rail ? "px-2.5 py-1" : "px-2 py-1";
  const gap = rail ? "gap-2" : "gap-1.5";
  const wrap = rail
    ? "mt-2 flex flex-wrap gap-2 border-t border-ink/15 pt-2"
    : "mt-1.5 flex flex-wrap gap-1.5";

  return (
    <div role="group" aria-label="Review this clip" className={`${wrap} ${gap}`}>
      {canHold && (
        <button
          type="button"
          disabled={inFlight}
          onClick={() => onHold?.(clip)}
          aria-label={`Hold for review: ${clip.caption}`}
          className={`border-2 border-ink bg-white ${pad} ${text} font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C] disabled:opacity-60`}
        >
          {inFlight ? "Holding…" : "Hold for review"}
        </button>
      )}
      {canApprove && (
        <button
          type="button"
          disabled={inFlight}
          onClick={() => onApprove?.(clip)}
          aria-label={`Approve this clip: ${clip.caption}`}
          className={`border-2 border-action bg-action ${pad} ${text} font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C] disabled:opacity-60`}
        >
          {inFlight ? "Approving…" : "Approve"}
        </button>
      )}
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove?.(clip)}
          aria-label={`Remove this clip (moderator action): ${clip.caption}`}
          className={`border-2 border-accred bg-white ${pad} ${text} font-bold text-accred hover:bg-accred hover:text-white`}
        >
          Remove (moderator)
        </button>
      )}
    </div>
  );
}
