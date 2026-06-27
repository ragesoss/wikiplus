# e2e / screenshots harness — parallel-safe by construction (issue #182)

The e2e + screenshot harness must be safe to run from several sessions at once (parallel cloud /
mobile / local build-loop runs are routine), and a crashed run must never leave state that breaks the
next one. This is the isolation strategy and the cleanup model.

## The gap (what was shared)

The per-run datadir was already isolated (`mkdtemp`), and so was its unix socket. The collision
points were the two **fixed TCP ports**:

- the ephemeral Postgres port (`E2E_PG_PORT`, default 54330), and
- the Next web-server port (`E2E_PORT`, default 4321).

Two concurrent runs bound the same ports → one failed with an opaque `pg_ctl` bind error (surfaced as
`shots: capture run failed (rc=1)`), or worse: `reuseExistingServer: !CI` let a run **silently reuse
another session's `next-server` on 4321, pointed at a different/stale DB** — cross-contamination.

## Strategy: a free ephemeral port per run, for both services

Each run allocates its **own** free port for Postgres and for the Next server (bind to `:0`, read back
the kernel-assigned port, release — the standard approach; a small release→rebind race is tolerated and
covered by a legible fail-fast). The fixed defaults are gone; `E2E_PG_PORT` / `E2E_PORT` remain
**honored when explicitly set** (the rare "I want a fixed port" case), but the *default* is per-run.

With unique ports, `reuseExistingServer` can no longer bite the default path: a freshly-allocated port
never has a server on it, so the web server always starts clean and is never the wrong-DB server.

### The config-load ordering wrinkle, resolved

`playwright.config.ts` is evaluated **before** `globalSetup` runs, and the web server, the
`webServer.env` `DATABASE_URL`, the `baseURL`, and `globalSetup`'s Postgres must all agree on the same
two ports. So the ports are chosen **at the very start of config evaluation** and published through
`process.env`:

- `e2e/ports.ts` owns allocation. `ensureE2EPorts()` returns `{ pgPort, webPort }`: for each port it
  honors an existing `process.env` value (explicit override) or allocates a fresh free one, then
  **writes it back to `process.env`** so every later reader in the process agrees. It is idempotent.
- `playwright.config.ts` calls `ensureE2EPorts()` first thing in its body, then builds `baseURL`, the
  `webServer.command/url`, and `webServer.env.DATABASE_URL` from those ports.
- `e2e/db-server.ts` exposes the port/URL as **functions** (`e2eDatabaseUrl()`), read at call time
  from `process.env` — not module-load constants — so `startE2EDatabase()` (in `globalSetup`, same
  process) resolves the identical port the config already published. Allocation happens once.

Worker processes (which import the specs → `auth.ts` → `db-server.ts`) never read the port — they use
only the auth secret / cookie name / seeded-user file — so they need no allocation, and the cookie is
domain-only (`localhost`), unaffected by the port.

## Robust teardown, stale-state cleanup, and a real reap affordance

Ownership is split cleanly:

- **Normal run:** Playwright tears down the web server it spawned; `globalTeardown` →
  `stopE2EDatabase()` stops the postmaster, removes the datadir + the seeded-user file, and deletes the
  run record. `globalTeardown` runs even when the suite fails. (`globalTeardown` does **not** touch the
  web port — Playwright owns that lifecycle; killing it there would race Playwright's own teardown.)
- **Killed run (SIGKILL):** Playwright skips its web-server teardown and `globalTeardown` never runs,
  orphaning **both** the postmaster and the `next-server`. A reap affordance handles this.

### Run registry — so reaping targets the harness's *own* resources

Each run writes a small JSON **run record** under `<tmpdir>/wikiplus-e2e-runs/<id>.json`:
`{ datadir, pgPort, webPort, pgPid }`. `stopE2EDatabase()` deletes it on clean exit, so any record
left behind marks a crashed run.

`reapE2E()` (exposed as `yarn e2e:reap` and `scripts/dev/shots.sh --cleanup`) walks the records and,
for each, stops the postmaster (by its recorded datadir / `postmaster.pid`), kills whatever holds the
recorded **web port** (looked up by that *exact recorded port*, via `lsof`/`fuser` — **never** a
command-line pattern match), removes the datadir, and deletes the record. It also sweeps orphaned
`<tmpdir>/wikiplus-e2e-pg-*` datadirs that no record covers. It reports each PID/port/dir it touches.

**Why never pattern-match.** `pkill -f wikiplus-e2e-pg` matches its own command line and kills the
operator's shell. Reaping must key off resources the harness *recorded as its own* (a datadir we
created, a port we allocated), not a name grep.

Because ports are now per-run-random, a *lingering* orphan from a crashed run no longer blocks the next
run (it gets a different port). Reaping is hygiene — reclaiming resources — not a prerequisite for the
next run to start.

### Fail fast, legibly

- When a port is **explicitly pinned** via env and is already held, `ensureE2EPorts()` fails at config
  time with a clear message naming the port and pointing at `yarn e2e:reap` / the override.
- If the postmaster fails to start anyway (the rare allocate→bind race, or a pinned-port conflict),
  `startE2EDatabase()` surfaces the postmaster log tail plus the port + datadir and the reap hint —
  not a swallowed `execFileSync` throw.
- A bounded `PGCTLTIMEOUT` keeps `pg_ctl -w start` from hanging indefinitely on its readiness wait
  (observed under PostgreSQL 18 in this environment).

## Atomic gallery refresh (the `--commit` blast radius)

`scripts/dev/shots.sh --commit` is the only path that writes the **committed** baseline, so a failure
there must never leave it broken. The committed refresh now renders into a **staging dir** and syncs to
the baseline only when the staging set is coherent:

- A **partial refresh** (`--commit` + a subset) seeds staging with the existing baseline PNGs so
  un-selected shots survive; the selected scenes render over them.
- The index is rebuilt in staging from whatever PNGs are present, then staging is synced to the
  committed dir and `git add`ed — so the committed gallery is **always index-coherent**.
- If the capture produced **zero** PNGs (e.g. the build failed), the existing baseline is left
  **untouched** rather than wiped.
- A partial failure still produces a coherent committed gallery, reports which scenes are missing, and
  exits non-zero so the operator knows it was partial.

(The non-`--commit` path writes a gitignored throwaway dir, where corruption is harmless, so it keeps
rendering directly — staging is only for the committed baseline.)

## Out of scope

App code and product behavior; the CI worker-count / shots-flakiness tuning; warm-cluster pooling or
any test-data multi-tenancy — the goal here is **isolation**, not sharing.
