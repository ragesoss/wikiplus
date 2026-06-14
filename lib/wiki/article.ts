// Client-side Wikipedia integration, mirroring the production approach:
// fetch from the MediaWiki REST API and sanitize before rendering. See
// docs/ARCHITECTURE.md ("Article rendering").

export interface ArticleSummary {
  title: string;
  description?: string;
  /** Sanitized lead HTML. */
  extractHtml: string;
  thumbnailUrl?: string;
  url: string;
}

export interface ArticleSection {
  id: string;       // e.g. "Light-dependent_reactions"
  title: string;    // plain text
  level: 2 | 3;    // h2 or h3
  html: string;     // sanitized paragraph HTML for this section
}

export interface ArticleBody {
  sections: ArticleSection[];
}

const REST = "https://en.wikipedia.org/api/rest_v1";
const USER_AGENT = "wiki+/prototype (https://ragesoss.github.io/wikiplus/; sage@wikiedu.org)";

/** Resolve a Wikidata QID to its English Wikipedia article title. */
export async function qidToTitle(qid: string): Promise<string | null> {
  const url =
    "https://www.wikidata.org/w/api.php" +
    `?action=wbgetentities&ids=${encodeURIComponent(qid)}` +
    "&props=sitelinks&format=json&origin=*";
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.entities?.[qid]?.sitelinks?.enwiki?.title ?? null;
}

/** Resolve a Wikipedia article title to its Wikidata QID. */
export async function titleToQid(title: string): Promise<string | null> {
  const url = `${REST}/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: { "Api-User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.wikibase_item ?? null;
}

export async function fetchArticleSummary(
  title: string
): Promise<ArticleSummary> {
  const res = await fetch(
    `${REST}/page/summary/${encodeURIComponent(title)}`
  );
  if (!res.ok) throw new Error(`Wikipedia summary error ${res.status}`);
  const data = await res.json();

  const DOMPurify = (await import("dompurify")).default;
  const extractHtml = DOMPurify.sanitize(
    data.extract_html || `<p>${data.extract ?? ""}</p>`
  );

  return {
    title: data.title,
    description: data.description,
    extractHtml,
    thumbnailUrl: data.thumbnail?.source,
    url:
      data.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

/** Rewrite internal Wikipedia links to absolute URLs. */
function rewriteLinks(html: string): string {
  return html
    .replace(/href="\.\/([^"]+)"/g, (_, slug) =>
      `href="https://en.wikipedia.org/wiki/${slug}" target="_blank" rel="noreferrer"`
    )
    .replace(/href="\/wiki\/([^"]+)"/g, (_, slug) =>
      `href="https://en.wikipedia.org/wiki/${slug}" target="_blank" rel="noreferrer"`
    );
}

/** Strip unwanted elements from HTML string. */
function stripElements(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
}

/**
 * Fetch and parse the full article body into sections.
 * MUST only run in browser (uses DOMParser). Returns empty sections in SSR.
 */
export async function fetchArticleBody(title: string): Promise<ArticleBody> {
  if (typeof window === "undefined") {
    return { sections: [] };
  }

  const res = await fetch(
    `${REST}/page/html/${encodeURIComponent(title)}`,
    {
      headers: { "Api-User-Agent": USER_AGENT },
    }
  );
  if (!res.ok) return { sections: [] };

  const rawHtml = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");

  // Remove unwanted elements
  const selectors = [
    ".mw-editsection",
    ".mw-references-wrap",
    ".navbox",
    ".hatnote",
    "style",
    "script",
    ".reference",
    ".reflist",
    ".mw-empty-elt",
    ".thumb",          // keep thumbnails out for simplicity
  ];
  for (const sel of selectors) {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  }

  const sections: ArticleSection[] = [];

  // Find all h2 and h3 elements in the body
  const body = doc.body;
  const headings = Array.from(body.querySelectorAll("h2, h3"));

  for (const heading of headings) {
    const tagName = heading.tagName.toLowerCase() as "h2" | "h3";
    const level: 2 | 3 = tagName === "h2" ? 2 : 3;

    // Get section id: prefer the heading's own id or a nearby anchor
    const anchor = heading.querySelector(".mw-headline") ?? heading;
    const rawId =
      heading.id ||
      (anchor as HTMLElement).id ||
      heading.getAttribute("data-mw-section-id") ||
      "";

    if (!rawId) continue;

    // Clean heading text
    const titleText = (heading.textContent ?? "").trim()
      .replace(/\[edit\]/g, "")
      .trim();

    if (!titleText) continue;

    // Collect content nodes between this heading and the next h2/h3
    const contentParts: string[] = [];
    let node = heading.nextElementSibling;
    while (node) {
      const nodeName = node.tagName?.toLowerCase();
      if (nodeName === "h2" || nodeName === "h3") break;
      // Skip section headings that are inside sub-divs
      if (nodeName === "section") {
        // For section elements, only take direct paragraph children
        const pNodes = Array.from(node.children).filter(
          (c) => !["h2", "h3", "h4"].includes(c.tagName.toLowerCase())
        );
        for (const p of pNodes) {
          contentParts.push(p.outerHTML);
        }
      } else {
        contentParts.push(node.outerHTML);
      }
      node = node.nextElementSibling;
    }

    let html = contentParts.join("\n");
    html = stripElements(html);
    html = rewriteLinks(html);

    sections.push({
      id: rawId,
      title: titleText,
      level,
      html,
    });
  }

  // If no headings found via above method, try section elements
  if (sections.length === 0) {
    const sectionEls = Array.from(
      body.querySelectorAll("section[data-mw-section-id]")
    );
    for (const sec of sectionEls) {
      const sectionId = sec.getAttribute("data-mw-section-id");
      if (!sectionId || sectionId === "0") continue;

      const heading = sec.querySelector("h2, h3");
      if (!heading) continue;

      const level: 2 | 3 = heading.tagName.toLowerCase() === "h2" ? 2 : 3;
      const anchor =
        heading.querySelector(".mw-headline") ?? heading;
      const rawId =
        heading.id ||
        (anchor as HTMLElement).id ||
        "";

      if (!rawId) continue;

      const titleText = (heading.textContent ?? "").trim()
        .replace(/\[edit\]/g, "")
        .trim();

      // Clone without the heading
      const clone = sec.cloneNode(true) as Element;
      clone.querySelectorAll("h2, h3").forEach((h) => h.remove());
      let html = clone.innerHTML;
      html = stripElements(html);
      html = rewriteLinks(html);

      sections.push({ id: rawId, title: titleText, level, html });
    }
  }

  return { sections };
}
