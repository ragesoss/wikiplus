// The shared Indigo-Press stat cell — ONE primitive, two sizes (design topic-card-redesign.md
// §3.4 "one stat primitive, two sizes; do NOT fork its visual tokens").
//
// The visual tokens are the single source here: an indigo `.bignum` numeral over an uppercase
// `text-ink2` label, sized by the `size` prop. Both the Topic-overview Infobox 3-up grid
// (`size="default"`) and the homepage Topic card's compact 3-up grid (`size="compact"`) render
// THIS cell, so the family is unmistakable and the tokens can never drift apart by hand-copy.
// The cells are divided by the Indigo-Press hairlines on the GRID wrapper at each call site
// (`grid-cols-3 divide-x-2 divide-ink border-2 border-ink`), not here.

const SIZES = {
  // The Infobox overview scale (the original `Stat` look — preserved exactly).
  default: { cell: "px-2 py-3", num: "text-3xl", label: "mt-1 text-[10px]" },
  // The homepage-card adaptation: smaller numerals + label, tighter padding (§3.4).
  compact: {
    cell: "px-1.5 py-2",
    num: "text-xl sm:text-2xl",
    label: "mt-0.5 text-[9px] sm:text-[10px]",
  },
} as const;

export function Stat({
  n,
  label,
  size = "default",
}: {
  n: number;
  label: string;
  /** "default" = the Infobox overview scale; "compact" = the homepage Topic-card scale. */
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  return (
    <div className={`${s.cell} text-center`}>
      <p className={`bignum ${s.num} text-brand`}>{n}</p>
      <p
        className={`${s.label} font-bold uppercase tracking-wide text-ink2`}
      >
        {label}
      </p>
    </div>
  );
}
