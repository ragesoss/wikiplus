// Ephemeral Postgres for the e2e suite (issue #47), parallel-safe per run (issue #182).
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
// WHAT IT DOES. Boots a throwaway Postgres cluster under a per-run temp datadir using the system
// `initdb`/`pg_ctl` binaries, on a PER-RUN FREE port (so two sessions never collide — see
// e2e/ports.ts), then applies the Drizzle migrations + the environment-agnostic seed (the SAME
// `scripts/migrate.ts` deploy path) so the suite runs against the exact seeded shape the deployed
// app opens with (the three demo topics + the curated Photosynthesis clips). Playwright
// `globalSetup` starts it before the webServer; `globalTeardown` stops it and removes the datadir.
// Deterministic + offline (no network). Each run is recorded so a crash can be reaped (`reapE2E`).

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { ensureE2EPorts } from "./ports";

export const E2E_PG_DB = "wikiplus_e2e";

/** The per-run Postgres port (allocated free per run; honors an explicit E2E_PG_PORT). */
export function e2ePgPort(): number {
  return ensureE2EPorts().pgPort;
}

/**
 * DATABASE_URL for the per-run ephemeral cluster. A FUNCTION (read at call time), not a module
 * constant, so playwright.config.ts (config evaluation) and `startE2EDatabase()` (globalSetup) both
 * resolve the SAME per-run port that `ensureE2EPorts()` published to `process.env`. (#182)
 */
export function e2eDatabaseUrl(): string {
  return `postgres://postgres@127.0.0.1:${e2ePgPort()}/${E2E_PG_DB}`;
}

// A test contributor seeded into the e2e DB so the auth helper (e2e/auth.ts) can mint a signed-in
// session that maps to a REAL contributor row (the write boundary attributes to contributor.id).
// The handle is fixed; the seeded id is published in `process.env[E2E_USER_ENV]` at setup time and
// read from there by the helper (NOT a shared temp file — two concurrent runs would clobber each
// other's file, and one run's teardown would delete a sibling's, the #182 cross-contamination
// failure mode). The env is per process-tree, so each run's workers inherit only their own run's
// contributor. (issue #47 — the contribute flow is auth-gated as of issue C; parallel-safe per #182.)
export const E2E_USER_HANDLE = "E2ETester";
export const E2E_USER_ENV = "E2E_USER";

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
const DATADIR_PREFIX = "wikiplus-e2e-pg-";

// Per-run registry: each run drops a small record so a crashed run (no teardown) can be reaped by
// its OWN recorded port/datadir — never a command-line pattern match (which would kill the
// operator's shell). `stopE2EDatabase` deletes the record on clean exit, so a leftover = a crash.
const RUNS_DIR = join(tmpdir(), "wikiplus-e2e-runs");

interface RunRecord {
  datadir: string;
  pgPort: number;
  webPort: number;
  pgPid: number | null;
  // The Playwright runner pid that owns this run. Lets `reapE2E` tell a LIVE run from an orphan.
  ownerPid: number;
}

function recordPath(datadir: string): string {
  return join(RUNS_DIR, `${basename(datadir)}.json`);
}

