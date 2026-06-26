import Link from "next/link";
import {
  contextByAccessibleName,
  isStubCurator,
} from "@/lib/curation/curator-attribution";
import { contributorHref } from "@/lib/wiki/topicRoute";

// The compact curator credit for a curated General-strip tile (design general-strip-fullbleed.md §2.1).
// A small INITIAL badge tucked into the curator note's lower-right corner (the header's collapsed-
// username style — a circle, 2px hardbox border, brand→violet gradient, white bold initial), linking
// IN to the curator's profile (the same target as `ContextByLink`). The FULL name reveals on
// hover/focus in a small pill; the link's `aria-label` carries the full "context by <username>" so
// assistive tech never needs the hover. This replaces the full "context by" row — the credit is less
// prominent and frees a whole line. The host note panel must be `relative` (the badge is absolute).
//
// A stub / `@prototype` curator (no profile) renders NOTHING — no dead link, no badge.
export function CuratorBadge({
  curatedBy,
}: {
  /** The clip's curator handle (`clip.curatedBy`). Absent / `@prototype` → no badge. */
  curatedBy: string | undefined | null;
}) {
  if (isStubCurator(curatedBy)) return null;
  const username = curatedBy as string;
  const initial = username.slice(0, 1).toUpperCase();
  return (
    <Link
      href={contributorHref(username)}
      aria-label={contextByAccessibleName(username)}
      title={username}
      className="group absolute -bottom-2.5 -right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-hardbox bg-gradient-to-br from-brand to-violet text-[12px] font-bold text-white"
    >
      <span aria-hidden>{initial}</span>
      {/* The full name, revealed on hover/focus (the aria-label already carries it for AT). */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[120%] right-0 hidden whitespace-nowrap border-2 border-hardbox bg-surface-raised px-1.5 py-0.5 text-[11px] font-bold text-ink-plus shadow-[2px_2px_0_var(--color-hardbox-offset)] group-hover:block group-focus:block"
      >
        {username}
      </span>
    </Link>
  );
}
