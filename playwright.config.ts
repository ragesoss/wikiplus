import { defineConfig, devices } from "@playwright/test";

// E2E for the core loop (find topic → read → watch & weigh → contribute), run
// against the Node SSR server (`yarn build` → `next start`) — issue #37 replaced the
// `serve -s out` static-export serving. The live MediaWiki fetch is intercepted
// in-spec (the sandbox has no network egress), so the article body resolves to a
// deterministic fixture; the plus side renders from the seeded localStorage DataStore.
const PORT = Number(process.env.E2E_PORT || 4321);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Build the Node server once, then serve it with `next start`. Unseeded
  // `/topic/<Title>/` deep links are rendered on demand by the running server (no
  // 404.html trick); the client resolves them exactly as today.
  webServer: {
    command: `yarn build && yarn start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
