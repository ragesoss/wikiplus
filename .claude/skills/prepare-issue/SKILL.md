---
name: prepare-issue
description: This skill should be used when the owner wants to prepare, draft, scope, or file a build-task issue for wiki+ — e.g. "prepare an issue for X", "draft a build task", "groom this idea into an issue", "turn this into a ready issue", or "file an issue for …". It drafts a well-scoped build-task issue from a rough idea, grounded in the project docs, then SHOWS it for approval and posts to GitHub only after the owner approves.
---

# wiki+ prepare-issue — draft a build-ready issue, approve, then post

Turn a rough idea into a **well-scoped build-task issue** that the `/build-loop` can pick up and run
reliably. The issue is the unit of work (one issue = one build-loop run), so scoping it well here is
what makes autonomous, cloud kick-off simple and predictable later.

## The hard rule — approve before posting

**Draft → show → get explicit approval → only then post.** Never run `gh issue create` (or otherwise
publish) before the owner has seen the **full drafted issue in the conversation** and approved it.
Present the draft, take edits, iterate, and post only on an explicit "yes / post it / approved." No
approval → no posting. This gate is the whole point of the skill: deciding what's worth building, and
how it's framed, is the owner's call.

## How to work

1. **Ground first.** Read what the issue must align with: `docs/VISION.md`, `docs/ARCHITECTURE.md`,
   `docs/TOPIC_PAGE_DESIGN.md` (+ `mockups/`) for the relevant area. Run `gh issue list` to avoid
   duplicating an open one.
2. **Clarify sparingly.** Ask at most **1–2 crisp questions** only if the idea is genuinely
   underspecified; otherwise draft with reasonable assumptions and record them under *Notes*. (Mobile
   sessions: fewer questions, explicit assumptions — the approval step catches the rest.)
3. **Draft the build-task fields** — match `.github/ISSUE_TEMPLATE/build-task.yml`:
   - **Outcome / intent** — what's true when done; the problem + user value, *not* the implementation.
   - **References** — the exact `docs/` sections + mockups the loop should ground itself in.
   - **Work outline & deliverables** — what the session does *and produces*: include any
     **discovery/decision** step before building, and the **doc updates** that capture design/architecture
     decisions (e.g. recording the decision in `docs/ARCHITECTURE.md`), not just code. Most build tasks
     are not code-only.
   - **In scope** / **Out of scope** — one coherent build; the out-of-scope list keeps the run focused
     and the merge small.
   - **Done when** — testable acceptance hints (these feed Product's acceptance criteria).
   - **Notes / assumptions / open questions** — surface tensions and unknowns for Product to resolve,
     rather than inventing answers.
4. **Check the scope.** Is it *one* build, small enough for a single autonomous run? If it's really
   several, propose splitting into multiple issues (or a sequence) instead of one sprawling task. Name
   dependencies. If it isn't an implementation task at all, suggest filing it as `bug` / `feedback` /
   `idea` instead of forcing a build task.
5. **Present for approval.** Show the full **title + body + proposed labels** in the conversation and
   ask the owner to approve, edit, or discard. Iterate on their feedback until they approve.
6. **Post on approval only.** `gh issue create --label "type: build" --body-file -` with the approved
   body; report the issue **number + URL**.

## Readiness is the owner's sign-off — never yours

A build session picks up an issue only when it is `type: build` **+ `status: ready`** (see *Issue
pipeline* in `docs/AGENT_OPERATING_MODEL.md`). **Recommend** whether the issue looks build-ready, but
**never apply `status: ready` yourself** — that label is the owner's deliberate go-ahead, and
self-applying it would defeat the pickup gate. File as `type: build` (backlog); if you judge it ready,
say so and let the owner add `status: ready`. If it isn't ready, list exactly what's missing.
