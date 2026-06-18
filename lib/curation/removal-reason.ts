// The single source of truth for the moderator-removal reason vocabulary (CURATION §7.2 /
// Decision C9; issue #59 / D5c). Client-safe (no server-only import): the RemoveConfirmDialog
// surfaces the labels; the persisted `removed_reason` may carry the enum value (+ optional
// free-text). Centralized so the confirm form AND a future moderation surface share ONE source
// (the C9 instruction — "centralized so the form and a future moderation surface share one
// source"), exactly as the §2/§3 stance/accuracy enums (lib/curation/labels.ts) are.
//
// BINDING (CURATION §7.2 / Decision 2/4):
//   - The reason is OPTIONAL — a removal needs no reason; "No reason given" is the default and
//     sends no `removed_reason`. The reason NEVER gates the removal.
//   - The reason is AUDIT-ONLY + NEVER reader-facing — it is display + audit metadata for a
//     future moderation surface, never rendered on the Topic page / the read's return shape /
//     a reader's bundle. A removed clip simply stops showing (no "removed for X" notice).
//   - The set IS the §7 removable list (one category per §7 clause), so the vocabulary stays
//     §7-consistent by construction. It NEVER classifies by `accuracy_flag` — a human moderator
//     judges abuse; the category records that judgment, it does not decide removability.

/** The C9 §7-aligned removal-reason category values (the persisted enum). */
export type RemovalReasonCategory =
  | "spam"
  | "promotion"
  | "off_topic"
  | "note_violation"
  | "hateful_or_illegal"
  | "deceptive_media"
  | "copyright"
  | "other";

/**
 * The verbatim C9 labels (UX text), in §7-list order — used VERBATIM in the confirm `<select>`
 * (design §5.2). Dev encodes the enum values; UX uses these strings. Do not paraphrase.
 */
export const REMOVAL_REASON_LABELS: Record<RemovalReasonCategory, string> = {
  spam: "Spam",
  promotion: "Self/affiliate promotion",
  off_topic: "No genuine relevance",
  note_violation: "Note violates the standard",
  hateful_or_illegal: "Hateful, harassing, or illegal",
  deceptive_media: "Deceptive / manipulated media",
  copyright: "Copyright-circumventing embed",
  other: "Other (see note)",
};

/** Stable display order for the confirm form's category options (the §7-list order above). */
export const REMOVAL_REASON_ORDER: readonly RemovalReasonCategory[] = [
  "spam",
  "promotion",
  "off_topic",
  "note_violation",
  "hateful_or_illegal",
  "deceptive_media",
  "copyright",
  "other",
] as const;

/** The default "no category" option label (design §5.2 — selected by default → no reason sent). */
export const REMOVAL_REASON_NONE_LABEL = "No reason given";

/** Max length for the optional free-text removal note (a moderator note, not an essay — design §5.2). */
export const REMOVAL_NOTE_MAXLENGTH = 280;

const CATEGORY_SET = new Set<string>(REMOVAL_REASON_ORDER);

/** Is `value` a known C9 removal-reason category? (Closed-set guard, like the stance/accuracy guards.) */
export function isRemovalReasonCategory(
  value: string
): value is RemovalReasonCategory {
  return CATEGORY_SET.has(value);
}

/**
 * Compose the OPTIONAL audit-only removal reason from the confirm form's two controls into the
 * single nullable string persisted in `clip.removed_reason` (Decision 4 — "the captured fact is
 * an optional reason string"). The captured shape is the §7-category value (when one is chosen)
 * and/or the free-text note, joined as `<category>: <note>` so both survive for the audit trail
 * and a future moderation surface can split them back. Returns `null` when NEITHER is given (a
 * removal with no reason is valid) — so `removed_reason` stays NULL, never an empty string.
 *
 * BINDING: this never gates the removal and is never shown to a reader; it is only the audit
 * metadata bound to the tombstone alongside `removed_by` / `removed_at`.
 */
export function composeRemovalReason(
  category: RemovalReasonCategory | null,
  note: string | undefined | null
): string | null {
  const trimmed = (note ?? "").trim();
  if (category && trimmed) return `${category}: ${trimmed}`;
  if (category) return category;
  if (trimmed) return trimmed;
  return null;
}
