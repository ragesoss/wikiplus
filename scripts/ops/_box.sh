#!/usr/bin/env bash
# Shared config for the wiki+ VPS ops helpers (scripts/ops/*). SOURCED by the box-*.sh
# scripts — not invoked directly, and NOT allowlisted on its own.
#
# Connection facts are public (see docs/ops/vps-setup.md). The SSH private key is local-only
# + gitignored, so the box-*.sh scripts only work from a session that has it (a local machine),
# never from a cloud/CI session (those deploy via GitHub Actions). verify-live.sh needs no key.
# Override any value with the WIKIPLUS_* env vars.
BOX_USER="${WIKIPLUS_BOX_USER:-deploy}"
BOX_HOST="${WIKIPLUS_BOX_HOST:-172.232.188.245}"
SSH_KEY="${WIKIPLUS_SSH_KEY:-$HOME/.ssh/wikiplus_vps_ed25519}"
BOX_DIR="/opt/wikiplus"
SITE_URL="${WIKIPLUS_SITE_URL:-https://wikiplus.wikiedu.org}"

# Run a FIXED command on the box. The box-*.sh wrappers only ever pass a constant command
# string (never arbitrary/untrusted input) — that is what keeps them safe to allowlist.
box_ssh() {
  ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=12 -o StrictHostKeyChecking=accept-new \
    "${BOX_USER}@${BOX_HOST}" "$@"
}
