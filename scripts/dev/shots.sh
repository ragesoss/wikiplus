#!/usr/bin/env bash
# Standard PR screenshot gallery for wiki+ — one command to render the app's UI surfaces across the
# states reviewers + the owner care about, build a browsable HTML index, and (optionally) attach a
# chosen subset to a PR or refresh the committed canonical gallery.
#
# It drives the catalog-backed capture spec `e2e/screenshots.spec.ts` (which self-skips in the normal
# CI e2e gate unless SHOTS=1) against the real Node SSR server with the in-spec Wikipedia/Wikidata/
# YouTube stubs + a seeded ephemeral Postgres (Playwright globalSetup), signing in via the e2e
# session-cookie helper for the logged-in shots — no real OAuth, no network egress. Every surface +
# state is a `Scene` in e2e/screenshots/catalog.ts (the SINGLE source of truth); each scene renders
# across mobile/tablet/desktop × logged-out/logged-in. The logged-in shots are guarded: a capture
# whose client session didn't resolve a numeric contributorId FAILS LOUDLY (never a silent
# logged-out "logged-in" shot — #109).
#
# WORKFLOW. By default the FULL set lands in a gitignored working dir with an `index.html`. For a PR,
# pick the relevant scenes (--scene / --group / --focus) and attach just those (--pr). The committed
# canonical baseline lives at docs/design/ui-screenshots/ — refresh it on demand with --commit:
#   • a UI change touching a few surfaces → PARTIAL refresh, e.g.
#       scripts/dev/shots.sh --group "Topic · header" --commit ui   (re-renders just those, keeps the rest)
#   • a broad/shared change (header, palette, a shared component) or a new scene → FULL refresh:
#       scripts/dev/shots.sh --all --commit ui
#
# Usage:
#   scripts/dev/shots.sh [SELECTION] [--out DIR] [--commit [SLUG]] [--pr N]
#   scripts/dev/shots.sh --cleanup [--force]   (reap a crashed run's orphan Postgres + web server)
# Selection (default: everything):
#   --all                 every scene (default)
#   --group NAME          one index group, e.g. --group "General Strip"  (or a slug: general-strip)
#   --scene ID[,ID…]      named scenes, e.g. --scene general-suggestions,player-modal
#   --focus ID[,ID…]      named scenes AND pin+badge them at the top of the index (the PR's focus)
#   --home/--topic/--notfound   back-compat aliases (home / all topic surfaces / the not-found scene)
# Output:
#   --out DIR             output dir (default: screenshots/standard — gitignored)
#   --commit [SLUG]       write to docs/design/<SLUG>-screenshots/ and `git add` it — the on-demand
#                         refresh of the PERMANENT committed gallery (the baseline is SLUG=ui). With
#                         --all it re-renders everything; with a subset it PARTIALLY refreshes (only
#                         the selected scenes, preserving the rest). SLUG defaults to the branch name.
#   --pr N                attach the rendered set to PR #N as a comment gallery. PNGs are pushed to a
#                         dedicated `screenshots` branch (never merged → main stays lean) and
#                         referenced by SHA-pinned raw URLs (survive the PR branch being deleted).
# Maintenance:
#   --cleanup [--force]   reap a CRASHED run's orphan ephemeral Postgres + Next web server + datadir
#                         (`yarn e2e:reap`). Targets only resources the harness recorded as its own —
#                         never a process-name pattern match. `--force` reaps even an apparently-live run.
#
# The committed-gallery refresh is COHERENT-ON-SUCCESS: --commit renders into a staging dir and syncs
# to the baseline only when the result is coherent, so a failed scene never leaves an index-less or
# wiped committed dir (a partial failure keeps the prior shots, rebuilds a coherent index, and reports
# which scenes are missing). A run with two sessions live is safe: each gets its own per-run Postgres +
# web port (issue #182).
#
# The catalog is the source of truth: to add a shot, add a scene there — it is captured AND indexed
# automatically; no edits to this script or the spec.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

scope="all"; out=""; commit=0; slug=""; pr=""; grep_pat=""; focus=""

# Normalize a group name to the spec's @group tag slug (lowercase, non-alnum → '-').
slugify() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//'; }
# Join a comma list of scene ids into an alternation that matches the `@scene:<id> ` tag exactly.
scene_grep() { printf '@scene:(%s) ' "$(printf '%s' "$1" | tr ',' '|')"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --all)      scope="all"; shift ;;
    --group)    scope="group"; grep_pat="@group:$(slugify "$2")"; shift 2 ;;
    --scene)    scope="scene"; grep_pat="$(scene_grep "$2")"; shift 2 ;;
    --focus)    scope="focus"; focus="$2"; grep_pat="$(scene_grep "$2")"; shift 2 ;;
    --home)     scope="home"; grep_pat="@group:home"; shift ;;
    --topic)    scope="topic"; grep_pat="@group:(topic|general-strip|players)"; shift ;;
    --notfound) scope="notfound"; grep_pat="@scene:topic-notfound "; shift ;;
    --out)      out="$2"; shift 2 ;;
    --commit)   commit=1
                if [ $# -ge 2 ] && [[ "$2" != --* ]]; then slug="$2"; shift; fi
                shift ;;
    --pr)       pr="$2"; shift 2 ;;
    --cleanup)  shift; exec yarn e2e:reap "$@" ;;
    -h|--help)  sed -n '2,53p' "$0"; exit 0 ;;
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

