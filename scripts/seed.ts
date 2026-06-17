import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { seedDatabase } from "@/lib/db/seed";
import * as schema from "@/lib/db/schema";

// Standalone DB seed runner (issue #45). Opens a short-lived connection to the live Postgres
// and runs the environment-agnostic seed (lib/db/seed.ts). Invoked by scripts/migrate.ts on
// deploy, after migrations apply; idempotent, so it is safe on every deploy.
//
// Importable directly (`node scripts/seed.js`) for a manual re-seed too. DATABASE_URL is the
// runtime DB connection — required here, NOT at build time.

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
