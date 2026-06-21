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
export type StubProfile = "curated" | "suggestions" | "empty" | "missing" | "plain";

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
const SUGGESTION_ARTICLE_HTML = `<!DOCTYPE html><html><body>
  <section><p>Cellular respiration is the set of metabolic reactions that convert nutrients into ATP.</p></section>
  <section data-mw-section-id="1"><h2 id="glycolysis">Glycolysis</h2><p>Glycolysis body.</p></section>
  <section data-mw-section-id="2"><h2 id="citric">Citric acid cycle</h2><p>Citric acid cycle body.</p></section>
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

async function stubTopic(
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
        youtube: () => RESP_YT_ITEMS,
      });
    case "empty":
      return stubTopic(page, {
        qid: "Q146",
        title: "Cat",
        article: longArticleHtml("The cat is a domestic species of small carnivorous mammal."),
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

// ── The catalog ─────────────────────────────────────────────────────────────────────────────────

export const SCENES: Scene[] = [
  // ── Home / landing ──
  {
    id: "home",
    group: "Home",
    label: "Home — landing page",
    note: "Daylight Projector header + Find-a-topic search + example topics.",
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
    label: "PlayerModal — curated clip (blocking)",
    note: "The dialog player + curation note, opened from a curated tile.",
    route: "/topic/Photosynthesis/",
    stub: "curated",
    ready: topicReady,
    prepare: openPlayerModal,
    clip: SEL_PLAYER_MODAL,
  },
  {
    id: "pinned-player",
    group: "Players",
    label: "PinnedPlayer — candidate dock (non-modal)",
    note: "The corner dock, opened from a suggested candidate.",
    route: "/topic/Cellular_respiration/",
    stub: "suggestions",
    ready: topicReady,
    prepare: openPinnedPlayer,
    clip: "fullPage",
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
    label: "About — How it works (placeholder)",
    note: "Placeholder shell so the homepage hero's primary \"How it works\" CTA has a destination; content is a separate build.",
    route: "/about",
    stub: "plain",
    auth: ["out"],
    ready: async (page) => {
      await page.getByRole("heading", { name: /How it works/i }).waitFor();
      await page.waitForTimeout(200);
    },
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
