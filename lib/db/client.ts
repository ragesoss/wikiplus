import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// The Postgres connection (issue #45). SERVER-ONLY by construction:
//   - `import "server-only"` makes a client-component import a build error, so neither the
//     pg driver nor DATABASE_URL can ever land in the client bundle (AC7).
//   - The connection is opened LAZILY on first query, never at build/import time. A
//     build-time connect would break the CI image build (the build box has no DB) and
//     violate "connect lazily at runtime" (deliverable 4). `next build` therefore needs
//     NO DATABASE_URL.
//
// Driver: postgres.js (`postgres`) — a small, dependency-free, Drizzle-recommended driver.
// One pooled client per process is reused across requests (memoized below).

export type Db = PostgresJsDatabase<typeof schema>;

let client: ReturnType<typeof postgres> | null = null;
let db: Db | null = null;

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. The wiki+ data store needs a Postgres connection " +
        "string (postgres://user:pass@host:5432/db). It is read lazily at runtime, " +
        "never at build time — `next build` does not need it. See docs/ops/vps-setup.md."
    );
  }
  return url;
}

/** The raw postgres.js client (opened lazily, memoized). Used by migrate/seed scripts. */
export function getSql(): ReturnType<typeof postgres> {
  if (!client) {
    client = postgres(databaseUrl(), {
      // Modest pool for the 1GB box; raise with the production read-path.
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      // Surface schema/connection errors instead of silently coercing.
      onnotice: () => {},
    });
  }
  return client;
}

/**
 * The Drizzle DB handle (opened lazily on first call, memoized for the process).
 * All server-side data access goes through this — never a direct driver import elsewhere.
 */
export function getDb(): Db {
  if (!db) {
    db = drizzle(getSql(), { schema });
  }
  return db;
}
