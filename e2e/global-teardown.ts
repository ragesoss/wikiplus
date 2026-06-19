import { stopE2EDatabase } from "./db-server";

// Playwright globalTeardown (issue #47): stop the ephemeral Postgres + remove its datadir
// after the suite finishes (the counterpart to e2e/global-setup.ts).
export default async function globalTeardown() {
  await stopE2EDatabase();
}
