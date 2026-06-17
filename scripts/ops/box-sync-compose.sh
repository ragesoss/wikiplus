#!/usr/bin/env bash
# MUTATING (prod): sync the repo's deploy/docker-compose.yml to the box and recreate the stack.
# The CI deploy job does NOT sync the compose file, so use this when the app env / compose
# shape changed (e.g. a new runtime var). Intentionally NOT in the allowlist — a deploy-config
# change to the live box should keep one explicit confirmation. Requires the local SSH key.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$DIR/_box.sh"
ROOT="$(cd "$DIR/../.." && pwd)"
echo "Syncing $ROOT/deploy/docker-compose.yml -> ${BOX_USER}@${BOX_HOST}:$BOX_DIR/"
scp -i "$SSH_KEY" -o BatchMode=yes "$ROOT/deploy/docker-compose.yml" "${BOX_USER}@${BOX_HOST}:$BOX_DIR/docker-compose.yml"
box_ssh 'cd /opt/wikiplus && docker compose config -q && echo "config: ok" && docker compose up -d --wait && docker compose ps --format "table {{.Service}}\t{{.Status}}"'
