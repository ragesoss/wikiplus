"use client";

import Link from "next/link";
import type { Clip } from "@/lib/data/types";

const sansFont = "Source Sans 3, Source Sans Pro, system-ui, sans-serif";

const header = (
  <div className="bg-[#676EB4] text-white px-4 py-2.5 border-b-2 border-[#2C2C2C] flex items-baseline gap-1">
    <span
      className="text-lg leading-none font-black"
      style={{ fontFamily: sansFont, letterSpacing: "-0.02em" }}
    >
      ＋plus
    </span>
    <span
      className="text-[11px] uppercase tracking-widest ml-1 opacity-90 font-bold"
      style={{ fontFamily: sansFont }}
    >
      this topic
    </span>
  </div>
);

export function PlusInfobox({ clips, qid }: { clips: Clip[]; qid: string }) {
  const clipCount = clips.length;

  if (clipCount === 0) {
    return (
      <div className="bg-white border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C] overflow-hidden mb-3">
        {header}

        {/* Big zero */}
        <div className="px-4 py-4 text-center">
          <div
            className="text-[64px] font-black text-[#676EB4] leading-[0.85]"
            style={{ fontFamily: sansFont, letterSpacing: "-0.03em" }}
          >
            0
          </div>
          <div
            className="text-[11px] font-bold uppercase tracking-wide text-[#595959] mt-1"
            style={{ fontFamily: sansFont }}
          >
            videos curated
          </div>
        </div>

        {/* CTA */}
        <div className="px-4 pb-4 space-y-2">
          <p
            className="text-[12px] text-[#595959] text-center"
            style={{ fontFamily: sansFont }}
          >
            auto-suggestions from YouTube
          </p>
          <Link
            href={`/contribute?qid=${encodeURIComponent(qid)}`}
            className="block w-full text-center text-[14px] font-bold px-4 py-2.5 bg-[#676EB4] text-white border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#2C2C2C] transition-all focus-visible:outline-2 focus-visible:outline-[#676EB4]"
            style={{ fontFamily: sansFont }}
          >
            ✦ Be the first to curate
          </Link>
        </div>

        {/* Status footer */}
        <div
          className="px-4 py-2 border-t-2 border-[#2C2C2C] text-[12px] font-bold text-[#1F6757] flex items-center gap-1.5"
          style={{ fontFamily: sansFont }}
        >
          <span className="w-2 h-2 rounded-full bg-[#2A8270] inline-block flex-shrink-0" aria-hidden="true" />
          suggestions synced
        </div>
      </div>
    );
  }

  const creatorCount = new Set(clips.map((c) => c.creator.handle)).size;
  const curatorCount = clipCount > 0 ? 1 : 0;

  const stats: [string, number][] = [
    ["Videos", clipCount],
    ["Creators", creatorCount],
    ["Curators", curatorCount],
  ];

  return (
    <div className="bg-white border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C] overflow-hidden mb-3">
      {header}
      <div className="grid grid-cols-3 text-center divide-x-2 divide-[#2C2C2C]">
        {stats.map(([label, value]) => (
          <div key={label} className="px-2 py-3">
            <div
              className="text-3xl font-black text-[#676EB4] leading-none"
              style={{ fontFamily: sansFont, letterSpacing: "-0.03em" }}
            >
              {value}
            </div>
            <div
              className="text-[10px] font-bold uppercase tracking-wide text-[#595959] mt-1"
              style={{ fontFamily: sansFont }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
      <div
        className="px-4 py-2 border-t-2 border-[#2C2C2C] text-[12px] font-bold text-[#1F6757] flex items-center gap-1.5"
        style={{ fontFamily: sansFont }}
      >
        <span className="w-2 h-2 rounded-full bg-[#2A8270] inline-block flex-shrink-0" aria-hidden="true" />
        synced · {clipCount} shown
      </div>
    </div>
  );
}
