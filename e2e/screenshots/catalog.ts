import type { Page } from "@playwright/test";
import { RESP_YT_ITEMS, stubCommon, type YouTubeItemStub } from "../fixtures";
import { signIn } from "../auth";

// ── wiki+ screenshot scene catalog ──────────────────────────────────────────────────────────────
// The SINGLE source of truth for the standard PR screenshot gallery. Both the capture spec
// (e2e/screenshots.spec.ts) and the index generator (scripts/dev/shots-index.ts) import `SCENES`
// from here, so ADDING A SHOT IS ONE OBJECT: append a `Scene` and it is captured across its
// viewports × auth states AND listed in the browsable HTML index automatically.
//
// A scene names a SURFACE in a STATE: a route, a fixture profile, an optional `prepare` step that
// drives the page to the state worth seeing (scroll the header to slim, open a player, reveal the
// mobile search, scroll the General rail), and a `clip` that frames the shot (whole page, the live
// viewport, a single element, or a fixed rectangle). The matrix per scene is viewports (mobile /
// tablet / desktop) × auth (logged-out / logged-in), each subsettable per scene.
//
// SIGNED-IN INTEGRITY (#109): the logged-in arm is only trustworthy if the client session actually
// resolved a numeric `contributorId` (the bug was a session whose display name populated while
// `contributorId` stayed null, so `TopicView`'s `signedIn` was false and every "logged-in" shot
// silently rendered the logged-out view). `waitForSignedIn` below is the loud guard: it polls the
// real `/api/auth/session` and THROWS if `contributorId` never becomes a number, so a silently
// logged-out "logged-in" shot fails the run instead of landing in the gallery.
//
// Captures run against the Node SSR server with the in-spec Wikipedia/Wikidata/YouTube stubs + the
// seeded ephemeral Postgres (Playwright globalSetup). The logged-in arm uses the e2e session-cookie
// helper (no real OAuth, no network egress).

export type Viewport = "mobile" | "tablet" | "desktop" | "landscape-tablet";
export type AuthState = "out" | "in";
/** The active skin for a capture (issue #119). "light" is the default Indigo Press zine (no
 *  `data-skin`); "zine-dark" is the dark skin, selected by the `wikiplus-skin` cookie the spec sets
 *  before navigation (mirroring the pre-paint bootstrap in app/layout.tsx). A scene opts into the
 *  dark capture via `skins`; the default is light-only so the committed baseline does not double. */
export type Skin = "light" | "zine-dark";
/** The cookie the pre-paint bootstrap (app/layout.tsx) reads to select a non-default skin. */
export const SKIN_COOKIE = "wikiplus-skin";

/** Viewport sizes — the widths that select the app's mobile (< md) / tablet (md) / desktop (≥ lg)
 *  layouts. Heights are the rendering window; full-page captures grow past them. */
export const VIEWPORTS: Record<Viewport, { width: number; height: number }> = {
  mobile: { width: 390, height: 850 },
  tablet: { width: 834, height: 1000 },
  desktop: { width: 1280, height: 900 },
  // A wide-but-short landscape tablet (iPad-Mini landscape). ≥ lg WIDE but < 820px TALL, so the
  // About page's height-aware gate (docs/design/about-height-aware-scene.md) renders the
  // miniature-alone fallback rather than the full poster scene. Only the dedicated
  // `about-landscape-tablet` scene opts into this viewport — the default matrix is unaffected.
  "landscape-tablet": { width: 1024, height: 768 },
};

/**
 * How a scene is framed:
 *   - "fullPage"               the whole scrollable page (whole-surface scenes: home, about, …)
 *   - "viewport"               exactly the visible window (e.g. body under the slim sticky header)
 *   - a selector string        the element's own bounding box (component scenes: a card, the strip)
 *   - { x, y, width, height }  a fixed rectangle from the top-left (the slim header bar)
 */
export type Clip =
  | "fullPage"
  | "viewport"
  | string
  | { x: number; y: number; width: number; height: number };

/** A fixture profile — the external-call stubs + seeded topic a scene renders against. */
export type StubProfile =
  | "curated"
  | "suggestions"
  | "empty"
  | "missing"
  | "plain"
  | "article-mobile";

export interface Scene {
  /** Filename stem + index key, e.g. "topic-general-curated". Combined with viewport + auth. */
  id: string;
  /** Index section heading the scene is grouped under. */
  group: string;
  /** Human caption for the index + the PR gallery. */
  label: string;
  /** One-line note on what the shot is evidence of (shown under the caption in the index). */
  note?: string;
  /** Route to open. */
  route: string;
  /** Which external-call stubs + seeded topic to render against (default "plain"). */
  stub?: StubProfile;
  /** Viewports to capture (default: all three). */
  viewports?: Viewport[];
  /** Auth states to capture (default: both). */
  auth?: AuthState[];
  /** Skins to capture (issue #119; default: ["light"] — the default zine). A surface that should
   *  also evidence the zine-dark skin adds "zine-dark"; the dark cell is captured + indexed
   *  automatically with a `-zine-dark` filename suffix. The light baseline is always captured so the
   *  byte-stable-light acceptance holds across a full refresh. */
  skins?: Skin[];
  /** Register extra route overrides BEFORE navigation (after the stub profile, before `goto`).
   *  Used by the loading/error scenes to STALL or FAIL a flow so the capture lands during load
   *  or on the error face (the `prepare`/`ready` hooks run post-`goto`, too late to block the
   *  initial fetch). A no-op for ordinary scenes. */
  setup?: (page: Page) => Promise<void>;
  /** Drive the page to the state worth capturing (scroll, open a player, reveal search, …). */
  prepare?: (page: Page) => Promise<void>;
  /** Wait signal before capture (default: the header is present). */
  ready?: (page: Page) => Promise<void>;
  /** How to frame the shot (default: "fullPage"). */
  clip?: Clip;
  /** Surface this scene first in the index, badged — the focus of the current PR. */
  focus?: boolean;
}

// ── Fixture article bodies ──────────────────────────────────────────────────────────────────────

/** An article long enough to scroll well past the header-collapse threshold (slim captures), but
 *  no longer — extra filler sections only bloat the committed `topic-body` full-page shots. */
function longArticleHtml(lead: string): string {
  return `<!DOCTYPE html><html><body>
    <section><p>${lead}</p></section>
    ${Array.from({ length: 14 })
      .map(
        (_, i) =>
          `<section data-mw-section-id="${i + 1}"><h2 id="s${i}">Section ${i + 1}</h2><p>Body text for section ${i + 1}, repeated to give the article real scroll height.</p></section>`
      )
      .join("")}
  </body></html>`;
}

/** A short two-section article whose headings share NO keyword with RESP_YT_ITEMS, so the five
 *  candidates all land in the General band (the suggestion-state captures). */
export const SUGGESTION_ARTICLE_HTML = `<!DOCTYPE html><html><body>
  <section><p>Cellular respiration is the set of metabolic reactions that convert nutrients into ATP.</p></section>
  <section data-mw-section-id="1"><h2 id="glycolysis">Glycolysis</h2><p>Glycolysis body.</p></section>
  <section data-mw-section-id="2"><h2 id="citric">Citric acid cycle</h2><p>Citric acid cycle body.</p></section>
</body></html>`;

