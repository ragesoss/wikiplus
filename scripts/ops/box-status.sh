#!/usr/bin/env bash
# Read-only: container + migrate-one-shot health on the box. No args. Safe to allowlist.
# Requires the local SSH key (see _box.sh) — local sessions only.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$DIR/_box.sh"
box_ssh 'cd /opt/wikiplus && docker compose ps --all --format "table {{.Service}}\t{{.Status}}"'
