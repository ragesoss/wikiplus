// Ephemeral Postgres for the e2e suite (issue #47).
//
// WHY THIS EXISTS. As of issue #45 the data layer is shared Postgres reached through Server
// Actions (see docs/ARCHITECTURE.md "Persistence"). The e2e webServer runs the REAL server
// build (`next build && next start`), so its `store.*` Server Actions hit Postgres — they are
// NOT the localStorage double the view/integration unit tests mock. Without a DB every store
// read rejects; combined with the title→QID resolve path this leaves the Topic page stuck in
// its resolve-error state and the whole core-loop suite red. (The unit tests use in-memory
// pglite, but `next start` runs the postgres.js TCP driver, which pglite cannot back — hence a
// real, ephemeral Postgres here.)
//
// WHAT IT DOES. Boots a throwaway Postgres cluster under a temp datadir using the system
// `initdb`/`pg_ctl` binaries, on a fixed loopback port, then applies the Drizzle migrations +
// the environment-agnostic seed (the SAME `scripts/migrate.ts` deploy path) so the suite runs
// against the exact seeded shape the deployed app opens with (the three demo topics + the
// curated Photosynthesis clips). Playwright `globalSetup` starts it before the webServer;
// `globalTeardown` stops it and removes the datadir. Deterministic + offline (no network).

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Loopback port for the throwaway cluster — high + fixed so the webServer env can point at it. */
export const E2E_PG_PORT = Number(process.env.E2E_PG_PORT || 54330);
export const E2E_PG_DB = "wikiplus_e2e";
export const E2E_DATABASE_URL = `postgres://postgres@127.0.0.1:${E2E_PG_PORT}/${E2E_PG_DB}`;

// A test contributor seeded into the e2e DB so the auth helper (e2e/auth.ts) can mint a signed-in
// session that maps to a REAL contributor row (the write boundary attributes to contributor.id).
// The handle is fixed; the id is written to this file at setup time so the helper reads it without
// a DB round-trip. (issue #47 — the uncurated-topic contribute flow is auth-gated as of issue C.)
export const E2E_USER_HANDLE = "E2ETester";
export const E2E_USER_FILE = join(tmpdir(), "wikiplus-e2e-user.json");

// The Auth.js JWT signing secret + session-cookie name the webServer runs with — SHARED with the
// sign-in helper (e2e/auth.ts) so a test-minted session cookie verifies against the same key.
// Deterministic + throwaway; reading is anonymous, so the secret only stops Auth.js's
// `MissingSecret` startup error and lets the contribute tests establish a signed-in precondition.
export const E2E_AUTH_SECRET =
  process.env.AUTH_SECRET || "e2e-playwright-fixed-secret-do-not-use-in-production";
// Non-secure host (http localhost) → Auth.js uses the un-prefixed cookie name.
export const E2E_SESSION_COOKIE = "authjs.session-token";

// A datadir under the OS temp root, recorded so teardown can find + remove it. Kept in an env
// var (not a module global) because globalSetup and globalTeardown run in separate processes.
const DATADIR_ENV = "E2E_PG_DATADIR";

/**
 * Locate the Postgres server bin directory (where `initdb`/`pg_ctl`/`postgres` live). Debian
 * keeps them out of $PATH under /usr/lib/postgresql/<major>/bin, so check those first, then
 * fall back to $PATH. Throws a clear error if none is found (so CI fails loudly, not weirdly).
 */
