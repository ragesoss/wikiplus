"use client";

import { useId } from "react";
import type { Candidate } from "@/lib/data/types";
import { CurateFields } from "./CurateForm";
import { ModalShell } from "./ModalShell";

// "Curate this clip" modal (design §6.8, AC19). Mock submit (A7): closes, no
// persistence this round.
export function CurateModal({
  candidate,
  sections,
  onClose,
}: {
  candidate: Candidate | null;
  sections: { slug: string; title: string }[];
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <ModalShell
      onClose={onClose}
      labelledBy={titleId}
      className="w-full max-w-lg"
      initialFocusSelector="textarea[name=note]"
    >
      <form
        className="plus-card max-h-[90vh] overflow-y-auto"
        onSubmit={(e) => {
          e.preventDefault();
          onClose(); // mock submit — no persistence (A7)
        }}
      >
        <div className="flex items-center justify-between border-b-2 border-ink bg-brand px-3 py-2 text-white">
          <h2 id={titleId} className="plus-disp text-lg font-bold">
            Curate this clip
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
          {candidate && (
            <div className="border-l-4 border-brand bg-bg2 px-3 py-2">
              <p className="text-[13px] font-bold text-ink">{candidate.caption}</p>
              <p className="text-[11px] text-ink2">
                {candidate.creator.name} · {candidate.platformLabel} —
                auto-suggested, not yet curated
              </p>
            </div>
          )}
          <CurateFields
            sections={sections}
            defaultSection={
              candidate && !candidate.general
                ? candidate.sectionSlug ?? "__general"
                : "__general"
            }
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="border-2 border-ink bg-brand px-3 py-2 text-sm font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
            >
              ✓ Publish curation
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
