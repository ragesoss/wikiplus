#!/usr/bin/env bash
# Standard PR screenshot matrix for wiki+ — one command to render the app's main UI surfaces across
# the states reviewers + the owner care about, then (optionally) attach them to a PR.
#
# It drives the committed capture spec `e2e/screenshots.spec.ts` (which self-skips in the normal CI
# e2e gate unless SHOTS=1) against the real Node SSR server with the in-spec Wikipedia/Wikidata/
# YouTube stubs + a seeded ephemeral Postgres (Playwright globalSetup), signing in via the e2e
# session-cookie helper for the logged-in shots — no real OAuth, no network egress.
#
# The matrix (per surface): logged-out + logged-in × desktop / tablet / mobile; for Topic also the
# scroll-top (Tier A, full beam) and slim-sticky (scrolled, beam faded) states + the mobile search
# icon-reveal. Home (landing), Topic, and the article-not-found state are the surfaces; subset with
# --home / --topic / --notfound.
#
# Usage:
#   scripts/dev/shots.sh [--all|--home|--topic|--notfound] [--out DIR] [--commit [SLUG]] [--pr N]
# Options:
#   --all            all surfaces (default)
#   --home           only the home/landing shots
#   --topic          only the Topic-page shots
#   --notfound       only the article-not-found shots (nonexistent Wikipedia title)
#   --out DIR        output dir (default: screenshots/standard — gitignored)
#   --commit [SLUG]  write to docs/design/<SLUG>-screenshots/ instead (the opt-in PERMANENT record,
#                    for design-system / identity work) and `git add` them. SLUG defaults to the
#                    current branch name. Mutually informs --out.
#   --pr N           after rendering, attach the shots to PR #N as a comment gallery. The PNGs are
#                    pushed to a dedicated `screenshots` branch (never merged → main stays lean) and
#                    referenced by SHA-pinned raw URLs (survive the PR branch being deleted).
#
# Default output is gitignored (no repo bloat); galleries are hosted on the side branch. Use
# --commit only when the screenshots are themselves design evidence worth keeping in the tree.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

scope="all"; out=""; commit=0; slug=""; pr=""
while [ $# -gt 0 ]; do
  case "$1" in
    --all)   scope="all"; shift ;;
    --home)  scope="home"; shift ;;
    --topic) scope="topic"; shift ;;
    --notfound) scope="notfound"; shift ;;
    --out)   out="$2"; shift 2 ;;
    --commit) commit=1
              if [ $# -ge 2 ] && [[ "$2" != --* ]]; then slug="$2"; shift; fi
              shift ;;
    --pr)    pr="$2"; shift 2 ;;
    -h|--help) sed -n '2,31p' "$0"; exit 0 ;;
    *) echo "shots: unknown option '$1' (see --help)" >&2; exit 2 ;;
  esac
done

# Resolve the output dir.
if [ "$commit" = 1 ]; then
  [ -n "$slug" ] || slug="$(git branch --show-current | tr -cs 'A-Za-z0-9' '-' | sed 's/^-//;s/-$//')"
  [ -n "$slug" ] || slug="ui"
  out="docs/design/${slug}-screenshots"
fi
[ -n "$out" ] || out="screenshots/standard"

# Map scope → Playwright grep over the @home / @topic / @notfound tags in the spec titles.
grep_arg=()
case "$scope" in
  home)     grep_arg=(--grep "@home") ;;
  topic)    grep_arg=(--grep "@topic") ;;
  notfound) grep_arg=(--grep "@notfound") ;;
  all)      grep_arg=() ;;
esac

