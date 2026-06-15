// Client-side Wikipedia typeahead (prefix-completion) suggestions for the navbar
// topic search (#12). This is the SAME key-free, CORS-enabled, anonymous-GET shape
// already used in `lib/wiki/article.ts` (`titleToQid`, `fetchFullArticle`): no
// server, no secret, no quota. See docs/ARCHITECTURE.md ("Topic discovery & search").
//
// Endpoint (Decision 2, owner-confirmed): the REST title-completion endpoint
// `/w/rest.php/v1/search/title` — Wikipedia's own typeahead engine, namespace 0
// (articles). It returns ranked completions plus an optional short description the
// UI may show. We display the upstream order as-is (no re-ranking — spec Out-of-scope).
//
// Etiquette (binding, Decision 2 / AC10): the caller debounces and aborts the prior
// in-flight request on query change; THIS function degrades **silently** on any
// error/abort/timeout (returns `[]`) so the UI never shows an error surface — it
// falls back to the submit-the-typed-title path (Decision 4).

// Wikimedia etiquette: the same descriptive Api-User-Agent as the article client.
// Browsers forbid setting User-Agent, but Api-User-Agent is honored by the REST API
// for anonymous CORS GETs (mirrors lib/wiki/article.ts).
const UA = "wiki+/0.0 (prototype; https://ragesoss.github.io/wikiplus/)";

/** REST `search/title` base — namespace 0 (articles) is the endpoint's default. */
const SUGGEST_URL = "https://en.wikipedia.org/w/rest.php/v1/search/title";

/** A single typeahead suggestion: a real article title + optional short description. */
export interface TopicSuggestion {
  /** The exact article title — handed verbatim to `topicHref` (never hand-encoded). */
  title: string;
  /** Short Wikidata/REST description, if the endpoint returned one (may be undefined). */
  description?: string;
}

/** Shape of a REST `search/title` result page (only the fields we read). */
interface RestSearchPage {
  title?: string;
  description?: string | null;
}

/**
 * Fetch up to `limit` Wikipedia article-title completions for `query`.
 *
 * Resolves to `[]` for an empty/whitespace query, and **degrades silently to `[]`**
 * on any non-OK response, network error, timeout, or abort — the contract the UI
 * relies on (Decision 2/4: never an error UI; fall through to submit-the-typed-title).
 *
 * @param query  the raw typed text (trimmed here; not encoded by the caller).
 * @param opts.signal  an AbortSignal so the caller can cancel a superseded request.
 * @param opts.limit   max suggestions to request (default 7 — design caps the list at 7).
 */
export async function fetchTopicSuggestions(
  query: string,
  opts: { signal?: AbortSignal; limit?: number } = {}
): Promise<TopicSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  const limit = opts.limit ?? 7;

  const url =
    `${SUGGEST_URL}?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(String(limit))}`;

  try {
    const res = await fetch(url, {
      headers: { "Api-User-Agent": UA },
      signal: opts.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { pages?: RestSearchPage[] };
    const pages = Array.isArray(data?.pages) ? data.pages : [];
    const out: TopicSuggestion[] = [];
    for (const p of pages) {
      const title = typeof p.title === "string" ? p.title : "";
      if (!title) continue;
      const description =
        typeof p.description === "string" && p.description ? p.description : undefined;
      out.push(description ? { title, description } : { title });
    }
    return out;
  } catch {
    // Abort, network error, timeout, or malformed JSON: silent degrade (Decision 2/4).
    return [];
  }
}
