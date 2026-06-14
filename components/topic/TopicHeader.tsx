// Sticky two-world header with the split Wiki / ＋plus wordmark (design §5.1, AC1).
// The grid mirrors the page grid so each half sits over its column. The ＋plus
// block (and, in the empty state, the signed-in user chip) is hidden < lg.
export function TopicHeader({
  articleTitle,
  identityHandle,
}: {
  articleTitle: string;
  /** Stubbed signed-in curator (empty state, design §6.1). Presentational only. */
  identityHandle?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-stretch gap-7 px-5 lg:grid-cols-[1fr_360px]">
        {/* Wiki half */}
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl font-semibold text-[#1b1b1b]">
              Wiki
            </span>
            <span className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-400 sm:inline">
              the encyclopedia article
            </span>
          </div>
          <span className="hidden truncate font-serif text-slate-500 md:inline">
            {articleTitle}
          </span>
        </div>
        {/* ＋plus half */}
        <div className="hidden h-16 items-center lg:flex">
          <div className="hardbox-sm flex w-full items-center justify-between bg-brand px-3 py-1.5">
            <span className="flex items-baseline gap-1.5 text-white">
              <span className="text-2xl">＋</span>
              <span className="plus-disp text-lg font-bold">plus</span>
              <span className="ml-1 text-[10px] uppercase tracking-[0.18em] text-white/90">
                curated video
              </span>
            </span>
            {identityHandle && (
              <span
                aria-label={`Signed in as ${identityHandle}`}
                className="flex items-center gap-1.5 text-white"
              >
                <span
                  aria-hidden
                  className="h-7 w-7 rounded-full border-2 border-white bg-gradient-to-br from-emerald-300 to-teal-600"
                />
                <span className="text-[12px] font-bold">{identityHandle}</span>
                <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-300" />
                <span className="text-[9px] font-bold uppercase tracking-wide">
                  signed in
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
