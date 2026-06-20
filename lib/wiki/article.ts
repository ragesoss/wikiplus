// Client-side Wikipedia integration, mirroring the production approach: fetch
// rendered article HTML from the MediaWiki REST API, sanitize with DOMPurify, and
// rewrite wikilinks before rendering. See docs/ARCHITECTURE.md ("Article rendering").
//
// The TOC + scroll-sync need the full section structure (AC3), so we fetch the page
// HTML, derive a section list with stable slugs, and split the body into per-section
// fragments.

import type { ArticleSection } from "@/lib/data/types";
import { slugToTitle, topicHref } from "./topicRoute";
import { scopeArticleCss } from "./cssScope";

const REST = "https://en.wikipedia.org/api/rest_v1";
// Wikimedia etiquette: a descriptive Api-User-Agent identifying wiki+ + a contact
// (CLAUDE.md / ARCHITECTURE "Etiquette"). Browsers forbid setting User-Agent, but
// Api-User-Agent is honored by the REST API for anonymous CORS GETs.
const UA = "wiki+/0.0 (prototype; https://ragesoss.github.io/wikiplus/)";

export interface ArticleLead {
  title: string;
  /** Sanitized lead HTML (paragraphs + the right-floated lead figure). */
  leadHtml: string;
  url: string;
  /**
   * Wikidata short description (Parsoid's `.shortdescription` metadata). It is page
   * metadata, NOT article prose, so it is lifted out of `leadHtml` and surfaced in the
   * masthead instead (alongside the CC BY-SA + QID line). Null when the article has none.
   */
  description?: string | null;
}

export interface ArticleSectionBody extends ArticleSection {
  /** Sanitized + link-rewritten section body HTML (may be empty for stub sections). */
  html: string;
}

export interface FullArticle {
  /**
   * Canonical Wikipedia title (`pages[].title` / the title `fetchFullArticle` was
   * called with after redirect resolution). Keys the source URL and the "From
   * Wikipedia" attribution link — NOT the human heading. See {@link FullArticle.displayTitle}.
   */
  title: string;
  /**
   * Plain-text rendered display title (Wikipedia's `pages[].displaytitle`, markup
   * stripped). Drives the human-facing heading ONLY. Equals {@link FullArticle.title}
   * when Wikipedia renders no distinct display title; legitimately differs for
   * author-stylized titles (e.g. canonical `Bell hooks` → display `bell hooks`).
   */
  displayTitle: string;
  lead: ArticleLead;
  sections: ArticleSectionBody[];
  url: string;
  /**
   * The page's own in-body `<style>`/TemplateStyles CSS, sanitized + scoped under
   * `.wiki-body` (`scopeArticleCss`), so faithful TemplateStyles layout — cladograms,
   * `.tmulti` montages, the long tail of styled tables — renders with no per-template CSS
   * authored by wiki+. Empty string when the article ships no styled content. Applied
   * ONLY via a `<style>` element's `textContent` inside the article subtree (the
   * `<style>` *elements* are still removed from the rendered DOM); never
   * `dangerouslySetInnerHTML`. See docs/ARCHITECTURE.md "TemplateStyles reuse mechanism".
   */
  styleCss: string;
}

/**
 * The resolution of a typed/pasted Topic title to Wikipedia's canonical form, the
 * rendered (plain-text) display title, and the Wikidata QID — all from ONE action-API
 * request (#23). The canonical title keys the URL/slug, the store lookup, the QID
 * lookup, the article fetch, and the "From Wikipedia" link; the display title drives
 * ONLY the human heading. `canonicalTitle`/`qid` are null when Wikipedia cannot
 * resolve the title (a missing page) — the caller must then reach the not-found path
 * and must NOT canonicalize (AC6).
 */
export interface ResolvedPage {
  /** `pages[].title` — Wikipedia's canonical title (redirects/aliases followed). */
  canonicalTitle: string | null;
  /** Plain-text `pages[].displaytitle`; falls back to the canonical title. */
  displayTitle: string | null;
  /** `pages[].pageprops.wikibase_item`. */
  qid: string | null;
}

/**
 * Strip a Wikipedia `displaytitle` to plain text. The API returns `displaytitle` as a
 * (possibly) HTML-formatted string — italics for species/works, sub/superscripts for
 * formulae, etc. HTML-formatted display titles are OUT of scope for #23, so we render
 * the heading as plain text this round: parse the fragment and take its `textContent`.
 * For the common no-markup case (`bell hooks`, `Calvin cycle`) this is the string
 * unchanged. Returns null for a null/empty input so the caller can fall back.
 */
export function stripDisplayTitle(html: string | null | undefined): string | null {
  if (!html) return null;
  // Fast path: no angle brackets and no entities → already plain text.
  if (!/[<&]/.test(html)) return html.trim() || null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = (doc.body.textContent || "").trim();
  return text || null;
}

