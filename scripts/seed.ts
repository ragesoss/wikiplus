import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { seedDatabase } from "@/lib/db/seed";
import * as schema from "@/lib/db/schema";

// Standalone DB seed runner (issue #45). Opens a short-lived connection to the live Postgres
// and runs the environment-agnostic seed (lib/db/seed.ts); idempotent, so it is safe to re-run.
//
// This is the MANUAL re-seed entrypoint (`yarn db:seed` / `tsx scripts/seed.ts`) and is the
// path the e2e harness uses to seed its ephemeral DB. The DEPLOY entrypoint (scripts/migrate.ts)
// runs `seedDatabase` directly behind the `SEED_DEMO_CONTENT` gate (issue #75) — it does NOT call
// this runner — so production can skip the demo seed without affecting this manual path.
// DATABASE_URL is the runtime DB connection — required here, NOT at build time.

export async function seed(url?: string): Promise<void> {
  const dbUrl = url ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }
  const client = postgres(dbUrl, { max: 1 });
  try {
    const db = drizzle(client, { schema });
    const inserted = await seedDatabase(db);
    console.log(
      inserted
        ? "[wiki+ seed] seeded topics + curated clips."
        : "[wiki+ seed] already seeded — no-op."
    );
  } finally {
    await client.end();
  }
}
