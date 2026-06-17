import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Apply pending Drizzle migrations, then seed (issue #45 — deliverable 5/6).
//
// RUN ON DEPLOY, not at build and not per-request. The compose `migrate` one-shot service
// (deploy/docker-compose.yml) runs `node scripts/migrate.js` against the live Postgres after
// it is healthy and before/alongside `app` start; a push to `main` that changes the schema
// therefore lands a migrated + seeded DB with no manual SSH (AC15). Idempotent: re-running
// applies only NEW migrations and the seed no-ops when its rows already exist.
//
// DATABASE_URL is required HERE (this is the runtime DB step) — but NOT for `next build`
// (the build never connects). Uses a short-lived single connection (max: 1), closed at the end.

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required to run migrations (postgres://user:pass@host:5432/db). " +
        "This is the deploy-time DB step — `next build` does not need it."
    );
  }

  const migrationClient = postgres(url, { max: 1 });
  const db = drizzle(migrationClient);

  console.log("[wiki+ migrate] applying migrations from ./drizzle …");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[wiki+ migrate] migrations applied.");

  await migrationClient.end();

  // Seed after the schema exists. Imported lazily so a schema-only run (or a future
  // --no-seed flag) can skip it without loading the seed module's deps.
  const { seed } = await import("./seed");
  await seed(url);

  console.log("[wiki+ migrate] done.");
}

main().catch((err) => {
  console.error("[wiki+ migrate] FAILED:", err);
  process.exit(1);
});
