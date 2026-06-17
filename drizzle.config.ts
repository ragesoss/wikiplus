import { defineConfig } from "drizzle-kit";

// drizzle-kit config (issue #45). Drives `drizzle-kit generate` (emit SQL migrations from
// lib/db/schema.ts into drizzle/) and `drizzle-kit migrate` (apply them). Migrations are
// applied on DEPLOY (the compose `migrate` one-shot / scripts/migrate.ts), never at build
// time and never on the 1GB box's own Next build (the box doesn't build).
//
// DATABASE_URL is read lazily — `drizzle-kit generate` does NOT need a live DB (it diffs the
// schema against the committed migration journal), so the migration can be generated and
// committed without Postgres running. Only `generate` runs in this environment; `migrate`
// runs against the live DB on the VPS (or pglite in tests).
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/wikiplus",
  },
  // Keep generated SQL readable for review (one statement per migration step).
  verbose: true,
  strict: true,
});
