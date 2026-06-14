"use client";

import type { ArticleSection } from "@/lib/data/types";

// Table of Contents (design §5.4 / §6.7, AC6/AC17). "＋ General" / "＋ Suggested"
// first, then a row per section indented by level. Count badges are solid indigo
// (curated) or dashed-outline violet "~n" (empty). Clicking a row jumps both sides.
export interface TocEntry {
  slug: string; // "__general" for the band row
  title: string;
  level: number;
  count: number;
}

export function Toc({
  entries,
  mode,
  currentSlug,
  onGo,
  bodyClassName = "max-h-[55vh]",
}: {
  entries: TocEntry[];
  mode: "curated" | "empty";
  currentSlug: string | null;
  onGo: (slug: string) => void;
  bodyClassName?: string;
}) {
  return (
    <nav aria-label="Table of contents" className="plus-card">
      <div className="border-b-2 border-ink bg-brand px-3 py-2">
        <span className="plus-disp text-base font-bold text-white">Contents</span>
      </div>
      <ul className={`overflow-y-auto px-2 py-2 text-[13px] ${bodyClassName}`}>
        {entries.map((e) => {
          const isBand = e.slug === "__general";
          const indent = isBand ? 0 : Math.max(0, (e.level - 2) * 12);
          const cur = currentSlug === e.slug;
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
                  cur ? "text-brand" : "text-ink"
                }`}
              >
                <span className="truncate">
                  {isBand
                    ? mode === "curated"
                      ? "＋ General"
                      : "＋ Suggested"
                    : e.title}
                </span>
                {e.count > 0 &&
                  (mode === "curated" ? (
                    <span className="shrink-0 border-2 border-ink bg-white px-1.5 text-[10px] font-bold text-brand">
                      {e.count}
                    </span>
                  ) : (
                    <span
                      title={`${e.count} unvetted suggestion(s)`}
                      className="shrink-0 border-2 border-dashed border-violet bg-white px-1.5 text-[10px] font-bold text-violet"
                    >
                      ~{e.count}
                    </span>
                  ))}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
