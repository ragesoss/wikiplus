#!/usr/bin/env bash
# worktree.sh — the ONE standard way to make a build worktree for wiki+.
#
#   worktree.sh new <name> [base]   create .claude/worktrees/<name> on a new branch <name>
#                                   (from [base], default the current HEAD), symlink node_modules
#                                   from the main checkout, and print the worktree's ABSOLUTE path
#   worktree.sh rm  <name>          remove that worktree (and delete its branch if merged/unused)
#   worktree.sh list                list all worktrees
#   worktree.sh path <name>         print the absolute path of .claude/worktrees/<name>
#
# WHY a fixed location under the repo: `.claude/worktrees/<name>` lives INSIDE the already-trusted
# project root, so Read/Write/Grep into it never trip a permission prompt — no per-worktree
# `Read(//…/**)` grant, ever. (A sibling worktree like `../wikiplus-issue-N` is outside the root and
# prompts on every access.) `.claude/worktrees/` is gitignored, so the parent repo never tracks it.
# Parallel-safe by construction: one subdir + one branch per build.
#
# WORKING IN THE WORKTREE: treat the printed path as your cwd — do NOT prefix commands with
# `cd <worktree> && …` (a compound `cd` to a non-cwd path defeats the allowlist and prompts every
# call). When a tool resolves a NEW file path, give it the worktree-ABSOLUTE path (a subagent's Write
# has resolved new files to the main repo root otherwise).
#
# Fixed verbs, no arbitrary shell passthrough → safe to allowlist in .claude/settings.json. Invoke
# directly (`scripts/dev/worktree.sh …`), never wrapped in `bash` (that re-routes the allowlist match
# to `bash`). See scripts/dev/README.md.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "worktree: not inside a git repo" >&2; exit 1; }
wt_dir="$root/.claude/worktrees"

usage() { sed -n '2,16p' "$0"; }

# Validate a worktree/branch name: a single path segment, no slashes or shell-significant chars, so it
# can never escape .claude/worktrees/ or inject into git args.
valid_name() { [[ "$1" =~ ^[A-Za-z0-9._-]+$ ]]; }

cmd="${1:-}"; shift || true
case "$cmd" in
  new)
    name="${1:-}"; base="${2:-HEAD}"
    [ -n "$name" ] || { echo "worktree new: missing <name>" >&2; usage; exit 2; }
    valid_name "$name" || { echo "worktree new: invalid name '$name' (use [A-Za-z0-9._-])" >&2; exit 2; }
    dest="$wt_dir/$name"
    if [ -e "$dest" ]; then echo "worktree new: '$dest' already exists" >&2; exit 1; fi
    mkdir -p "$wt_dir"
    # Reuse an existing branch of this name if present; otherwise create it from <base>.
    # git's own progress ("Preparing worktree…", "HEAD is now at…") goes to stderr so the ONLY thing
    # on stdout is the final absolute path below — safe to capture as `p=$(worktree.sh new …)`.
    if git -C "$root" show-ref --verify --quiet "refs/heads/$name"; then
      git -C "$root" worktree add "$dest" "$name" >&2 || exit 1
    else
      git -C "$root" worktree add "$dest" -b "$name" "$base" >&2 || exit 1
    fi
    # Symlink node_modules from the main checkout (same repo + shared lockfile → fast, no reinstall).
    # If this branch CHANGES dependencies, replace the symlink with a real `yarn install` in the worktree.
    if [ -d "$root/node_modules" ] && [ ! -e "$dest/node_modules" ]; then
      ln -s "$root/node_modules" "$dest/node_modules"
    fi
    echo "$dest"
    ;;
  rm|remove)
    name="${1:-}"
    [ -n "$name" ] || { echo "worktree rm: missing <name>" >&2; exit 2; }
    valid_name "$name" || { echo "worktree rm: invalid name '$name'" >&2; exit 2; }
    dest="$wt_dir/$name"
    git -C "$root" worktree remove --force "$dest" || exit 1
    # Best-effort branch cleanup (only if fully merged; -d, never -D, so unmerged work is preserved).
    git -C "$root" branch -d "$name" 2>/dev/null && echo "deleted merged branch $name" || \
      echo "kept branch $name (unmerged or in use) — delete with: git branch -D $name"
    ;;
  list|ls)
    git -C "$root" worktree list
    ;;
  path)
    name="${1:-}"
    [ -n "$name" ] || { echo "worktree path: missing <name>" >&2; exit 2; }
    valid_name "$name" || { echo "worktree path: invalid name '$name'" >&2; exit 2; }
    echo "$wt_dir/$name"
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    echo "worktree: unknown command '$cmd' (see --help)" >&2; exit 2
    ;;
esac
