import { test, expect, type Page } from "@playwright/test";
import { applyStub, stubTopic, SUGGESTION_ARTICLE_HTML } from "./screenshots/catalog";

// ── FRAME-BOX fit guarantee (issue #135, docs/design/mobile-player-launch.md §1.1/§2/§8 AC-1/AC-9;
//    supersedes the #120 dock-top-only check). ──────────────────────────────────────────────────
//
// The corrected launch invariant: on open (collapsed, portrait), the WHOLE VIDEO-FRAME BOX is within
// the viewport — frame top >= 0, frame bottom <= VH, frame left/right in-bounds — with NO scrolling
// inside the dock required to reach the video. This is what the #120 frame-LAST layout broke (the
// frame was the last child of an overflow-y-auto body and scrolled below the fold while a dock-top
// check still "passed"). This spec measures the frame element itself (the `[data-dock-frame]` box in
// MobilePlayerDock), so it FAILS against the old frame-last layout and PASSES against the corrected
// frame-first one. It holds for BOTH a curated clip AND a candidate clip, for BOTH a 16:9 and a 9:16
// clip, at EACH of 360/390/414/430 px portrait. The legacy Close-reachable + dock-top + landscape
// checks are kept as a regression net (AC-6 preserved invariants).
//
// STANDALONE, env-guarded (self-skips unless FIT_CHECK=1), NOT part of the normal e2e gate — it
// drives the REAL app + REAL CSS so the assertion measures the shipped layout (jsdom in vitest has no
// layout engine, so getBoundingClientRect there is meaningless). It reuses the screenshot harness's
// `applyStub` (deterministic Wikipedia/YouTube fixtures, no network egress) and the seeded ephemeral
// Postgres from playwright.config's globalSetup. Run with:
//   FIT_CHECK=1 yarn playwright test e2e/mobile-player-fit.spec.ts
const ENABLED = !!process.env.FIT_CHECK;

const SEL_DOCK = 'section[aria-label="Video player"]';
const SEL_FRAME = `${SEL_DOCK} [data-dock-frame]`;

type Kind = "curated" | "candidate";
type Aspect = "16:9" | "9:16";

// The Cellular-respiration suggestions route (candidate dock). The candidate's orientation comes
// from its thumbnail aspect (lib/candidates/youtube.ts), so the fit test stubs a horizontal item
// for the 16:9 case and a portrait item (`vertical: true`) for the 9:16 case — both YouTube with an
// embedUrl, so they open the dock (TikTok / no-embed candidates fall through to a new tab — AC-5).
const RESP_ROUTE = "/topic/Cellular_respiration/";
const RESP_QID = "Q189603";
const CANDIDATE_CAPTION = "Mitochondria in 60 seconds";

/** Register a deterministic Cellular-respiration suggestions page with ONE YouTube candidate of the
 *  requested orientation (the only suggestion, so its Play button is unambiguous). */
async function stubCandidate(page: Page, aspect: Aspect): Promise<void> {
  await stubTopic(page, {
    qid: RESP_QID,
    title: "Cellular respiration",
    article: SUGGESTION_ARTICLE_HTML,
    youtube: () => [
      {
        videoId: "fit001",
        title: CANDIDATE_CAPTION,
        channelTitle: "Quick Biology",
        vertical: aspect === "9:16",
      },
    ],
  });
}

// Per-(kind × aspect) setup + the Play-button caption to open the dock.
//   - curated: two real Photosynthesis curated clips (lib/data/seed.ts), one of each orientation,
//     BOTH carrying a contextNote (so "Context ▸" renders and the collapsed launch is the case).
//   - candidate: a stubbed YouTube suggestion of the requested orientation (see stubCandidate).
async function setupAndCaption(
  page: Page,
  kind: Kind,
  aspect: Aspect
): Promise<{ route: string; caption: string }> {
  if (kind === "curated") {
    await applyStub(page, "curated");
    return {
      route: "/topic/Photosynthesis/",
      caption:
        aspect === "9:16"
          ? "Photosynthesis Explained in under 1min! 🌱🔆"
          : "Photosynthesis: Crash Course Biology #8",
    };
  }
  await stubCandidate(page, aspect);
  return { route: RESP_ROUTE, caption: CANDIDATE_CAPTION };
}

