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

const REST = "https://en.wikipedia.org/api/rest_v1";

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
