import { defineConfig, devices } from "@playwright/test";

// E2E for the core loop (find topic → read → watch & weigh → contribute), run
// against the static export (`yarn build` → out/) served locally. The live
// MediaWiki fetch is intercepted in-spec (the sandbox has no network egress), so
// the article body resolves to a deterministic fixture; the plus side renders
// from the seeded localStorage DataStore.
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
  // Build the static export once, then serve out/ with a tiny static server.
  webServer: {
    command: `yarn build && npx serve -s out -l ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