const WIDTHS = [360, 390, 414, 430] as const;
// Portrait height = the most-stressing in-scope phone height (the UX repro used 780; a shorter
// viewport is a harder fit).
const PORTRAIT_H = 780;

async function openDock(page: Page, caption: string): Promise<void> {
  await page.locator("#general-band").waitFor();
  // Playwright auto-scrolls the Play button into view; section-anchored candidates are reachable too.
  await page.getByRole("button", { name: `Play: ${caption}` }).first().click();
  await page.locator(SEL_DOCK).waitFor();
  await page.locator(SEL_FRAME).waitFor();
  await page.waitForTimeout(150);
}

/** Measure the FRAME box + the dock top + whether Close / Move are inside the viewport, plus the
 *  STRUCTURAL "no scroll to reach the frame" facts: whether the frame is a descendant of any
 *  scrollable (overflow-y-auto) region (it must NOT be — in the frame-first layout the frame is a
 *  `shrink-0` sibling above the lone scroll region), and the max `scrollTop` of any scroller inside
 *  the dock at rest (must be 0 — nothing is scrolled to bring the frame into view). */
async function measure(page: Page) {
  const vh = page.viewportSize()!.height;
  const vw = page.viewportSize()!.width;
  const dock = page.locator(SEL_DOCK);
  const dockBox = (await dock.boundingBox())!;
  const frame = page.locator(SEL_FRAME).first();
  const frameBox = (await frame.boundingBox())!;
  const close = page.getByRole("button", { name: "Close video player" });
  const closeBox = (await close.boundingBox())!;
  const moveBtn = page.getByRole("button", { name: /Move player to (top|bottom) of screen/ });
  const moveCount = await moveBtn.count();
  const moveBox = moveCount ? await moveBtn.first().boundingBox() : null;
  const inViewport = (b: { x: number; y: number; width: number; height: number }) =>
    b.y >= -0.5 && b.x >= -0.5 && b.y + b.height <= vh + 0.5 && b.x + b.width <= vw + 0.5;

  // Structural facts read in the page: is the frame inside an overflow-y scroll CONTAINER (the
  // architectural frame-last tell — the frame as a child of the overflow-y-auto body — regardless of
  // whether that body currently overflows), and is any actively-scrollable in-dock region scrolled?
  const structural = await page.evaluate((sel) => {
    const dockEl = document.querySelector(sel);
    if (!dockEl) return { frameInsideScroller: true, maxScrollTop: 0 };
    const frameEl = dockEl.querySelector("[data-dock-frame]")!;
    // A scroll CONTAINER by style (overflow-y auto/scroll) — the architectural fact, not gated on
    // current overflow (a frame-last body is still a scroll body even when its content is short).
    const isScrollContainer = (el: Element) => {
      const oy = getComputedStyle(el).overflowY;
      return oy === "auto" || oy === "scroll";
    };
    // Walk up from the frame to (not including) the dock root: is any ancestor a scroll container?
    let frameInsideScroller = false;
    for (let n: Element | null = frameEl.parentElement; n && n !== dockEl; n = n.parentElement) {
      if (isScrollContainer(n)) {
        frameInsideScroller = true;
        break;
      }
    }
    // The largest scrollTop of any ACTIVELY-scrollable region in the dock (frame-first: only the
    // secondary region below the frame scrolls, so scrolling it never moves the frame).
    let maxScrollTop = 0;
    dockEl.querySelectorAll("*").forEach((el) => {
      if (isScrollContainer(el) && el.scrollHeight > el.clientHeight + 1) {
        maxScrollTop = Math.max(maxScrollTop, el.scrollTop);
      }
    });
    return { frameInsideScroller, maxScrollTop };
  }, SEL_DOCK);

  return {
    vh,
    vw,
    dockTop: dockBox.y,
    dockHeight: dockBox.height,
    frameBox,
    frameInViewport: inViewport(frameBox),
    closeOnScreen: inViewport(closeBox),
    movePresent: moveCount > 0,
    moveOnScreen: moveBox ? inViewport(moveBox) : null,
    frameInsideScroller: structural.frameInsideScroller,
    maxScrollTop: structural.maxScrollTop,
  };
}

