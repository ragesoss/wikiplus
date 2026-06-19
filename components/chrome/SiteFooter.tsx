import Link from "next/link";

// ── SiteFooter (issue #66, design §4.3 / §2.2). ───────────────────────────────────────────
// The slim shared footer — the PRIMARY persistent, signed-out-reachable link home for the data
// notice (AC2). The app had NO footer before #66; this introduces a minimal one placed at the
// bottom of the constrained-container routes (home / contribute / contributor profile). It is
// deliberately spare — a prototype, not a marketing footer — so it carries ONLY the spec-owned
// required element: a single text link "About your data" → /about/data.
//
// Visual (Indigo Press, quiet): a `border-t border-ink/10` hairline, generous top padding,
// `text-sm text-ink2`; the link uses the standard link affordance (`text-action` + hover/focus
// underline + the focus-visible ring) — never gold, never color alone (AC11). It sits in normal
// document flow at the end of the page (NOT position:fixed — a sticky footer would fight the
// vertical-first scroll). Rendered as a <footer> (contentinfo) landmark so AT users can jump to it.
//
// `containerClassName` lets each route align the footer to its own reading column.
export function SiteFooter({
  containerClassName = "mx-auto max-w-5xl px-4",
}: {
  containerClassName?: string;
}) {
  return (
    <footer className="border-t border-ink/10">
      <div className={`${containerClassName} py-8`}>
        <Link
          href="/about/data"
          className="text-sm text-action hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
        >
          About your data
        </Link>
      </div>
    </footer>
  );
}
