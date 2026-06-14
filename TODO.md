# wiki+ — TODO

Pending tasks not yet started. Remove items as they're done.

## Rebuild prototype-v1 through the role pipeline
- **What:** redo the full Indigo Press topic page (the 10-feature build) via Product → UX → Dev → QA,
  not inline — the **first real test of the `/build-loop` skill** (`.claude/skills/build-loop/`). Start
  from a fresh Product spec + UX design spec.
- **Reference only:** the rolled-back implementation is preserved on
  `origin/claude/todo-prototype-build-ob23be` (with the empty-state work). Treat it as a sketch to
  learn from, not code to cherry-pick.
- **Kickoff prompt** — paste into a fresh cloud session (orchestrator on Opus):

```
Rebuild the wiki+ Topic page through the build-loop — the first real run of the /build-loop skill.
Invoke it (it should also auto-trigger).

Target: the curated Indigo Press Topic page specified in docs/TOPIC_PAGE_DESIGN.md (reference
mockups: mockups/inline-indigo-sync.html for the curated state, inline-indigo-empty-v2.html for the
empty state). Build it the wiki+ way — client-side SPA over the lib/data/ DataStore seam, deployed to
GitHub Pages.

Scope: let Product scope and sequence from the design doc; don't pre-decide the feature list. If the
full page is too large for one autonomous pass, build the coherent core first (article render +
curated clips with context notes + the empty state) and report what remains for the next round.

Guardrails:
- You are the orchestrator on Opus. Delegate every stage to the role subagents; do not wear hats.
- Full autonomy: drive from this prompt to a live GitHub Pages deploy in one go — I'm offline /
  intermittent. My checkpoint is the live site; git is the rollback net. Don't pause for approval;
  make reasonable product assumptions and record them for Product.
- Don't ship red: if QA/UX can't go green within the bounded fix rounds, stop and report BLOCKED.
- Reference only, do NOT cherry-pick code: the rolled-back v1 is on
  origin/claude/todo-prototype-build-ob23be — a sketch, not source.
- YouTube search (if in scope): the key reaches the deploy via the YOUTUBE_API_KEY Actions secret
  (NEXT_PUBLIC_YOUTUBE_API_KEY in the build). Local/cloud builds have no key, so the search path must
  no-op gracefully when it's unset.
```

## Later — harden build-loop enforcement (optional)
- The `/build-loop` skill enforces the pipeline by *ordered, gated delegation the orchestrator follows*.
  What no skill can force is a fresh orchestrator choosing to invoke it and not wear hats in the first
  place. If that slips again, consider a structural backstop: a `Stop`/pre-push **hook** that blocks a
  feature commit lacking a spec/design/QA artifact, or an **Agent-SDK** cloud agent that holds the
  pipeline in code. Both are heavier than the prototype needs today — note, don't build yet.
