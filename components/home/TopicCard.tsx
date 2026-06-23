import Link from "next/link";
import { Stat } from "@/components/topic/Stat";
import type { TopicWithStats } from "@/lib/data/types";
import { topicHref } from "@/lib/wiki/topicRoute";

// The homepage "Recently curated" Topic card (design topic-card-redesign.md / issue #126).
//
// A miniature of the Wiki | +plus split (VISUAL_IDENTITY §2): the WHOLE card is ONE Indigo-Press
// hardbox `.plus-card` frame, with the FAITHFUL article half inside it (serif title + the
// `WIKIPEDIA ARTICLE` text mark + description) leading, then the wiki|plus seam, then the +plus
// half — the compact 3-up Videos/Creators/Curators stat grid (the same `Stat` primitive the Topic
// overview Infobox uses, at `size="compact"` — one primitive, two sizes; §3.4).
//
// The entire card is a SINGLE keyboard-activable <Link> (§8 / TC4): one Tab stop, the hardbox press
// on hover, an explicit focus-visible ink ring. The composed `aria-label` announces the title + the
// article mark + the counts as one sentence (singular boundary applied — "1 video", not "1 videos"),
// and the visual stat grid is `aria-hidden` so the counts aren't double-read.

/** `n === 1 ? "1 <singular>" : "n <plural>"` — the §5.1 count+noun rule for the accessible name. */
function countPhrase(n: number, singular: string, plural: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}

export function TopicCard({ topic }: { topic: TopicWithStats }) {
  const { videos, creators, curators } = topic.stats;
  // DEFENSIVE fallback (§6.2): the data path filters `videos ≥ 1`, so this never fires in normal
  // operation. If a zero-curation item ever reaches the card (a data-path regression), render the
  // article half and OMIT the stat block — no label, no 0/0/0 grid.
  const hasStats = videos >= 1;

  // The accessible name announces what the card IS + its stats as a sentence (§8). The stat clause
  // is omitted on the defensive zero path (no "0 videos" phrase, consistent with rendering no grid).
  const ariaLabel = hasStats
    ? `${topic.title} — Wikipedia article. ${countPhrase(
        videos,
        "video",
        "videos"
      )}, ${countPhrase(creators, "creator", "creators")}, ${countPhrase(
        curators,
        "curator",
        "curators"
      )}.`
    : `${topic.title} — Wikipedia article.`;

  return (
    <Link
      href={topicHref(topic.title)}
      aria-label={ariaLabel}
      className="plus-card block p-4 transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
    >
      {/* ── Article half (the LEAD): serif title + the text article mark + description. ── */}
      <span className="projector-serif block text-lg font-bold leading-snug text-ink line-clamp-2 sm:text-xl">
        {topic.title}
      </span>
      <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-ink2 sm:text-[11px]">
        Wikipedia article
      </span>
      {topic.description && (
        <span className="mt-1.5 block text-sm text-ink2 line-clamp-2">
          {topic.description}
        </span>
      )}

      {/* ── The plus half (the SUPPORT): the wiki|plus seam + the compact 3-up stat grid. ──
          Omitted on the defensive zero-curation path (§6.2): the seam collapses with it. The
          seam is the quiet `border-ink/15` hairline (§3.5) — distinct from the grid's heavy 2px
          ink border. The grid is aria-hidden — the composed aria-label conveys the counts (§8). */}
      {hasStats && (
        <div className="mt-3 border-t border-ink/15 pt-3">
          <div
            aria-hidden
            className="grid grid-cols-3 divide-x-2 divide-ink border-2 border-ink"
          >
            <Stat n={videos} label="Videos" size="compact" />
            <Stat n={creators} label="Creators" size="compact" />
            <Stat n={curators} label="Curators" size="compact" />
          </div>
        </div>
      )}
    </Link>
  );
}
