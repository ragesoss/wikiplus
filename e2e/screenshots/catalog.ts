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

export type Viewport = "mobile" | "tablet" | "desktop";
export type AuthState = "out" | "in";

/** Viewport sizes — the widths that select the app's mobile (< md) / tablet (md) / desktop (≥ lg)
 *  layouts. Heights are the rendering window; full-page captures grow past them. */
export const VIEWPORTS: Record<Viewport, { width: number; height: number }> = {
  mobile: { width: 390, height: 850 },
  tablet: { width: 834, height: 1000 },
  desktop: { width: 1280, height: 900 },
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

/** Wait for a home-host page (home / about / contribute / contributor) to be present. The home
 *  host renders the projector as a plain element (NOT `header.header-shared`, which is Topic-only),
 *  so the cross-host ready signal is the "wiki+" lockup link plus the page's first heading. */
export async function homeReady(page: Page): Promise<void> {
  await page.getByRole("link", { name: "wiki+" }).first().waitFor();
  await page.getByRole("heading").first().waitFor();
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
  await page.getByRole("button", { name: "Curate" }).click();
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
    group: "Home",
    label: "Home — header (Tier A beam)",
    note: "The projector beam + lockup + auth control, scroll-top.",
    route: "/",
    stub: "plain",
    ready: homeReady,
    clip: { x: 0, y: 0, width: 1280, height: 130 },
  },

  // ── Topic — header states ──
  {
    id: "topic-header-tierA",
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

  // ── Topic — body ──
  {
    id: "topic-body",
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
    group: "General Strip",
    label: "General Strip — empty",
    note: "Uncurated topic with no candidates yet.",
    route: "/topic/Cat/",
    stub: "empty",
    ready: topicReady,
    clip: SEL_GENERAL,
  },

  // ── Players ──
  {
    id: "player-modal",
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
    id: "about-data",
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
    group: "Other pages",
    label: "Contributor profile",
    note: "Public profile (viewer arm) / own profile (My curations).",
    route: "/contributor/E2ETester/",
    stub: "plain",
    ready: homeReady,
    clip: "fullPage",
  },
];

/** The viewports/auth a scene actually renders, with defaults applied. */
export function sceneViewports(scene: Scene): Viewport[] {
  return scene.viewports ?? ["mobile", "tablet", "desktop"];
}
export function sceneAuth(scene: Scene): AuthState[] {
  return scene.auth ?? ["out", "in"];
}

/** The output filename stem for one (scene, viewport, auth) cell. */
export function shotName(scene: Scene, viewport: Viewport, auth: AuthState): string {
  return `${scene.id}-${viewport}-${auth === "in" ? "logged-in" : "logged-out"}`;
}
