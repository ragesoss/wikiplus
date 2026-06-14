"use client";

import { EmbedFacade } from "@/components/EmbedFacade";
import type { AccuracyFlag, Clip, Stance } from "@/lib/data/types";
import { parseVideoUrl } from "@/lib/embed/facade";

// Text labels — signals are never conveyed by color alone (accessibility baseline).
const STANCE_LABEL: Record<Stance, string> = {
  explainer: "Explainer",
  opinion: "Opinion",
  "myth-busting": "Myth-busting",
  "personal-experiment": "Personal experiment",
  "primary-source": "Primary source",
};

const ACCURACY_LABEL: Record<AccuracyFlag, string> = {
  accurate: "Accurate",
  "mostly-accurate": "Mostly accurate",
  mixed: "Mixed",
  misleading: "Misleading",
  inaccurate: "Inaccurate",
};

export function ClipCard({ clip }: { clip: Clip }) {
  const video = parseVideoUrl(clip.videoUrl);

  return (
    <article className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
      {video ? (
        <EmbedFacade video={video} title={clip.title} />
      ) : (
        <a
          href={clip.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="block p-4 text-sm text-action underline"
        >
          Open video ↗
        </a>
      )}
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">
            {STANCE_LABEL[clip.stance]}
          </span>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-medium text-ink/70">
            Accuracy: {ACCURACY_LABEL[clip.accuracyFlag]}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-ink">{clip.contextNote}</p>
        <footer className="flex items-center justify-between text-xs text-ink/60">
          <span>
            @{clip.creator.handle} · {clip.creator.platform}
          </span>
          {clip.sectionAnchor && (
            <span>§ {clip.sectionAnchor.replace(/_/g, " ")}</span>
          )}
        </footer>
      </div>
    </article>
  );
}
