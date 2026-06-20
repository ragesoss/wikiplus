import { test, type Page } from "@playwright/test";
import {
  SCENES,
  VIEWPORTS,
  applyStub,
  signInPage,
  waitForSignedIn,
  sceneViewports,
  sceneAuth,
  shotName,
  type Clip,
  type Viewport,
} from "./screenshots/catalog";

// Standard PR screenshot matrix (driven by scripts/dev/shots.sh — NOT a bare `yarn test:e2e`).
// This is a THIN DRIVER: every surface/state lives as a `Scene` in e2e/screenshots/catalog.ts, and
// this file just expands each scene over its viewports × auth states into capture tests. To add a
// shot, add a scene to the catalog — never edit this file.
//
// These are CAPTURES, not assertions, so they MUST NOT run in the normal CI e2e gate (they'd be
// no-assertion "tests" that only slow it down). They self-SKIP unless `SHOTS=1` is set, which
// scripts/dev/shots.sh does. The ONE assertion they make is the signed-in guard: a `*-logged-in`
// capture FAILS LOUDLY (waitForSignedIn) if the client session didn't resolve a numeric
// contributorId, so a silently logged-out "logged-in" shot can never reach the gallery (#109).
//
// Subsetting is by Playwright `--grep` on the `@scene:<id>` / `@group:<slug>` tags embedded in the
// test titles (the wrapper maps --scene / --group / --focus + the --home/--topic/--notfound aliases
// to those). Output dir comes from `SHOTS_OUT` (default `screenshots/standard`, gitignored).

const ENABLED = !!process.env.SHOTS;
const OUT = process.env.SHOTS_OUT || "screenshots/standard";

/** Normalize a group name into a stable `--grep`-able tag, e.g. "Topic · header" → "topic-header". */
function groupSlug(group: string): string {
  return group
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Frame and write one shot. Rect clips are clamped to the live viewport width (so a full-width
 *  slim-bar rect works at every viewport without overflowing the narrow ones). */
async function capture(page: Page, path: string, clip: Clip, viewportWidth: number): Promise<void> {
  if (clip === "fullPage") {
    await page.screenshot({ path, fullPage: true });
  } else if (clip === "viewport") {
    await page.screenshot({ path });
  } else if (typeof clip === "string") {
    await page.locator(clip).first().screenshot({ path });
  } else {
    await page.screenshot({
      path,
      clip: { ...clip, width: Math.min(clip.width, viewportWidth) },
    });
  }
}

async function defaultReady(page: Page): Promise<void> {
  await page.locator("header.header-shared").waitFor();
  await page.waitForTimeout(300);
}

for (const scene of SCENES) {
  test.describe(`${scene.label} @scene:${scene.id} @group:${groupSlug(scene.group)}`, () => {
    test.skip(!ENABLED, "screenshot capture — run via scripts/dev/shots.sh");

    for (const viewport of sceneViewports(scene)) {
      for (const auth of sceneAuth(scene)) {
        const title = `${viewport} ${auth === "in" ? "logged-in" : "logged-out"}`;
        test(title, async ({ page, baseURL }) => {
          await applyStub(page, scene.stub ?? "plain");
          if (auth === "in") await signInPage(page, baseURL);

          const { width, height } = VIEWPORTS[viewport as Viewport];
          await page.setViewportSize({ width, height });
          await page.goto(scene.route);

          // The loud signed-in guard (#109): fail rather than capture a logged-out "logged-in" shot.
          if (auth === "in") await waitForSignedIn(page);

          if (scene.ready) await scene.ready(page);
          else await defaultReady(page);
          if (scene.prepare) await scene.prepare(page);

          await capture(page, `${OUT}/${shotName(scene, viewport, auth)}.png`, scene.clip ?? "fullPage", width);
        });
      }
    }
  });
}
