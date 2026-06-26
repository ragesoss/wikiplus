"use client";

// The marked-complete per-viewer "show suggestions anyway" reveal — a card in the plus rail (design
// complete-toggle-rail.md). The HOST (TopicView) decides presence + position: it renders this card in
// the rail only when `closedToSuggestions && hasUnderlyingSuggestions`, placed after the last curated
// (section-anchored) ClipCard — or the rail's first item when there are none. This component is the
// card's presentation only: the honest "Marked complete" framing + the toggle button whose
// label/treatment follows `overridden`.
//
// A full-width rail card in the hardbox language (light page surface, NOT the indigo band): the white
// fill keeps its small text AA; a `border-l-4 border-l-brand` accent rule ties it to the brand. The
// button is a plain action `<button type="button">` — NEVER role=switch/aria-pressed (the WORD carries
// state — VI: never color alone); off is the brand-fill reveal path, on is the quieter raised/white
// reverse. The override's session-local, per-topic, client-only mechanics live in the host
// (topic-complete.md §4.2); activating this just calls `onToggle`, and focus stays on the same node.
export function CompleteToggleCard({
  overridden = false,
  onToggle,
}: {
  /** Has THIS viewer overridden the suppression for this session — drives the label/treatment flip
   *  (off → "Show suggestions anyway"; on → "Hide suggestions again"). */
  overridden?: boolean;
  /** Flip the host's per-viewer, session-local, per-topic reveal (instant in-place, never a DB write). */
  onToggle?: () => void;
}) {
  return (
    <div
      className="border-2 border-hardbox bg-surface-raised p-3 text-ink-plus shadow-[2px_2px_0_var(--color-hardbox-offset)]"
      style={{ borderLeftWidth: 4, borderLeftColor: "var(--color-brand)" }}
    >
      <p className="plus-sans text-[11px] font-bold uppercase tracking-wide text-ink-plus">
        <span aria-hidden>✓</span> Marked complete
      </p>
      <p className="plus-body mt-1 text-[12px] leading-snug text-ink2">
        A curator marked this complete, so suggestions are hidden.
      </p>
      <button
        type="button"
        onClick={onToggle}
        aria-label={
          overridden
            ? "Hide suggestions again — return to the complete view"
            : "Show suggestions for this topic in this session"
        }
        className={
          overridden
            ? "mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center border-2 border-hardbox bg-surface-raised px-2.5 py-1 text-[12px] font-bold text-ink-plus hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
            : "mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center border-2 border-hardbox bg-brand px-2.5 py-1 text-[12px] font-bold text-white hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
        }
      >
        {overridden ? "Hide suggestions again" : "Show suggestions anyway"}
      </button>
    </div>
  );
}
