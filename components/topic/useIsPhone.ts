"use client";

import { useEffect, useState } from "react";

// `md` (768px) is the established phone-vs-not-phone line in this codebase — the same boundary the
// article-side header switches its search disclosure on (docs/ARCHITECTURE.md "Article rendering").
// The mobile article column's collapse + type/touch layer fires below it (design §4 OQ4).
const MD_BREAKPOINT = 768;

/**
 * True on a phone-width viewport (`< md`, `max-width: 767px`) — the branch that drives the article
 * column's collapsible sections and mobile type/touch scale (design §4 OQ4 / §5.3).
 *
 * Resolved from a media query AFTER mount, matching the header's `isNarrow`/`compact` pattern
 * (SiteHeader / HeaderAuth). The SSR / first-paint default is `false` (the `≥ md` expanded column),
 * so the desktop/tablet article renders all sections expanded with no disclosure chrome and the
 * first server render is byte-for-byte today's (AC6); a phone refines to `true` after mount.
 */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(`(max-width: ${MD_BREAKPOINT - 1}px)`);
    const apply = () => setIsPhone(mql.matches);
    apply();
    // addEventListener("change") is the modern API; addListener is the jsdom/legacy fallback.
    if (mql.addEventListener) mql.addEventListener("change", apply);
    else mql.addListener(apply);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", apply);
      else mql.removeListener(apply);
    };
  }, []);
  return isPhone;
}
