import Link from "next/link";
import {
  CONTEXT_BY_PREFIX,
  SEED_CLIP_LABEL,
  contextByAccessibleName,
  isStubCurator,
} from "@/lib/curation/curator-attribution";
import { contributorHref } from "@/lib/wiki/topicRoute";

// The public "context by <curator>" attribution (issue #54 / D3, AC6; CURATION §5.4 / Decision C7).
// ONE shared element so the verbatim strings, the link target, and the `@prototype` suppression are
// defined once and reused on the `ClipCard` footer (light surface) and the curated `GeneralStrip`
// tile (the indigo band). It is the IN-link half of the distinctness pair: the §5.2 creator credit
// links OUT to the platform (unchanged); this names the NOTE's author and links IN to their profile.
//
// Two branches (Decision 3b / Decision 4):
//   - real curator → "context by <username>" with the USERNAME as the link to
//     `/contributor/<username>` (accessible name "context by <username>, view their curations");
//     the WORD carries the meaning (never color-alone) + the underline marks the link.
//   - `@prototype` / no curator → the NON-linked "seed clip · no curator" label (no <a>, no href).
//
// `surface` picks the AA-safe link tone: `light` (the card footer) → `text-link` underline-on-hover;
// `indigo` (the General band's white-on-`bg-brand` tile) → WHITE + a persistent underline (the
// underline, not a color shift, carries "this is a link" on indigo — §6.3). It carries NO read-path
// cost — it is static markup built from `clip.curatedBy`, already on every clip the topic read loads.
export function ContextByLink({
  curatedBy,
  surface,
}: {
  /** The clip's curator handle (`clip.curatedBy`). Absent / `@prototype` → the legacy label. */
  curatedBy: string | undefined | null;
  /** Which surface the attribution sits on — picks the AA-safe link/label tone. */
  surface: "light" | "indigo";
}) {
  // Legacy `@prototype` (or no curator): the non-linked provenance label — honest, no dead link.
  if (isStubCurator(curatedBy)) {
    return (
      <span className={surface === "indigo" ? "text-white/80" : "text-muted"}>
        {SEED_CLIP_LABEL}
      </span>
    );
  }

  const username = curatedBy as string;
  const prefixClass = surface === "indigo" ? "text-white/80" : "text-muted";
  const linkClass =
    surface === "indigo"
      ? "text-white underline hover:text-white/90"
      : "text-link underline-offset-2 hover:underline";

  return (
    <span className={prefixClass}>
      {CONTEXT_BY_PREFIX}
      <Link
        href={contributorHref(username)}
        aria-label={contextByAccessibleName(username)}
        className={`font-bold ${linkClass}`}
      >
        {username}
      </Link>
    </span>
  );
}