test.describe("Mobile dock — frame-box fit on open (issue #135, AC-1/AC-9)", () => {
  test.skip(!ENABLED, "frame-box fit check — run with FIT_CHECK=1");

  for (const kind of ["curated", "candidate"] as Kind[]) {
    for (const aspect of ["16:9", "9:16"] as Aspect[]) {
      for (const width of WIDTHS) {
        test(`${kind} ${aspect} @ ${width}px portrait — whole frame visible on open`, async ({ page }) => {
          const { route, caption } = await setupAndCaption(page, kind, aspect);
          await page.setViewportSize({ width, height: PORTRAIT_H });
          await page.goto(route);
          await page.locator("header.header-shared").waitFor();
          await page.locator("h1").first().waitFor();

          await openDock(page, caption);

          const m = await measure(page);

          // AC-1 — the WHOLE frame box is within the viewport on open (the corrected invariant).
          expect(
            m.frameBox.y,
            `frame top must be >= 0 (was ${m.frameBox.y}; VH=${m.vh})`
          ).toBeGreaterThanOrEqual(-0.5);
          expect(
            m.frameBox.y + m.frameBox.height,
            `frame bottom must be <= VH ${m.vh} (was ${m.frameBox.y + m.frameBox.height})`
          ).toBeLessThanOrEqual(m.vh + 0.5);
          expect(m.frameBox.x, `frame left must be >= 0 (was ${m.frameBox.x})`).toBeGreaterThanOrEqual(-0.5);
          expect(
            m.frameBox.x + m.frameBox.width,
            `frame right must be <= VW ${m.vw} (was ${m.frameBox.x + m.frameBox.width})`
          ).toBeLessThanOrEqual(m.vw + 0.5);
          expect(m.frameInViewport, "the whole frame box must be within the viewport on open").toBe(true);

          // AC-9 (b) — STRUCTURAL "no scroll to reach the video": the frame is NOT inside the
          // dock's scroll region (it's a shrink-0 sibling ABOVE the lone overflow-y-auto secondary
          // region), and no in-dock scroller is scrolled at rest. This encodes "video-first" so a
          // frame-LAST layout (frame as the last child of the overflow-y-auto body) FAILS here.
          expect(
            m.frameInsideScroller,
            "the frame must NOT be inside a scroll region (frame-first: a shrink-0 sibling, not the last child of the scroll body)"
          ).toBe(false);
          expect(
            m.maxScrollTop,
            `no in-dock scroller may be scrolled to reach the frame on open (maxScrollTop was ${m.maxScrollTop})`
          ).toBeLessThanOrEqual(0.5);

          // AC-2 — the dock is bounded; it does NOT fill the viewport (a meaningful article slice
          // remains). At every in-scope width the dock is well under 88dvh.
          expect(
            m.dockHeight,
            `dock must not fill the viewport (height ${m.dockHeight} of VH ${m.vh})`
          ).toBeLessThan(m.vh * 0.88 + 0.5);

          // Preserved #120 net: dock top on-screen, Close reachable, Move reachable when docked.
          expect(m.dockTop, `dock top must be >= 0 (was ${m.dockTop})`).toBeGreaterThanOrEqual(-0.5);
          expect(m.closeOnScreen, "Close button must be within the viewport").toBe(true);
          if (m.movePresent) {
            expect(m.moveOnScreen, "Move button must be within the viewport").toBe(true);
          }
        });
      }
    }
  }
});

