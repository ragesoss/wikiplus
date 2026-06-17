import { TopicSearch } from "@/components/search/TopicSearch";
import { AuthControl } from "@/components/auth/AuthControl";

// Sticky two-world header with the split Wiki / ＋plus wordmark (design §5.1, AC1).
// The grid mirrors the page grid so each half sits over its column. The ＋plus block is
// hidden < lg; the auth affordance therefore appears in TWO places (issue C, design §1c):
//   - lg+: inside the indigo ＋plus block (`topic-plus` skin), replacing the old stub chip.
//   - < lg: a compact AuthControl (`topic-compact`) at the right end of the Wiki row, so a
//     curator on a phone can still log in / see who they are (design §1c Option A, §6).
export function TopicHeader({ articleTitle }: { articleTitle: string }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-stretch gap-7 px-5 lg:grid-cols-[1fr_360px]">
        {/* Wiki half — wordmark (left), topic search (center), article title (right).
            Search is quiet plus-side UI living on the Wiki side at every breakpoint
            (#12, design §Placement Host 2). ≥ md: inline compact field. < md: a labeled
            magnifier icon-disclosure (the sanctioned Decision-1 degrade) so the tight
            header is never crowded and the article column is not intruded upon. */}
        <div className="flex h-16 items-center gap-3">
          <div className="flex shrink-0 items-baseline gap-2">
            <span className="font-serif text-2xl font-semibold text-[#1b1b1b]">
              Wiki
            </span>
            <span className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-400 lg:inline">
              the encyclopedia article
            </span>
          </div>
          {/* Inline compact search ≥ md. */}
          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            <TopicSearch variant="topic-inline" />
          </div>
          {/* Icon-disclosure < md (degradable surface). */}
          <div className="ml-auto flex md:hidden">
            <TopicSearch variant="topic-disclosure" />
          </div>
          <span className="hidden shrink truncate font-serif text-slate-500 md:inline">
            {articleTitle}
          </span>
          {/* Compact auth affordance on the Wiki row < lg (the ＋plus block is hidden there).
              Sits after search/title; pushed right when the title is hidden (< md). */}
          <div className="ml-auto flex shrink-0 lg:hidden">
            <AuthControl variant="topic-compact" />
          </div>
        </div>
        {/* ＋plus half — the plus-side identity home (design §1c). */}
        <div className="hidden h-16 items-center lg:flex">
          <div className="hardbox-sm flex w-full items-center justify-between bg-brand px-3 py-1.5">
            <span className="flex items-baseline gap-1.5 text-white">
              <span className="text-2xl">＋</span>
              <span className="plus-disp text-lg font-bold">plus</span>
              <span className="ml-1 text-[10px] uppercase tracking-[0.18em] text-white/90">
                curated video
              </span>
            </span>
            <AuthControl variant="topic-plus" />
          </div>
        </div>
      </div>
    </header>
  );
}
