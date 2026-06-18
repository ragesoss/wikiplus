import type { Page, Route } from "@playwright/test";

// Shared, deterministic fixture stubs for the e2e suite (issue #47). The sandbox has NO network
// egress, so EVERY external HTTP call the app makes is intercepted here and answered with a
// realistic, complete shape — the fields the app actually reads. The full per-route contract is
// documented in e2e/fixtures-contract.md; keep these helpers and that doc in lock-step.
//
// Routes covered:
//   - www.wikidata.org/w/api.php (wbgetentities)  → QID → enwiki sitelink title  (qidToTitle)
//   - en.wikipedia.org/w/api.php (action query)   → title → canonical title + pageid + QID
//                                                     + displaytitle             (resolvePage)
//   - en.wikipedia.org/api/rest_v1/page/html/…    → Parsoid article HTML         (fetchFullArticle)
//   - en.wikipedia.org/w/rest.php/v1/search/title → typeahead completions        (fetchTopicSuggestions)
//   - www.googleapis.com/youtube/v3/search        → candidate videos             (youtubeSource.search)

// ── Action-API (title → canonical title + pageid + displaytitle + QID) ─────────────────────────
// `resolvePage` (lib/wiki/article.ts) reads `query.pages[*]` and treats a page with NO `pageid`
// (or a `missing` flag) as UNRESOLVED — returning all-null so the Topic route reaches its
// not-found/resolve-error path. So a stub that returns ONLY `pageprops.wikibase_item` (the old
// shape) makes EVERY unseeded title fail to resolve. A complete entry MUST carry `pageid` AND
// `title`; `displaytitle` and `pageprops.wikibase_item` are read when present.
export interface ActionPageStub {
  /** Canonical Wikipedia title (`pages[].title`) — REQUIRED (keys URL/slug/store/fetch). */
  title: string;
  /** Wikidata QID (`pages[].pageprops.wikibase_item`) — drives the under-the-hood store key. */
  qid: string;
  /** Rendered display title (`pages[].displaytitle`) — defaults to `title` when omitted. */
  displaytitle?: string;
}

/**
 * Build a complete action-API `query.pages` response for one resolved page. `pageid` is a fixed
 * positive number (its presence is what marks the page as existing; the value is not read
 * further). `ns: 0` mirrors the article namespace.
 */
export function actionApiBody(stub: ActionPageStub): string {
  return JSON.stringify({
    query: {
      pages: {
        "1": {
          pageid: 1,
          ns: 0,
          title: stub.title,
          displaytitle: stub.displaytitle ?? stub.title,
          pageprops: { wikibase_item: stub.qid },
        },
      },
    },
  });
}

/** Wikidata `wbgetentities` body: QID → its enwiki sitelink title (`qidToTitle` reads this). */
export function wikidataBody(entities: Record<string, string>): string {
  const out: Record<string, { sitelinks: { enwiki: { title: string } } }> = {};
  for (const [qid, title] of Object.entries(entities)) {
    out[qid] = { sitelinks: { enwiki: { title } } };
  }
  return JSON.stringify({ entities: out });
}

// ── YouTube candidate source (search.list) ─────────────────────────────────────────────────────
// `youtubeSource.search` (lib/candidates/youtube.ts) reads `items[].id.videoId` and
// `items[].snippet.{title,description,channelTitle,channelId,thumbnails}`. With a (placeholder)
// NEXT_PUBLIC_YOUTUBE_API_KEY inlined at build time the source is ENABLED, so this stub is what
// makes the uncurated-topic empty-state suggestions deterministic.

export interface YouTubeItemStub {
  videoId: string;
  title: string;
  channelTitle: string;
  /** Optional description text (feeds section-match keyword scan; omit for General-only). */
  description?: string;
}

/** Build a YouTube `search.list` response body from a fixed list of items. */
export function youtubeBody(items: YouTubeItemStub[]): string {
  return JSON.stringify({
    items: items.map((it) => ({
      id: { kind: "youtube#video", videoId: it.videoId },
      snippet: {
        title: it.title,
        description: it.description ?? "",
        channelTitle: it.channelTitle,
        channelId: `UC_${it.videoId}`,
        thumbnails: {
          high: {
            url: `https://i.ytimg.com/vi/${it.videoId}/hqdefault.jpg`,
            width: 480,
            height: 360,
          },
        },
      },
    })),
  });
}

/**
 * Five generic Cellular-respiration candidates whose captions/descriptions share NO distinctive
 * section keyword with the seeded RESP_HTML sections ("Glycolysis", "Citric acid cycle"), so the
 * pipeline places all five in the General band (capped at GENERAL_CANDIDATE_COUNT = 5) and zero in
 * sections → exactly 5 total suggestions. That fixed total backs the "5 auto-suggestions" count
 * line and the dismiss-one → "4" assertion (core-loop AC19).
 */
export const RESP_YT_ITEMS: YouTubeItemStub[] = [
  { videoId: "resp001", title: "How cells make energy", channelTitle: "Science Sketch" },
  { videoId: "resp002", title: "The powerhouse explained", channelTitle: "BioBites" },
  { videoId: "resp003", title: "Energy in living things", channelTitle: "Crash Lessons" },
  { videoId: "resp004", title: "A quick overview of metabolism", channelTitle: "StudyNook" },
  { videoId: "resp005", title: "Inside the mitochondria", channelTitle: "MicroWorld" },
];

// ── Route registration helper ───────────────────────────────────────────────────────────────────
const json = (route: Route, body: string) =>
  route.fulfill({ contentType: "application/json", body });

/**
 * Register the Wikidata + action-API + YouTube stubs on a page. The article HTML route
 * (`api/rest_v1/page/html`) is spec-specific (each spec carries its own fixture HTML), so it is
 * NOT registered here — the caller adds it. `resolve` maps a request URL to the right page stub;
 * `youtube` maps a search query to a candidate list (default: empty).
 */
export async function stubCommon(
  page: Page,
  opts: {
    /** QID → enwiki title, for the Wikidata `wbgetentities` route (`qidToTitle`). */
    wikidata: Record<string, string>;
    /** Map a decoded action-API request URL to the page stub it should resolve to. */
    resolve: (url: string) => ActionPageStub;
    /** Map a YouTube search request URL to its candidate list (default: none). */
    youtube?: (url: string) => YouTubeItemStub[];
  }
): Promise<void> {
  await page.route("**/wikidata.org/**", (route) => json(route, wikidataBody(opts.wikidata)));
  await page.route("**/w/api.php**", (route) => {
    const url = decodeURIComponent(route.request().url());
    json(route, actionApiBody(opts.resolve(url)));
  });
  await page.route("**/youtube/v3/search**", (route) => {
    const url = decodeURIComponent(route.request().url());
    const items = opts.youtube ? opts.youtube(url) : [];
    json(route, youtubeBody(items));
  });
}
