"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import {
  ACCURACY_LABEL,
  ACCURACY_ORDER,
  STANCE_LABEL,
  STANCE_ORDER,
} from "@/lib/curation/labels";
import {
  NOTE_LICENSE_AGREEMENT,
  NOTE_LICENSE_STATEMENT,
} from "@/lib/curation/note-license";
import { isMaterialNoteChange } from "@/lib/curation/note-text";
import type { AccuracyFlag, Stance } from "@/lib/data/types";

const NOTE_SOFT_CAP = 320; // CURATION C1 soft cap
const NOTE_MAX = 400; // hard ceiling (field maxlength), C1 guidance

// The shared curate fields (design §6.8 + D1 §3, extended for D2 §§4/6.2). Used by the Curate,
// Add (D1, ADD path) AND Edit (D2) modals. Note + live counter, closed-enum selects, section
// select, and the CC BY-SA note-license agreement — whose presentation differs per flow:
//
//   - ADD / Promote (D1): `alwaysRequired = true` (the default). The §5.3 agreement is
//     always visible + always a publish precondition (every publish is a new note).
//   - EDIT (D2): `alwaysRequired = false` + an `initialNote`. The agreement is HIDDEN on open
//     (the clip already carries a captured agreement) and REVEALS + becomes required only once
//     the note's normalized text diverges from the stored note — a MATERIAL note change
//     (Decision 3). A chip/section-only or whitespace-only edit never surfaces it; reverting
//     the text hides it again (a fresh unchecked box each time it re-diverges). The reveal sits
//     in an `aria-live="polite"` region so its mid-edit appearance is announced (design §4.3).
//
// The note text + the agreement are the two client-side publish PRECONDITIONS (design §3.2 /
// §4 / AC6 / AC10), lifted to the parent modal via `onPreconditionsChange` so the modal owns
// the disabled/pending state. For edit, the modal gates Save on `hasNote && (!materialNote ||
// agreed)` — the `materialNote` flag is reported here so the gate matches what is revealed.
export function CurateFields({
  sections,
  defaultSection = "__general",
  onPreconditionsChange,
  licenseStatementId,
  alwaysRequired = true,
  initialNote = "",
  initialStance = "explainer",
  initialAccuracy = "accurate",
  noteRef,
}: {
  sections: { slug: string; title: string }[];
  defaultSection?: string;
  /**
   * Reports the client-side publish preconditions up to the modal (design §3.2/§3.3 + §4):
   * `hasNote` (non-empty trimmed note), `agreed` (the CC BY-SA agreement checked), and
   * `materialNote` (the note text changed materially vs. the stored note — drives the EDIT
   * agreement gate; always `true` on the add path so the agreement is always required).
   */
  onPreconditionsChange?: (state: {
    hasNote: boolean;
    agreed: boolean;
    materialNote: boolean;
  }) => void;
  /**
   * Element id of the always-visible/revealed license statement, so the modal can point the
   * publish button's `aria-describedby` at it — making the "why unavailable" reason
   * discoverable to assistive tech (design §3.4 / §4.3 / AC6 / §12).
   */
  licenseStatementId?: string;
  /**
   * ADD path: `true` (default) — the agreement is always shown + always required. EDIT path:
   * `false` — the agreement is hidden on open and conditional on a material note change (§4).
   */
  alwaysRequired?: boolean;
  /** EDIT pre-fill: the clip's current note (also the materiality baseline — §4.1 / §6.2). */
  initialNote?: string;
  /** EDIT pre-fill: the clip's current stance (defaults to the add default). */
  initialStance?: Stance;
  /** EDIT pre-fill: the clip's current accuracy flag (defaults to the add default). */
  initialAccuracy?: AccuracyFlag;
  /**
   * Optional ref onto the Context note textarea so a parent can move focus to it on reveal
   * (issue #64, design §5/§7/§12.3: AddModal lands focus on the note when a media source resolves
   * or a placeholder is accepted). Unused by the Promote/Edit flows.
   */
  noteRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const [note, setNote] = useState(initialNote);
  // The agreement is UNCHECKED ON OPEN every time — a fresh per-submit act (design §3.1 / §4.1,
  // Decision D1-1). No "remember my choice"; the component mounts fresh per modal open.
  const [agreed, setAgreed] = useState(false);
  const agreementId = useId();
  const over = note.length > NOTE_SOFT_CAP;

  // Is the agreement currently SHOWN + REQUIRED? On the add path, always. On the edit path,
  // only once the normalized note text diverges from the stored note (a material change, §4).
  const materialNote =
    alwaysRequired || isMaterialNoteChange(initialNote, note);
  const showAgreement = materialNote;

  function emit(nextNote: string, nextAgreed: boolean) {
    const material =
      alwaysRequired || isMaterialNoteChange(initialNote, nextNote);
    onPreconditionsChange?.({
      hasNote: nextNote.trim().length > 0,
      agreed: nextAgreed,
      materialNote: material,
    });
  }

  // Emit the INITIAL preconditions on mount (issue #53 / D2): the EDIT path pre-fills the note,
  // so `hasNote` must reflect that immediately (else Save is wrongly disabled for a chip/section-
  // only edit). On the ADD path the note is empty → `hasNote=false`, matching D1's prior behavior.
  // A ref keeps the callback fresh without re-running on every re-render (mount-once).
  const onChangeRef = useRef(onPreconditionsChange);
  onChangeRef.current = onPreconditionsChange;
  useEffect(() => {
    onChangeRef.current?.({
      hasNote: initialNote.trim().length > 0,
      agreed: false,
      materialNote: alwaysRequired, // edit: not material until the note diverges
    });
    // Mount-once: the field's own onChange handlers carry every subsequent update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <Field label="Context note">
        <textarea
          ref={noteRef}
          name="note"
          rows={3}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            emit(e.target.value, agreed);
          }}
          placeholder="What's useful or off about this clip? Separate fact from the creator's opinion…"
          className="field"
        />
        <p className="mt-1 text-[11px] text-muted">
          1–3 sentences. Say what&apos;s established fact vs. the creator&apos;s
          take, why it&apos;s worth watching here, and any limits.
        </p>
        <p
          className={`mt-0.5 text-[11px] font-bold ${over ? "text-accred" : "text-muted"}`}
          aria-live="polite"
        >
          {over ? "over recommended length" : `${note.length}/${NOTE_SOFT_CAP}`}
        </p>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Stance">
          <select name="stance" className="field" defaultValue={initialStance}>
            {STANCE_ORDER.map((s: Stance) => (
              <option key={s} value={s}>
                {STANCE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Accuracy">
          <select name="accuracy" className="field" defaultValue={initialAccuracy}>
            {ACCURACY_ORDER.map((a: AccuracyFlag) => (
              <option key={a} value={a}>
                {ACCURACY_LABEL[a]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Section">
        <select name="section" className="field" defaultValue={defaultSection}>
          <option value="__general">General</option>
          {sections.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.title}
            </option>
          ))}
        </select>
      </Field>

      {/* CC BY-SA agreement (design §3 / §4 / AC6 / AC9 / CURATION §5.3). Sits directly above
          the modal's action row. Two parts, both carried by TEXT (never color alone, §3.4):
          an always-visible license statement + a required, unchecked-on-open checkbox that
          gates publish/save. ADD: always rendered (always required). EDIT: rendered ONLY on a
          material note change (§4), wrapped in an aria-live region so its mid-edit appearance
          is announced to AT (§4.3). Strictly about "my context note" — never conflated with
          creator credit (CURATION §5.2 / design §3.1). */}
      <div aria-live="polite" className={showAgreement ? "" : "sr-only"}>
        {showAgreement && (
          <div className="space-y-1 border-t border-hardbox/15 pt-3">
            <p id={licenseStatementId} className="text-[11px] text-muted">
              {NOTE_LICENSE_STATEMENT}
            </p>
            <label className="flex cursor-pointer items-start gap-2 text-[12px] text-ink-plus">
              <input
                id={agreementId}
                name="noteLicenseAgreed"
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  emit(note, e.target.checked);
                }}
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
              />
              <span>{NOTE_LICENSE_AGREEMENT}</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-violet">
        {label}
      </span>
      {children}
    </label>
  );
}
