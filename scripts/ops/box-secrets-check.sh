#!/usr/bin/env bash
# Read-only: confirm the required RUNTIME secrets are present + non-empty in the box .env.
# Prints COUNTS only — never any secret value. No args. Safe to allowlist.
# (AUTH_URL is a literal in deploy/docker-compose.yml, not a box .env secret, so it's not here.)
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$DIR/_box.sh"
box_ssh 'f=/opt/wikiplus/.env; for k in AUTH_SECRET wikimedia_oauth_client_key wikimedia_oauth_client_secret POSTGRES_PASSWORD; do printf "%-32s present-and-nonempty=%s\n" "$k" "$(grep -cE "^$k=.+" "$f" 2>/dev/null || echo 0)"; done'
