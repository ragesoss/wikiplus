"use client";

import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b-2 border-[#2C2C2C]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-baseline gap-0.5 text-lg font-semibold"
          aria-label="wiki+ home"
        >
          <span className="text-[#2C2C2C]" style={{ fontFamily: "Georgia, serif" }}>
            Wiki
          </span>
          <span
            className="font-black text-[#676EB4]"
            style={{
              fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            ＋plus
          </span>
        </Link>
        <nav className="text-sm">
          <Link
            href="/contribute"
            className="text-[#1F6F95] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#676EB4] rounded px-1"
          >
            Contribute
          </Link>
        </nav>
      </div>
    </header>
  );
}
