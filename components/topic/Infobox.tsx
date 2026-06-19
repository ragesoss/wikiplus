"use client";

import type { TopicStats } from "@/lib/data/types";
import { pluralize } from "@/lib/format";

// ＋plus infobox (design §5.3 curated / §6.2 empty; issue #60 §5.1 — three faces).
//
// Issue #60 retires the binary `mode` in favor of two independent facts —
// `hasCurated` (≥1 curated clip) and `suggestionCount` (remaining, deduped
// `liveCandidates.length`) — so the panel can render the COEXISTENCE (mixed) case:
//
//   - empty          (0 curated)             → the big "0 / videos curated" block + the
//                                               "N auto-suggestions from {sources}" volume
//                                               line + the "✦ Be the first to curate" CTA.
//   - mixed          (≥1 curated, ≥1 sugg.)  → the three curated numerals + the rescoped
//                                               once-per-context volume line
//                                               "{V} curated · {M} suggested" (§5.1) + NO CTA.
//   - fully-curated  (≥1 curated, 0 sugg.)   → the three curated numerals only — no suggestion
//                                               count, no unvetted line, no CTA.
//
// The CTA appears ONLY at 0 curated (§5.4 / AC13). The two-count line is the rescoped
// #14 once-per-context volume signal for the whole topic (AC14).
export function Infobox({
  hasCurated,
  stats,
  suggestionCount,
  sources,
  syncedLabel,
  onCurateFirst,
}: {
  /** ≥1 curated clip — drives the curated numerals vs. the empty "0" block. */
  hasCurated: boolean;
  stats: TopicStats;
  /** Remaining, deduped suggestions (`liveCandidates.length`) — `{M}` in mixed. */
  suggestionCount: number;
  sources: string;
  syncedLabel: string;
  onCurateFirst: () => void;
}) {
  // The three derived states (§0). `hasSuggestions` reuses the same remaining-count the
  // empty face already shows, so no new data is threaded.
  const hasSuggestions = suggestionCount > 0;
  const isEmpty = !hasCurated;
  const isMixed = hasCurated && hasSuggestions;

  return (
    <div className="plus-card">
      {/* #14 AC10: the header is just `＋plus` — no "this topic" label. */}
      <div className="flex items-baseline gap-2 border-b-2 border-ink bg-brand px-3 py-2 text-white">
        <span className="plus-disp text-lg font-bold">＋plus</span>
      </div>

      {hasCurated ? (
        <>
          <div className="grid grid-cols-3 divide-x-2 divide-ink">
            <Stat n={stats.videos} label="Videos" />
            <Stat n={stats.creators} label="Creators" />
            <Stat n={stats.curators} label="Curators" />
          </div>
          {/* §5.1 mixed-state two-count line: the rescoped once-per-context volume signal
              for the whole topic (AC11/AC14). Rendered ONLY in mixed (≥1 suggestion); in
              fully-curated there is no suggestion count, no unvetted line. The word
              "suggested" carries the unvetted meaning in TEXT (AC15 — not color alone).
              Sits where the empty face's "N auto-suggestions" line sits (directly under the
              numerals) so the panel's vertical rhythm is stable across states. */}
          {isMixed && (
            <p className="border-t-2 border-ink px-4 py-2 text-center text-[12px] text-ink2">
              {stats.videos} curated · {suggestionCount} suggested
            </p>
          )}
        </>
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
        {/* The synced line: the curated synced line in mixed + fully-curated; the
            "suggestions synced" line in empty (unchanged — §5.1). */}
        {isEmpty
          ? `suggestions synced ${syncedLabel}`
          : `synced ${stats.synced ?? "recently"} · ${stats.videos} shown`}
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
