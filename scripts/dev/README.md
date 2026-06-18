# scripts/dev — local development-cycle helpers

Fixed, allowlistable wrappers for the recurring dev-loop tasks that agents (and humans) otherwise
re-assemble as ad-hoc one-liners every session. Each does **one** thing with no arbitrary shell
passthrough, so the read-only/safe ones are allowlisted in `.claude/settings.json` — cutting the
permission-prompt noise during the build loop.

**Invoke from the repo root, exactly as written** (the allowlist matches the literal command); never
wrap them in `bash` (that re-routes the match to `bash` and defeats the allowlist).

| Script | What it does | Allowlisted? |
|---|---|---|
| `scripts/dev/qa-gate.sh [--no-build\|--no-test\|--no-typecheck]` | The pre-PR gate: `yarn typecheck` + `yarn test` + `yarn build` in one command, with labeled/trimmed output, a PASS/FAIL summary, and a non-zero exit if any gate fails. `--no-build` for a faster inner loop. | ✅ yes |
| `scripts/dev/shoot.sh <target…> [opts]` | Render design-review screenshots. A target is an `.html` file (via `file://`), a `/route` (via the app server), or a full URL. Options: `--montage [name]`, `--crop WxH+X+Y`, `--width/--height/--scale`, `--out DIR`, `--serve` (build + start a temp server for routes). Replaces the chrome-`--screenshot` + ImageMagick `-crop`/`-append` ritual. | ✅ yes |
| `scripts/dev/test-db.sh up\|down` | A local throwaway Postgres on :55432 for integration tests against real PG (the normal `yarn test` suite uses in-process pglite and needs none of this). | ✅ yes |

`shoot.sh` writes to `./screenshots/` by default (gitignored). Routes/URLs need a reachable server:
it reuses one already listening on `$WIKIPLUS_SHOT_URL` (default `http://localhost:3000`), or with
`--serve` it `yarn build`s (unless `--no-build`) + `yarn start`s a temporary one and tears it down.

See `scripts/ops/README.md` for the deploy/runtime (`verify-live.sh`, `wait-deploy.sh`, `box-*.sh`)
helpers, and the **Helper scripts** note in `.claude/skills/build-loop/SKILL.md` for where each fits
in the pipeline.