// The DIMENSIONAL discriminator (AC-9 (a)): a SHORT viewport + the curated note EXPANDED — the
// realistic regression trigger. With the note expanded on a short phone, a frame-LAST layout (the
// secondary region — chips · Context · the up-to-320px note panel · CTA — rendered ABOVE the frame,
// the frame the last child of the overflow-y-auto body) shoves the 9:16 frame down past the fold and
// clips it / hides it inside the scroll body; the frame-FIRST layout keeps the frame pinned as a
// shrink-0 sibling ABOVE the note (the note scrolls beneath it). So this case is GREEN on the real
// (frame-first) layout and RED on a frame-last one — it discriminates where the 780px on-open case
// can't (at 780px the dock sizes to content under the cap and the frame stays in [0,VH] either way).
const SHORT_H = 640;
test.describe("Mobile dock — short-viewport expanded-note discriminator (issue #135, AC-9)", () => {
  test.skip(!ENABLED, "frame-box fit check — run with FIT_CHECK=1");

  for (const width of WIDTHS) {
    // A 9:16 Short is the stress shape (its frame is the tallest); the expanded note is the heaviest
    // secondary region. Both kinds are exercised by the on-open block; here the curated note is what
    // makes the secondary region heavy, so this is curated 9:16.
    test(`curated 9:16 @ ${width}×${SHORT_H} expanded — frame stays fully visible, not scrolled`, async ({ page }) => {
      await applyStub(page, "curated");
      await page.setViewportSize({ width, height: SHORT_H });
      await page.goto("/topic/Photosynthesis/");
      await page.locator("header.header-shared").waitFor();
      await page.locator("h1").first().waitFor();

      await openDock(page, "Photosynthesis Explained in under 1min! 🌱🔆");
      // Expand the curated note — the heavy secondary region that a frame-last layout stacks ABOVE
      // the frame.
      await page.getByRole("button", { name: /^Context/ }).click();
      await page.waitForTimeout(150);

      const m = await measure(page);

      // The whole frame box stays within the viewport even with the note expanded on a short phone.
      expect(
        m.frameBox.y,
        `frame top must be >= 0 (was ${m.frameBox.y}; VH=${m.vh})`
      ).toBeGreaterThanOrEqual(-0.5);
      expect(
        m.frameBox.y + m.frameBox.height,
        `frame bottom must be <= VH ${m.vh} with the note expanded (was ${m.frameBox.y + m.frameBox.height})`
      ).toBeLessThanOrEqual(m.vh + 0.5);
      expect(m.frameInViewport, "the whole frame must stay within the viewport with the note expanded").toBe(true);
      // And reaching it required no scroll: the frame is a shrink-0 sibling, not inside the scroller.
      expect(
        m.frameInsideScroller,
        "the frame must NOT be inside the dock's scroll region even when the note is expanded"
      ).toBe(false);
    });
  }
});

test.describe("Mobile dock — preserved no-overflow + landscape net (issue #120, §6.1/§6.2)", () => {
  test.skip(!ENABLED, "dimensional fit check — run with FIT_CHECK=1");

  // The legacy curated check, retained as a regression net for the expanded-note + landscape cases
  // that the frame-box test above does not exercise (it tests the collapsed launch only). Asserts
  // the dock never grows past the top edge and Close/Move stay reachable — collapsed AND expanded,
  // portrait AND landscape, for both aspects.
  const CURATED_ROUTE = "/topic/Photosynthesis/";
  const CURATED_CAPTION: Record<Aspect, string> = {
    "16:9": "Photosynthesis: Crash Course Biology #8",
    "9:16": "Photosynthesis Explained in under 1min! 🌱🔆",
  };
  for (const aspect of ["16:9", "9:16"] as Aspect[]) {
    const caption = CURATED_CAPTION[aspect];
    for (const width of WIDTHS) {
      for (const orientation of ["portrait", "landscape"] as const) {
        for (const expanded of [false, true]) {
          const title = `${aspect} ${width}px ${orientation} ${expanded ? "expanded" : "collapsed"}`;
          test(title, async ({ page }) => {
            await applyStub(page, "curated");
            const size =
              orientation === "portrait"
                ? { width, height: PORTRAIT_H }
                : { width: PORTRAIT_H, height: width };
            await page.setViewportSize(size);
            await page.goto(CURATED_ROUTE);
            await page.locator("header.header-shared").waitFor();
            await page.locator("h1").first().waitFor();

            await openDock(page, caption);

            // Expand the curated note (the case DEFECT 1 reproduced). In landscape the dock is
            // maximized and the secondary region (incl. the expander) is hidden — nothing to expand,
            // so skip the expand step there; the maximized layout is what we still measure.
            if (expanded && orientation === "portrait") {
              await page.getByRole("button", { name: /^Context/ }).click();
              await page.waitForTimeout(120);
            }

            const m = await measure(page);
            expect(m.dockTop, `dock top must be >= 0 (was ${m.dockTop})`).toBeGreaterThanOrEqual(-0.5);
            expect(m.closeOnScreen, "Close button must be within the viewport").toBe(true);
            if (m.movePresent) {
              expect(m.moveOnScreen, "Move button must be within the viewport").toBe(true);
            }
          });
        }
      }
    }
  }
});
