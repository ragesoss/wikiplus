"use client";

import { Fragment } from "react";
import type { ArticleSectionBody, ArticleLead } from "@/lib/wiki/article";
import { ArticleStyles } from "./ArticleStyles";

// The faithful Wikipedia article column (design §5.2/§5.6, AC2/AC3), split to match
// the page regions (design §3): the title + attribution + lead live in the MASTHEAD;
// the section bodies live in the READER grid beside the sticky rail.

/** Masthead-left: serif title, CC BY-SA + QID attribution, and the lead HTML. */
export function ArticleLeadBlock({
  title,
  url,
  qid,
  lead,
  styleCss,
}: {
  title: string;
  url: string;
  /** Wikidata QID (under-the-hood key). Omitted only for an article with no Wikidata item. */
  qid?: string | null;
  lead: ArticleLead;
  /**
   * The article's reused, scoped TemplateStyles (`FullArticle.styleCss`). Mounted once
   * via `ArticleStyles` inside this lead's `.wiki-body` subtree so faithful clade/
   * `.tmulti`/long-tail-table layout renders across all sections (every reused rule is
   * `.wiki-body`-scoped, so one shared `<style>` styles the whole split article). Empty
   * string → nothing mounts.
   */
  styleCss?: string;
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
      {/* Reused, scoped TemplateStyles mount — inside `.wiki-body` so the `.wiki-body `
          scope prefix on every reused rule resolves. Applied via `textContent`
          (ArticleStyles), never innerHTML. A no-op when `styleCss` is empty. */}
      <div className="wiki-body mt-4">
        <ArticleStyles styleCss={styleCss ?? ""} />
        <div dangerouslySetInnerHTML={{ __html: lead.leadHtml }} />
      </div>
    </header>
  );
}

/**
 * A top-level disclosure group: an `h2` section and the `h3`/`h4` sections that follow it (until the
 * next `h2`), which render inside its collapsible body (design §4 OQ1 / §5.1). On a phone the `h2`
 * heading is the toggle and the whole group's bodies collapse together; `h3`/`h4` are NOT
 * independently collapsible (matching mobile Wikipedia). Each member keeps its own `<section
 * id="sec-{slug}">` so anchors/slugs are byte-identical (AC2) — grouping only governs the wrapper.
 */
export interface H2Group {
  /** The `h2` section that bears the toggle, or `null` for a leading `h3+` run before the first
   *  `h2` (a defensive "loose" group, rendered expanded with no toggle). */
  h2: ArticleSectionBody | null;
  /** The `h2` plus its following `h3`/`h4` sections, in document order. */
  members: ArticleSectionBody[];
}

/**
 * Group the flat section stream into `h2`-led disclosure groups (design §5.1). Each `level === 2`
 * starts a new group; each subsequent `level >= 3` joins the current group's members. A leading
 * `level >= 3` run before the first `h2` forms one loose group (`h2: null`). The slug set across all
 * members is the input set, unchanged — grouping adds/removes/renames no `sec-{slug}` id (AC2).
 */
export function groupSectionsByH2(sections: ArticleSectionBody[]): H2Group[] {
  const groups: H2Group[] = [];
  let current: H2Group | null = null;
  for (const s of sections) {
    if (s.level === 2) {
      current = { h2: s, members: [s] };
      groups.push(current);
    } else if (current) {
      current.members.push(s);
    } else {
      // Defensive: an `h3`/`h4` before any `h2` — a loose, always-expanded group.
      current = { h2: null, members: [s] };
      groups.push(current);
    }
  }
  return groups;
}

/** Map every section slug to the slug of the `h2` group that owns it (the `h2` that toggles it).
 *  An `h3`/`h4` maps to its parent `h2`'s slug; a loose group's members map to their own slug (they
 *  have no toggling `h2`). Used by `goTo`/anchor-jump to expand the owning group (design §5.4). */
export function ownerH2SlugMap(sections: ArticleSectionBody[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const g of groupSectionsByH2(sections)) {
    const owner = g.h2?.slug;
    for (const m of g.members) map.set(m.slug, owner ?? m.slug);
  }
  return map;
}

/** Render one section's heading (by level) + its body. Shared by both the phone and `≥ md` paths so
 *  the per-section DOM (ids, heading level, `.wiki-body`) is identical across breakpoints. The `h2`
 *  heading is only rendered here in the non-toggle (`≥ md` / loose-group) path; on the phone path the
 *  `h2` heading is the disclosure button (below). */
function SectionInner({ s, headingAsButton }: { s: ArticleSectionBody; headingAsButton?: boolean }) {
  return (
    <>
      {!headingAsButton && s.level === 2 && <h2 id={`h-${s.slug}`}>{s.title}</h2>}
      {s.level === 3 && <h3 id={`h-${s.slug}`}>{s.title}</h3>}
      {s.level >= 4 && <h4 id={`h-${s.slug}`}>{s.title}</h4>}
      {s.html && (
        <div className="wiki-body" dangerouslySetInnerHTML={{ __html: s.html }} />
      )}
    </>
  );
}

