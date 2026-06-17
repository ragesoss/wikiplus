#!/usr/bin/env bash
# Local throwaway Postgres for INTEGRATION tests (e.g. running the Drizzle store / migrations
# against real Postgres). The normal `yarn test` suite uses in-process pglite and needs none of
# this — reach for it only when you specifically want a real PG. Fixed image/port/creds/name and
# an up|down verb, so it encapsulates the raw `docker run` (which is otherwise unsafe to
# allowlist) behind a constant, allowlistable command.
#   up   -> start postgres on :55432, print the DATABASE_URL to export
#   down -> stop + remove it
set -euo pipefail
NAME=wikiplus-testdb
IMAGE=postgres:16-alpine
PORT=55432
case "${1:-}" in
  up)
    docker run -d --rm --name "$NAME" \
      -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=wikiplus \
      -p "$PORT:5432" "$IMAGE" >/dev/null
    echo "started $NAME ($IMAGE) on :$PORT"
    echo "export DATABASE_URL=postgres://postgres:testpass@localhost:$PORT/wikiplus"
    ;;
  down)
    docker stop "$NAME" >/dev/null 2>&1 && echo "stopped $NAME" || echo "$NAME not running"
    ;;
  *) echo "usage: $(basename "$0") up|down" >&2; exit 2 ;;
esac