/** The mobile-article fixture (issue #121, design §10): an article shaped to exercise EVERY mobile
 *  state in one capture set — a **taxobox in the lead** (stacks full-width at phone width — AC4), a
 *  multi-`h2` section stack (the collapsed/expanded disclosure — AC1/AC3), nested `h3` content under
 *  an `h2` (renders inside the expanded group), and a **wide data table** inside a section (scrolls
 *  horizontally in `.wiki-tablewrap`, no page-level overflow — AC4). The taxobox lives BEFORE the
 *  first `h2`, so article.ts keeps it in the always-open lead; the wide table lives inside an `h2`
 *  body so it is revealed on expand and the observers flag its overflow. */
const MOBILE_ARTICLE_HTML = `<!DOCTYPE html><html><body>
  <section>
    <table class="infobox biota">
      <caption>Lion</caption>
      <tr><th colspan="2">Lion</th></tr>
      <tr><td colspan="2" style="text-align:center"><img src="//up.example/lion.jpg" width="200" height="150" alt="Lion"></td></tr>
      <tr><th scope="row">Kingdom</th><td>Animalia</td></tr>
      <tr><th scope="row">Family</th><td>Felidae</td></tr>
      <tr><th scope="row">Genus</th><td>Panthera</td></tr>
      <tr><th scope="row">Species</th><td>P. leo</td></tr>
    </table>
    <p>The lion (<i>Panthera leo</i>) is a large cat of the genus <i>Panthera</i>, native to Africa and India. It has a muscular, broad-chested body and a short, rounded head.</p>
  </section>
  <section data-mw-section-id="1"><h2 id="etymology">Etymology</h2>
    <p>The English word "lion" derives via Anglo-Norman from the Latin <i>leonem</i>.</p>
  </section>
  <section data-mw-section-id="2"><h2 id="taxonomy">Taxonomy</h2>
    <p>The lion is part of the genus <i>Panthera</i> within the family Felidae.</p>
    <section data-mw-section-id="3"><h3 id="subspecies">Subspecies</h3>
      <p>Two subspecies are recognised today, distinguished by range and morphology.</p>
    </section>
  </section>
  <section data-mw-section-id="4"><h2 id="population">Population by region</h2>
    <p>A wide table of recorded population estimates, wider than a phone column:</p>
    <table class="wikitable">
      <caption>Estimated wild lion population by region and year</caption>
      <tr><th>Region</th><th>1990</th><th>2000</th><th>2010</th><th>2020</th><th>Trend</th><th>Protected areas</th></tr>
      <tr><td>West Africa</td><td>2,000</td><td>1,200</td><td>850</td><td>400</td><td>Declining</td><td>Limited</td></tr>
      <tr><td>East Africa</td><td>20,000</td><td>15,000</td><td>11,000</td><td>8,000</td><td>Declining</td><td>Extensive</td></tr>
      <tr><td>Southern Africa</td><td>12,000</td><td>11,500</td><td>11,000</td><td>10,500</td><td>Stable</td><td>Extensive</td></tr>
      <tr><td>India (Gir)</td><td>250</td><td>320</td><td>411</td><td>674</td><td>Increasing</td><td>Single reserve</td></tr>
    </table>
  </section>
  <section data-mw-section-id="5"><h2 id="behaviour">Behaviour</h2>
    <p>Lions are social and live in groups called prides.</p>
  </section>
  <section data-mw-section-id="6"><h2 id="references">References</h2><p>Cited works.</p></section>
</body></html>`;

// ── Fixture profiles ────────────────────────────────────────────────────────────────────────────
// Each profile registers the Wikidata + action-API + YouTube stubs (no network egress) and the
// article-HTML + embed routes a scene needs. The seeded ephemeral Postgres already carries the
// demo topics: Photosynthesis is fully curated; Cellular respiration and Cat render the empty arm.

/** A placeholder embed page so an opened player frame shows a solid panel, not a blocked iframe. */
async function stubEmbeds(page: Page): Promise<void> {
  const body =
    "<!DOCTYPE html><html><head><meta charset='utf-8'></head>" +
    "<body style='margin:0;background:#2C2C2C;color:#fff;font-family:sans-serif'>" +
    "<div style='display:flex;height:100vh;align-items:center;justify-content:center'>▶ video</div>" +
    "</body></html>";
  await page.route(/youtube-nocookie\.com\/embed\//, (route) =>
    route.fulfill({ contentType: "text/html", body })
  );
  await page.route(/youtube\.com\/embed\//, (route) =>
    route.fulfill({ contentType: "text/html", body })
  );
}

export async function stubTopic(
  page: Page,
  opts: { qid: string; title: string; article: string; youtube: () => YouTubeItemStub[] }
): Promise<void> {
  await stubCommon(page, {
    wikidata: { [opts.qid]: opts.title },
    resolve: () => ({ title: opts.title, qid: opts.qid }),
    youtube: opts.youtube,
  });
  await page.route("**/api/rest_v1/page/html/**", (route) =>
    route.fulfill({ contentType: "text/html", body: opts.article })
  );
  await stubEmbeds(page);
}

export async function applyStub(page: Page, profile: StubProfile): Promise<void> {
  switch (profile) {
    case "curated":
      return stubTopic(page, {
        qid: "Q11982",
        title: "Photosynthesis",
        article: longArticleHtml(
          "Photosynthesis is the process used by plants, algae, and some bacteria to convert light energy into chemical energy."
        ),
        youtube: () => [],
      });
    case "suggestions":
      return stubTopic(page, {
        qid: "Q189603",
        title: "Cellular respiration",
        article: SUGGESTION_ARTICLE_HTML,
        // Append one PORTRAIT (9:16) candidate so the PinnedPlayer's narrowed vertical dock + its
        // action row can be captured at the stressing width (issue #123 §6).
        youtube: () => [
          ...RESP_YT_ITEMS,
          {
            videoId: "resp006",
            title: PINNED_VERTICAL_CAPTION,
            channelTitle: "ShortBio",
            vertical: true,
          },
        ],
      });
    case "empty":
      return stubTopic(page, {
        qid: "Q146",
        title: "Cat",
        article: longArticleHtml("The cat is a domestic species of small carnivorous mammal."),
        youtube: () => [],
      });
    case "article-mobile":
      // The mobile-article-rendering fixture (#121): an uncurated topic (created on demand) whose
      // article carries a lead taxobox, nested `h3` content, and a wide table — the shapes the
      // mobile collapse / infobox-stacking / table-scroll scenes capture (design §10).
      return stubTopic(page, {
        qid: "Q140",
        title: "Lion",
        article: MOBILE_ARTICLE_HTML,
        youtube: () => [],
      });
    case "missing":
      // A well-formed but NONEXISTENT title: the action API returns a `missing` page (no pageid),
      // which resolvePage treats as unresolved → TopicView's #19 not-found state. Register the
      // action route AFTER stubCommon so this (last-registered) handler wins.
      await stubTopic(page, {
        qid: "Q0",
        title: "Asdfqwer",
        article: "<!DOCTYPE html><html><body></body></html>",
        youtube: () => [],
      });
      await page.route("**/w/api.php**", (route) => {
        const url = decodeURIComponent(route.request().url());
        const title = /[?&]titles=([^&]+)/.exec(url)?.[1]?.replace(/\+/g, " ") ?? "Asdfqwer";
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ query: { pages: { "-1": { ns: 0, title, missing: "" } } } }),
        });
      });
      return;
    case "plain":
      // Non-topic surfaces (home, about, contribute, contributor) make no Wikipedia fetch; register
      // empty stubs anyway so any stray external call is intercepted (the sandbox has no egress).
      await stubCommon(page, { wikidata: {}, resolve: () => ({ title: "", qid: "" }), youtube: () => [] });
      return;
  }
}