/**
 * Reader-left: the sectioned article body. The article column reads as faithful
 * Wikipedia — never interrupted by a plus/candidate card in EITHER state. Plus
 * content crosses into the Wiki column ONLY in the full-width General strip (the
 * one crossover); section-matched candidates are anchored in the plus rail, not
 * inline here (see docs/specs/wiki-column-no-plus.md).
 *
 * On a phone (`isPhone`, `< md`) each top-level `h2` group renders as a collapsible disclosure
 * (design §4/§5.2): the `h2` heading row is a native `<button aria-expanded>` and the group body is
 * `hidden` when closed (so its links leave the tab order — AC9). On `≥ md` (`isPhone === false`) the
 * SAME component renders every section expanded as plain headings with no button/chevron — identical
 * DOM order/ids and CSS to today (AC6). The open-state set + the toggle live in `TopicView` so
 * `goTo`/anchor-jump can expand a collapsed group before scrolling (design §5.4).
 */
export function ArticleSections({
  sections,
  activeSlug,
  sectionRef,
  isPhone = false,
  openH2Slugs,
  onToggleH2,
}: {
  sections: ArticleSectionBody[];
  activeSlug: string | null;
  sectionRef?: (slug: string, el: HTMLElement | null) => void;
  /** Phone branch (`< md`): render the `h2` disclosure. Default `false` → the `≥ md` expanded column. */
  isPhone?: boolean;
  /** Slugs of the `h2` groups that are currently expanded (only meaningful on the phone branch). */
  openH2Slugs?: Set<string>;
  /** Toggle an `h2` group open/closed by its slug (phone branch). */
  onToggleH2?: (h2Slug: string) => void;
}) {
  const groups = groupSectionsByH2(sections);
  return (
    <main aria-label="Wikipedia article" className="min-w-0">
      {groups.map((g) => {
        const h2 = g.h2;
        // `≥ md`, or a loose group with no toggling `h2`: render every member expanded as plain
        // headings — today's exact output (AC6). No disclosure chrome.
        if (!isPhone || !h2) {
          return g.members.map((s) => (
            <section
              key={s.slug}
              id={`sec-${s.slug}`}
              ref={(el) => sectionRef?.(s.slug, el)}
              className={`sec ${activeSlug === s.slug ? "active" : ""}`}
            >
              <SectionInner s={s} />
            </section>
          ));
        }

        // Phone branch: the `h2` heading row is the disclosure toggle; its body holds the `h2`'s own
        // body plus every following `h3`/`h4` section, hidden until expanded.
        const open = openH2Slugs?.has(h2.slug) ?? false;
        const bodyId = `secbody-${h2.slug}`;
        const rest = g.members.slice(1); // the `h3`/`h4` members nested under this `h2`
        return (
          <section
            key={h2.slug}
            id={`sec-${h2.slug}`}
            ref={(el) => sectionRef?.(h2.slug, el)}
            className={`sec ${activeSlug === h2.slug ? "active" : ""}`}
          >
            <h2 id={`h-${h2.slug}`} className="sec-h2-toggle">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => onToggleH2?.(h2.slug)}
              >
                <span className="sec-chevron" aria-hidden="true" />
                <span className="sec-h2-text">{h2.title}</span>
              </button>
            </h2>
            <div id={bodyId} hidden={!open}>
              {h2.html && (
                <div className="wiki-body" dangerouslySetInnerHTML={{ __html: h2.html }} />
              )}
              {rest.map((s) => (
                <section
                  key={s.slug}
                  id={`sec-${s.slug}`}
                  ref={(el) => sectionRef?.(s.slug, el)}
                  className={`sec ${activeSlug === s.slug ? "active" : ""}`}
                >
                  <SectionInner s={s} />
                </section>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

/**
 * Skeleton while the article fetch is in flight (topic-loading-states §3.2, article variant).
 * Static neutral bars under the projector scan — "the lamp warming up over the source side."
 * The scan is the FAINT (non-plus) variant: this is the Wikipedia-flavored source column, so
 * the warm sweep is quiet. The container is `relative` so the absolutely-positioned
 * `.projector-scan` overlay can sweep across the bars. The existing `aria-busy="true"` +
 * `role="status"` "Loading article…" pattern is preserved (§5.1, AC6); the scan is decorative
 * and carries no meaning on its own (§5.2, AC7).
 */
export function ArticleSkeleton() {
  return (
    <div aria-busy="true" className="relative min-w-0">
      <span className="sr-only" role="status">
        Loading article…
      </span>
      <div className="skeleton-bar h-8 w-3/5" />
      {[88, 96, 72, 90, 80, 94, 68].map((w, i) => (
        <Fragment key={i}>
          <div className="skeleton-bar mt-3 h-3.5" style={{ width: `${w}%` }} />
        </Fragment>
      ))}
      <span className="projector-scan" aria-hidden="true" />
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
      <h2 className="text-lg font-bold text-ink-plus">Couldn&apos;t load the article</h2>
      <p className="mt-1 text-sm text-ink2">
        We couldn&apos;t reach Wikipedia just now. The curated videos are still here
        on the right.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="border-2 border-hardbox bg-brand px-3 py-2 text-sm font-bold text-white hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
        >
          Try again
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="border-2 border-hardbox bg-surface-raised px-3 py-2 text-sm font-bold text-ink-plus"
        >
          Open on Wikipedia ↗
        </a>
      </div>
    </div>
  );
}