export function findPgBin(): string {
  if (process.env.E2E_PG_BIN && existsSync(join(process.env.E2E_PG_BIN, "pg_ctl")))
    return process.env.E2E_PG_BIN;
  const base = "/usr/lib/postgresql";
  if (existsSync(base)) {
    // Highest installed major first.
    const majors = readdirSync(base)
      .map((d) => ({ d, n: Number(d) }))
      .filter((x) => Number.isFinite(x.n))
      .sort((a, b) => b.n - a.n);
    for (const { d } of majors) {
      const bin = join(base, d, "bin");
      if (existsSync(join(bin, "pg_ctl"))) return bin;
    }
  }
  // $PATH fallback (e.g. a non-Debian image).
  const which = spawnSync("which", ["pg_ctl"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim().replace(/\/pg_ctl\s*$/, "");
  }
  throw new Error(
    "e2e: could not find a Postgres bin dir (initdb/pg_ctl). Install postgresql, or set " +
      "E2E_PG_BIN to its bin directory."
  );
}

function pg(bin: string, exe: string): string {
  return join(bin, exe);
}

/** Boot the throwaway cluster, create the DB, and apply migrations + seed. Idempotent-ish. */
export async function startE2EDatabase(): Promise<void> {
  const bin = findPgBin();
  const datadir = mkdtempSync(join(tmpdir(), "wikiplus-e2e-pg-"));
  process.env[DATADIR_ENV] = datadir;

  // initdb: trust auth on loopback (throwaway cluster, never reachable off-box), UTF8.
  execFileSync(
    pg(bin, "initdb"),
    ["-D", datadir, "-U", "postgres", "--auth=trust", "-E", "UTF8"],
    { stdio: "ignore" }
  );

  // Start: bind loopback only, put the unix socket inside the datadir (no /tmp clash with a
  // system Postgres), and disable fsync for a faster throwaway boot.
  execFileSync(
    pg(bin, "pg_ctl"),
    [
      "-D",
      datadir,
      "-w", // wait until accepting connections
      "-o",
      `-p ${E2E_PG_PORT} -k ${datadir} -c listen_addresses=127.0.0.1 -c fsync=off`,
      "start",
    ],
    { stdio: "ignore" }
  );

  execFileSync(
    pg(bin, "psql"),
    ["-h", "127.0.0.1", "-p", String(E2E_PG_PORT), "-U", "postgres", "-c", `CREATE DATABASE ${E2E_PG_DB};`],
    { stdio: "ignore" }
  );

  // Apply migrations + seed via the SAME deploy-path script (scripts/migrate.ts), so the e2e DB
  // matches exactly what `docker compose` lands on deploy. tsx is a devDependency; run it through
  // the local binary with DATABASE_URL pointed at the throwaway cluster.
  execFileSync("yarn", ["db:migrate"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  });

  // Seed the e2e test contributor and record its id for the auth helper. RETURNING the id means we
  // never assume a serial value. `-tA` → tuples-only, unaligned (bare id) — but psql STILL prints
  // its command-completion tag ("INSERT 0 1") on a SECOND stdout line, so the RETURNING value is
  // line 1 and the tag is line 2. Parse line 1 only: a naive `.trim()` of the whole output leaves
  // "2\nINSERT 0 1", whose `Number(...)` is `NaN` → the auth helper would mint a session with a
  // null `contributorId` and every signed-in capture/test would silently run logged-out (#109).
  const rawId = execFileSync(
    pg(bin, "psql"),
    [
      "-h",
      "127.0.0.1",
      "-p",
      String(E2E_PG_PORT),
      "-U",
      "postgres",
      "-d",
      E2E_PG_DB,
      "-tA",
      "-c",
      `INSERT INTO contributor (handle, display_name) VALUES ('${E2E_USER_HANDLE}', 'E2E Tester')
       RETURNING id;`,
    ],
    { encoding: "utf8" }
  );
  const id = Number(rawId.split("\n", 1)[0]?.trim());
  if (!Number.isInteger(id) || id <= 0) {
    // Fail loud rather than write a null id that turns every signed-in test logged-out.
    throw new Error(
      `e2e: could not parse the seeded contributor id from psql output: ${JSON.stringify(rawId)}`
    );
  }
  writeFileSync(E2E_USER_FILE, JSON.stringify({ contributorId: id, handle: E2E_USER_HANDLE }));

  // Watchlist (issue #162): seed the e2e contributor WATCHING the curated Photosynthesis topic
  // (Q11982 — the one with seeded clips), so the `/watchlist` populated scene + the logged-in topic
  // watch-control ("✓ Watching") capture against a real, non-empty per-user feed. A `SELECT` from
  // `topic` resolves the topic id (the seed assigns serials); `ON CONFLICT DO NOTHING` keeps the
  // boot idempotent. (The two watchlist EMPTY states are covered by unit tests, not scenes — a single
  // e2e contributor can't simultaneously watch-nothing and watch-a-curated-topic.)
  execFileSync(
    pg(bin, "psql"),
    [
      "-h",
      "127.0.0.1",
      "-p",
      String(E2E_PG_PORT),
      "-U",
      "postgres",
      "-d",
      E2E_PG_DB,
      "-c",
      `INSERT INTO watchlist (contributor_id, topic_id)
       SELECT ${id}, t.id FROM topic t WHERE t.wikidata_qid = 'Q11982'
       ON CONFLICT DO NOTHING;`,
    ],
    { stdio: "inherit" }
  );
}

/** Stop the cluster and remove its datadir. Best-effort: never throws out of teardown. */
export async function stopE2EDatabase(): Promise<void> {
  const datadir = process.env[DATADIR_ENV];
  if (!datadir) return;
  try {
    const bin = findPgBin();
    execFileSync(pg(bin, "pg_ctl"), ["-D", datadir, "-m", "immediate", "stop"], {
      stdio: "ignore",
    });
  } catch {
    /* already down */
  }
  try {
    rmSync(datadir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
  try {
    rmSync(E2E_USER_FILE, { force: true });
  } catch {
    /* best effort */
  }
}
