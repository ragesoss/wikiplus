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
6. **Post on approval.** `gh issue create --label "type: build" --body-file -` with the approved body
   (add `--label "status: ready"` per the readiness default below); report the issue **number + URL**
   and state whether you marked it ready.

## Readiness — default to build-ready when the description is complete

Nothing auto-picks issues, so `status: ready` is an **organizational signal, not a safety gate**.
**Default to marking an issue `status: ready`** (apply the label at post time alongside `type: build`)
whenever its description is **sufficiently complete to be worked on** — clear outcome, scoped work
outline, and no blocking unknowns.

**Leave `status: ready` off** (file as `type: build` backlog) only when the issue genuinely isn't ready
to start, e.g.:
- it **depends on another unbuilt issue** (build that one first),
- it needs an **external or owner action first** (a credential, an OAuth consumer registration, a
  product/design decision the owner must make), or
- it has **open questions that block the work** (vs. minor assumptions recorded under *Notes*).

When you leave it off, say **exactly what's missing**. Either way, tell the owner which you did and
why — and they can always flip the label.

## Tag cloud-optimal builds

Cloud build sessions run in a sandbox: **far fewer permission prompts** (free rein for terminal
commands), so they're much faster — but they have **no general-purpose internet access** and **no
browser** (no screenshot generation, no browser-based / Playwright e2e testing). Local sessions have the
browser + internet but prompt for many commands.

When filing, **assess whether the build is cloud-optimal** and, if so, add the **`env: cloud-optimal`**
label. **Be permissive.** A **screenshot / gallery refresh is always deferrable** to a later local pass,
so **needing one does not, by itself, disqualify** an issue — UI work whose correctness is
unit/component-testable is still cloud-optimal (build in cloud, refresh the screenshots locally
afterward).

**NOT cloud-optimal (omit the label) only when the build needs:**
- **The general internet** — building or testing against **live external APIs** (Wikipedia/Wikidata,
  YouTube/TikTok oEmbed/embeds, OAuth provider endpoints) rather than mocked / seeded data.
- **A real browser to verify correctness** — interaction-heavy client behavior that unit/component
  tests can't reasonably cover (focus management/traps, drag, scroll-sync, autoplay, intersection-
  driven behavior, modal semantics), or work that is **fundamentally visual-design iteration** (a
  redesign you can't do well without seeing it render). A deferrable screenshot refresh is *not* this.

State which you decided and why — a one-line rationale in *Notes* when it isn't obvious.
