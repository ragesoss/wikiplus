# wiki+ — TODO

Pending tasks not yet started. Remove items as they're done.

## Rebuild prototype-v1 through the role pipeline
- **What:** redo the full Indigo Press topic page (the 10-feature build) via Product → UX → Dev → QA,
  not inline — the **first real test of the `/build-loop` skill** (`.claude/skills/build-loop/`). Start
  from a fresh Product spec + UX design spec.
- **Reference only:** the rolled-back implementation is preserved on
  `origin/claude/todo-prototype-build-ob23be` (with the empty-state work). Treat it as a sketch to
  learn from, not code to cherry-pick.

## Later — harden build-loop enforcement (optional)
- The `/build-loop` skill enforces the pipeline by *ordered, gated delegation the orchestrator follows*.
  What no skill can force is a fresh orchestrator choosing to invoke it and not wear hats in the first
  place. If that slips again, consider a structural backstop: a `Stop`/pre-push **hook** that blocks a
  feature commit lacking a spec/design/QA artifact, or an **Agent-SDK** cloud agent that holds the
  pipeline in code. Both are heavier than the prototype needs today — note, don't build yet.
