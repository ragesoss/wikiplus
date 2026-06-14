"use client";

import type { ArticleSection } from "@/lib/wiki/article";

interface TocProps {
  sections: ArticleSection[];
  clipsBySection: Record<string, unknown[]>;
  currentSectionId: string | null;
  onNavigate: (sectionId: string) => void;
}

export function TocCard({
  sections,
  clipsBySection,
  currentSectionId,
  onNavigate,
}: TocProps) {
  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Table of contents"
      className="bg-white border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C] overflow-hidden mb-3"
    >
      <div className="bg-[#f8f9fa] px-4 py-2 border-b-2 border-[#2C2C2C]">
        <span
          className="text-[11px] uppercase tracking-widest font-bold text-[#2C2C2C]"
          style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
        >
          Contents
        </span>
      </div>
      <ol className="py-2 max-h-64 overflow-y-auto text-sm" style={{ scrollbarWidth: "thin" }}>
        {sections.map((sec) => {
          const hasClips = (clipsBySection[sec.id]?.length ?? 0) > 0;
          const isActive = currentSectionId === sec.id;
          return (
            <li key={sec.id}>
              <button
                type="button"
                onClick={() => onNavigate(sec.id)}
                className={[
                  "w-full text-left px-4 py-1 flex items-center gap-2 hover:bg-[#f0f2ff] transition-colors",
                  sec.level === 3 ? "pl-8" : "",
                  isActive ? "bg-[#f0f2ff] text-[#676EB4] font-semibold" : "text-[#0645ad]",
                ].join(" ")}
                style={{ fontFamily: "Georgia, serif" }}
                aria-current={isActive ? "location" : undefined}
              >
                <span className="truncate">{sec.title}</span>
                {hasClips && (
                  <span
                    className="ml-auto flex-shrink-0 text-[10px] font-bold text-[#676EB4] bg-[#676EB4]/10 rounded px-1"
                    aria-label={`${clipsBySection[sec.id].length} video${clipsBySection[sec.id].length === 1 ? "" : "s"}`}
                  >
                    {clipsBySection[sec.id].length} ▶
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function MiniToc({
  sections,
  clipsBySection,
  currentSectionId,
  onNavigate,
}: TocProps) {
  if (sections.length === 0) return null;

  // Only show sections that have clips
  const sectionsWithClips = sections.filter(
    (s) => (clipsBySection[s.id]?.length ?? 0) > 0
  );

  if (sectionsWithClips.length === 0) return null;

  return (
    <nav
      aria-label="Section navigation"
      className="mb-3 border-2 border-[#2C2C2C] bg-white shadow-[2px_2px_0_#2C2C2C] overflow-hidden"
    >
      <div className="bg-[#f8f9fa] px-3 py-1.5 border-b-2 border-[#2C2C2C]">
        <span
          className="text-[10px] uppercase tracking-widest font-bold text-[#2C2C2C]"
          style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
        >
          Jump to section
        </span>
      </div>
      <ul className="py-1">
        {sectionsWithClips.map((sec) => {
          const isActive = currentSectionId === sec.id;
          const count = clipsBySection[sec.id]?.length ?? 0;
          return (
            <li key={sec.id}>
              <button
                type="button"
                onClick={() => onNavigate(sec.id)}
                className={[
                  "w-full text-left px-3 py-1 text-[12px] flex items-center gap-1.5 hover:bg-[#f0f2ff] transition-colors",
                  isActive
                    ? "bg-[#676EB4] text-white font-bold"
                    : "text-[#0645ad]",
                ].join(" ")}
                style={{ fontFamily: "Georgia, serif" }}
                aria-current={isActive ? "location" : undefined}
              >
                <span className="truncate">{sec.title}</span>
                <span
                  className={[
                    "ml-auto flex-shrink-0 text-[10px] font-bold rounded px-1",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-[#676EB4]/10 text-[#676EB4]",
                  ].join(" ")}
                  aria-label={`${count} video${count === 1 ? "" : "s"}`}
                >
                  {count}▶
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
