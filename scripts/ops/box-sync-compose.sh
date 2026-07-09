#!/usr/bin/env bash
# MUTATING (prod): sync the repo's deploy config (docker-compose.yml + Caddyfile) to the box and
# apply it. The CI deploy job does NOT sync these files, so use this when the app env / compose
# shape OR the Caddy host config changed (e.g. a new runtime var, or a domain change). Intentionally
# NOT in the allowlist — a deploy-config change to the live box should keep one explicit confirmation.
# Requires the local SSH key.
#
# NOTE (domain change): the Caddyfile is where the public host lives. Point the new host's DNS at
# the box BEFORE running this — Caddy fetches the new Let's Encrypt cert via an HTTP-01 challenge on
# reload, which needs the name to already resolve to this box.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$DIR/_box.sh"
ROOT="$(cd "$DIR/../.." && pwd)"
echo "Syncing $ROOT/deploy/{docker-compose.yml,Caddyfile} -> ${BOX_USER}@${BOX_HOST}:$BOX_DIR/"
scp -i "$SSH_KEY" -o BatchMode=yes \
  "$ROOT/deploy/docker-compose.yml" "$ROOT/deploy/Caddyfile" \
  "${BOX_USER}@${BOX_HOST}:$BOX_DIR/"
# Validate, then apply: `up -d` recreates app/postgres if the compose shape changed; a changed
# (bind-mounted) Caddyfile is NOT picked up by `up -d`, so hot-reload Caddy explicitly for a
# zero-downtime config swap. `caddy validate` fails the run loudly on a bad Caddyfile before reload.
box_ssh 'cd /opt/wikiplus \
  && docker compose config -q && echo "compose config: ok" \
  && docker compose up -d --wait \
  && docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
  && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile \
  && echo "caddy reloaded" \
  && docker compose ps --format "table {{.Service}}\t{{.Status}}"'
