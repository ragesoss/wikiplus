"use client";

import type { TopicStats } from "@/lib/data/types";

// ＋plus overview panel (design docs/design/plus-overview-redesign.md — Direction A).
//
// The panel leads with VALUE (what wiki+ adds to this topic), then a state-variant
// counts/volume block, then a primary Browse/Jump scroll action, then a secondary,
// honestly-framed curation invite. It is useful to a non-curator and pitches curation
// as the secondary flywheel — never the headline.
//
// Three derived states share ONE structure (§6), reshaping only the counts/volume block:
//   - empty          (0 curated, ≥1 suggestion) → dashed bg2 panel: the suggestion numeral
//                                                  + "videos found to weigh in" + the
//                                                  "unreviewed suggestions" line.
//   - mixed          (≥1 curated, ≥1 sugg.)     → the 3-up Videos/Creators/Curators grid
//                                                  + the "{V} curated · {M} suggested to
//                                                  weigh in" two-count line.
//   - fully-curated  (≥1 curated, 0 sugg.)      → the 3-up grid only (no suggestion count,
//                                                  no unvetted line).
// Plus the §6.5 ERROR floor: header + value + an honest one-line, no counts/buttons.
//
// The unvetted meaning is carried in TEXT (suggested / unreviewed / to weigh in), never by
// color or border alone (§9). Gold is not used. The teal curate button distinguishes the
// contribute action from indigo navigation (§6.1).
const VALUE_STATEMENT =
  "Short videos to learn this topic, each weighed for what's fact vs. opinion.";

export function Infobox({
  hasCurated,
  stats,
  suggestionCount,
  storeError = false,
  onBrowse,
  onCurate,
}: {
  /** ≥1 curated clip — selects the numeral grid vs. the empty volume panel. */
  hasCurated: boolean;
  stats: TopicStats;
  /** Remaining, deduped suggestions (`liveCandidates.length`) — `{M}` in mixed / the empty numeral. */
  suggestionCount: number;
  /** Store-read failure floor (§6.5): render header + value + an honest line, no counts/buttons. */
  storeError?: boolean;
  /** Browse/Jump — ALWAYS scrolls to the General band / first video (never opens curate). */
  onBrowse: () => void;
  /** Curate/Add — ALWAYS opens the curate/add entry (login-gated at the call site). */
  onCurate: () => void;
}) {
  const isEmpty = !hasCurated;
  const isMixed = hasCurated && suggestionCount > 0;

  return (
    <div className="plus-card overflow-hidden">
      {/* Header block — the Indigo identity (§6.1). */}
      <div className="flex items-baseline gap-2 border-b-2 border-ink bg-brand px-4 py-2.5 text-white">
        <span className="plus-disp text-lg leading-none font-bold">＋plus</span>
        <span className="plus-sans text-[11px] font-bold uppercase tracking-widest opacity-90">
          on this topic
        </span>
      </div>

      {/* Value statement — the lead line, identical in every state (§6.2). A <p>, not a
          heading: it is a tagline, and the rail already has its labelled-aside landmark (§9). */}
      <div className="px-4 pt-4">
        <p className="plus-sans text-[15px] font-bold leading-snug text-ink">
          {VALUE_STATEMENT}
        </p>
      </div>

      {storeError ? (
        // §6.5 read-failure floor: an honest line in place of the counts block. No numerals,
        // no buttons (a write surface is meaningless when reads are failing).
        <div className="px-4 pb-4 pt-3">
          <p className="plus-body text-[12px] leading-snug text-ink2">
            Couldn&apos;t load this topic&apos;s video stats. The article is unaffected.
          </p>
        </div>
      ) : (
        <>
          {/* Counts / volume block — the single state-variant region (§6.1–§6.3). */}
          <div className="px-4 pt-3">
            {isEmpty ? (
              // Empty: a dashed, light (bg2) panel — visually "provisional", matching the
              // unvetted candidate language. The word "unreviewed/suggestions" carries the
              // unvetted meaning in TEXT (§6.1 / §9), not the dashed border/fill alone.
              <div className="flex items-center gap-3 border-2 border-dashed border-[#D9D9D9] bg-bg2 px-3 py-2.5">
                <p className="bignum text-3xl leading-none text-brand">
                  {suggestionCount}
                </p>
                <div className="leading-tight">
                  <p className="plus-sans text-[12px] font-bold text-ink">
                    videos found to weigh in
                  </p>
                  <p className="plus-body text-[11px] text-ink2">
                    none vouched for yet — these are unreviewed suggestions
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Mixed + fully-curated: the three-numeral grid (§6.2 / §6.3). */}
                <div className="grid grid-cols-3 divide-x-2 divide-ink border-2 border-ink">
                  <Stat n={stats.videos} label="Videos" />
                  <Stat n={stats.creators} label="Creators" />
                  <Stat n={stats.curators} label="Curators" />
                </div>
                {/* Mixed only: the rescoped once-per-context two-count line. "suggested" /
                    "to weigh in" carry the unvetted meaning in TEXT (§6.2 / §9). Absent in
                    fully-curated (no suggestion count, no unvetted line — §6.3). */}
                {isMixed && (
                  <p className="plus-body mt-2 text-center text-[12px] text-ink2">
                    {stats.videos} curated ·{" "}
                    <span className="font-bold">{suggestionCount} suggested</span> to
                    weigh in
                  </p>
                )}
              </>
            )}
          </div>

          {/* Primary action — scrolls to the relevant content. ALWAYS a scroll, never curate
              (§10). A real <button> performing a scripted scroll, with a clear accessible
              name (§9). */}
          <div className="px-4 pt-3">
            <button
              type="button"
              onClick={onBrowse}
              aria-label={isEmpty ? "Browse suggested videos" : "Jump to videos"}
              className="block w-full border-2 border-ink bg-white px-3 py-2 text-center plus-sans text-[13px] font-bold text-ink transition hover:bg-bg2"
            >
              {isEmpty ? "Browse suggested videos ↓" : "Jump to videos ↓"}
            </button>
          </div>

          {/* Secondary curation invite — separated by a 2px ink top border; task-explaining
              copy + a demoted button (§6). Teal fill in empty (the "grow"/contribute signal),
              white bordered in mixed/fully-curated (calmer — the topic already has content). */}
          <div className="mt-1 border-t-2 border-ink px-4 py-3">
            {isEmpty ? (
              <p className="plus-body mb-2 text-[12px] leading-snug text-ink2">
                Watched one worth keeping?{" "}
                <strong className="text-ink">Vouch for it</strong> and write a note so the
                next learner knows how to weigh it.
              </p>
            ) : (
              <p className="plus-body mb-2 text-[12px] leading-snug text-ink2">
                Know a clip that belongs here?{" "}
                <strong className="text-ink">Add &amp; curate one</strong> to broaden how
                this topic is shown.
              </p>
            )}
            <button
              type="button"
              onClick={onCurate}
              aria-haspopup="dialog"
              className={
                isEmpty
                  ? "hardbox-sm w-full border-2 border-ink bg-sprout px-3 py-2 plus-sans text-[13px] font-bold text-white transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
                  : "w-full border-2 border-ink bg-white px-3 py-2 plus-sans text-[13px] font-bold text-ink transition hover:bg-bg2"
              }
            >
              {isEmpty ? "＋ Curate a video" : "＋ Add a video"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="px-2 py-3 text-center">
      <p className="bignum text-3xl text-brand">{n}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-ink2">
        {label}
      </p>
    </div>
  );
}
