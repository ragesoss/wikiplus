"use client";

import type { TopicStats } from "@/lib/data/types";
import { pluralize } from "@/lib/format";

// ＋plus infobox (design §5.3 curated / §6.2 empty, AC7/AC14). Curated = 3 big
// numerals (videos / creators / curators). Empty = a "0 videos curated" block + the
// "Be the first to curate" CTA.
export function Infobox({
  mode,
  stats,
  suggestionCount,
  sources,
  syncedLabel,
  onCurateFirst,
}: {
  mode: "curated" | "empty";
  stats: TopicStats;
  suggestionCount: number;
  sources: string;
  syncedLabel: string;
  onCurateFirst: () => void;
}) {
  return (
    <div className="plus-card">
      {/* #14 AC10: the header is just `＋plus` — the purposeless "this topic" label
          was removed. Counts, sync status, the "Be the first to curate" CTA, and the
          "N auto-suggestions from {sources}" volume line are unchanged. */}
      <div className="flex items-baseline gap-2 border-b-2 border-ink bg-brand px-3 py-2 text-white">
        <span className="plus-disp text-lg font-bold">＋plus</span>
      </div>

      {mode === "curated" ? (
        <div className="grid grid-cols-3 divide-x-2 divide-ink">
          <Stat n={stats.videos} label="Videos" />
          <Stat n={stats.creators} label="Creators" />
          <Stat n={stats.curators} label="Curators" />
        </div>
      ) : (
        <div className="px-4 py-5 text-center">
          <p className="bignum text-[64px] leading-none text-brand">0</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-ink2">
            videos curated
          </p>
          <p className="mt-4 text-[12px] text-ink2">
            {pluralize(suggestionCount, "auto-suggestion")} from {sources}
          </p>
          <button
            type="button"
            onClick={onCurateFirst}
            aria-label="Be the first to curate this topic"
            aria-haspopup="dialog"
            className="hardbox-sm mt-2 w-full border-2 border-ink bg-brand px-3 py-2 text-sm font-bold text-white hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
          >
            ✦ Be the first to curate
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 border-t-2 border-ink px-3 py-1.5 text-[12px] font-bold text-teal-dk">
        <span aria-hidden className="h-2 w-2 rounded-full bg-sprout" />
        {mode === "curated"
          ? `synced ${stats.synced ?? "recently"} · ${stats.videos} shown`
          : `suggestions synced ${syncedLabel}`}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="px-2 py-4 text-center">
      <p className="bignum text-3xl text-brand">{n}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-ink2">
        {label}
      </p>
    </div>
  );
}
