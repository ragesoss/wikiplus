// Per-run TCP port allocation for the e2e / screenshot harness (issue #182).
//
// WHY THIS EXISTS. The harness runs from several sessions at once (parallel cloud / mobile / local
// build-loop runs). A fixed Postgres port and a fixed Next-server port make two runs collide. So each
// run gets its OWN free port for both services. The port has to be known at playwright.config.ts
// evaluation time — BEFORE globalSetup runs — because the web server, its `webServer.env`
// DATABASE_URL, the baseURL, and the Postgres in globalSetup must all agree on the same two ports.
// `ensureE2EPorts()` is therefore called first thing in the config body and PUBLISHES the chosen
// ports through `process.env`, so every later reader in the process resolves the identical values.
//
// Port allocation is "bind to :0, read back the kernel-assigned port, release it" — the standard
// approach. A tiny release→rebind race is tolerated and covered by the legible fail-fast in
// db-server.ts. Allocation is synchronous (config evaluation is sync) via a short-lived node child,
// because Node's `net` API is async-only and there is no sync in-process equivalent.

import { execFileSync, spawnSync } from "node:child_process";

const PG_PORT_ENV = "E2E_PG_PORT";
const WEB_PORT_ENV = "E2E_PORT";
// Set once the ports are resolved, so later callers (globalSetup, worker processes that re-evaluate
// the config) trust the published env instead of re-validating. Without it, a second call would see
// the env we ourselves published, mistake it for an external pin, and fail the free-check against our
// OWN already-running Postgres / web server.
const RESOLVED_ENV = "E2E_PORTS_RESOLVED";

/**
 * Allocate `count` distinct free loopback ports, synchronously. Opens `count` listeners on
 * 127.0.0.1:0 SIMULTANEOUSLY (so the kernel hands out distinct ports), reads them back, closes them,
 * and returns them. Throws a clear error if the helper can't run or report ports.
 */
export function allocateFreePorts(count: number): number[] {
  // Hold all sockets open at once → distinct ports; then close and print them.
  const child = `
    const net = require("node:net");
    const n = Number(process.env.E2E_ALLOC_N);
    const servers = [], ports = [];
    let opened = 0, failed = false;
    for (let i = 0; i < n; i++) {
      const s = net.createServer();
      servers.push(s);
      s.once("error", (e) => { if (!failed) { failed = true; console.error(String(e)); process.exit(1); } });
      s.listen(0, "127.0.0.1", () => {
        ports.push(s.address().port);
        if (++opened === n) {
          Promise.all(servers.map((x) => new Promise((r) => x.close(r))))
            .then(() => { process.stdout.write(ports.join(" ")); process.exit(0); });
        }
      });
    }
  `;
  let out: string;
  try {
    out = execFileSync(process.execPath, ["-e", child], {
      encoding: "utf8",
      env: { ...process.env, E2E_ALLOC_N: String(count) },
    });
  } catch (e) {
    throw new Error(`e2e: failed to allocate ${count} free port(s): ${(e as Error).message}`);
  }
  const ports = out
    .trim()
    .split(/\s+/)
    .map((p) => Number(p))
    .filter((p) => Number.isInteger(p) && p > 0);
  if (ports.length !== count) {
    throw new Error(`e2e: free-port allocation returned ${JSON.stringify(out)} (wanted ${count})`);
  }
  return ports;
}

/** True if `port` is currently free to bind on loopback. Synchronous (a short-lived node child). */
export function isPortFree(port: number): boolean {
  const child = `
    const net = require("node:net");
    const s = net.createServer();
    s.once("error", () => process.exit(1));
    s.listen(Number(process.env.E2E_CHECK_PORT), "127.0.0.1", () => s.close(() => process.exit(0)));
  `;
  const res = spawnSync(process.execPath, ["-e", child], {
    env: { ...process.env, E2E_CHECK_PORT: String(port) },
  });
  return res.status === 0;
}

/**
 * Resolve the per-run Postgres + web ports and publish them through `process.env` so every later
 * reader (db-server's `startE2EDatabase`, the webServer env, baseURL) agrees. Idempotent: an already
 * set env value is honored — an explicit override, or a prior call this process. A freshly allocated
 * port is written back to `process.env`. An explicitly PINNED port that is already held fails fast
 * here, at config time, with a legible message (rather than a swallowed bind error later).
 */
export function ensureE2EPorts(): { pgPort: number; webPort: number } {
  // Already resolved this process (a repeat call) or inherited from the resolving parent (globalSetup
  // / a worker re-evaluating the config)? Trust the published ports — do NOT re-check, or we'd flag
  // our own running servers as "in use".
  if (process.env[RESOLVED_ENV]) {
    return { pgPort: Number(process.env[PG_PORT_ENV]), webPort: Number(process.env[WEB_PORT_ENV]) };
  }

  const pinnedPg = process.env[PG_PORT_ENV];
  const pinnedWeb = process.env[WEB_PORT_ENV];

  // How many fresh ports do we still need to allocate (only the ones not explicitly pinned)?
  const need = (pinnedPg ? 0 : 1) + (pinnedWeb ? 0 : 1);
  const fresh = need > 0 ? allocateFreePorts(need) : [];

  let pgPort: number;
  if (pinnedPg) {
    pgPort = Number(pinnedPg);
    if (!isPortFree(pgPort)) {
      throw new Error(
        `e2e: ${PG_PORT_ENV}=${pgPort} is already in use. Free it, run \`yarn e2e:reap\`, or unset ` +
          `${PG_PORT_ENV} to auto-pick a free port.`
      );
    }
  } else {
    pgPort = fresh.shift() as number;
  }

  let webPort: number;
  if (pinnedWeb) {
    webPort = Number(pinnedWeb);
    if (!isPortFree(webPort)) {
      throw new Error(
        `e2e: ${WEB_PORT_ENV}=${webPort} is already in use. Free it, run \`yarn e2e:reap\`, or unset ` +
          `${WEB_PORT_ENV} to auto-pick a free port.`
      );
    }
  } else {
    webPort = fresh.shift() as number;
  }

  // Publish back so globalSetup + every other reader (in this process and inheriting workers) resolve
  // the same ports, and mark resolution done so they trust the values rather than re-validating.
  process.env[PG_PORT_ENV] = String(pgPort);
  process.env[WEB_PORT_ENV] = String(webPort);
  process.env[RESOLVED_ENV] = "1";
  return { pgPort, webPort };
}