// ── Auth guard ──────────────────────────────────────────────────────────────────────────────────

/** Sign the page in as the seeded e2e contributor (call BEFORE navigating). */
export async function signInPage(page: Page, baseURL?: string): Promise<void> {
  await signIn(page, baseURL);
}

/**
 * The loud signed-in guard (#109). Poll the REAL `/api/auth/session` until the client session
 * carries a NUMERIC `contributorId` — the exact predicate `TopicView` derives `signedIn` from.
 * THROWS if it never resolves, so a silently logged-out "logged-in" capture fails the run rather
 * than landing in the gallery looking signed in. Call AFTER `page.goto`.
 */
export async function waitForSignedIn(page: Page): Promise<void> {
  const deadline = Date.now() + 8000;
  let last: unknown = null;
  while (Date.now() < deadline) {
    const id = await page.evaluate(async () => {
      try {
        const r = await fetch("/api/auth/session", { credentials: "include" });
        const j = await r.json();
        return (j && j.user ? j.user.contributorId : null) ?? null;
      } catch {
        return null;
      }
    });
    if (typeof id === "number") return;
    last = id;
    await page.waitForTimeout(150);
  }
  throw new Error(
    `waitForSignedIn: /api/auth/session never returned a numeric contributorId (last: ${JSON.stringify(last)}). ` +
      "A signed-in capture would silently render the logged-out view (#109)."
  );
}

// ── prepare / ready helpers ───────────────────────────────────────────────────────────────────

/** Scroll past the header-collapse threshold and let the slim end-state settle. */
export async function collapseHeader(page: Page): Promise<void> {
  await page.locator("header.header-shared").waitFor();
  await page.evaluate(() => window.scrollTo(0, 700));
  await page
    .locator("header.header-shared[data-collapsed]")
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(350); // let the ~180ms cross-fade settle to the slim end-state
}

/** Wait for the Topic article to be present (the Topic-host header + first heading). */
async function topicReady(page: Page): Promise<void> {
  await page.locator("header.header-shared").waitFor();
  await page.locator("h1").first().waitFor();
  await page.waitForTimeout(300);
}

// ── Loading / error setups (topic-loading-states §8). ───────────────────────────────────────────
// These STALL or FAIL a flow before navigation so the capture lands on the pending/error face. The
// route overrides are registered LAST (after applyStub), so Playwright's last-registered handler
// wins for the matched URLs.

/**
 * Scene (a) — hold BOTH regions pending (§4 row 1): stall the article HTML fetch (so
 * `fetchState` stays "loading" → the article scan skeleton) AND stall the store-read Server
 * Action POST to the topic route (so `!storeReady` → the plus scan skeleton). A stalled
 * handler that never fulfills keeps the request pending for the capture window — no empty or
 * error copy can render because neither region has settled.
 */
async function stallTopicLoading(page: Page): Promise<void> {
  // Stall the Parsoid article HTML — fetchState stays "loading".
  await page.route("**/api/rest_v1/page/html/**", () => {
    /* never fulfilled — the request hangs, holding the article skeleton */
  });
  // Stall the store-read Server Action: App-Router Server Actions POST to the page route itself
  // (the GET that delivers the document must still pass through). Hold only the POSTs.
  await page.route("**/topic/**", (route) => {
    if (route.request().method() === "POST") return; // hang the store-read action(s)
    return route.continue();
  });
}

/** Ready for the loading scene: wait for the article scan skeleton (the loading face), not an
 *  `h1` (which never appears while the fetch is stalled), then a short settle for the scan. */
async function topicLoadingReady(page: Page): Promise<void> {
  await page.locator("header.header-shared").waitFor();
  await page.locator('[aria-busy="true"] .projector-scan').first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
}

/**
 * Scene (c) — fail the article fetch (§4 row 11): abort the Parsoid HTML route so
 * `fetchFullArticle` throws → `fetchState === "error"` (the `ArticleError` card). Paired with the
 * `curated` stub so the rail still lists clips (AC9) and the shot shows NO contradictory empty copy.
 */
async function failTopicArticle(page: Page): Promise<void> {
  await page.route("**/api/rest_v1/page/html/**", (route) => route.abort());
}

/** Ready for the article-error scene: wait for the error alert card to settle. */
async function topicErrorReady(page: Page): Promise<void> {
  await page.locator("header.header-shared").waitFor();
  await page.getByRole("alert").first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
}

/** Wait for a home-host page (home / about / contribute / contributor) to be present. The home
 *  host renders the projector as a plain element (NOT `header.header-shared`, which is Topic-only),
 *  so the cross-host ready signal is the "wiki+" lockup link plus the page's first heading. */
export async function homeReady(page: Page): Promise<void> {
  await page.getByRole("link", { name: "wiki+" }).first().waitFor();
  await page.getByRole("heading").first().waitFor();
  await page.waitForTimeout(300);
}

// ── Recent-curations feed setups (issue #160 / `/recent`, design §10). ──────────────────────────
// The feed's data is the `listRecentCurations` Server Action POST to the `/recent` route itself
// (the GET that delivers the document must still pass through — only the POST is the read). Stall it
// for the loading face, abort it for the error face; the populated/empty faces use the seeded DB
// through the normal POST. Registered LAST (after applyStub) so the handler wins.

/** Stall the feed read (the `/recent` Server Action POST) so the initial loading skeletons hold. */
async function stallRecentLoading(page: Page): Promise<void> {
  await page.route("**/recent**", (route) => {
    if (route.request().method() === "POST") return; // hang the feed read action
    return route.continue();
  });
}

/** Ready for the loading scene: the header + the polite "Loading recent curations…" status. */
async function recentLoadingReady(page: Page): Promise<void> {
  await homeReady(page);
  await page.locator('[aria-busy="true"]').first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
}

/** Fail the feed read (abort the `/recent` POST) so the initial-error panel renders. */
async function failRecentRead(page: Page): Promise<void> {
  await page.route("**/recent**", (route) => {
    if (route.request().method() === "POST") return route.abort();
    return route.continue();
  });
}

/** Ready for the error scene: the header + the "Couldn't load the feed" heading. */
async function recentErrorReady(page: Page): Promise<void> {
  await homeReady(page);
  await page.getByText("Couldn't load the feed").waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
}

/** Ready for a populated feed: the header + the first item's play affordance settled. */
async function recentPopulatedReady(page: Page): Promise<void> {
  await homeReady(page);
  await page.getByRole("button", { name: /^Play:/ }).first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
}

