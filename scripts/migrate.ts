import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Db } from "@/lib/db/client";

// Apply pending Drizzle migrations, then (conditionally) seed (issue #45 — deliverable 5/6;
// the demo-seed gate added in issue #75).
//
// RUN ON DEPLOY, not at build and not per-request. The compose `migrate` one-shot service
// (deploy/docker-compose.yml) runs `node dist/migrate.cjs` against the live Postgres after
// it is healthy and before/alongside `app` start; a push to `main` that changes the schema
// therefore lands a migrated DB with no manual SSH (AC15). Idempotent: re-running applies
// only NEW migrations and (when seeding) the seed no-ops once its rows already exist.
//
// DATABASE_URL is required HERE (this is the runtime DB step) — but NOT for `next build`
// (the build never connects). Uses a short-lived single connection (max: 1), closed at the end.

/**
 * Is the deploy-time demo seed enabled? DEFAULT ON: returns false ONLY when
 * `SEED_DEMO_CONTENT` is the literal `"false"` or `"0"` (trimmed, case-insensitive);
 * unset / empty / any other value returns true. Reads `process.env` at RUNTIME, so the
 * seam survives the esbuild bundle (`dist/migrate.cjs`) unchanged. Exported for tests.
 */
export function seedDemoContentEnabled(
  raw: string | undefined = process.env.SEED_DEMO_CONTENT
): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v !== "false" && v !== "0";
}

/**
 * The gate seam (issue #75): decide WHETHER to seed, at the deploy entrypoint, then run the
 * environment-agnostic seed. The check lives HERE, not inside `seedDatabase` — that function
 * stays byte-for-byte unchanged so tests + local dev (which call it directly) keep seeding
 * with no new setup. The seed is now a TEST/LOCAL-DEV FIXTURE; production gates it OFF in the
 * compose `migrate` env (see docs/ARCHITECTURE.md "Production seed policy" + deploy/docker-compose.yml).
 *
 * Returns `true` if the seed ran (its `seedDatabase` return is informational only and logged
 * by the runner), `false` if it was skipped. A skipped seed is a CLEAN SUCCESS — never an error.
 * Takes the gate value as an arg (default: the env-derived `seedDemoContentEnabled()`) so a
 * test can drive both branches against a pglite handle exactly the way `seedDatabase` is tested.
 */
export async function maybeSeed(
  db: Db,
  enabled: boolean = seedDemoContentEnabled()
): Promise<boolean> {
  if (!enabled) {
    console.log(
      "[wiki+ migrate] SEED_DEMO_CONTENT is off — skipping demo seed (migrations applied)."
    );
    return false;
  }
  // Imported lazily (after the gate) so a gated-off run never loads the seed module's deps.
  const { seedDatabase } = await import("@/lib/db/seed");
  const inserted = await seedDatabase(db);
  console.log(
    inserted
      ? "[wiki+ migrate] seeded topics + curated clips."
      : "[wiki+ migrate] already seeded — no-op."
  );
  return true;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required to run migrations (postgres://user:pass@host:5432/db). " +
        "This is the deploy-time DB step — `next build` does not need it."
    );
  }

  const client = postgres(url, { max: 1 });
  try {
    const db = drizzle(client) as unknown as Db;

    console.log("[wiki+ migrate] applying migrations from ./drizzle …");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
    console.log("[wiki+ migrate] migrations applied.");

    // Demo-seed gate (issue #75): seed UNLESS SEED_DEMO_CONTENT is off (prod opt-out).
    await maybeSeed(db);

    console.log("[wiki+ migrate] done.");
  } finally {
    await client.end();
  }
}

// Run only when invoked as the entrypoint (the bundled dist/migrate.cjs / `tsx scripts/migrate.ts`).
// A test importing `maybeSeed` / `seedDemoContentEnabled` must NOT trigger a live migration —
// so the auto-run is guarded behind `process.env.VITEST` being unset.
if (!process.env.VITEST) {
  main().catch((err) => {
    console.error("[wiki+ migrate] FAILED:", err);
    process.exit(1);
  });
}
