"use client";

import { useState } from "react";
import {
  ACCURACY_LABEL,
  ACCURACY_ORDER,
  STANCE_LABEL,
  STANCE_ORDER,
} from "@/lib/curation/labels";
import type { AccuracyFlag, Stance } from "@/lib/data/types";

const NOTE_SOFT_CAP = 320; // CURATION C1 soft cap
const NOTE_MAX = 400; // hard ceiling (field maxlength), C1 guidance

// The shared curate fields (design §6.8) used by both the Curate and Add modals.
// Note + live counter, closed-enum selects, section select, CC BY-SA notice.
export function CurateFields({
  sections,
  defaultSection = "__general",
}: {
  sections: { slug: string; title: string }[];
  defaultSection?: string;
}) {
  const [note, setNote] = useState("");
  const over = note.length > NOTE_SOFT_CAP;

  return (
    <div className="space-y-4">
      <Field label="Context note">
        <textarea
          name="note"
          rows={3}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
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

      <p className="text-[11px] text-muted">
        By publishing, you agree to release your context note under CC BY-SA 4.0.
      </p>
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