function readPostmasterPid(datadir: string): number | null {
  try {
    const pid = Number(readFileSync(join(datadir, "postmaster.pid"), "utf8").split("\n", 1)[0]?.trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM"; // exists but not ours
  }
}

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
  const { pgPort, webPort } = ensureE2EPorts();
  const databaseUrl = e2eDatabaseUrl();
  const datadir = mkdtempSync(join(tmpdir(), DATADIR_PREFIX));
  process.env[DATADIR_ENV] = datadir;
  const logFile = join(datadir, "postmaster.log");

  try {
    // initdb: trust auth on loopback (throwaway cluster, never reachable off-box), UTF8.
    execFileSync(
      pg(bin, "initdb"),
      ["-D", datadir, "-U", "postgres", "--auth=trust", "-E", "UTF8"],
      { stdio: "ignore" }
    );

    // Start: bind loopback only on the per-run port, put the unix socket inside the datadir (no
    // /tmp clash with a system Postgres), disable fsync for a faster throwaway boot. `-l` captures
    // the postmaster log so a bind failure is legible; PGCTLTIMEOUT bounds the `-w` readiness wait
    // (it has been observed to hang under PostgreSQL 18 here).
    execFileSync(
      pg(bin, "pg_ctl"),
      [
        "-D",
        datadir,
        "-l",
        logFile,
        "-w", // wait until accepting connections
        "-o",
        `-p ${pgPort} -k ${datadir} -c listen_addresses=127.0.0.1 -c fsync=off`,
        "start",
      ],
      { stdio: "ignore", env: { ...process.env, PGCTLTIMEOUT: process.env.PGCTLTIMEOUT || "60" } }
    );
  } catch (e) {
    // Fail fast + legible: surface the port, the datadir, the postmaster log tail, and the reap
    // hint — not a swallowed execFileSync throw.
    let tail = "";
    try {
      tail = readFileSync(logFile, "utf8").trim().split("\n").slice(-8).join("\n");
    } catch {
      /* no log */
    }
    try {
      rmSync(datadir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    throw new Error(
      `e2e: Postgres failed to start on port ${pgPort} (datadir ${datadir}).\n` +
        "Another run holding the port, or a crashed one? Run `yarn e2e:reap` to clear orphans, or " +
        "set E2E_PG_PORT to a known-free port.\n" +
        (tail ? `postmaster log tail:\n${tail}` : `(no postmaster log: ${(e as Error).message})`)
    );
  }

  // Record this run so a crash leaves a reapable trail keyed by OUR port + datadir.
  try {
    mkdirSync(RUNS_DIR, { recursive: true });
    const rec: RunRecord = {
      datadir,
      pgPort,
      webPort,
      pgPid: readPostmasterPid(datadir),
      ownerPid: process.pid,
    };
    writeFileSync(recordPath(datadir), JSON.stringify(rec));
  } catch {
    /* a missing record only weakens reaping; never fail the run over it */
  }

  // Create the DB, apply migrations + seed, and publish the seeded contributor. Any failure here —
  // after the postmaster is already up — would otherwise ORPHAN the cluster, because Playwright skips
  // globalTeardown when globalSetup throws. So tear the half-built run down (postmaster + datadir +
  // record) before rethrowing, leaving nothing behind.
  try {
    execFileSync(
      pg(bin, "psql"),
      ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "postgres", "-c", `CREATE DATABASE ${E2E_PG_DB};`],
      { stdio: "ignore" }
    );

    // Apply migrations + seed via the SAME deploy-path script (scripts/migrate.ts), so the e2e DB
    // matches exactly what `docker compose` lands on deploy. tsx is a devDependency; run it through
    // the local binary with DATABASE_URL pointed at the throwaway cluster.
    execFileSync("yarn", ["db:migrate"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });

    // Seed the e2e test contributor and publish its id for the auth helper. RETURNING the id means we
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
        String(pgPort),
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
      // Fail loud rather than publish a null id that turns every signed-in test logged-out.
      throw new Error(
        `e2e: could not parse the seeded contributor id from psql output: ${JSON.stringify(rawId)}`
      );
    }
    // Publish to the env (inherited by worker processes) — no shared file, so parallel-safe (#182).
    process.env[E2E_USER_ENV] = JSON.stringify({ contributorId: id, handle: E2E_USER_HANDLE });

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
        String(pgPort),
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
  } catch (e) {
    await stopE2EDatabase(); // tear down the half-built run — no orphan postmaster/datadir/record
    throw new Error(
      `e2e: database setup failed after Postgres started on port ${pgPort}: ${(e as Error).message}`
    );
  }
}

/** Stop the cluster and remove its datadir + run record. Best-effort: never throws out of teardown. */
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
    rmSync(recordPath(datadir), { force: true });
  } catch {
    /* best effort */
  }
}