echo "shots: rendering '$scope' → $out (this builds + serves the app; ~1–2 min)…"
mkdir -p "$out"
rm -f "$out"/home-*.png "$out"/topic-*.png "$out"/notfound-*.png 2>/dev/null || true
SHOTS=1 SHOTS_OUT="$out" npx playwright test e2e/screenshots.spec.ts "${grep_arg[@]}"
rc=$?
if [ "$rc" != 0 ]; then echo "shots: capture run failed (rc=$rc)" >&2; exit "$rc"; fi
count=$(ls "$out"/*.png 2>/dev/null | wc -l | tr -d ' ')
echo "shots: wrote $count screenshot(s) to $out"

if [ "$commit" = 1 ]; then
  git add "$out" && echo "shots: staged $out (commit when ready)"
fi

[ -n "$pr" ] || exit 0

# ── Attach to PR #$pr: push the PNGs to the dedicated `screenshots` side branch (never merged), then
#    post a gallery comment with SHA-pinned raw URLs. ────────────────────────────────────────────
command -v gh >/dev/null || { echo "shots: gh not on PATH — cannot post to PR #$pr" >&2; exit 1; }
nwo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
sbranch="screenshots"
git fetch -q origin "$sbranch" 2>/dev/null || true
if ! git show-ref -q --verify "refs/remotes/origin/$sbranch"; then
  # Create an empty root commit (no working-tree churn, no orphan-in-worktree quirks) and push it.
  empty_tree="$(git hash-object -t tree /dev/null)"
  root_commit="$(git commit-tree "$empty_tree" -m "init screenshots branch (PR galleries; never merged to main)")"
  git push -q origin "$root_commit:refs/heads/$sbranch"
  git fetch -q origin "$sbranch"
fi
wt="$(mktemp -d)"
git worktree add -q -B "$sbranch" "$wt" "origin/$sbranch"
mkdir -p "$wt/pr-$pr"
rm -f "$wt/pr-$pr"/*.png 2>/dev/null || true
cp "$out"/*.png "$wt/pr-$pr/"
( cd "$wt" && git add "pr-$pr" \
  && git commit -q -m "Screenshots for PR #$pr ($scope)" \
  && git push -q origin "$sbranch" )
sha="$(git -C "$wt" rev-parse HEAD)"
git worktree remove --force "$wt"

base="https://raw.githubusercontent.com/$nwo/$sha/pr-$pr"
body="$(mktemp)"
{
  echo "## 📸 Screenshots ($scope)"
  echo
  echo "_Real-browser captures (Node SSR server, seeded DB; logged-in via the e2e session cookie — no real OAuth). Generated by \`scripts/dev/shots.sh\`._"
  echo
  # Emit an image line only when the file was actually produced (subset-safe).
  img() { [ -f "$out/$1.png" ] && { echo "**$2**"; echo; echo "![$2]($base/$1.png)"; echo; }; }
  if ls "$out"/home-*.png >/dev/null 2>&1; then
    echo "### Home (landing)"; echo
    img home-desktop-logged-out "Desktop — logged out"
    img home-desktop-logged-in  "Desktop — logged in"
    img home-mobile-logged-out  "Mobile — logged out"
    img home-mobile-logged-in   "Mobile — logged in"
  fi
  if ls "$out"/topic-*.png >/dev/null 2>&1; then
    echo "### Topic"; echo
    img topic-desktop-tierA-logged-out "Desktop ≥ lg — logged out (seam on the article↔plus divider)"
    img topic-desktop-tierA-logged-in  "Desktop ≥ lg — logged in"
    img topic-desktop-slim-logged-in   "Desktop — slim sticky bar (scrolled, beam faded)"
    img topic-tablet-tierA-logged-out  "Tablet (md, stacked) — logged out"
    img topic-mobile-tierA-logged-out  "Mobile (< md, search → icon) — logged out"
    img topic-mobile-tierA-logged-in   "Mobile — logged in"
    img topic-mobile-slim-logged-in    "Mobile — slim sticky (scrolled)"
    img topic-mobile-search-revealed   "Mobile — search revealed"
  fi
  if ls "$out"/notfound-*.png >/dev/null 2>&1; then
    echo "### Article not found (nonexistent Wikipedia title)"; echo
    img notfound-desktop-logged-out "Desktop — logged out (header search is the recovery path)"
    img notfound-desktop-logged-in  "Desktop — logged in"
    img notfound-mobile-logged-out  "Mobile — logged out"
  fi
} > "$body"
gh pr comment "$pr" --body-file "$body"
rm -f "$body"
echo "shots: posted gallery to PR #$pr"