/**
 * Resolve a title to its canonical title + display title + QID in a SINGLE action-API
 * request — `action=query&prop=info|pageprops&inprop=displaytitle&
 * ppprop=wikibase_item&redirects=1&titles=…`. One request yields `pages[].title`
 * (canonical), `pages[].displaytitle` (rendered), and the QID — no extra round-trip.
 * `redirects=1` follows Wikipedia redirects/aliases (`jfk` → `John F. Kennedy`). A
 * `missing` page (or any failure) yields all-null so the caller reaches not-found
 * without canonicalizing (AC6). CORS-enabled for anonymous GETs.
 */
export async function resolvePage(title: string): Promise<ResolvedPage> {
  const empty: ResolvedPage = { canonicalTitle: null, displayTitle: null, qid: null };
  const url =
    "https://en.wikipedia.org/w/api.php" +
    "?action=query&prop=info%7Cpageprops&inprop=displaytitle" +
    "&ppprop=wikibase_item&redirects=1" +
    `&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  const res = await fetch(url, { headers: { "Api-User-Agent": UA } });
  if (!res.ok) return empty;
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return empty;
  const first = Object.values(pages)[0] as
    | {
        title?: string;
        missing?: string | boolean;
        pageid?: number;
        displaytitle?: string;
        pageprops?: { wikibase_item?: string };
      }
    | undefined;
  // A nonexistent title comes back as `{ missing: "", title: … }` (no pageid). Treat
  // it as unresolved so the title route does NOT canonicalize to it (AC6, #19 boundary).
  if (!first || first.missing !== undefined || first.pageid === undefined) {
    return empty;
  }
  const canonicalTitle = first.title ?? null;
  const displayTitle = stripDisplayTitle(first.displaytitle) ?? canonicalTitle;
  return {
    canonicalTitle,
    displayTitle,
    qid: first.pageprops?.wikibase_item ?? null,
  };
}

/** Resolve a Wikidata QID to its English Wikipedia article title. */
export async function qidToTitle(qid: string): Promise<string | null> {
  const url =
    "https://www.wikidata.org/w/api.php" +
    `?action=wbgetentities&ids=${encodeURIComponent(qid)}` +
    "&props=sitelinks&format=json&origin=*";
  const res = await fetch(url, { headers: { "Api-User-Agent": UA } });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.entities?.[qid]?.sitelinks?.enwiki?.title ?? null;
}

/**
 * Resolve an English Wikipedia article title to its Wikidata QID — the reverse of
 * {@link qidToTitle}. Used by the title-based Topic route (`/topic/<Title>`): the
 * canonical URL the user sees is title-based (paralleling `/wiki/<Title>`), and the
 * QID is resolved here under the hood to key store lookups (ARCHITECTURE "Article
 * rendering" / "Internal-link resolution"). Returns null if the page has no QID
 * (e.g. a missing/red article) — the caller falls back to the title.
 *
 * Uses the Wikipedia action API `pageprops` (`wikibase_item`), which resolves
 * redirects and is CORS-enabled for anonymous GETs. Thin wrapper over
 * {@link resolvePage} (the single source of the action-API request) returning just
 * the QID — kept for callers that only need the QID.
 */
export async function titleToQid(title: string): Promise<string | null> {
  return (await resolvePage(title)).qid;
}

/** Slugify a heading to a stable anchor id (matches the mockup's kebab style). */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Article-fidelity: the navigational tail + the References/Notes (citation) sections
// come through the same section walk as ordinary `ArticleSectionBody` entries, so they
// get a slug, heading, TOC row, `.sec` wrapper, and scroll-sync tracking for free
// (design spec §2/§6.3).
// A footnote-style "Notes" block is a `note`-group reference list (`ol.mw-references`)
// that carries its own backlinks — keeping it as its own section IS the citation
// system for those notes (D7); there is no duplication because each footnote group
// emits exactly one list. `DROP_SECTIONS` is therefore now EMPTY of these tail
// names; the only thing still removed is genuine chrome (`stripChrome`), and empty
// sections (e.g. a tail heading whose list was fully chrome) simply render no body.
const DROP_SECTIONS = new Set<string>([]);

/**
 * Fetch + sanitize the full article and derive its section structure.
 *
 * We use the REST `page/html` endpoint (Parsoid HTML, CORS-enabled for anonymous
 * GETs — ARCHITECTURE "Article rendering"). The body is a flat stream of
 * <section> wrappers around headings; we sanitize the whole document once, rewrite
 * links + figures, then walk top-level headings (h2–h4) to build the TOC + split
 * the body. The lead = everything before the first h2.
 */
export async function fetchFullArticle(
  title: string,
  displayTitle?: string | null
): Promise<FullArticle> {
  const res = await fetch(
    `${REST}/page/html/${encodeURIComponent(title)}`,
    { headers: { "Api-User-Agent": UA } }
  );
  if (!res.ok) throw new Error(`Wikipedia article error ${res.status}`);
  const rawHtml = await res.text();

  // --- TemplateStyles reuse (ARCHITECTURE "TemplateStyles reuse mechanism"; #105) -----
  // The page's own in-body `<style>`/TemplateStyles blocks supply the article column's
  // faithful layout. Read their CSS *text* from a throwaway parse of the RAW HTML BEFORE
  // the DOMPurify pass — `DOMParser` does not execute styles/scripts in a detached
  // document, and we only read `textContent`, so this is the raw CSS source string and
  // touches nothing in the sanitize path. The `<style>` *elements* are still excluded
  // from the DOMPurify allowlist and removed by `stripChrome` (X4 unchanged); only their
  // text is reused. `scopeArticleCss` sanitizes + scopes it under `.wiki-body`; the
  // result is applied later via a `<style>` element's `textContent` (NEVER innerHTML).
  // Empty for an article with no styled content (the apply component then mounts nothing).
  const styleSrc = collectStyleCss(rawHtml);
  const styleCss = await scopeArticleCss(styleSrc);

  const DOMPurify = (await import("dompurify")).default;

  // --- Allowlist (ARCHITECTURE "DOMPurify allowlist" open question, resolved) --
  // Article-fidelity (#24–#27) FLIPS the v1 "references/tables/math/tail deferred"
  // decision. The allowlist now permits exactly what citations, tables, the
  // Wikipedia infobox, and math need — and NOTHING that re-opens an XSS vector.
  //
  // TAGS: the v1 set already covered prose/headings/lists/links/figures/tables and
  //   `sup`/`span` (so citation markers + the SVG-math `<span class="mwe-math-…">`
  //   wrapper already pass). We deliberately keep DROPPING `<math>`, `<svg>`,
  //   `<iframe>`, `<object>`, `<embed>`, `<form>`, `<style>`, `<link>`, `<script>`
  //   — i.e. the math MathML/SVG payloads, embeds, and CSS-injection surfaces — so
  //   the existing SECURITY tests (test/article.test.ts) still hold. See math below.
  //
  // ATTR additions for this round (all inert, render/a11y/anchor-routing only):
  //   - `aria-hidden`, `role`           → table/equation scroll regions + math img
  //   - `data-mw-group`                 → distinguishes the `note` footnote group
  //   - `data-mw-footnote-number`       → reference-list <li> numbering (display)
  //   - `aria-label`, `aria-labelledby` → preserved if Parsoid emits them
  //   - `colspan`, `rowspan`, `scope`   → table-cell SPAN + header SCOPE (see hook)
  //   `style` is STILL NOT allowed (inline-style injection stays blocked, X4) — we
  //   re-apply the small set of layout styles we need ourselves in CSS/JS.
  //
  // TABLE-LAYOUT/A11Y attr preservation (#74). `colspan`/`rowspan` (numeric cell spans)
  //   and `scope` (`row`/`col` header scope) are inert layout/a11y attributes carrying
  //   no script or style — and they are LOAD-BEARING for faithful tables/infoboxes: the
  //   taxobox/infobox banner rows are `<th colspan="2">`, so without `colspan` the
  //   banner-vs-data-row distinction the CSS keys off (D1/D2) would not exist in the
  //   produced DOM, and multi-column data tables would collapse. DOMPurify 3.x, once a
  //   custom `ALLOWED_URI_REGEXP` is set (we set one to control link routing),
  //   URI-validates these attribute VALUES and drops them (`"row"`/`"2"` fail the link
  //   regexp) even though they are listed in `ALLOWED_ATTR`. A scoped
  //   `uponSanitizeAttribute` hook re-permits EXACTLY these three names via
  //   `forceKeepAttr` (a hardcoded 3-name set) — it cannot rescue any other
  //   attribute, and it is removed right after this sanitize call so it never
  //   leaks to other callers of the shared DOMPurify singleton. X4 is untouched
  //   (`<script>`/`<style>`/`<math>`/`<svg>`/inline `style`/event handlers/`javascript:`
  //   URIs all still die; asserted by test/article*.test.ts X4).
  //
  // MATH render mechanism (C4 — DECIDED FROM LIVE PARSOID OUTPUT, Pythagorean_theorem):
  //   Parsoid emits, per equation, a `<span class="mwe-math-element">` containing
  //   BOTH (a) a `display:none` `<span class="mwe-math-mathml-a11y"><math>…</math></span>`
  //   and (b) a visible `<img class="mwe-math-fallback-image-{inline|display}"
  //   alt="{TeX}" aria-hidden="true" src="…/media/math/render/svg/…">`.
  //   DECISION: render the **SVG fallback image**, NOT MathML. Rationale: (1) the
  //   `<math>` element is a script/foreignObject XSS surface and is one of the few
  //   things this sanitizer is built to strip — keeping it would weaken X4; (2) the
  //   SVG image is what Wikipedia shows visually, scales crisply, and already carries
  //   the TeX as `alt`. The hidden MathML span loses its `<math>` to sanitize (leaving
  //   an empty hidden span we drop), and we move accessibility onto the image by
  //   UN-hiding it (`stripChrome`/`cleanMath` removes its `aria-hidden`) so the `alt`
  //   (TeX) is announced (C3/§5.3). No KaTeX/client dependency needed.
  // The hook's allow-set is a HARDCODED set of exactly these three inert
  // layout/a11y attribute names — it can rescue nothing else (not `style`, not
  // `on*`, not `href`/`src`). It is removed in `finally` so it never leaks into
  // any other DOMPurify.sanitize call (DOMPurify is a global singleton here).
  const KEEP_INERT_ATTRS = new Set(["colspan", "rowspan", "scope"]);
  const keepInertAttrs: Parameters<typeof DOMPurify.addHook>[1] = (
    _node,
    data
  ) => {
    if (KEEP_INERT_ATTRS.has(data.attrName)) data.forceKeepAttr = true;
  };
  DOMPurify.addHook("uponSanitizeAttribute", keepInertAttrs);
  let clean: string;
  try {
    clean = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        "section", "p", "div", "span", "br", "hr",
        "h1", "h2", "h3", "h4", "h5", "h6",
        "ul", "ol", "li", "dl", "dt", "dd",
        "b", "strong", "i", "em", "sub", "sup", "small", "abbr",
        "a", "figure", "figcaption", "img",
        "table", "thead", "tbody", "tr", "th", "td", "caption",
        "blockquote", "cite", "code", "pre",
      ],
      ALLOWED_ATTR: [
        "href", "src", "srcset", "alt", "title",
        "id", "class", "colspan", "rowspan", "scope", "rel", "target",
        "width", "height", "data-mw-section-id",
        // Article-fidelity additions (render/a11y/anchor-routing only — all inert):
        "aria-hidden", "role", "aria-label", "aria-labelledby",
        "data-mw-group", "data-mw-footnote-number",
      ],
      // We rewrite links ourselves; allow http(s) + relative + in-page anchors.
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\.{0,2}\/|#)/i,
    });
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute", keepInertAttrs);
  }

  const doc = new DOMParser().parseFromString(clean, "text/html");
  const root = doc.body;

  // Order matters:
  //   1. stripChrome FIRST — remove navboxes/metadata/edit-links so later passes
  //      (link rewrite, citation prep) never touch chrome we're about to drop.
  //   2. prepCitations — normalize the marker↔reference anchors to pure in-page
  //      `#cite_*` hashes BEFORE rewriteLinks, and tag elements for the React layer.
  //   3. rewriteLinks — routes the REMAINING links; it now EXEMPTS `#cite_*`/`#cite_ref_*`
  //      in-page anchors (kept functional) and de-links only other bare `#` anchors.
  //   4. cleanFigures / cleanMath / wrapTables — image, math, and table presentation.
  stripChrome(root);
  prepCitations(root, title);
  rewriteLinks(root, title);
  cleanFigures(root);
  cleanMath(root);
  prepClades(root);
  wrapTables(root);
  prepHatnotes(root);

  // Parsoid's short description (`<div class="shortdescription" style="display:none">`)
  // is page METADATA, not prose. Wikipedia hides it with an inline style our sanitizer
  // strips (correctly — `style` is not allowlisted), so it would otherwise leak to the
  // top of the lead. Lift its text for the masthead and remove the element from the body.
  const shortDescEl = root.querySelector(".shortdescription");
  const description = shortDescEl?.textContent?.trim() || null;
  shortDescEl?.remove();

  const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;

  // --- Walk children: lead = before first h2; then split by h2/h3/h4. ----------
  // Parsoid wraps each section in <section>; flatten to a node stream first.
  const stream = flatten(root);

  const leadParts: string[] = [];
  const sections: ArticleSectionBody[] = [];
  let current: { sec: ArticleSectionBody; parts: string[] } | null = null;
  let sawHeading = false;
  let dropping = false;

  for (const node of stream) {
    const heading = headingLevel(node);
    if (heading) {
      sawHeading = true;
      const title = (node.textContent || "").trim();
      const slug = slugify(title);
      if (current) finishSection(current, sections);
      if (!title || DROP_SECTIONS.has(slug)) {
        dropping = true;
        current = null;
        continue;
      }
      dropping = false;
      current = { sec: { slug, title, level: heading, html: "" }, parts: [] };
      continue;
    }
    if (dropping) continue;
    const html = (node as Element).outerHTML ?? "";
    if (!html.trim()) continue;
    if (!sawHeading) leadParts.push(html);
    else if (current) current.parts.push(html);
  }
  if (current) finishSection(current, sections);

  // The heading uses the plain-text display title when one was resolved (#23); it
  // falls back to the canonical title so a direct fetch with no resolution still
  // renders a heading. The canonical `title` continues to key the source URL +
  // attribution link; only `displayTitle` feeds the human heading.
  return {
    title,
    displayTitle: displayTitle?.trim() || title,
    url: articleUrl,
    lead: { title, leadHtml: leadParts.join("\n"), url: articleUrl, description },
    sections: dedupeSlugs(sections),
    styleCss,
  };
}