/** PIDs LISTENing on `port` (exact match — never a command-line grep). lsof, then fuser fallback. */
function listenerPids(port: number): number[] {
  const res = spawnSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
  let out = res.status === 0 ? res.stdout || "" : "";
  if (!out) {
    const f = spawnSync("fuser", [`${port}/tcp`], { encoding: "utf8" });
    out = `${f.stdout || ""} ${f.stderr || ""}`;
  }
  return [...new Set(out.split(/\s+/).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}

function procCmd(pid: number): string {
  return (spawnSync("ps", ["-o", "args=", "-p", String(pid)], { encoding: "utf8" }).stdout || "").trim();
}

function stopPostmaster(datadir: string, pgPid: number | null, log: (m: string) => void): void {
  if (existsSync(datadir)) {
    try {
      const bin = findPgBin();
      execFileSync(pg(bin, "pg_ctl"), ["-D", datadir, "-m", "immediate", "stop"], { stdio: "ignore" });
      return;
    } catch {
      /* fall through to a direct PID kill */
    }
  }
  if (pgPid && isAlive(pgPid)) {
    try {
      process.kill(pgPid, "SIGKILL");
      log(`killed postmaster pid ${pgPid}`);
    } catch {
      /* gone */
    }
  }
}

function killWebPort(port: number, log: (m: string) => void): void {
  for (const pid of listenerPids(port)) {
    const cmd = procCmd(pid);
    // We found this pid by OUR recorded port, but the OS could have recycled that port to an
    // unrelated process — confirm it is a Next server (what the harness runs: `next start` →
    // `next-server`) before SIGKILL, so a plain `node`/other listener on a recycled port is spared.
    if (!/next-server|next start|[/\\]next[/\\]/i.test(cmd)) {
      log(`skip pid ${pid} on :${port} (not a Next server: ${cmd || "?"})`);
      continue;
    }
    try {
      process.kill(pid, "SIGKILL");
      log(`killed web server pid ${pid} on :${port}`);
    } catch {
      /* gone */
    }
  }
}

/**
 * Reap harness leftovers — the cleanup affordance (`yarn e2e:reap`, `scripts/dev/shots.sh
 * --cleanup`). Walks the run registry and, for each ORPHANED run (its owner Playwright process is
 * gone), stops the postmaster by its recorded datadir, kills whatever holds the recorded web port,
 * and removes the datadir + record. Also sweeps orphan `wikiplus-e2e-pg-*` datadirs no record
 * covers. A LIVE run (owner still alive) is skipped unless `force`. Targets only resources the
 * harness recorded as its own — never a command-line pattern match.
 */
export async function reapE2E(opts: { force?: boolean } = {}): Promise<void> {
  const force = !!opts.force;
  const log = (m: string) => console.log(`e2e:reap ${m}`);
  let reaped = 0;
  let skipped = 0;
  const seen = new Set<string>();

  let records: string[] = [];
  try {
    records = readdirSync(RUNS_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    /* no registry yet */
  }
  for (const f of records) {
    const p = join(RUNS_DIR, f);
    let rec: RunRecord;
    try {
      rec = JSON.parse(readFileSync(p, "utf8")) as RunRecord;
    } catch {
      rmSync(p, { force: true });
      continue;
    }
    seen.add(rec.datadir);
    if (!force && rec.ownerPid && isAlive(rec.ownerPid)) {
      log(`skip LIVE run (owner pid ${rec.ownerPid}, pg :${rec.pgPort}, web :${rec.webPort}) — use --force`);
      skipped++;
      continue;
    }
    stopPostmaster(rec.datadir, rec.pgPid, log);
    killWebPort(rec.webPort, log);
    try {
      rmSync(rec.datadir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    rmSync(p, { force: true });
    log(`reaped run pg :${rec.pgPort} web :${rec.webPort} (${rec.datadir})`);
    reaped++;
  }

  // Backstop: orphan datadirs that lost their record (PG-only — no port to reap a web server from).
  let dirs: string[] = [];
  try {
    dirs = readdirSync(tmpdir()).filter((d) => d.startsWith(DATADIR_PREFIX));
  } catch {
    /* none */
  }
  for (const d of dirs) {
    const datadir = join(tmpdir(), d);
    if (seen.has(datadir)) continue;
    stopPostmaster(datadir, readPostmasterPid(datadir), log);
    try {
      rmSync(datadir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    log(`reaped orphan datadir ${datadir}`);
    reaped++;
  }

  log(reaped === 0 && skipped === 0 ? "nothing to reap" : `done (${reaped} reaped, ${skipped} skipped)`);
}
