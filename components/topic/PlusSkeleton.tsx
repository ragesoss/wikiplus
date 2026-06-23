"use client";

import { Fragment } from "react";

// The plus-side loading skeleton (topic-loading-states §3.3, the plus variant). Rendered while
// `!storeReady`, in place of the wiki+ panel + TOC (the masthead aside) and as a matching General-
// band row. It is the plus side's own "lamp warming up" treatment: STATIC neutral bars/blocks in
// the Indigo Press hardbox idiom, under the (slightly stronger) projector scan.
//
// The accessibility model (§5.1, AC6): each region carries `aria-busy="true"` + an `sr-only
// role="status"` "Loading videos…" node, so a screen-reader user is told the plus side is loading
// and told when it has loaded (the skeleton unmounts on settle). The scan is decorative
// (`aria-hidden`) and never the sole carrier of "loading" (§5.2, AC7).
//
// No indigo color-block and no text sit on the loading surface (§3.3/§5.3): the `.plus-card` card
// draws only its 2px ink border on white, so no small text ever lands on the bare indigo band
// during load and the AA rule is trivially satisfied.

/** A neutral skeleton bar (static; the scan is the animated layer). */
function Bar({ className }: { className?: string }) {
  return <div className={`skeleton-bar ${className ?? ""}`} />;
}

/**
 * The masthead aside placeholder: a bordered wiki+ panel card (3 bars) + a TOC block (4–6 bars),
 * each under its own scan. Stands in for `<Infobox>` + `<Toc>` while the store read is pending, in
 * the same box the settled aside occupies so nothing shifts when content resolves (§7).
 */
export function PlusAsideSkeleton() {
  // Varied TOC bar widths so the placeholder reads as a list, not a block.
  const tocWidths = [82, 64, 90, 56, 74, 68];
  return (
    <aside
      aria-busy="true"
      className="space-y-4 lg:sticky lg:top-20 lg:self-start"
    >
      <span className="sr-only" role="status">
        Loading videos…
      </span>
      {/* wiki+ panel placeholder — the `.plus-card` hardbox (2px ink border on white) so the
          Indigo Press identity is present from the first frame; no indigo fill, no text. */}
      <div className="relative plus-card p-4">
        <Bar className="h-5 w-3/4" />
        <Bar className="mt-3 h-9 w-full" />
        <Bar className="mt-3 h-7 w-2/5" />
        <span className="projector-scan projector-scan-plus" aria-hidden="true" />
      </div>
      {/* TOC placeholder — a short stack of neutral bars. */}
      <div className="relative px-1">
        {tocWidths.map((w, i) => (
          <Fragment key={i}>
            <Bar className={`${i === 0 ? "" : "mt-2.5"} h-3`} />
          </Fragment>
        ))}
        <span className="projector-scan projector-scan-plus" aria-hidden="true" />
      </div>
    </aside>
  );
}

/**
 * The General-band placeholder row: a single full-bleed row of 3–4 16:9 thumbnail-shaped blocks,
 * matching the strip's thumbnail-forward shape so the band height does not jump when it resolves
 * (§3.3/§7). Stands in for `<GeneralStrip>` while the store read is pending. Its own `aria-busy` +
 * status node is omitted here because the aside above already announces "Loading videos…" once for
 * the plus side; this band is the visual continuation of that same loading event.
 */
export function PlusBandSkeleton() {
  // Matches the settled band's OUTER geometry (`my-7 border-y-2`, the 1200px inner column) so the
  // height does not jump when it resolves (§7) — but NEUTRAL, with no indigo color-block (§3.3): the
  // band only paints its real indigo surface once content is real.
  return (
    <div aria-hidden="true" className="my-7 border-y-2 border-hardbox bg-surface-2">
      <div className="mx-auto max-w-[1200px] px-5 py-4">
        <div className="relative">
          {/* A short header bar standing in for the band's `<h2>`, then the thumbnail row. */}
          <div className="skeleton-bar mb-4 h-7 w-44 bg-surface-raised" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="skeleton-bar aspect-video w-full bg-surface-raised"
              />
            ))}
          </div>
          <span className="projector-scan projector-scan-plus" />
        </div>
      </div>
    </div>
  );
}
