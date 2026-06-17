#!/usr/bin/env bash
# Read-only: recent container logs on the box. Default: app, last 30m, tail 200 (the common
# case) — the no-arg form is safe to allowlist. Optional args (prompt-gated when passed):
#   $1 service: app|caddy|postgres|migrate   $2 since: e.g. 30m / 2h / 90s
# Both args are validated, so even the arg form cannot inject an arbitrary remote command.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$DIR/_box.sh"
SVC="${1:-app}"; SINCE="${2:-30m}"
case "$SVC"   in app|caddy|postgres|migrate) ;; *) echo "service must be app|caddy|postgres|migrate" >&2; exit 2;; esac
case "$SINCE" in ''|*[!0-9hms]*) echo "since must look like 30m / 2h / 90s" >&2; exit 2;; esac
box_ssh "cd /opt/wikiplus && docker compose logs $SVC --since $SINCE --tail 200"
