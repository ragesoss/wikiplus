#!/usr/bin/env bash
# Post-deploy health check of the LIVE site (default https://wikiplus.wikiedu.org).
# Read-only (GET only) — checks the anonymous read path + the auth endpoints, exits non-zero
# on any failure. No args needed (defaults to prod), so the no-arg form is safe to allowlist.
# Optional: pass a base URL as $1 to check another origin (that invocation is prompt-gated).
# Works from ANY session (no SSH key required).
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$DIR/_box.sh"
BASE="${1:-$SITE_URL}"
fail=0
http() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
chk()  { if [ "$3" = "$2" ]; then echo "ok   $1 ($3)"; else echo "FAIL $1 (got $3 want $2)"; fail=1; fi; }

chk "home"              200 "$(http "$BASE/")"
chk "topic (followed)"  200 "$(http -L "$BASE/topic/Photosynthesis")"
chk "auth/session"      200 "$(http -L "$BASE/api/auth/session")"
if curl -s -L "$BASE/api/auth/providers" | grep -q '"wikimedia"'; then
  echo "ok   auth/providers lists wikimedia"; else echo "FAIL auth/providers missing wikimedia"; fail=1; fi
# The home page is statically prerendered; the AuthControl login button is client-rendered
# after hydration, so assert a STABLE static marker (the wordmark) for "page really rendered".
# Auth wiring itself is covered by the providers/session checks above.
if curl -s "$BASE/" | grep -q "wiki+"; then
  echo "ok   home rendered (wiki+ wordmark)"; else echo "FAIL home did not render (no wordmark)"; fail=1; fi

if [ "$fail" -eq 0 ]; then echo "VERIFY: PASS"; else echo "VERIFY: FAIL"; fi
exit "$fail"
