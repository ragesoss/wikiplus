# scripts/ops — VPS / deploy helper scripts

Fixed, **safe-by-construction** wrappers for the recurring deploy/runtime actions that would
otherwise need general-purpose `ssh` / `scp` / `curl` / `docker` commands (each of which has to
be approved every time, and is unsafe to blanket-allowlist). Each script does **one** operation
with no arbitrary passthrough, so the read-only ones can be allowlisted in
`.claude/settings.json` without widening the blast radius — cutting the permission-prompt noise
during the build loop.

**Invoke from the repo root, exactly as written** (the allowlist matches the literal command):

| Script | What it does | Mutates? | Allowlisted? | Needs SSH key? |
|---|---|---|---|---|
| `scripts/ops/verify-live.sh` | Post-deploy health check of the live site (read path + auth endpoints); exits non-zero on failure | no (GET) | ✅ yes | no — any session |
| `scripts/ops/box-status.sh` | `docker compose ps` + migrate-one-shot health on the box | no | ✅ yes | yes (local) |
| `scripts/ops/box-logs.sh` | Recent container logs (default: app, 30m, tail 200) | no | ✅ yes (no-arg form) | yes (local) |
| `scripts/ops/box-secrets-check.sh` | Confirm required runtime secrets are present+non-empty (counts only, never values) | no | ✅ yes | yes (local) |
| `scripts/ops/box-sync-compose.sh` | Copy `deploy/docker-compose.yml` to the box + recreate the stack | **yes (prod)** | ❌ no — keep one confirmation | yes (local) |

`_box.sh` is sourced by the others (connection config + a `box_ssh` helper); don't invoke it
directly. Override connection facts with `WIKIPLUS_BOX_HOST` / `WIKIPLUS_BOX_USER` /
`WIKIPLUS_SSH_KEY` / `WIKIPLUS_SITE_URL`.

## Safety model (why allowlisting these is OK)

- Each allowlisted script runs a **constant** command — it never forwards arbitrary input to a
  shell. `box-logs.sh`'s optional `service`/`since` args are validated against fixed patterns.
- The mutating script (`box-sync-compose.sh`) is **deliberately not allowlisted**: a change to
  the live box keeps an explicit confirmation. (It still saves prompts — one approval instead of
  the four raw `scp`+`ssh`+`docker` calls it replaces.)
- A generic `box-exec.sh "$@"` wrapper is intentionally **absent** — it would be no safer than
  allowlisting `ssh *`.

Connection facts are public (see `docs/ops/vps-setup.md`); the SSH private key is local-only and
gitignored, so the `box-*` scripts only work from a session that has it. The CI deploy
(`.github/workflows/deploy.yml`) is the normal path to prod — these are for verification and
diagnosis around it.
