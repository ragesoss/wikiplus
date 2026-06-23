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
| `scripts/dev/shots.sh [--all\|--home\|--topic] [--out DIR] [--commit [SLUG]] [--pr N]` | The **standard PR screenshot matrix** — renders the app's main UI surfaces (home/landing + Topic) across logged-out/logged-in × desktop/tablet/mobile, plus (for Topic) the scroll-top (Tier A) and slim-sticky states + the mobile search icon-reveal. Drives the committed `e2e/screenshots.spec.ts` through the e2e harness (seeded DB + the signed-in cookie — no real OAuth). Subset with `--home`/`--topic`; `--pr N` attaches the gallery to a PR. | ⚠️ no (`--pr` pushes a branch + comments) |
| `scripts/dev/test-db.sh up\|down` | A local throwaway Postgres on :55432 for integration tests against real PG (the normal `yarn test` suite uses in-process pglite and needs none of this). | ✅ yes |
| `scripts/dev/worktree.sh new <name> [base]\|rm <name>\|list\|path <name>` | The **standard build worktree**. `new` makes `.claude/worktrees/<name>` on branch `<name>` (from `[base]`, default HEAD), symlinks `node_modules` from the main checkout, and prints the worktree's absolute path; `rm` tears it down (and deletes the branch if merged). | ✅ yes |

`shoot.sh` writes to `./screenshots/` by default (gitignored). Routes/URLs need a reachable server:
it reuses one already listening on `$WIKIPLUS_SHOT_URL` (default `http://localhost:3000`), or with
`--serve` it `yarn build`s (unless `--no-build`) + `yarn start`s a temporary one and tears it down.

**`shoot.sh` vs `shots.sh`:** `shoot.sh` is the *ad-hoc* tool — point it at any file/route/URL with a
custom crop. `shots.sh` is the *standard PR matrix* — a fixed, reproducible set of the app's main UI
states for reviewing a UI change. Default output is gitignored `screenshots/standard/` (no repo
bloat); `--pr N` hosts the gallery on the dedicated `screenshots` branch (never merged to `main`) and
references it from a PR comment via SHA-pinned raw URLs. Use `--commit [SLUG]` only when the
screenshots are themselves design evidence worth keeping in-tree (e.g. design-system / identity work,
like `docs/design/landing-page-screenshots/`).

**`worktree.sh` — why in-repo:** it always creates worktrees under `.claude/worktrees/<name>` (gitignored).
Because that path is **inside the trusted project root**, Read/Write/Grep into the worktree never trip a
permission prompt — unlike a sibling `../wikiplus-<name>`, which is outside the root and prompts on every
access (and needs a hand-approved `Read(//…/**)` grant per worktree). One subdir + branch per build, so
it's parallel-safe. Work *in* the printed path: don't prefix commands with `cd <worktree> && …` (a
compound `cd` to a non-cwd path defeats the allowlist), and give tools worktree-absolute paths for new
files. `node_modules` is symlinked from the main checkout (fast, shared deps); if a branch changes
dependencies, replace the symlink with a real `yarn install` inside the worktree.

See `scripts/ops/README.md` for the deploy/runtime (`verify-live.sh`, `wait-deploy.sh`, `box-*.sh`)
helpers, and the **Helper scripts** note in `.claude/skills/build-loop/SKILL.md` for where each fits
in the pipeline.
