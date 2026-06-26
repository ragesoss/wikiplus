"use client";

import type { ArticleSection } from "@/lib/data/types";

// Table of Contents (design §5.4 / §6.7; issue #60 §5.2 — dual counts). "＋ General"
// first, then a row per section indented by level.
//
// Issue #60 retires the binary `mode` count: a row now carries BOTH a curated count
// and a suggested count, and renders BOTH badges where a section has both (curated-
// first, matching the body order). A solid indigo `{c}` is the curated count; a
// dashed-outline violet `~{s}` is the suggested (unvetted) count. Each badge carries
// an `sr-only` word ("curated" / "suggested, unvetted") so the meaning is in the
// accessible name, never color/border-style alone (AC12/AC15). A row with neither a
// curated nor a suggested video shows just its title — no trailing badge.
export interface TocEntry {
  slug: string; // "__general" for the band row
  title: string;
  level: number;
  /** Curated clips anchored to this row (solid indigo `{c}`). */
  curated: number;
  /** Remaining suggestions anchored to this row (dashed violet `~{s}`). */
  suggested: number;
}

export function Toc({
  entries,
  currentSlug,
  onGo,
  bodyClassName = "max-h-[55vh]",
}: {
  entries: TocEntry[];
  currentSlug: string | null;
  onGo: (slug: string) => void;
  bodyClassName?: string;
}) {
  return (
    <nav aria-label="Table of contents" className="plus-card">
      <div className="border-b-2 border-hardbox bg-brand px-3 py-2">
        <span className="plus-disp text-base font-bold text-white">Contents</span>
      </div>
      <ul className={`overflow-y-auto px-2 py-2 text-[13px] ${bodyClassName}`}>
        {entries.map((e) => {
          const isBand = e.slug === "__general";
          const indent = isBand ? 0 : Math.max(0, (e.level - 2) * 12);
          const cur = currentSlug === e.slug;
          const hasCurated = e.curated > 0;
          const hasSuggested = e.suggested > 0;
          return (
            <li key={e.slug}>
              <a
                href={`#${isBand ? "general-band" : "sec-" + e.slug}`}
                onClick={(ev) => {
                  ev.preventDefault();
                  onGo(e.slug);
                }}
                style={{ paddingLeft: indent }}
                className={`flex items-center justify-between gap-2 rounded px-1 py-1 font-semibold hover:text-brand ${
                  cur ? "text-brand" : "text-ink-plus"
                }`}
              >
                <span className="truncate">
                  {isBand ? "＋ General" : e.title}
                </span>
                {/* The badge cluster (§5.2): curated-first, then suggested. Both render
                    where a row has both; either alone where a row has only one. A row with
                    NEITHER a curated nor a suggested video shows just its title — no trailing
                    badge (the TOC is article navigation with optional video counts; a per-row
                    "no video" label is unnecessary). */}
                {(hasCurated || hasSuggested) && (
                  <span className="flex shrink-0 items-center gap-1">
                    {hasCurated && (
                      <span
                        title={`${e.curated} curated video(s)`}
                        className="shrink-0 border-2 border-hardbox bg-surface-raised px-1.5 text-[10px] font-bold text-brand"
                      >
                        {e.curated}
                        <span className="sr-only"> curated</span>
                      </span>
                    )}
                    {hasSuggested && (
                      <span
                        title={`${e.suggested} unvetted suggestion(s)`}
                        className="shrink-0 border-2 border-dashed border-violet bg-surface-raised px-1.5 text-[10px] font-bold text-violet"
                      >
                        ~{e.suggested}
                        <span className="sr-only"> suggested, unvetted</span>
                      </span>
                    )}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
