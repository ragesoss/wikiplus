#!/usr/bin/env bash
# Wait for the `main` deploy to land, then verify the live site.
#   scripts/ops/wait-deploy.sh            # wait for the deploy of origin/main's HEAD
#   scripts/ops/wait-deploy.sh <sha>      # wait for the deploy of a specific commit sha
#
# Polls the `deploy.yml` GitHub Actions run for the target commit until it completes, then chains
# `scripts/ops/verify-live.sh` on success. Replaces the ad-hoc
#   for i in $(seq 1 30); do gh run list --workflow=deploy.yml --jq ...; sleep ...; done
# loop that every post-merge session rebuilds. Read-only (gh + a GET health check) → allowlistable.
#
# Tunables (env): WIKIPLUS_DEPLOY_INTERVAL (default 15s), WIKIPLUS_DEPLOY_TRIES (default 60),
# WIKIPLUS_DEPLOY_WORKFLOW (default deploy.yml).
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

case "${1:-}" in -h|--help) sed -n '2,12p' "$0"; exit 0 ;; esac

interval="${WIKIPLUS_DEPLOY_INTERVAL:-15}"
tries="${WIKIPLUS_DEPLOY_TRIES:-60}"
workflow="${WIKIPLUS_DEPLOY_WORKFLOW:-deploy.yml}"

if [ -n "${1:-}" ]; then
  sha="$1"
else
  git fetch origin main --quiet 2>/dev/null || true
  sha="$(git rev-parse origin/main)"
fi
short="${sha:0:7}"
echo "wait-deploy: target $short (workflow $workflow); polling every ${interval}s, up to $tries times."

for n in $(seq 1 "$tries"); do
  line="$(gh run list --workflow="$workflow" --limit 20 \
            --json status,conclusion,headSha,databaseId \
            --jq ".[] | select(.headSha == \"$sha\") | \"\(.status) \(.conclusion) \(.databaseId)\"" \
          2>/dev/null | head -n1)"
  status="${line%% *}"
  rest="${line#* }"; conclusion="${rest%% *}"

  if [ -z "$line" ]; then
    printf '[%02d/%d] no run for %s yet…\n' "$n" "$tries" "$short"
  elif [ "$status" = "completed" ]; then
    echo "[$n] run completed: conclusion=$conclusion"
    if [ "$conclusion" = "success" ]; then
      echo "wait-deploy: deploy succeeded — verifying live site…"
      exec scripts/ops/verify-live.sh
    fi
    echo "wait-deploy: deploy did NOT succeed (conclusion=$conclusion)." >&2
    exit 1
  else
    printf '[%02d/%d] %s…\n' "$n" "$tries" "$status"
  fi
  [ "$n" -lt "$tries" ] && sleep "$interval"
done

echo "wait-deploy: timed out after $((interval * tries))s waiting for $short." >&2
exit 1
