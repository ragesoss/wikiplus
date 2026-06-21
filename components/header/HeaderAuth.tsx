"use client";

// HeaderAuth (#72) — renders EXACTLY ONE AuthControl whose SKIN is chosen by breakpoint (AC9 —
// one instance, not the retired two-places duplication). The single instance uses the `home` skin
// (indigo-on-light) ≥ md on the cool field, and `topic-compact` (avatar initial / short "Log in")
// < md (design §5.7). It is the SAME DOM node across the Tier-A ↔ slim scroll transition, so focus
// is never lost on collapse (AC13).
//
// The variant is resolved from a media query AFTER mount. On the server / first paint it renders the
// `home` skin (the ≥ md default — the desktop common case); the no-flash loading chip in AuthControl
// already absorbs the session-resolution paint, so the one-frame skin settle is not a visible flash.
// One node only — `getAllByRole("button", { name: /account/i })` returns exactly one (AC9 verify).

import { useEffect, useState } from "react";
import { AuthControl } from "@/components/auth/AuthControl";
import { useNarrowSearch } from "@/lib/header/narrowSearchContext";

const MD_BREAKPOINT = 768; // Tailwind `md` — the topic-compact ↔ home skin handoff (§5.7)

export function HeaderAuth() {
  // Default to the ≥ md `home` skin for SSR/first paint; refine to `topic-compact` < md after mount.
  const [compact, setCompact] = useState(false);
  // topic-mobile-search §3.3: while the narrow search disclosure is open (< md AND the field is
  // expanded — the Topic-host-derived signal), collapse this login to icon-only. Inert outside the
  // Topic host (the default context value is false), so Home/Page headers are unaffected.
  const { narrowSearchExpanded } = useNarrowSearch();

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(`(max-width: ${MD_BREAKPOINT - 1}px)`);
    const apply = () => setCompact(mql.matches);
    apply();
    // addEventListener("change") is the modern API; addListener is the jsdom/legacy fallback.
    if (mql.addEventListener) mql.addEventListener("change", apply);
    else mql.addListener(apply);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", apply);
      else mql.removeListener(apply);
    };
  }, []);

  return (
    <AuthControl
      variant={compact ? "topic-compact" : "home"}
      forceIconOnly={narrowSearchExpanded}
    />
  );
}
