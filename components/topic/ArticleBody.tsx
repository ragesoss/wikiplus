"use client";

import { Fragment } from "react";
import type { ArticleSectionBody, ArticleLead } from "@/lib/wiki/article";
import type { Candidate } from "@/lib/data/types";
import { InlineCandidate } from "./InlineCandidate";

// The faithful Wikipedia article column (design §5.2/§5.6, AC2/AC3), split to match
// the page regions (design §3): the title + attribution + lead live in the MASTHEAD;
// the section bodies live in the READER grid beside the sticky rail.

/** Masthead-left: serif title, CC BY-SA + QID attribution, and the lead HTML. */
export function ArticleLeadBlock({
  title,
  url,
  qid,
  lead,
}: {
  title: string;
  url: string;
  /** Wikidata QID (under-the-hood key). Omitted only for an article with no Wikidata item. */
  qid?: string | null;
  lead: ArticleLead;
}) {
  return (
    <header className="min-w-0">
      <h1 className="wiki-title border-b border-wikirule pb-1 text-[1.9rem] font-bold leading-tight">
        {title}
      </h1>
      {/* Wikidata short description — page metadata lifted out of the article body
          (article.ts), shown as a subtitle here rather than leaking into the lead. */}
      {lead.description && (
        <p className="mt-1 text-sm text-[#54595D]">{lead.description}</p>
      )}
      {/* CC BY-SA + QID attribution (design §5.2, AC4 / CURATION §5.1) */}
      <p className="mt-1 text-xs text-[#54595D]">
        From{" "}
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="text-wikilink hover:underline"
        >
          Wikipedia
        </a>{" "}
        · CC BY-SA 4.0{qid ? ` · Wikidata ${qid}` : ""}
      </p>
      <div
        className="wiki-body mt-4"
        dangerouslySetInnerHTML={{ __html: lead.leadHtml }}
      />
    </header>
  );
}

/** Reader-left: the sectioned article body, never interrupted by a card (AC2). */
export function ArticleSections({
  sections,
  activeSlug,
  mode,
  topicTitle,
  inlineCandidates,
  onPlay,
  onPromote,
  onDismiss,
  sectionRef,
}: {
  sections: ArticleSectionBody[];
  activeSlug: string | null;
  mode: "curated" | "empty";
  topicTitle: string;
  inlineCandidates: Map<string, Candidate>;
  /** YouTube-candidate play → non-modal PinnedPlayer (issue #10, AC1). */
  onPlay?: (c: Candidate) => void;
  onPromote: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
  sectionRef?: (slug: string, el: HTMLElement | null) => void;
}) {
  return (
    <main aria-label="Wikipedia article" className="min-w-0">
      {sections.map((s) => {
        const cand = mode === "empty" ? inlineCandidates.get(s.slug) : undefined;
        return (
          <section
            key={s.slug}
            id={`sec-${s.slug}`}
            ref={(el) => sectionRef?.(s.slug, el)}
            className={`sec ${activeSlug === s.slug ? "active" : ""}`}
          >
            {s.level === 2 && <h2 id={`h-${s.slug}`}>{s.title}</h2>}
            {s.level === 3 && <h3 id={`h-${s.slug}`}>{s.title}</h3>}
            {s.level >= 4 && <h4 id={`h-${s.slug}`}>{s.title}</h4>}
            {s.html && (
              <div
                className="wiki-body"
                dangerouslySetInnerHTML={{ __html: s.html }}
              />
            )}
            {cand && (
              <InlineCandidate
                candidate={cand}
                topicTitle={topicTitle}
                onPlay={onPlay}
                onPromote={onPromote}
                onDismiss={onDismiss}
              />
            )}
          </section>
        );
      })}
    </main>
  );
}

/** Skeleton while the article fetch is in flight (design §7.1). */
export function ArticleSkeleton() {
  return (
    <div aria-busy="true" className="min-w-0">
      <span className="sr-only" role="status">
        Loading article…
      </span>
      <div className="skeleton-bar h-8 w-3/5" />
      {[88, 96, 72, 90, 80, 94, 68].map((w, i) => (
        <Fragment key={i}>
          <div className="skeleton-bar mt-3 h-3.5" style={{ width: `${w}%` }} />
        </Fragment>
      ))}
    </div>
  );
}

/** Inline error card (design §7.2). The plus side stays useful. */
export function ArticleError({
  url,
  onRetry,
}: {
  url: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="plus-card min-w-0 p-4">
      <h2 className="text-lg font-bold text-ink">Couldn&apos;t load the article</h2>
      <p className="mt-1 text-sm text-ink2">
        We couldn&apos;t reach Wikipedia just now. The curated videos are still here
        on the right.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="border-2 border-ink bg-brand px-3 py-2 text-sm font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
        >
          Try again
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink"
        >
          Open on Wikipedia ↗
        </a>
      </div>
    </div>
  );
}
