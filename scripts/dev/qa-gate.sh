#!/usr/bin/env bash
# Pre-commit / pre-PR verification gate for wiki+.
#   (no args)       typecheck + unit tests + server build   (the full pre-PR gate; the
#                   build stage wipes .next first so a stale manifest can't false-FAIL it)
#   --no-build      typecheck + tests only                  (faster inner-loop check)
#   --no-test       typecheck + build only
#   --no-typecheck  skip the typecheck stage
#   --docker        ALSO build the Dockerfile `build` stage against the trimmed context
#                   (catches .dockerignore breaks the host `yarn build` misses — same gate
#                   as PR CI's pr-ci.yml). Opt-in: a local Docker build is slow, so it is
#                   OFF by default. Needs Docker. Builds the actual deploy context, so it is
#                   immune to a stale host `.next` (issue #95) — `.next` is .dockerignore'd.
#
# Runs the recurring "did I break anything?" combo in ONE allowlistable command, with labeled,
# trimmed output and a PASS/FAIL summary, exiting non-zero if any selected gate fails (and
# dumping that gate's output tail). Replaces the ad-hoc
#   yarn typecheck 2>&1 | tail; yarn test 2>&1 | tail; yarn build 2>&1 | tail
# that Dev/QA reassemble every session. Fixed verbs, no arbitrary passthrough → safe to allowlist.
set -uo pipefail

run_build=1; run_test=1; run_typecheck=1; run_docker=0
for arg in "$@"; do
  case "$arg" in
    --no-build)     run_build=0 ;;
    --no-test)      run_test=0 ;;
    --no-typecheck) run_typecheck=0 ;;
    --docker)       run_docker=1 ;;
    -h|--help)      sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "qa-gate: unknown arg '$arg' (see --help)" >&2; exit 2 ;;
  esac
done

# Run from the repo root regardless of caller cwd.
cd "$(dirname "$0")/../.." || exit 1

log_dir="$(mktemp -d)"
trap 'rm -rf "$log_dir"' EXIT
fail=0
declare -a summary=()

gate() {
  local name="$1"; shift
  local logf="$log_dir/$name.log"
  printf '\n\033[1m=== %s ===\033[0m  (%s)\n' "$name" "$*"
  if "$@" >"$logf" 2>&1; then
    tail -n 3 "$logf" | sed 's/^/  /'
    summary+=("PASS  $name")
  else
    local rc=$?
    echo "  --- FAILED (exit $rc) — last 40 lines: ---"
    tail -n 40 "$logf" | sed 's/^/  /'
    summary+=("FAIL  $name")
    fail=1
  fi
}

[ "$run_typecheck" = 1 ] && gate typecheck yarn typecheck
[ "$run_test" = 1 ]      && gate test      yarn test
# Wipe .next first so a stale prerender manifest can't false-FAIL the build (issue #95):
# `next build` prints "Compiled successfully" then dies on a half-stale manifest during
# route prerendering. The gate runs a full build, so the clean-start cost is acceptable here;
# bare `yarn build` is left incremental for the inner loop.
[ "$run_build" = 1 ]     && { rm -rf .next; gate build yarn build; }
# Opt-in: build the deploy `build` stage against the trimmed context (.dockerignore-aware).
[ "$run_docker" = 1 ]    && gate docker    docker build --target build .

printf '\n\033[1m=== git status (short) ===\033[0m\n'
git status --short | sed 's/^/  /' || true

printf '\n\033[1m=== summary ===\033[0m\n'
printf '  %s\n' "${summary[@]}"
exit "$fail"