/**
 * Collect the CSS *text* of the page's in-body `<style>`/TemplateStyles blocks from the
 * raw Parsoid HTML (TemplateStyles modules arrive as `<style data-mw-deduplicate=…
 * typeof="mw:Extension/templatestyles">` inside `mw-empty-elt` spans, plus any other
 * in-body `<style>`). Parsed in a detached `DOMParser` document — no styles/scripts
 * execute and only `textContent` is read, so this returns the raw CSS source untouched
 * by sanitize. Concatenated newest-last; `scopeArticleCss` sanitizes + scopes the result.
 * Returns `""` when the page ships no `<style>` blocks (the reuse path is then a no-op).
 */
function collectStyleCss(rawHtml: string): string {
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  const parts: string[] = [];
  for (const styleEl of Array.from(doc.querySelectorAll("style"))) {
    const css = styleEl.textContent;
    if (css && css.trim()) parts.push(css);
  }
  return parts.join("\n");
}

function finishSection(
  c: { sec: ArticleSectionBody; parts: string[] },
  out: ArticleSectionBody[]
) {
  c.sec.html = c.parts.join("\n");
  out.push(c.sec);
}

/** Flatten Parsoid's nested <section> wrappers into a single child stream. */
function flatten(root: HTMLElement): Element[] {
  const out: Element[] = [];
  for (const child of Array.from(root.children)) {
    if (child.tagName.toLowerCase() === "section") {
      out.push(...flatten(child as HTMLElement));
    } else {
      out.push(child);
    }
  }
  return out;
}