grep_arg=()
[ -n "$grep_pat" ] && grep_arg=(--grep "$grep_pat")

echo "shots: rendering '$scope' → $out (this builds + serves the app; ~1–2 min)…"
mkdir -p "$out"

# WHERE we render. The committed baseline (--commit) is refreshed COHERENT-ON-SUCCESS: render into a
# staging dir and only sync to $out when the result is coherent, so a failed scene never leaves the
# committed dir index-less or wiped. (The final sync is rm-then-cp, not a single rename, so a crash
# mid-sync is the one narrow non-atomic window — the staged set is always coherent before it.) The
# throwaway working dir (non-commit) renders in place — corruption there is harmless.
if [ "$commit" = 1 ]; then
  render="$(mktemp -d)/shots"; mkdir -p "$render"
  # A PARTIAL refresh (--commit + a subset) must PRESERVE un-selected shots: seed staging with the
  # current baseline PNGs, then render the selected scenes over them. A full --all starts empty.
  if [ "$scope" != all ]; then cp "$out"/*.png "$render"/ 2>/dev/null || true; fi
else
  render="$out"
  rm -f "$render"/*.png "$render"/index.html "$render"/manifest.json 2>/dev/null || true
fi

SHOTS=1 SHOTS_OUT="$render" npx playwright test e2e/screenshots.spec.ts "${grep_arg[@]}"
rc=$?
captured=$(ls "$render"/*.png 2>/dev/null | wc -l | tr -d ' ')
[ "$rc" = 0 ] || echo "shots: capture run had failures (rc=$rc); $captured shot(s) produced" >&2

if [ "$commit" = 1 ]; then
  if [ "$captured" -eq 0 ]; then
    # Catastrophic (e.g. the build failed): leave the existing baseline UNTOUCHED rather than wipe it.
    echo "shots: 0 shots captured — baseline $out left untouched" >&2
    rm -rf "$(dirname "$render")"
    exit "${rc:-1}"
  fi
  # Build a coherent index over the staged set, then sync atomically into the committed baseline.
  SHOTS_FOCUS="$focus" npx tsx scripts/dev/shots-index.ts "$render"
  rm -f "$out"/*.png "$out"/index.html "$out"/manifest.json 2>/dev/null || true
  cp "$render"/* "$out"/ 2>/dev/null || true
  rm -rf "$(dirname "$render")"
else
  # Build the browsable HTML index + manifest from the catalog + the PNGs just produced.
  SHOTS_FOCUS="$focus" npx tsx scripts/dev/shots-index.ts "$out"
fi

count=$(ls "$out"/*.png 2>/dev/null | wc -l | tr -d ' ')
echo "shots: wrote $count screenshot(s) to $out"
[ "$rc" = 0 ] || echo "shots: NOTE partial refresh — $out has a coherent index but is missing the failed scene(s)" >&2

if [ "$commit" = 1 ]; then
  git add "$out" && echo "shots: staged $out (commit when ready)"
fi

# Exit reflects the capture outcome: a partial failure is non-zero even though the committed dir is
# now coherent, so the operator (and CI) see the run wasn't fully green.
[ -n "$pr" ] || exit "$rc"

# ── Attach to PR #$pr: push the PNGs to the dedicated `screenshots` side branch (never merged), then
#    post a gallery comment with SHA-pinned raw URLs, grouped from the run manifest. ───────────────
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
  # Group the gallery straight from the run manifest (catalog labels/groups) — no hand-kept list.
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const base = process.argv[2];
    const auth = a => (a === "in" ? "logged-in" : "logged-out");
    const byGroup = {};
    for (const s of m) (byGroup[s.group] ||= []).push(s);
    const out = [];
    for (const g of Object.keys(byGroup)) {
      out.push("### " + g, "");
      for (const s of byGroup[g]) {
        const star = s.focus ? "⭐ " : "";
        const cap = `${star}${s.label} — ${s.viewport} · ${auth(s.auth)}`;
        out.push(`**${cap}**`, "", `![${cap}](${base}/${s.file})`, "");
      }
    }
    process.stdout.write(out.join("\n"));
  ' "$out/manifest.json" "$base"
} > "$body"
gh pr comment "$pr" --body-file "$body"
rm -f "$body"
echo "shots: posted gallery to PR #$pr"
exit "$rc"
