"use client";

import { useId, useState } from "react";
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
import type { AccuracyFlag, Stance } from "@/lib/data/types";

const NOTE_SOFT_CAP = 320; // CURATION C1 soft cap
const NOTE_MAX = 400; // hard ceiling (field maxlength), C1 guidance

// The shared curate fields (design §6.8 + D1 §3) used by both the Curate and Add modals.
// Note + live counter, closed-enum selects, section select, and — the D1 delta — the
// REQUIRED + always-visible CC BY-SA note-license agreement (replacing the old passive line).
//
// The note text and the agreement checkbox are the two client-side publish PRECONDITIONS
// (design §3.2 / AC6 / AC10), so this component LIFTS those two signals to the parent modal
// via `onPreconditionsChange` — the modal owns the publish button's disabled/pending state and
// the gated submit. Stance/accuracy/section stay uncontrolled `name=` fields read off the form
// at submit (they default to valid enum values, so they are never a blocking precondition).
export function CurateFields({
  sections,
  defaultSection = "__general",
  onPreconditionsChange,
  licenseStatementId,
}: {
  sections: { slug: string; title: string }[];
  defaultSection?: string;
  /**
   * Reports the two client-side publish preconditions up to the modal (design §3.2/§3.3):
   * `hasNote` (non-empty trimmed note) and `agreed` (the required CC BY-SA agreement checked).
   * The modal disables/enables the publish control from these.
   */
  onPreconditionsChange?: (state: { hasNote: boolean; agreed: boolean }) => void;
  /**
   * Element id of the always-visible license statement, so the modal can point the publish
   * button's `aria-describedby` at it — making the "why is publish unavailable" reason
   * discoverable to assistive tech (design §3.4 / AC6 / §12).
   */
  licenseStatementId?: string;
}) {
  const [note, setNote] = useState("");
  // The agreement is UNCHECKED ON OPEN every time — a fresh per-submit act (design §3.1,
  // Decision D1-1). No "remember my choice"; the component mounts fresh per modal open.
  const [agreed, setAgreed] = useState(false);
  const agreementId = useId();
  const over = note.length > NOTE_SOFT_CAP;

  function emit(nextNote: string, nextAgreed: boolean) {
    onPreconditionsChange?.({
      hasNote: nextNote.trim().length > 0,
      agreed: nextAgreed,
    });
  }

  return (
    <div className="space-y-4">
      <Field label="Context note">
        <textarea
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
          <select name="stance" className="field" defaultValue="explainer">
            {STANCE_ORDER.map((s: Stance) => (
              <option key={s} value={s}>
                {STANCE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Accuracy">
          <select name="accuracy" className="field" defaultValue="accurate">
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

      {/* Required CC BY-SA agreement (design §3 / AC6 / CURATION §5.3). Sits directly above
          the modal's action row. Two parts, both carried by TEXT (never color alone, §3.4):
          an always-visible license statement + a required, unchecked-on-open checkbox that
          gates publish. Strictly about "my context note" — never conflated with creator
          credit (CURATION §5.2 / design §3.1). */}
      <div className="space-y-1 border-t border-ink/15 pt-3">
        <p id={licenseStatementId} className="text-[11px] text-muted">
          {NOTE_LICENSE_STATEMENT}
        </p>
        <label className="flex cursor-pointer items-start gap-2 text-[12px] text-ink">
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
