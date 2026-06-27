import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_SECRET, e2eDatabaseUrl } from "./e2e/db-server";
import { ensureE2EPorts } from "./e2e/ports";

// E2E for the core loop (find topic → read → watch & weigh → contribute), run
// against the Node SSR server (`yarn build` → `next start`) — issue #37 replaced the
// `serve -s out` static-export serving. The live MediaWiki/Wikidata/YouTube fetches are
// intercepted in-spec (the sandbox has no network egress), so the article body + candidate
// suggestions resolve to deterministic fixtures (see e2e/fixtures-contract.md).
//
// As of issue #45 the data layer is shared Postgres reached through Server Actions, so the
// webServer needs a real DB + an Auth.js secret to behave like the deployed app — `globalSetup`
// boots an ephemeral, seeded Postgres (e2e/db-server.ts) and `webServer.env` points the server
// at it. (issue #47)
//
// Parallel-safe per run (issue #182): the Postgres + web ports are allocated FREE per run and
// published to process.env HERE — first thing at config evaluation, before globalSetup and before
// any reader resolves them — so the web server, baseURL, the webServer DATABASE_URL, and the
// ephemeral Postgres all agree on the same per-run ports. Workers inherit this env, so they resolve
// the identical ports. `E2E_PG_PORT` / `E2E_PORT` are honored when explicitly set.
const { webPort: PORT } = ensureE2EPorts();

// A non-empty placeholder YouTube key so the candidate source's `isEnabled()` is TRUE at BUILD
// time (the key is `NEXT_PUBLIC_`, inlined into the client bundle). The live search call is then
// intercepted in-spec (the googleapis.com/youtube/v3/search route stub) → deterministic
// suggestions for the uncurated-topic empty-state tests, with no network egress. (issue #47)
const E2E_YOUTUBE_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || "e2e-youtube-key-stubbed";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Screenshot runs (`scripts/dev/shots.sh` sets SHOTS=1) drive the real SSR server across
  // many scenes at once; the default worker count oversubscribes one Node server and flakes
  // shots with h1-timeout contention. Cap shots to 5 workers; the normal e2e gate is unaffected.
  workers: process.env.SHOTS ? 5 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Build the Node server once, then serve it with `next start`. Unseeded
  // `/topic/<Title>/` deep links are rendered on demand by the running server (no
  // 404.html trick); the client resolves them exactly as today. The env below is read at
  // BOTH build (NEXT_PUBLIC_* inlined) and runtime (DATABASE_URL/AUTH_SECRET read lazily).
  webServer: {
    command: `yarn build && yarn start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: e2eDatabaseUrl(),
      AUTH_SECRET: E2E_AUTH_SECRET,
      NEXT_PUBLIC_YOUTUBE_API_KEY: E2E_YOUTUBE_KEY,
    },
  },
});
