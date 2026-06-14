# wiki+ — TODO

Pending tasks not yet started. Remove items as they're done.

## Build the core build-loop workflow (Bootstrap step 3)
- **What:** a deterministic workflow that runs the role pipeline — Product spec → UX (design spec) →
  Dev → QA & Review + UX evaluation → Ops — by **delegating each stage to the matching `.claude/agents/`
  subagent**, with the committed artifact as each hand-off. Explicit goal: the **completely-cloud,
  mobile-drivable cycle from a prompt to an updated staging (GitHub Pages) deployment**. Pin per-role
  models (orchestrator on Opus).
- **Why:** the roles exist as files but nothing enforces the sequence; the 2026-06-14 cloud session
  built the prototype solo and skipped QA/UX as a result (rolled back). This workflow is the
  enforcement mechanism behind the hard rule in `CLAUDE.md`. See `docs/AGENT_OPERATING_MODEL.md`
  → *Lesson from 2026-06-14*.

## Rebuild prototype-v1 through the role pipeline
- **What:** redo the full Indigo Press topic page (the 10-feature build) via Product → UX → Dev → QA,
  not inline — also the first real test of the build-loop workflow above. Start from a fresh Product
  spec + UX design spec.
- **Reference only:** the rolled-back implementation is preserved on
  `origin/claude/todo-prototype-build-ob23be` (with the empty-state work). Treat it as a sketch to
  learn from, not code to cherry-pick.
