"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { store } from "@/lib/data";
import {
  ACCURACY_LABEL,
  ACCURACY_ORDER,
  STANCE_LABEL,
  STANCE_ORDER,
} from "@/lib/curation/labels";
import type { AccuracyFlag, Stance } from "@/lib/data/types";
import { parseVideoUrl } from "@/lib/embed/facade";

// Closed CURATION enums (docs/CURATION_STANDARD.md §2/§3). The Topic Page v1 build
// is the full curation UX; this lightweight form remains for the prototype's
// existing add path.
const STANCES: Stance[] = STANCE_ORDER;
const ACCURACY: AccuracyFlag[] = ACCURACY_ORDER;

export default function ContributePage() {
  const [qid, setQid] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [stance, setStance] = useState<Stance>("explainer");
  const [accuracyFlag, setAccuracyFlag] = useState<AccuracyFlag>("accurate");
  const [error, setError] = useState<string | null>(null);
  const [savedQid, setSavedQid] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("qid");
    if (p) setQid(p);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = qid.trim();
    if (!id) return setError("A topic Wikidata QID is required (e.g. Q146).");
    const parsed = parseVideoUrl(videoUrl);
    if (!parsed)
      return setError(
        "Unrecognized video URL — YouTube, TikTok, or Instagram supported."
      );
    if (!contextNote.trim())
      return setError("A context note is the point — please add one.");

    const platformLabel =
      parsed.platform === "youtube"
        ? "YouTube"
        : parsed.platform === "tiktok"
          ? "TikTok"
          : parsed.platform === "instagram"
            ? "Instagram"
            : "Video";
    await store.upsertTopic({ qid: id, title: id });
    await store.addClip({
      topicQid: id,
      platform: parsed.platform,
      platformLabel,
      orientation: "horizontal",
      watchUrl: videoUrl,
      embedUrl: parsed.embedUrl,
      thumbnailUrl: parsed.thumbnailUrl,
      caption: contextNote.trim().slice(0, 80),
      creator: {
        handle: handle.trim() || "@unknown",
        name: handle.trim() || "Unknown creator",
        platform: parsed.platform,
      },
      contextNote: contextNote.trim(),
      stance,
      accuracyFlag,
      general: true,
    });
    setSavedQid(id);
  }

  if (savedQid) {
    return (
      <div className="mx-auto max-w-xl space-y-3 px-4 py-8">
        <p className="text-sm text-ink">Clip added.</p>
        <Link
          href={`/topic?qid=${encodeURIComponent(savedQid)}`}
          className="text-action underline"
        >
          View the topic →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <h1 className="text-2xl font-semibold text-ink">Add a clip</h1>

      <Field label="Topic Wikidata QID">
        <input
          value={qid}
          onChange={(e) => setQid(e.target.value)}
          placeholder="Q146"
          className="input"
        />
      </Field>

      <Field label="Video URL">
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="input"
        />
      </Field>

      <Field label="Creator handle">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@creator"
          className="input"
        />
      </Field>

      <Field label="Context note — what's fact vs. the creator's opinion">
        <textarea
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          rows={4}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Stance">
          <select
            value={stance}
            onChange={(e) => setStance(e.target.value as Stance)}
            className="input"
          >
            {STANCES.map((s) => (
              <option key={s} value={s}>
                {STANCE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Accuracy">
          <select
            value={accuracyFlag}
            onChange={(e) => setAccuracyFlag(e.target.value as AccuracyFlag)}
            className="input"
          >
            {ACCURACY.map((a) => (
              <option key={a} value={a}>
                {ACCURACY_LABEL[a]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-action focus:ring-offset-2"
      >
        Add clip
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
