#!/usr/bin/env bash
# Screenshot helper for wiki+ design review.
# Renders one or more targets to PNG with a fixed retina convention, an optional per-shot crop,
# and an optional vertical montage — replacing the ad-hoc
#   google-chrome --headless --screenshot ... ; convert -crop ... ; convert ... -append
# ritual (and the throwaway "build → serve → playwright shot" pattern) that design-review and
# UX-evaluation sessions reinvent constantly.
#
# A target is one of:
#   foo.html            a local file  → rendered via file://         (mockups, static design)
#   /topic/Photo/       a route       → rendered via the app server  (live UI; needs a server)
#   https://host/path   a full URL    → rendered as-is
#
# Routes/URLs need a reachable server. By default that is $WIKIPLUS_SHOT_URL (default
# http://localhost:3000); pass --serve to have this script `yarn build` (unless --no-build) +
# `yarn start` a throwaway server itself and tear it down on exit.
#
# Usage:
#   scripts/dev/shoot.sh mockups/foo.html [more.html ...]        [opts]
#   scripts/dev/shoot.sh --route /topic/Photosynthesis/ --route / [opts]
# Options:
#   --route PATH     add a route target (repeatable; or just pass /paths positionally)
#   --out DIR        output directory (default: ./screenshots, gitignored)
#   --width PX       viewport width        (default 1280)
#   --height PX      viewport height       (default 900)
#   --scale N        device scale factor   (default 2)
#   --crop WxH+X+Y   ImageMagick crop applied to every shot (geometry format is validated)
#   --montage [NAME] also append all shots top-to-bottom into one strip (default montage.png)
#   --serve          build (unless --no-build) + start a temp server for route targets
#   --no-build       with --serve, reuse the existing .next build instead of rebuilding
#
# Fixed chrome flags + a validated crop geometry; file/route args are only ever handed to
# chrome / convert, never eval'd → safe to allowlist.
set -uo pipefail

cd "$(dirname "$0")/../.." || exit 1

CHROME="$(command -v google-chrome-stable || command -v google-chrome || command -v chromium || true)"
[ -n "$CHROME" ] || { echo "shoot: no chrome/chromium on PATH" >&2; exit 1; }
command -v convert >/dev/null || { echo "shoot: ImageMagick 'convert' not on PATH" >&2; exit 1; }

base_url="${WIKIPLUS_SHOT_URL:-http://localhost:3000}"
out_dir="./screenshots"
width=1280; height=900; scale=2
crop=""; montage=""; do_serve=0; do_build=1
declare -a targets=()

while [ $# -gt 0 ]; do
  case "$1" in
    --route)   targets+=("$2"); shift 2 ;;
    --out)     out_dir="$2"; shift 2 ;;
    --width)   width="$2"; shift 2 ;;
    --height)  height="$2"; shift 2 ;;
    --scale)   scale="$2"; shift 2 ;;
    --crop)    crop="$2"; shift 2 ;;
    --montage) montage="montage.png"
               # optional value if the next token isn't another flag
               if [ $# -ge 2 ] && [[ "$2" != --* ]]; then montage="$2"; shift; fi
               shift ;;
    --serve)   do_serve=1; shift ;;
    --no-build) do_build=0; shift ;;
    -h|--help) sed -n '2,38p' "$0"; exit 0 ;;
    --*) echo "shoot: unknown option '$1' (see --help)" >&2; exit 2 ;;
    *) targets+=("$1"); shift ;;
  esac
done

[ "${#targets[@]}" -gt 0 ] || { echo "shoot: no targets (see --help)" >&2; exit 2; }
if [ -n "$crop" ] && ! [[ "$crop" =~ ^[0-9]+x[0-9]+\+[0-9]+\+[0-9]+$ ]]; then
  echo "shoot: --crop must be WxH+X+Y (e.g. 1880x270+0+250)" >&2; exit 2
fi

mkdir -p "$out_dir"

# Does any target need a server (route or URL, not a .html file)?
needs_server=0
for t in "${targets[@]}"; do
  case "$t" in http://*|https://*|/*) needs_server=1 ;; esac
done

server_pid=""
cleanup() { [ -n "$server_pid" ] && kill "$server_pid" 2>/dev/null; }
trap cleanup EXIT

server_up() { curl -sf -m 3 -o /dev/null "$base_url" 2>/dev/null; }

if [ "$needs_server" = 1 ]; then
  if server_up; then
    echo "shoot: using server already up at $base_url"
  elif [ "$do_serve" = 1 ]; then
    [ "$do_build" = 1 ] && { echo "shoot: yarn build…"; yarn build >/dev/null 2>&1 || { echo "shoot: build failed" >&2; exit 1; }; }
    echo "shoot: starting temp server (yarn start)…"
    yarn start >/dev/null 2>&1 &
    server_pid=$!
    for _ in $(seq 1 30); do server_up && break; sleep 1; done
    server_up || { echo "shoot: temp server never came up at $base_url" >&2; exit 1; }
  else
    echo "shoot: route/URL target but no server at $base_url." >&2
    echo "       start one (yarn build && yarn start), set WIKIPLUS_SHOT_URL, or pass --serve." >&2
    exit 1
  fi
fi

shoot_one() {  # $1 = target, $2 = output png
  local target="$1" outpng="$2" url
  case "$target" in
    http://*|https://*) url="$target" ;;
    /*)                 url="${base_url%/}$target" ;;
    *)                  [ -f "$target" ] || { echo "shoot: no such file '$target'" >&2; return 1; }
                        url="file://$(cd "$(dirname "$target")" && pwd)/$(basename "$target")" ;;
  esac
  "$CHROME" --headless=new --hide-scrollbars --disable-gpu \
    --force-device-scale-factor="$scale" --window-size="$width,$height" \
    --virtual-time-budget=3000 --screenshot="$outpng" "$url" >/dev/null 2>&1
  [ -s "$outpng" ] || { echo "shoot: chrome produced no image for '$target'" >&2; return 1; }
  if [ -n "$crop" ]; then convert "$outpng" -crop "$crop" +repage "$outpng"; fi
  echo "  $target → $outpng"
}

declare -a shots=()
i=0
for t in "${targets[@]}"; do
  i=$((i + 1))
  slug="$(printf '%s' "$t" | tr -cs 'A-Za-z0-9' '-' | sed 's/^-//; s/-$//')"
  [ -n "$slug" ] || slug="shot"
  png="$(printf '%s/%02d-%s.png' "$out_dir" "$i" "$slug")"
  if shoot_one "$t" "$png"; then shots+=("$png"); fi
done

[ "${#shots[@]}" -gt 0 ] || { echo "shoot: no shots produced" >&2; exit 1; }

if [ -n "$montage" ]; then
  case "$montage" in /*) montpath="$montage" ;; *) montpath="$out_dir/$montage" ;; esac
  convert "${shots[@]}" -append -bordercolor "#dddddd" -border 0x1 "$montpath"
  echo "montage → $montpath"
fi
