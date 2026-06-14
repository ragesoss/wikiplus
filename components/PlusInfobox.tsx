"use client";

import type { Clip } from "@/lib/data/types";

export function PlusInfobox({ clips }: { clips: Clip[] }) {
  const clipCount = clips.length;
  const creatorCount = new Set(clips.map((c) => c.creator.handle)).size;
  // Placeholder: one curator per clip as a rough proxy
  const curatorCount = clipCount > 0 ? 1 : 0;

  const stats: [string, number][] = [
    ["Videos", clipCount],
    ["Creators", creatorCount],
    ["Curators", curatorCount],
  ];

  return (
    <div className="bg-white border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C] overflow-hidden mb-3">
      <div className="bg-[#676EB4] text-white px-4 py-2.5 border-b-2 border-[#2C2C2C] flex items-baseline gap-1">
        <span
          className="text-lg leading-none font-black"
          style={{
            fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          ＋plus
        </span>
        <span
          className="text-[11px] uppercase tracking-widest ml-1 opacity-90 font-bold"
          style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
        >
          this topic
        </span>
      </div>
      <div className="grid grid-cols-3 text-center divide-x-2 divide-[#2C2C2C]">
        {stats.map(([label, value]) => (
          <div key={label} className="px-2 py-3">
            <div
              className="text-3xl font-black text-[#676EB4] leading-none"
              style={{
                fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif",
                letterSpacing: "-0.03em",
              }}
            >
              {value}
            </div>
            <div
              className="text-[10px] font-bold uppercase tracking-wide text-[#595959] mt-1"
              style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
      <div
        className="px-4 py-2 border-t-2 border-[#2C2C2C] text-[12px] font-bold text-[#1F6757] flex items-center gap-1.5"
        style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
      >
        <span className="w-2 h-2 rounded-full bg-[#2A8270] inline-block flex-shrink-0" aria-hidden="true" />
        synced · {clipCount} shown
      </div>
    </div>
  );
}
