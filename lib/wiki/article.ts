// Client-side Wikipedia integration, mirroring the production approach: fetch
// rendered article HTML from the MediaWiki REST API, sanitize with DOMPurify, and
// rewrite wikilinks before rendering. See docs/ARCHITECTURE.md ("Article rendering").
//
// v1 upgrade: the lead-only summary is no longer enough — the TOC + scroll-sync
// need the full section structure (AC3). We fetch the page HTML, derive a section
// list with stable slugs, and split the body into per-section fragments.

import type { ArticleSection } from "@/lib/data/types";
import { topicHref } from "./topicRoute";

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
}

export interface ArticleSectionBody extends ArticleSection {
  /** Sanitized + link-rewritten section body HTML (may be empty for stub sections). */
  html: string;
}

export interface FullArticle {
  title: string;
  lead: ArticleLead;
  sections: ArticleSectionBody[];
  url: string;
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
 * redirects and is CORS-enabled for anonymous GETs.
 */
export async function titleToQid(title: string): Promise<string | null> {
  const url =
    "https://en.wikipedia.org/w/api.php" +
    "?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1" +
    `&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  const res = await fetch(url, { headers: { "Api-User-Agent": UA } });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;
  const first = Object.values(pages)[0] as
    | { pageprops?: { wikibase_item?: string } }
    | undefined;
  return first?.pageprops?.wikibase_item ?? null;
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

// Sections that are navigational/meta rather than article content — dropped from
// the TOC + body so the reader sees the encyclopedia, not editor chrome.
const DROP_SECTIONS = new Set([
  "references",
  "notes",
  "citations",
  "footnotes",
  "external-links",
  "external-link",
  "further-reading",
  "see-also",
  "bibliography",
  "sources",
  "works-cited",
  "general-and-cited-references",
]);

/**
 * Fetch + sanitize the full article and derive its section structure.
 *
 * We use the REST `page/html` endpoint (Parsoid HTML, CORS-enabled for anonymous
 * GETs — ARCHITECTURE "Article rendering"). The body is a flat stream of
 * <section> wrappers around headings; we sanitize the whole document once, rewrite
 * links + figures, then walk top-level headings (h2–h4) to build the TOC + split
 * the body. The lead = everything before the first h2.
 */
export async function fetchFullArticle(title: string): Promise<FullArticle> {
  const res = await fetch(
    `${REST}/page/html/${encodeURIComponent(title)}`,
    { headers: { "Api-User-Agent": UA } }
  );
  if (!res.ok) throw new Error(`Wikipedia article error ${res.status}`);
  const rawHtml = await res.text();

  const DOMPurify = (await import("dompurify")).default;

  // --- Allowlist (ARCHITECTURE open question, resolved here) -------------------
  // Keep prose, headings, lists, links, and figures/images (with captions/credit).
  // Drop scripts/styles/iframes/forms and Parsoid/MediaWiki bookkeeping attrs.
  const clean = DOMPurify.sanitize(rawHtml, {
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
      "id", "class", "colspan", "rowspan", "rel", "target",
      "width", "height", "data-mw-section-id",
    ],
    // We rewrite links ourselves; allow http(s) + relative.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\.{0,2}\/|#)/i,
  });

  const doc = new DOMParser().parseFromString(clean, "text/html");
  const root = doc.body;

  rewriteLinks(root, title);
  cleanFigures(root);
  stripChrome(root);

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

  return {
    title,
    url: articleUrl,
    lead: { title, leadHtml: leadParts.join("\n"), url: articleUrl },
    sections: dedupeSlugs(sections),
  };
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

    if (m && !m[1].includes(":")) {
      // Ordinary article link → canonical title-based topic route.
      const title = decodeURIComponent(m[1]);
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
      // In-page anchor (e.g. cite/note refs) → de-link to plain text.
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

/** Strip editor chrome the sanitize allowlist let through. */
function stripChrome(root: HTMLElement) {
  const junk = [
    ".mw-editsection",
    ".reference",
    ".mw-references-wrap",
    ".reflist",
    ".navbox",
    ".metadata",
    ".mbox-text",
    ".ambox",
    "table.infobox",
    "table.sidebar",
    "table.vertical-navbox",
    "sup.reference",
    ".hatnote",
    ".thumbcaption .magnify",
    "style",
    "link",
  ];
  for (const sel of junk) {
    for (const el of Array.from(root.querySelectorAll(sel))) el.remove();
  }
}