/** Play the first feed clip (mount the embed iframe) for the `recent-feed-playing` capture. */
async function playFirstRecentClip(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Play:/ }).first().click();
  await page.locator("iframe").first().waitFor({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
}

/** Scroll the feed track to its end so the end-of-feed marker ("You're all caught up.") is in view.
 *  Repeatedly activates "Show more" (the keyboard fallback) until it is gone, then settles. */
async function scrollRecentToEnd(page: Page): Promise<void> {
  await recentPopulatedReady(page);
  for (let i = 0; i < 12; i++) {
    const more = page.getByRole("button", { name: "Show more curations" });
    if ((await more.count()) === 0) break;
    await more.first().click().catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.getByText("You're all caught up.").waitFor({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
}

/** Wait for the About centerpiece to be SETTLED (docs/design/about-projector-warmup.md §6). The
 *  page plays a one-shot "projector warm-up" intro on load; the baseline must capture the SETTLED
 *  final state, never a mid-intro frame. Two independent guards (belt-and-braces): force reduced
 *  motion — under which the FIRST paint is the final state (no intro to race) — AND wait for the
 *  `data-about-intro="settled"` readiness signal the Centerpiece exposes (covers a no-preference
 *  capture too). So the regenerated About baseline equals the committed static poster (AC11). */
async function aboutSettled(page: Page): Promise<void> {
  await homeReady(page); // wordmark link + first heading (the home-host ready signal)
  // Force the no-intro path: under `reduce` the first painted scene IS the settled poster.
  await page.emulateMedia({ reducedMotion: "reduce" });
  // …and/or wait the settled signal (covers a no-preference capture if the harness ever runs one).
  await page
    .locator('[data-about-intro="settled"]')
    .waitFor({ timeout: 3000 })
    .catch(() => {});
}

/** Open the blocking PlayerModal by playing the first curated clip. */
async function openPlayerModal(page: Page): Promise<void> {
  await page.locator("#general-band").waitFor();
  await page.getByRole("button", { name: /^Play:/ }).first().click();
  await page.locator('[role="dialog"][aria-label="Video player"]').waitFor();
  await page.waitForTimeout(200);
}

/** Open the non-modal PinnedPlayer dock by playing the first candidate suggestion. */
async function openPinnedPlayer(page: Page): Promise<void> {
  await page.locator("#general-band").waitFor();
  await page.getByRole("button", { name: /^Play:/ }).first().click();
  await page.locator('section[aria-label="Video preview"]').waitFor();
  await page.waitForTimeout(200);
}

/** The caption of the portrait (9:16) candidate appended to the `suggestions` YouTube stub (above)
 *  so the PinnedPlayer's narrowed VERTICAL dock + its action row can be captured (issue #123 §6). */
const PINNED_VERTICAL_CAPTION = "Cellular respiration in 60 seconds";

/** Open the PinnedPlayer on a VERTICAL (9:16) candidate so the narrowed dock + its action row are
 *  captured at the stressing width (issue #123 §6 — the two buttons still fit). */
async function openPinnedPlayerVertical(page: Page): Promise<void> {
  await page.locator("#general-band").waitFor();
  await page
    .getByRole("button", { name: `Play: ${PINNED_VERTICAL_CAPTION}` })
    .first()
    .click();
  await page.locator('section[aria-label="Video preview"]').waitFor();
  await page.waitForTimeout(200);
}

/** Open the dock, then activate the signed-in "Not relevant" action: the dock closes (the playing
 *  candidate is dismissed) and focus lands on the General band heading (issue #123 State L). This
 *  scene is the POST-DISMISS resting state — evidence the dock tears down and the loop returns to
 *  the band. Run signed-in only (the Not-relevant button is gated, not shown, logged out). */
async function dismissFromPinnedPlayer(page: Page): Promise<void> {
  await openPinnedPlayer(page);
  await page
    .getByRole("button", { name: /^Dismiss as not relevant:/ })
    .first()
    .click();
  await page
    .locator('section[aria-label="Video preview"]')
    .waitFor({ state: "detached" });
  await page.waitForTimeout(200);
}

/** Wait for the article column to be present, then scroll the collapsed `h2` disclosure stack into
 *  view (past the lead + TOC). On a phone (`< md`) each `h2` section is a collapsed disclosure button
 *  (`.sec-h2-toggle > button`); this frames the stack of closed rows (design §10 collapsed scene). */
async function articleCollapsedStack(page: Page): Promise<void> {
  await topicReady(page);
  // The first collapsed `h2` toggle marks the top of the section stack; scroll it near the top.
  const firstToggle = page.locator(".sec-h2-toggle > button").first();
  await firstToggle.waitFor();
  await firstToggle.evaluate((el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior })
  );
  await page.waitForTimeout(300);
}

/** Open one `h2` disclosure (the "Taxonomy" section, which carries nested `h3` content) and scroll
 *  it to the top, so the capture shows the expanded body + a nested `h3` in document order while the
 *  neighbouring sections stay collapsed (design §10 expanded scene). */
async function articleExpandSection(page: Page, name: RegExp): Promise<void> {
  await topicReady(page);
  const toggle = page.getByRole("button", { name });
  await toggle.waitFor();
  await toggle.click();
  await page.locator(`[aria-expanded="true"]`).first().waitFor();
  await toggle.evaluate((el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior })
  );
  await page.waitForTimeout(400); // let the reveal lay out + the overflow observers flag the table
}

// ── Marked complete / closed to suggestions (issue #159) ──
// The curator mark/un-mark control lives at the foot of the ＋plus panel and renders SIGNED-IN only,
// so these scenes run the signed-in arm and drive the complete state THROUGH the real control (a UI
// click that persists via the role-gated Server Action). Idempotent: if the topic is already marked
// complete (a prior scene in the same seeded DB), the control reads "Reopen to suggestions" and we
// skip the click — the page is already in the suppressed complete state either way.

/** Mark the topic complete via the curator control, then wait for the status indicator. REOPEN-FIRST
 *  for determinism: if a prior scene left this topic complete (shared seeded DB, no per-scene reset),
 *  reopen it first so the subsequent mark always produces a fresh, captured complete state. Leaves
 *  the page in the suppressed complete state (the default view). */
async function markComplete(page: Page): Promise<void> {
  await topicReady(page);
  const reopen = page.getByRole("button", {
    name: /Reopen this topic to suggestions/i,
  });
  if (await reopen.count()) {
    await reopen.first().click();
    await page
      .getByRole("button", { name: /Mark this topic complete/i })
      .first()
      .waitFor({ timeout: 8000 });
  }
  await page
    .getByRole("button", { name: /Mark this topic complete/i })
    .first()
    .click();
  // The status indicator ("Marked complete") confirms the suppressed complete state is rendered.
  await page.getByText(/Marked complete/i).first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(250);
}

/** Mark complete, then activate the per-viewer override so the normal suggestion presentation is
 *  revealed for this session (the "overridden" capture — suggestions reappear in place). */
async function markCompleteOverridden(page: Page): Promise<void> {
  await markComplete(page);
  await page
    .getByRole("button", { name: /Show suggestions for this topic/i })
    .first()
    .click();
  await page
    .getByRole("button", { name: /Hide suggestions again/i })
    .first()
    .waitFor({ timeout: 8000 });
  await page.waitForTimeout(250);
}

// ── Unified mobile dock (issue #120) ──
// On a mobile viewport (< lg) BOTH curated and candidate playback route into the one
// `MobilePlayerDock`, a `<section aria-label="Video player">` (distinct from the desktop
// PinnedPlayer's "Video preview"). These helpers drive its captured states. The mobile scenes
// run only at the `mobile` viewport, so the play click always lands on the mobile dock.

/** Open the unified slim mobile dock by playing the first video in the General band. The slim
 *  default is the frame + ONE four-cell control row (Close · Move · Curate · See context). */
async function openMobileDock(page: Page): Promise<void> {
  await page.locator("#general-band").waitFor();
  await page.getByRole("button", { name: /^Play:/ }).first().click();
  await page.locator(SEL_MOBILE_DOCK).waitFor();
  await page.waitForTimeout(200);
}

/** Open the mobile dock, then open the Curate inline expander reveal (mobile-player-slim.md §3). */
async function openMobileDockCurate(page: Page): Promise<void> {
  await openMobileDock(page);
  // `exact: true` targets the dock's "Curate" tab specifically — when signed in the article also
  // renders per-candidate "Curate this clip: …" buttons, which a substring match would collide with.
  await page.getByRole("button", { name: "Curate", exact: true }).click();
  await page.waitForTimeout(150);
}

/** Open the mobile dock, then open the See context inline expander reveal (mobile-player-slim.md §4). */
async function openMobileDockSeeContext(page: Page): Promise<void> {
  await openMobileDock(page);
  await page.getByRole("button", { name: "See context" }).click();
  await page.waitForTimeout(150);
}

/** Open the mobile dock, then park it at the TOP edge (the toggle's other state — "Move to bottom"). */
async function openMobileDockTopParked(page: Page): Promise<void> {
  await openMobileDock(page);
  await page.getByRole("button", { name: /Move player to top of screen/ }).click();
  await page.waitForTimeout(150);
}

/** Reveal the mobile header search (icon → expanded field). */
async function revealMobileSearch(page: Page): Promise<void> {
  await page.locator("header.header-shared").waitFor();
  await page.getByRole("button", { name: /search topics/i }).click();
  await page.getByRole("button", { name: /close search/i }).waitFor();
  await page.waitForTimeout(200);
}

// Selectors framed as element clips (existing DOM — no app changes).
const SEL_HEADER = "header.header-shared";
const SEL_GENERAL = "#general-band";
const SEL_TOC = 'nav[aria-label="Table of contents"]';
const SEL_OVERVIEW = '.plus-card:has-text("on this topic")'; // the ＋plus Infobox header is unique
const SEL_PLAYER_MODAL = '[role="dialog"][aria-label="Video player"]';
const SEL_PINNED = 'section[aria-label="Video preview"]';
// The unified mobile dock (issue #120) — distinct from the desktop PinnedPlayer's "Video preview".
const SEL_MOBILE_DOCK = 'section[aria-label="Video player"]';

// ── The catalog ─────────────────────────────────────────────────────────────────────────────────

export const SCENES: Scene[] = [
  // ── Home / landing ──
  {
    id: "home",
    skins: ["light", "zine-dark"],
    group: "Home",
    label: "Home — landing page",
    note: "Daylight Projector header + Find-a-topic search + the 'Recently curated' topic list.",
    route: "/",
    stub: "plain",
    ready: homeReady,
    clip: "fullPage",
  },
  {
    id: "home-header",
    skins: ["light", "zine-dark"],
    group: "Home",
    label: "Home — header (Tier A beam)",
    note: "The projector beam + lockup + auth control, scroll-top. On zine-dark the home header reads clearly OFF — the flat indigo +plus lockup on a flat dark band, no beam / lit-aperture glow / white burn slab.",
    route: "/",
    stub: "plain",
    ready: homeReady,
    clip: { x: 0, y: 0, width: 1280, height: 130 },
  },

  // ── Topic — header states ──
  {
    id: "topic-header-tierA",
    skins: ["light", "zine-dark"],
    group: "Topic · header",
    label: "Topic header — Tier A (scroll-top, full beam)",
    note: "The full projector beam over the article↔plus seam.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    ready: topicReady,
    clip: SEL_HEADER,
  },
  {
    id: "topic-header-slim",
    skins: ["light", "zine-dark"],
    group: "Topic · header",
    label: "Topic header — slim sticky (scrolled, beam faded)",
    note: "The collapsed Tier-C card after scrolling past the burn threshold.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    prepare: collapseHeader,
    clip: { x: 0, y: 0, width: 1280, height: 96 },
  },
  {
    id: "topic-search",
    group: "Topic · header",
    label: "Topic header — mobile search revealed",
    note: "The icon-disclosure search expanded on the narrow header: the wordmark collapses to the \"+\" glyph and the login to icon-only (\"W\" logged-out / avatar logged-in) so the field flexes between them with no overlap.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    viewports: ["mobile"],
    // Both auth arms: the logged-out "W" icon-only login AND the logged-in icon-only avatar
    // expanded state (topic-mobile-search AC7 / DQ-3).
    auth: ["out", "in"],
    prepare: revealMobileSearch,
    clip: { x: 0, y: 0, width: 390, height: 140 },
  },

  // ── Skin toggle — the in-app light ↔ zine-dark control in the footer ──
  // The skin toggle lives in SiteFooter, alongside "About your data." Captured on BOTH skins
  // so the destination word/glyph (Dark↔Light, moon↔sun), text-link quiet affordance, and its
  // AA on both footer surfaces are evidenced. Both logged-out and logged-in (AC1).
  {
    id: "footer-skin-toggle",
    skins: ["light", "zine-dark"],
    focus: true,
    group: "Footer · skin toggle",
    label: "Footer — skin toggle (quiet text+icon, alongside 'About your data')",
    note: "The skin toggle in the footer: 'Dark' + moon on light, 'Light' + sun on dark. Quiet text-link affordance (no chip border), unobtrusive alongside the data notice link (AC13/AC15).",
    route: "/",
    stub: "plain",
    ready: async (page) => {
      await homeReady(page);
      await page.locator('[data-testid="footer-skin-toggle"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
    },
    viewports: ["desktop"],
    clip: "footer",
  },

  // ── Topic — body ──
  {
    id: "topic-body",
    skins: ["light", "zine-dark"],
    group: "Topic · body",
    label: "Topic — full two-world layout",
    note: "Article ↔ plus columns, top to bottom.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    ready: topicReady,
    clip: "fullPage",
  },
  {
    id: "topic-body-sticky",
    skins: ["light", "zine-dark"],
    group: "Topic · body",
    label: "Topic — body under the slim sticky header",
    note: "The viewport after scrolling: slim header over the article body.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    prepare: collapseHeader,
    clip: "viewport",
  },

  // ── Topic — mobile article rendering (issue #121, design §10) ──
  // The phone (`< md`) article column reads like mobile Wikipedia: `h2` sections collapse to tappable
  // disclosure rows, the infobox stacks full-width in the open lead, and wide tables scroll inside
  // their region. All mobile-only + logged-out (the disclosure is auth-independent — design §10).
  {
    id: "topic-article-mobile-collapsed",
    group: "Topic · mobile article",
    label: "Mobile article — collapsed section stack (default)",
    note: "Phone default: the lead, then a stack of collapsed `h2` disclosure rows (closed chevrons).",
    route: "/topic/Lion/",
    stub: "article-mobile",
    prepare: articleCollapsedStack,
    viewports: ["mobile"],
    auth: ["out"],
    clip: "viewport",
    focus: true,
  },
  {
    id: "topic-article-mobile-expanded",
    group: "Topic · mobile article",
    label: "Mobile article — one section expanded",
    note: "Taxonomy expanded (open chevron) revealing its body + a nested `h3`; siblings stay collapsed.",
    route: "/topic/Lion/",
    stub: "article-mobile",
    prepare: (page) => articleExpandSection(page, /^Taxonomy/),
    viewports: ["mobile"],
    auth: ["out"],
    clip: "viewport",
    focus: true,
  },
  {
    id: "topic-article-mobile-infobox",
    group: "Topic · mobile article",
    label: "Mobile article — full-width stacked infobox",
    note: "The taxobox stacks full-width at the top of the always-open lead at phone width (AC4).",
    route: "/topic/Lion/",
    stub: "article-mobile",
    ready: topicReady,
    viewports: ["mobile"],
    auth: ["out"],
    clip: "viewport",
    focus: true,
  },
  {
    id: "topic-article-mobile-table",
    group: "Topic · mobile article",
    label: "Mobile article — wide table scrolls in its region",
    note: "An expanded section's wide table scrolls horizontally in `.wiki-tablewrap`; the page never scrolls sideways (AC4).",
    route: "/topic/Lion/",
    stub: "article-mobile",
    prepare: (page) => articleExpandSection(page, /^Population by region/),
    viewports: ["mobile"],
    auth: ["out"],
    clip: "viewport",
    focus: true,
  },

  // ── Topic — overview card & TOC ──
  {
    id: "topic-overview",
    skins: ["light", "zine-dark"],
    group: "Topic · overview & TOC",
    label: "Overview card (＋plus Infobox)",
    note: "The video-stats / curation-state card.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    ready: topicReady,
    viewports: ["desktop", "tablet"],
    clip: SEL_OVERVIEW,
  },
  {
    id: "topic-toc",
    skins: ["light", "zine-dark"],
    group: "Topic · overview & TOC",
    label: "Table of contents (plus card)",
    note: "Section list with curated/suggested badges.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    ready: topicReady,
    viewports: ["desktop", "tablet"],
    auth: ["out"],
    clip: SEL_TOC,
  },

  // ── General Strip — the three states ──
  {
    id: "general-curated",
    skins: ["light", "zine-dark"],
    group: "General Strip",
    label: "General Strip — curated",
    note: "Human-curated clips (Photosynthesis).",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    ready: topicReady,
    clip: SEL_GENERAL,
  },
  {
    id: "general-suggestions",
    skins: ["light", "zine-dark"],
    group: "General Strip",
    label: "General Strip — suggestions (unvetted)",
    note: "Auto-found candidates on an uncurated topic.",
    route: "/topic/Cellular_respiration/",
    stub: "suggestions",
    ready: topicReady,
    clip: SEL_GENERAL,
  },
  {
    id: "general-empty",
    skins: ["light", "zine-dark"],
    group: "General Strip",
    label: "General Strip — empty",
    note: "Uncurated topic with no candidates yet.",
    route: "/topic/Cat/",
    stub: "empty",
    ready: topicReady,
    clip: SEL_GENERAL,
  },

  // ── Topic · marked complete (issue #159) ──
  // A curator-set topic flag that suppresses the suggestion layer by default. The control + the
  // status indicator live in the ＋plus panel; the override is the indicator's path (a). These
  // scenes drive the complete state THROUGH the real UI (signed-in `markComplete`), so the shots
  // show the genuinely persisted, suppressed state.
  //
  // DB-STATE NOTE for the capture run (Operations): `markComplete` writes the persisted flag via the
  // role-gated Server Action against the shared seeded Postgres, which has no per-scene reset
  // (e2e/global-setup.ts seeds once for the suite). To keep these self-contained, each complete
  // scene REOPENS the topic at the START of its `prepare` first (a no-op the first time), then marks
  // it complete for the capture — so the captured state is deterministic regardless of a prior
  // scene's writes, and a topic left complete only affects a LATER scene on the SAME topic. Run a
  // FULL refresh (`--all`) or these as a `--scene topic-complete-*` subset; if a later same-topic
  // baseline scene drifts to the suppressed look, reopen the topic once (any signed-in curator) or
  // re-seed. Pinned to a lean viewport/skin subset (full-page desktop evidence).
  {
    id: "topic-complete-overview",
    skins: ["light", "zine-dark"],
    group: "Topic · marked complete",
    label: "＋plus panel — marked complete (indicator + curator control)",
    note: "A complete fully-curated topic: the calm 'Marked complete' indicator atop the panel body and the signed-in curator 'Reopen to suggestions' control at the foot.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    auth: ["in"],
    prepare: markComplete,
    viewports: ["desktop", "tablet"],
    clip: SEL_OVERVIEW,
    focus: true,
  },
  {
    id: "topic-complete-suppressed",
    group: "Topic · marked complete",
    label: "Topic — complete, suppressed (full page)",
    note: "A complete topic reads as a near-plain article: curated content (if any) plus the calm panel note; no candidate tiles, no 'Suggested · uncurated' divider/header, no dashed TOC counts.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    auth: ["in"],
    viewports: ["desktop"],
    prepare: markComplete,
    clip: "fullPage",
    focus: true,
  },
  {
    id: "topic-complete-zero-video",
    skins: ["light", "zine-dark"],
    group: "Topic · marked complete",
    label: "Topic — complete + zero curated videos (minimal render)",
    note: "Complete with no curated videos: a near-plain article + a calm panel note carrying both opt-in paths (Show suggestions anyway · Add a video). The General band is omitted — not blank, not broken (AC18).",
    route: "/topic/Cellular_respiration/",
    stub: "suggestions",
    auth: ["in"],
    viewports: ["desktop"],
    prepare: markComplete,
    clip: "fullPage",
    focus: true,
  },
  {
    id: "topic-complete-overridden",
    group: "Topic · marked complete",
    label: "Topic — complete, per-viewer override ON (suggestions revealed)",
    note: "After 'Show suggestions anyway': the normal derived state reappears in place for this viewer; the indicator's button now reads 'Hide suggestions again'. Session-local, never changes the stored default (AC12).",
    route: "/topic/Cellular_respiration/",
    stub: "suggestions",
    auth: ["in"],
    viewports: ["desktop"],
    prepare: markCompleteOverridden,
    clip: "fullPage",
    focus: true,
  },

  // ── Topic · loading & states (topic-loading-states §8, AC3 evidence) ──
  // The three honest conditions, side by side, are visibly distinct: (a) neutral skeletons under a
  // warm projector scan; (b) a fully-formed empty plus side with weigh-in copy; (c) a bordered error
  // alert with a populated rail. Row 8/10 (error + loading / error + settled-empty) are covered by
  // unit tests on the derived-state gate per AC2; the (c) shot uses the populated-plus case so the
  // "no contradictory empty copy" point is visible alongside the preserved plus side.
  {
    id: "topic-loading",
    skins: ["light", "zine-dark"],
    group: "Topic · loading & states",
    label: "Topic — loading (projector scan, both regions)",
    note: "Both regions pending: the projector scan over the article + plus skeletons. No empty or error copy. On zine-dark the sweep is a cool light-ink wash (no warm daylight gold).",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    setup: stallTopicLoading,
    ready: topicLoadingReady,
    clip: "fullPage",
  },
  {
    id: "topic-settled-empty",
    group: "Topic · loading & states",
    label: "Topic — settled, genuinely empty (legitimate bootstrap)",
    note: "A real topic that settled with 0 curated and 0 suggestions: the legitimate empty/weigh-in copy. Distinct from loading and from error.",
    route: "/topic/Cat/",
    stub: "empty",
    ready: topicReady,
    clip: "fullPage",
  },
  {
    id: "topic-article-error",
    group: "Topic · loading & states",
    label: "Topic — article load failed (error card, no contradictory empty copy)",
    note: "The reported bug, fixed: the article error card with NO \"no suggestions\" message. The plus side reflects its own state independently (curated clips still listed — AC9).",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    setup: failTopicArticle,
    ready: topicErrorReady,
    clip: "fullPage",
  },

  // ── Players ──
  {
    id: "player-modal",
    skins: ["light", "zine-dark"],
    group: "Players",
    label: "PlayerModal — curated clip (blocking, desktop)",
    note: "The dialog player + curation note, opened from a curated tile. Desktop-only: on mobile/tablet (< lg) curated playback uses the unified mobile dock (issue #120).",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    viewports: ["desktop"],
    ready: topicReady,
    prepare: openPlayerModal,
    clip: SEL_PLAYER_MODAL,
  },
  {
    id: "pinned-player",
    skins: ["light", "zine-dark"],
    group: "Players",
    label: "PinnedPlayer — candidate dock (watch + act, desktop)",
    note: "The corner dock, opened from a suggested candidate (issue #123): title bar → frame → action row below the frame. Signed-in shows ✦ Curate (primary) + ✕ Not relevant (secondary); logged-out shows the single ✦ Curate this video CTA (no Not-relevant button). Desktop-only: on mobile/tablet (< lg) candidate playback uses the unified mobile dock (issue #120).",
    route: "/topic/Cellular_respiration/",
    stub: "suggestions",
    viewports: ["desktop"],
    ready: topicReady,
    prepare: openPinnedPlayer,
    clip: "fullPage",
  },
  {
    id: "pinned-player-vertical",
    group: "Players",
    label: "PinnedPlayer — vertical 9:16 dock, action row (desktop)",
    note: "The stressing width (issue #123 §6): the narrowed 9:16 dock with the action row still a single horizontal row beneath the frame — signed-in ✦ Curate (flex-1) + ✕ Not relevant fit; logged-out shows the single CTA.",
    route: "/topic/Cellular_respiration/",
    stub: "suggestions",
    viewports: ["desktop"],
    ready: topicReady,
    prepare: openPinnedPlayerVertical,
    clip: "fullPage",
  },
  {
    id: "pinned-player-post-dismiss",
    group: "Players",
    label: "PinnedPlayer — post-dismiss (dock closed, focus to band)",
    note: "After ✦ Not relevant from the dock (issue #123 State L): the playing candidate is optimistically hidden, the dock + iframe tear down, and focus returns to the General band heading — the watch→decide→back-to-the-list loop, no autoplay of an unrequested clip. Signed-in only (the Not-relevant button is gated, not shown, logged out).",
    route: "/topic/Cellular_respiration/",
    stub: "suggestions",
    viewports: ["desktop"],
    auth: ["in"],
    ready: topicReady,
    prepare: dismissFromPinnedPlayer,
    clip: "fullPage",
  },

  // ── Unified SLIM mobile player (mobile-player-slim.md) — all mobile-only states ──
  // The slim default is the frame + ONE 46px row of four glyph-above-word cells (Close · Move ·
  // Curate · See context); all metadata + curation live behind the Curate / See context inline
  // expanders. There is no custom maximize control (fullscreen = the embed's native button;
  // rotate-to-maximize is automatic CSS), so no maximize scenes.
  {
    id: "mobile-player-slim-default",
    skins: ["light", "zine-dark"],
    group: "Players · mobile unified",
    label: "Mobile dock — slim default (bottom-parked)",
    note: "The locked slim model: video frame + ONE four-cell row (Close · Move · Curate · See context) and nothing else — no caption, creator, chips, or description. A generous article slice (~69% for a 16:9 clip) stays visible above.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    viewports: ["mobile"],
    ready: topicReady,
    prepare: openMobileDock,
    clip: "viewport",
  },
  {
    id: "mobile-player-slim-top-parked",
    group: "Players · mobile unified",
    label: "Mobile dock — slim default, parked at the top edge",
    note: "The Move toggle's other state: the slim dock pinned to the top edge (Move now reads 'Move to bottom'); the internal order is identical (frame → four-cell row), the article reflowed below it.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    viewports: ["mobile"],
    auth: ["out"],
    ready: topicReady,
    prepare: openMobileDockTopParked,
    clip: "viewport",
  },
  {
    id: "mobile-player-curate-expanded",
    group: "Players · mobile unified",
    label: "Mobile dock — Curate reveal (signed in)",
    note: "The Curate inline expander open on a candidate, signed in: ✦ Curate (brand-primary) + ✕ Not relevant (quiet secondary), the same vocabulary + treatment as the desktop player. The frame stays pinned above; the reveal body grows the dock.",
    route: "/topic/Cellular_respiration/",
    stub: "suggestions",
    viewports: ["mobile"],
    auth: ["in"],
    ready: topicReady,
    prepare: openMobileDockCurate,
    clip: "viewport",
  },
  {
    id: "mobile-player-curate-loggedout",
    group: "Players · mobile unified",
    label: "Mobile dock — Curate reveal (logged out)",
    note: "The Curate inline expander open on a candidate, logged out: a single ✦ Curate this video CTA and NO dismiss (a logged-out dismiss can't honestly optimistic-hide). The frame stays pinned above.",
    route: "/topic/Cellular_respiration/",
    stub: "suggestions",
    viewports: ["mobile"],
    auth: ["out"],
    ready: topicReady,
    prepare: openMobileDockCurate,
    clip: "viewport",
  },
  {
    id: "mobile-player-seecontext-candidate",
    group: "Players · mobile unified",
    label: "Mobile dock — See context reveal (candidate)",
    note: "The See context inline expander open on a candidate: caption · creator credit · the 'Why suggested' match reason. The creator identity appears ONLY here, never in the slim default.",
    route: "/topic/Cellular_respiration/",
    stub: "suggestions",
    viewports: ["mobile"],
    ready: topicReady,
    prepare: openMobileDockSeeContext,
    clip: "viewport",
  },
  {
    id: "mobile-player-seecontext-curated",
    group: "Players · mobile unified",
    label: "Mobile dock — See context reveal (curated)",
    note: "The See context inline expander open on a curated clip: caption · creator credit · stance/accuracy chips · the full 'Context note' on a light card · 'Context by @curator'. The note scrolls inside the bounded reveal body; the frame stays pinned above.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    viewports: ["mobile"],
    ready: topicReady,
    prepare: openMobileDockSeeContext,
    clip: "viewport",
  },

  // ── Article not found (#19) ──
  {
    id: "topic-notfound",
    skins: ["light", "zine-dark"],
    group: "Topic · not found",
    label: "Article not found (nonexistent title)",
    note: "The honest #19 missing-article recovery state.",
    route: "/topic/Asdfqwer/",
    stub: "missing",
    ready: async (page) => {
      await page.getByRole("heading", { name: /no Wikipedia article by that title/i }).waitFor();
      await page.waitForTimeout(200);
    },
    viewports: ["desktop", "mobile"],
    clip: "fullPage",
  },

  // ── Other pages ──
  {
    id: "about",
    skins: ["light", "zine-dark"],
    group: "Other pages",
    label: "About — centerpiece + how it works",
    note: "The projector→page→＋plus thesis hero (full scene ≥ lg; miniature-alone < lg) + the How-it-works steps.",
    // `?capture=poster` is the deterministic-title pin (docs/design/about-projector-warmup.md §7.2):
    // under it /about forces the eligible-title pool EMPTY so the miniature shows the fallback
    // "Acer palmatum" — so the About baseline matches the committed poster `178c148` and never churns
    // as the seeded curations change. (A documented capture hook on the page, not a test-only branch
    // in the component.)
    route: "/about?capture=poster",
    stub: "plain",
    // The About scene plays a one-shot warm-up intro; wait for the SETTLED final state (and force
    // reduced motion) so the baseline is deterministic and equals the static poster (AC11).
    ready: aboutSettled,
    clip: "fullPage",
  },
  {
    // The wide-but-short About capture (issue #145, docs/design/about-height-aware-scene.md). At
    // 1024×768 (≥ lg wide, < 820px tall) the height-aware gate renders the MINIATURE-ALONE fallback —
    // the card stacked above the lone miniature, NO projector/beam/status-light/toggle, no orphaned
    // beam, nothing clipped, no horizontal scroll. Captures ONLY the landscape-tablet viewport (the
    // sole opter-in to that key); same deterministic `?capture=poster` pin + `aboutSettled` waiter as
    // the standard About scene.
    //
    // BASELINE PENDING A CHROMIUM CAPTURE: this session has no chromium, so the PNG is not yet
    // generated. Run `scripts/dev/shots.sh --scene about-landscape-tablet --commit ui` in a chromium
    // session to produce + commit the baseline.
    id: "about-landscape-tablet",
    group: "Other pages",
    label: "About — wide-but-short (landscape tablet, miniature-alone fallback)",
    note: "1024×768: the height-aware gate falls back to the miniature-alone layout (no projector/beam/toggle, no orphaned beam, nothing clipped) — docs/design/about-height-aware-scene.md.",
    route: "/about?capture=poster",
    stub: "plain",
    viewports: ["landscape-tablet"],
    ready: aboutSettled,
    clip: "fullPage",
    focus: true,
  },
  {
    id: "about-data",
    skins: ["light", "zine-dark"],
    group: "Other pages",
    label: "About your data",
    note: "The persistent data-handling notice.",
    route: "/about/data",
    stub: "plain",
    auth: ["out"],
    ready: async (page) => {
      await page.getByRole("heading", { name: /About your data/i }).waitFor();
      await page.waitForTimeout(200);
    },
    clip: "fullPage",
  },
  {
    id: "contribute",
    skins: ["light", "zine-dark"],
    group: "Other pages",
    label: "Contribute (Add a clip)",
    note: "Logged-out gate vs the real add form.",
    route: "/contribute",
    stub: "plain",
    ready: homeReady,
    clip: "fullPage",
  },
  {
    id: "contributor-profile",
    skins: ["light", "zine-dark"],
    group: "Other pages",
    label: "Contributor profile",
    note: "Public profile (viewer arm) / own profile (My curations).",
    route: "/contributor/E2ETester/",
    stub: "plain",
    ready: homeReady,
    clip: "fullPage",
  },

  // ── Recent-curations feed (issue #160 / `/recent`, design §10) ──────────────────────────────────
  // The cross-topic feed of recently-curated clips: full-viewport snap-scroll, click-to-play, all
  // states. Framed "viewport" (one full-viewport item/panel below the slim header) rather than
  // "fullPage" — the snap track is a fixed-height internal scroller, so the live viewport is the
  // shot. Populated/playing/landscape/vertical render against the seeded curated DB; loading/error
  // use the stall/abort setups; empty uses the no-curations `empty` stub (Cat seeds zero clips).
  {
    id: "recent-feed-populated",
    focus: true,
    group: "Recent feed",
    label: "Recent feed — populated (top of feed)",
    note: "The normal feed: a full-viewport item with the video stage + the reused CurationBlock trust layer, jump-to-topic link, and read-only upvote count. Logged-out AND logged-in (the same feed; only the header auth differs).",
    route: "/recent",
    stub: "curated",
    ready: recentPopulatedReady,
    clip: "viewport",
  },
  {
    id: "recent-feed-populated-landscape",
    group: "Recent feed",
    label: "Recent feed — 16:9 clip (letterbox)",
    note: "A landscape (16:9) clip letterboxed in the stage on a black backing — never cropped or distorted (§2.3).",
    route: "/recent",
    stub: "curated",
    ready: recentPopulatedReady,
    clip: "viewport",
  },
  {
    id: "recent-feed-populated-vertical",
    group: "Recent feed",
    label: "Recent feed — 9:16 clip (vertical)",
    note: "A vertical (9:16) clip height-capped + centred on black, letterboxed L/R when the stage is wider (§2.3).",
    route: "/recent",
    stub: "curated",
    ready: recentPopulatedReady,
    clip: "viewport",
  },
  {
    id: "recent-feed-playing",
    group: "Recent feed",
    label: "Recent feed — playing (embed mounted)",
    note: "After click-to-play: the poster replaced in place by the embed iframe (single active player). The curation panel is unchanged — the trust layer travels with the clip.",
    route: "/recent",
    stub: "curated",
    ready: recentPopulatedReady,
    prepare: playFirstRecentClip,
    clip: "viewport",
  },
  {
    id: "recent-feed-loading",
    group: "Recent feed",
    label: "Recent feed — loading (initial skeletons)",
    note: "The first page loading: the polite status + skeleton item placeholders (black stage + light note-card silhouette). Never a blank page or spinner-forever.",
    route: "/recent",
    stub: "curated",
    setup: stallRecentLoading,
    ready: recentLoadingReady,
    clip: "viewport",
  },
  {
    id: "recent-feed-empty",
    group: "Recent feed",
    label: "Recent feed — empty (no curations yet)",
    note: "The read succeeded with zero items (the fresh-site bootstrap): the 'No curations yet' panel sending the reader to find a topic — the honest path (you curate ON a topic).",
    route: "/recent",
    stub: "empty",
    ready: homeReady,
    clip: "viewport",
  },
  {
    id: "recent-feed-error",
    group: "Recent feed",
    label: "Recent feed — error (read failed)",
    note: "The initial read threw: the honest 'Couldn't load the feed' panel with a Try-again button — never hung on loading.",
    route: "/recent",
    stub: "curated",
    setup: failRecentRead,
    ready: recentErrorReady,
    clip: "viewport",
  },
  {
    id: "recent-feed-end",
    group: "Recent feed",
    label: "Recent feed — end-of-feed marker",
    note: "The quiet end marker when the cursor is exhausted: 'You're all caught up.' + a Back-to-top button, so the reader is never stranded at the bottom.",
    route: "/recent",
    stub: "curated",
    ready: recentPopulatedReady,
    prepare: scrollRecentToEnd,
    clip: "viewport",
  },
];

/** The viewports/auth a scene actually renders, with defaults applied. */
export function sceneViewports(scene: Scene): Viewport[] {
  return scene.viewports ?? ["mobile", "tablet", "desktop"];
}
export function sceneAuth(scene: Scene): AuthState[] {
  return scene.auth ?? ["out", "in"];
}
export function sceneSkins(scene: Scene): Skin[] {
  return scene.skins ?? ["light"];
}

/** The output filename stem for one (scene, viewport, auth, skin) cell. The light skin keeps the
 *  historical name (no suffix) so the committed baseline filenames are stable; the dark skin appends
 *  `-zine-dark`. */
export function shotName(
  scene: Scene,
  viewport: Viewport,
  auth: AuthState,
  skin: Skin = "light"
): string {
  const base = `${scene.id}-${viewport}-${auth === "in" ? "logged-in" : "logged-out"}`;
  return skin === "light" ? base : `${base}-${skin}`;
}

/** Set (or clear) the skin cookie BEFORE navigation — mirrors the pre-paint bootstrap in
 *  app/layout.tsx, so the captured page renders the selected skin with no flash. Light clears the
 *  cookie so the default (no `data-skin`) shell renders. */
export async function applySkin(page: Page, skin: Skin, baseURL?: string): Promise<void> {
  // Light is the default (no `data-skin`) — no cookie needed (and we must NOT clear cookies here, the
  // signed-in arm has already set its session cookie). Only the dark skin adds its cookie.
  if (skin === "light") return;
  const url = new URL(baseURL ?? "http://localhost:3000");
  await page.context().addCookies([
    { name: SKIN_COOKIE, value: skin, domain: url.hostname, path: "/" },
  ]);
}
