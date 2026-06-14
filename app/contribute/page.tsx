"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { store } from "@/lib/data";
import type { AccuracyFlag, Stance } from "@/lib/data/types";
import { parseVideoUrl } from "@/lib/embed/facade";
import { titleToQid } from "@/lib/wiki/article";
import { SiteHeader } from "@/components/SiteHeader";

// Provisional vocabularies — the Curation / Editorial role owns the final sets.
const STANCES: Stance[] = [
  "explainer",
  "opinion",
  "myth-busting",
  "personal-experiment",
  "primary-source",
];
const ACCURACY: AccuracyFlag[] = [
  "accurate",
  "mostly-accurate",
  "mixed",
  "misleading",
  "inaccurate",
];

export default function ContributePage() {
  const [qid, setQid] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [stance, setStance] = useState<Stance>("explainer");
  const [accuracyFlag, setAccuracyFlag] = useState<AccuracyFlag>("mostly-accurate");
  const [error, setError] = useState<string | null>(null);
  const [savedQid, setSavedQid] = useState<string | null>(null);

  // Wikipedia title resolver state
  const [wikiTitle, setWikiTitle] = useState("");
  const [qidHint, setQidHint] = useState<{ qid: string; title: string } | null>(null);
  const [qidHintError, setQidHintError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("qid")) setQid(p.get("qid")!);
    if (p.get("videoUrl")) setVideoUrl(p.get("videoUrl")!);
    if (p.get("creator")) setHandle(p.get("creator")!);
  }, []);

  async function resolveWikiTitle() {
    const raw = wikiTitle.trim();
    if (!raw) return;

    // Extract title from URL if pasted
    let title = raw;
    const urlMatch = raw.match(/en\.wikipedia\.org\/wiki\/([^?#]+)/);
    if (urlMatch) {
      title = decodeURIComponent(urlMatch[1].replace(/_/g, " "));
    }

    setResolving(true);
    setQidHint(null);
    setQidHintError(null);
    try {
      const resolved = await titleToQid(title);
      if (resolved) {
        setQidHint({ qid: resolved, title });
        setQid(resolved);
      } else {
        setQidHintError(`Could not find a Wikidata QID for "${title}". Try searching Wikipedia directly.`);
      }
    } catch {
      setQidHintError("Failed to resolve the title. Check your connection.");
    } finally {
      setResolving(false);
    }
  }

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

    await store.upsertTopic({ qid: id, title: id });
    await store.addClip({
      topicQid: id,
      videoUrl,
      platform: parsed.platform,
      videoId: parsed.videoId,
      title: undefined,
      creator: {
        handle: handle.trim() || "unknown",
        displayName: handle.trim() || "Unknown creator",
        platform: parsed.platform,
      },
      contextNote: contextNote.trim(),
      stance,
      accuracyFlag,
    });
    setSavedQid(id);
  }

  if (savedQid) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <div className="space-y-3">
            <p className="text-sm text-[#2C2C2C]">Clip added.</p>
            <Link
              href={`/topic?qid=${encodeURIComponent(savedQid)}`}
              className="text-[#1F6F95] underline"
            >
              View the topic →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <form onSubmit={onSubmit} className="max-w-xl space-y-5">
          <h1 className="text-2xl font-semibold text-[#2C2C2C]" style={{ fontFamily: "Georgia, serif" }}>
            Add a clip
          </h1>

          {/* Wikipedia title resolver */}
          <div className="border-2 border-[#2C2C2C] p-4 bg-[#f8f9fa] space-y-3">
            <p
              className="text-[11px] uppercase tracking-widest font-bold text-[#676EB4]"
              style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
            >
              Look up topic by Wikipedia article
            </p>
            <label className="block space-y-1">
              <span className="block text-sm font-medium text-[#2C2C2C]">
                Wikipedia article title or URL
              </span>
              <div className="flex gap-2">
                <input
                  value={wikiTitle}
                  onChange={(e) => setWikiTitle(e.target.value)}
                  onBlur={resolveWikiTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      resolveWikiTitle();
                    }
                  }}
                  placeholder="e.g. Photosynthesis or paste Wikipedia URL"
                  className="input flex-1"
                  aria-describedby="qid-hint"
                />
                <button
                  type="button"
                  onClick={resolveWikiTitle}
                  disabled={resolving || !wikiTitle.trim()}
                  className="px-3 py-2 bg-[#676EB4] text-white text-sm font-bold border-2 border-[#2C2C2C] shadow-[2px_2px_0_#2C2C2C] disabled:opacity-50 hover:bg-[#5248AF] focus-visible:outline-2 focus-visible:outline-[#676EB4]"
                >
                  {resolving ? "…" : "Resolve"}
                </button>
              </div>
            </label>
            {qidHint && (
              <p id="qid-hint" className="text-xs text-[#2A8270] font-semibold" role="status">
                ✓ {qidHint.title} · <span className="font-mono">{qidHint.qid}</span> (auto-filled below)
              </p>
            )}
            {qidHintError && (
              <p id="qid-hint" className="text-xs text-red-700" role="alert">
                {qidHintError}
              </p>
            )}
          </div>

          <Field label="Topic Wikidata QID">
            <input
              value={qid}
              onChange={(e) => setQid(e.target.value)}
              placeholder="Q146"
              className="input"
              aria-describedby={qidHint ? "qid-hint" : undefined}
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
                    {s}
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
                    {a}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

          <button
            type="submit"
            className="border-2 border-[#2C2C2C] bg-[#1F6F95] px-4 py-2 text-sm font-medium text-white shadow-[3px_3px_0_#2C2C2C] hover:bg-[#185f80] focus-visible:outline-2 focus-visible:outline-[#676EB4]"
          >
            Add clip
          </button>
        </form>
      </main>
    </div>
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
      <span className="block text-sm font-medium text-[#2C2C2C]">{label}</span>
      {children}
    </label>
  );
}
