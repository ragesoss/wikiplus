import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";

// In-memory Postgres for the DrizzleDataStore contract tests (issue #45, AC16). pglite is a
// real Postgres compiled to WASM — so the SAME committed Drizzle migrations apply, and the
// store runs against real Postgres semantics (unique constraints, ON CONFLICT, FKs) with NO
// external service, no network egress, and no Docker — green in the cloud/CI sandbox.

export interface TestDb {
  db: Db;
  close: () => Promise<void>;
}

/** A fresh, migrated, in-memory Postgres + a Drizzle handle typed like the real one. */
export async function makeTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  // Drizzle's pglite driver returns a different concrete type than postgres-js, but the
  // DataStore only uses the shared query API surface — cast to the app's Db alias.
  const db = drizzle(pg, { schema }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: "./drizzle" });
  return {
    db,
    close: async () => {
      await pg.close();
    },
  };
}