function headingLevel(el: Element): number | null {
  const m = el.tagName.toLowerCase().match(/^h([2-4])$/);
  return m ? Number(m[1]) : null;
}

/** Ensure section slugs are unique (a -2 suffix on collisions). */
function dedupeSlugs(sections: ArticleSectionBody[]): ArticleSectionBody[] {
  const seen = new Map<string, number>();
  for (const s of sections) {
    const n = seen.get(s.slug) ?? 0;
    if (n > 0) s.slug = `${s.slug}-${n + 1}`;
    seen.set(s.slug, n + 1);
  }
  return sections;
}

/**
 * Rewrite article-namespace wikilinks to the canonical title-based Topic route
 * (`/topic/<Title>/`, AC5, design §8; owner-directed title scheme — ARCHITECTURE
 * "Internal-link resolution"). The href is basePath-prefixed + trailing-slashed so a
 * hard navigation resolves under the GitHub Pages subpath; the decoded title is also
 * stashed in `data-topic-title` so TopicView's click interceptor can route client-side
 * (no full reload). Non-article / red / external links keep an absolute Wikipedia URL
 * opening in a new tab — never a broken /topic/ route.
 */
function rewriteLinks(root: HTMLElement, _title: string) {
  for (const a of Array.from(root.querySelectorAll("a"))) {
    const href = a.getAttribute("href") || "";
    a.classList.add("wikilink");

    // Parsoid emits relative "./Title" or "/wiki/Title"; also handle absolute.
    let m = href.match(/^\.?\/(?:wiki\/)?([^#?:]+)(#.*)?$/);
    if (!m) {
      const abs = href.match(/^https?:\/\/[^/]*wikipedia\.org\/wiki\/([^#?:]+)(#.*)?$/);
      if (abs) m = abs;
    }

    // Article-fidelity (#24): citation marker → reference and reference → marker
    // round-trip anchors are kept FUNCTIONAL (prepCitations already normalized them
    // to pure in-page `#cite_note-*` / `#cite_ref-*` hashes). Skip routing/de-linking
    // entirely so the in-page scroll works (A4/A6); they are not topic links.
    if (/^#cite_(note|ref)/.test(href)) {
      continue;
    }

    if (m && !m[1].includes(":")) {
      // Ordinary article link → canonical title-based topic route. Wikipedia hrefs
      // use the underscore form (`/wiki/Calvin_cycle`); slugToTitle maps `_`→space
      // AND percent-decodes, so `title` is the clean SPACE-form title — what
      // `data-topic-title` must carry for screen readers (design a11y; #11 AC8) and
      // what flows to the store/QID lookup. topicHref re-encodes it for the href.
      const title = slugToTitle(m[1]);
      const isRed = a.classList.contains("new") || a.classList.contains("mw-redlink");
      if (isRed) {
        externalize(a, href);
      } else {
        a.setAttribute("href", topicHref(title, { withBase: true }));
        a.setAttribute("data-topic-title", title);
        a.removeAttribute("target");
        a.removeAttribute("rel");
      }
    } else if (/^#/.test(href)) {
      // Other in-page anchors (not cite/backref) → de-link to plain text.
      delink(a);
    } else {
      // Namespaced (File:/Help:/Category:) or external → keep, open in new tab.
      externalize(a, href);
    }
  }
}

function externalize(a: Element, href: string) {
  let abs = href;
  if (/^\.?\//.test(href)) {
    abs = "https://en.wikipedia.org/wiki/" + href.replace(/^\.?\/(wiki\/)?/, "");
  }
  a.setAttribute("href", abs);
  a.setAttribute("target", "_blank");
  a.setAttribute("rel", "noopener");
}

function delink(a: Element) {
  const span = a.ownerDocument!.createElement("span");
  span.innerHTML = a.innerHTML;
  a.replaceWith(span);
}

/** Style figures faithfully and keep the Commons credit link (CURATION §5.1). */
function cleanFigures(root: HTMLElement) {
  for (const fig of Array.from(root.querySelectorAll("figure"))) {
    fig.classList.add("wikifig");
    // Drop the figure's link wrapper around the image but keep caption + credit.
    for (const img of Array.from(fig.querySelectorAll("img"))) {
      img.setAttribute("loading", "lazy");
      const src = img.getAttribute("src") || "";
      if (src.startsWith("//")) img.setAttribute("src", "https:" + src);
    }
  }
  // Fix protocol-relative srcs everywhere.
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src") || "";
    if (src.startsWith("//")) img.setAttribute("src", "https:" + src);
    img.setAttribute("loading", "lazy");
  }
}

/**
 * Strip GENUINE editor chrome the sanitize allowlist let through — kept PRECISE
 * (article-fidelity #25/#27, design §4.4/B7) so it never catches a data table, the
 * Wikipedia infobox, a citation marker, the reference list, or a hatnote (all now
 * RESTORED). Verified against live Parsoid markup of the seeded science topics:
 * navboxes are `div.navbox` (with an inner table), maintenance side-boxes are
 * `.metadata`/`.side-box`, and the old `table.infobox`/`sup.reference`/`.reference`/
 * `.mw-references-wrap`/`.reflist`/`.hatnote` entries are DELIBERATELY removed.
 *
 * `.taxobox-edit-taxonomy` is the taxobox's "Edit this classification" pencil — an
 * editing affordance with no function in wiki+, same family as `.mw-editsection`
 * (#74/D6). It is a `<span>` wrapping the edit link + its icon, nested in the
 * "Scientific classification" banner `<th>`; removing it leaves the banner heading
 * intact and never touches the taxobox lead image (a separate image cell), so that
 * image's `alt` is preserved.
 *
 * `#Timeline-row` is the geologic timebar graphic inside the taxobox "Temporal range:"
 * cell. It is a `<div>` of ~12 child `<div>`s, each absolutely-positioned by inline
 * `style` (pixel `left`/`width`, `background-color`) to form a colored bar. The X4
 * sanitizer correctly strips those inline `style` attrs; stripped of positioning, each
 * period's `<a>` stacks vertically into a broken-looking single-letter column (D1). The
 * bar is purely decorative — the human-readable temporal range ("Holocene to present")
 * is plain text in the same `<th>` cell, outside this div. Removing `#Timeline-row`
 * eliminates the broken letter-stack while leaving the textual range intact (approach
 * B from the UX spec: hide the orphaned graphic element, keep the text). The selector
 * is a unique DOM id — it cannot match anything other than this one graphic.
 */
function stripChrome(root: HTMLElement) {
  const junk = [
    ".mw-editsection", // [edit] section links
    ".taxobox-edit-taxonomy", // taxobox "Edit this classification" pencil (#74/D6)
    "#Timeline-row", // geologic timebar graphic — decorative, broken without inline style (D1)
    ".navbox", // bottom navigation boxes (div.navbox on live markup)
    ".metadata", // maintenance/side-box metadata (e.g. div.side-box.metadata)
    ".mbox-text",
    ".ambox", // article-message maintenance banners
    "table.sidebar", // vertical sidebar navigation
    "table.vertical-navbox",
    ".thumbcaption .magnify", // figure "enlarge" icon
    "style", // TemplateStyles (also dropped at sanitize; belt-and-suspenders)
    "link",
  ];
  for (const sel of junk) {
    for (const el of Array.from(root.querySelectorAll(sel))) el.remove();
  }
}

/**
 * Citations (article-fidelity #24, design §3). Runs BEFORE `rewriteLinks`.
 *
 * Live Parsoid structure (verified against Photosynthesis / Cellular_respiration):
 *   marker:    <sup class="mw-ref reference" id="cite_ref-N">
 *                <a href="./Title#cite_note-N"><span class="mw-reflink-text">
 *                  <span class="cite-bracket">[</span>N<span class="cite-bracket">]</span>
 *                </span></a></sup>
 *   ref <li>:  <li id="cite_note-N" data-mw-footnote-number="1">
 *                <span class="mw-cite-backlink"><a href="./Title#cite_ref-N"
 *                  rel="mw:referencedBy"><span class="mw-linkback-text">↑</span></a></span>
 *                <span class="mw-reference-text">…citation…</span></li>
 *   multi:     <span class="mw-cite-backlink" rel="mw:referencedBy">
 *                <a href="…#cite_ref-X_3-0"><span class="mw-linkback-text">1</span></a>
 *                <a href="…#cite_ref-X_3-1">…2…</a></span>
 *
 * We DON'T re-emit the markup — we (1) normalize the `./Title#cite_*` hrefs to pure
 * in-page `#cite_*` hashes (so `rewriteLinks` skips them and the browser scrolls in
 * page), (2) tag the marker `<sup>`/`<a>` with `data-cite-marker` + an `aria-label`
 * so the React popover layer (`components/topic/CitationLayer.tsx`) can wire the
 * popover, and (3) tag the back-ref `<a>`s with `data-cite-backref` + `aria-label`.
 */
function prepCitations(root: HTMLElement, title: string) {
  // Anchors point at `./<Title>#cite_*`; Parsoid encodes the title with underscores
  // and may percent-encode. We only need the trailing `#cite_*` hash — drop the path.
  const toHash = (href: string): string | null => {
    const h = href.match(/#(cite_(?:note|ref)[^"'\s]*)$/);
    return h ? `#${h[1]}` : null;
  };

  // Inline markers.
  for (const sup of Array.from(root.querySelectorAll("sup.reference, sup.mw-ref"))) {
    const a = sup.querySelector<HTMLAnchorElement>("a[href]");
    if (!a) continue;
    const hash = toHash(a.getAttribute("href") || "");
    if (!hash) continue;
    a.setAttribute("href", hash);
    // The reference number is the visible bracketed text (e.g. "[12]" or "[note 1]").
    const label = (a.textContent || "").replace(/[[\]]/g, "").trim() || "reference";
    a.setAttribute("aria-label", `Citation ${label}`);
    a.setAttribute("data-cite-marker", "");
    // The id (`cite_ref-N`) is the back-ref target; keep it on the <sup>.
    sup.setAttribute("data-cite-marker", "");
  }

  // Reference-list back-links (single `↑` and multi `1 2 …`).
  for (const a of Array.from(
    root.querySelectorAll<HTMLAnchorElement>(
      '.mw-cite-backlink a[href], a[rel="mw:referencedBy"]'
    )
  )) {
    const hash = toHash(a.getAttribute("href") || "");
    if (!hash) continue;
    a.setAttribute("href", hash);
    a.setAttribute("data-cite-backref", "");
    const inst = (a.textContent || "").trim();
    a.setAttribute(
      "aria-label",
      inst && inst !== "↑" ? `Back to citation, instance ${inst}` : "Back to citation"
    );
  }

  void title;
}

/**
 * Math (article-fidelity #26, design §5). C4 decision recorded at the allowlist:
 * render Parsoid's visible SVG fallback `<img>`, drop the MathML payload (a sanitize
 * surface), and make the image accessible via its `alt` (the TeX).
 *
 * Per equation Parsoid emits `<span class="mwe-math-element">` wrapping a hidden
 * `<span class="mwe-math-mathml-a11y">` (its `<math>` was already stripped at
 * sanitize, leaving an empty hidden span) and a visible `<img
 * class="mwe-math-fallback-image-{inline|display}" aria-hidden="true" alt="{TeX}">`.
 * We: remove the now-empty a11y span; UN-hide the image so its `alt` is announced;
 * mark display equations + their wrapper so the React layer can scroll-wrap wide
 * ones (§5.2); ensure protocol-relative/`//`-srcs are https.
 */
function cleanMath(root: HTMLElement) {
  // Drop the hidden MathML a11y spans (their <math> is gone after sanitize anyway).
  for (const a11y of Array.from(root.querySelectorAll(".mwe-math-mathml-a11y"))) {
    a11y.remove();
  }
  for (const img of Array.from(
    root.querySelectorAll<HTMLImageElement>(
      "img.mwe-math-fallback-image-inline, img.mwe-math-fallback-image-display"
    )
  )) {
    // The SVG image IS now the equation's perceivable form → expose its alt (C3/§5.3).
    img.removeAttribute("aria-hidden");
    if (!img.getAttribute("alt")) img.setAttribute("alt", "equation");
    const src = img.getAttribute("src") || "";
    if (src.startsWith("//")) img.setAttribute("src", "https:" + src);
    img.setAttribute("loading", "lazy");
    img.classList.add("wiki-math-img");
  }
  // Tag display (block) equations so CSS centers them + the wrapper can scroll wide.
  for (const el of Array.from(
    root.querySelectorAll(".mwe-math-element")
  )) {
    const isBlock =
      el.classList.contains("mwe-math-element-block") ||
      el.querySelector(".mwe-math-fallback-image-display");
    el.classList.add(isBlock ? "wiki-math-display" : "wiki-math-inline");
    if (isBlock) {
      el.setAttribute("role", "region");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", "Equation");
    }
  }
}

/**
 * Tables (article-fidelity #25, design §4.1/§4.2). Wrap every data table (and the
 * Wikipedia infobox is intentionally NOT wrapped — it floats) in a keyboard-
 * scrollable region so a wide table scrolls horizontally rather than breaking the
 * two-column shell (B2). The "Scroll table →" hint (§4.2) is CSS-only, shown when
 * the table overflows. The infobox is tagged for its float frame + its images get
 * the figure treatment (B5).
 *
 * Cladograms (`table.clade`) are NOT generic data tables: they are drawn by the page's
 * own `Template:Clade/styles.css`, reused — sanitized + scoped under `.wiki-body`
 * (`scopeArticleCss`; ARCHITECTURE "TemplateStyles reuse mechanism") — and live in
 * their own `div.clade` horizontal-scroll region. They are skipped here so the wiki+
 * thin override (which gives any wide data table a cell-border/header-shading grid)
 * never paints over the tree.
 */
function wrapTables(root: HTMLElement) {
  // Wikipedia infobox → float-right frame (kept; NOT wrapped/scrolled). §4.3.
  for (const ib of Array.from(root.querySelectorAll("table.infobox"))) {
    ib.classList.add("wiki-infobox");
    for (const img of Array.from(ib.querySelectorAll<HTMLImageElement>("img"))) {
      const src = img.getAttribute("src") || "";
      if (src.startsWith("//")) img.setAttribute("src", "https:" + src);
      img.setAttribute("loading", "lazy");
    }
  }

  // Data tables → scroll-wrapped, keyboard-reachable region. Skip the infobox, the
  // cladogram tree tables (clade-styled, in their own div.clade scroll region), any
  // table that merely hosts a cladogram (the `gallery-element` / `td.cladogram`
  // carrier — it must not draw a data-table grid around the tree), and any table
  // that is itself the inner table of a chrome box already stripped.
  for (const table of Array.from(root.querySelectorAll("table"))) {
    if (table.classList.contains("infobox")) continue;
    if (table.classList.contains("clade")) continue; // clade tree — styled by clade CSS
    if (table.querySelector("table.clade")) {
      // A carrier table holding a cladogram (e.g. `gallery-element` with a
      // `td.cladogram`): mark it so CSS drops its data-table grid, and let the
      // inner `div.clade` own the scroll. Do not wrap it as a data table.
      table.classList.add("wiki-clade-carrier");
      continue;
    }
    if (table.closest(".wiki-tablewrap")) continue; // already wrapped
    const doc = table.ownerDocument!;
    const wrap = doc.createElement("div");
    wrap.className = "wiki-tablewrap";
    wrap.setAttribute("role", "region");
    wrap.setAttribute("tabindex", "0");
    const caption = table.querySelector("caption")?.textContent?.trim();
    wrap.setAttribute("aria-label", caption || "Data table");
    table.classList.add("wiki-table");
    table.replaceWith(wrap);
    wrap.appendChild(table);
  }
}

/**
 * Cladograms (templatestyles-reuse spec AC1, design §3.1). Phylogenetic trees are drawn
 * ENTIRELY by `Template:Clade/styles.css` — per-cell `border-left`/`border-bottom`
 * on `td.clade-label`/`td.clade-slabel`/`td.clade-bar` that join into the right-angled
 * bracket tree. That TemplateStyles block arrives INSIDE the article body; its `<style>`
 * *element* is stripped at sanitize (X4 — page-embedded `<style>` is never trusted as
 * markup), but its CSS *text* is reused the SAFE way: read before sanitize, sanitized +
 * scoped from `.mw-parser-output table.clade` to `.wiki-body table.clade` by
 * `scopeArticleCss`, and applied via a `<style>` element's `textContent`
 * (ARCHITECTURE "TemplateStyles reuse mechanism"). It loads no remote CSS and re-permits
 * no page-body tag/inline-style/hook, so X4 is untouched; the clade `class` names
 * (`clade`, `clade-label`, `clade-leaf`, `clade-slabel`, `clade-bar`, and the
 * `first`/`last`/`reverse` modifiers) survive sanitize, so the reused rules land on the
 * surviving DOM and the branch lines render — with no per-template clade CSS authored by
 * wiki+.
 *
 * Here we make each tree's outer `div.clade` a contained, keyboard-scrollable region
 * (a deep/wide tree scrolls horizontally inside it rather than widening the two-column
 * shell — design §4) with the same "Scroll table →" overflow-hint affordance as wide
 * data tables. The empty `mw-empty-elt` spans that wrapped the TemplateStyles
 * `<style>`/`<link>` dedup references are removed so they leave no stray inline gap.
 */
function prepClades(root: HTMLElement) {
  // Drop the now-empty placeholders that held the stripped TemplateStyles refs.
  for (const empty of Array.from(root.querySelectorAll(".clade .mw-empty-elt"))) {
    if (!empty.textContent?.trim() && !empty.querySelector("img")) empty.remove();
  }
  for (const clade of Array.from(root.querySelectorAll("div.clade"))) {
    if (clade.parentElement?.closest("div.clade")) continue; // only the outermost tree
    clade.classList.add("wiki-clade");
    clade.setAttribute("role", "region");
    clade.setAttribute("tabindex", "0");
    clade.setAttribute("aria-label", "Cladogram");
  }
}

/**
 * Hatnotes (article-fidelity #27, design §6.2). Parsoid emits `<div role="note"
 * class="hatnote …">` at the lead top AND inside sections ("Main article: …").
 * Keep them IN PLACE (not relocated) and tag them so CSS styles them distinctly
 * (indented italic, §6.2). Their internal links are routed by `rewriteLinks`.
 */
function prepHatnotes(root: HTMLElement) {
  for (const hn of Array.from(root.querySelectorAll(".hatnote"))) {
    hn.classList.add("wiki-hatnote");
  }
}
