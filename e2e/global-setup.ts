import { startE2EDatabase } from "./db-server";

// Playwright globalSetup (issue #47): boot the ephemeral, seeded Postgres BEFORE the webServer
// (`next build && next start`) starts, so its store Server Actions have a real DB to read (see
// e2e/db-server.ts for the why). Runs once for the whole suite. The webServer's DATABASE_URL /
// AUTH_SECRET / NEXT_PUBLIC_YOUTUBE_API_KEY are set in playwright.config.ts's webServer.env.
export default async function globalSetup() {
  await startE2EDatabase();
}
