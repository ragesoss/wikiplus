// Shared note-text normalization for the §5.3 edit re-affirmation rule (issue #53 / D2,
// Decision 3 / AC9/AC10). Client-safe (no server-only import): the Edit modal uses it to
// decide whether to REVEAL the required CC BY-SA agreement (a material note change), and the
// Server Action uses it to decide whether to RE-STAMP `noteLicense` + `noteLicenseAgreedAt`.
//
// Both sides MUST agree on the same line, so the rule lives here once: a note edit is
// "material" iff the NORMALIZED text changed. Normalization = trim the ends + collapse every
// internal run of whitespace to a single space. So a pure whitespace/typo-spacing change that
// leaves the normalized text identical is NOT material (no re-stamp; no re-agreement prompt);
// any change to the normalized text IS material (re-stamp; the client reveals + requires the
// agreement). The client's reveal is the consent-capture surface; the SERVER is the authority
// on whether to stamp (it has the stored note) — the client boolean is never trusted as the
// stamp trigger (design §4.1).

/** Trim the ends and collapse internal whitespace runs to a single space (Decision 3). */
export function normalizeNote(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Is an edit from `before` → `after` a MATERIAL note-text change (Decision 3)? True iff the
 * normalized texts differ. A chip/section-only edit (same note) and a whitespace-only edit
 * are both NON-material (false).
 */
export function isMaterialNoteChange(before: string, after: string): boolean {
  return normalizeNote(before) !== normalizeNote(after);
}
