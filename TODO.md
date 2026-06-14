# wiki+ — TODO

Pending tasks not yet started. Remove items as they're done.

## Topic Page v2 — next round (Topic Page v1 shipped 2026-06-14)

Topic Page v1 shipped via the first real `/build-loop` run — the curated **and** empty Indigo Press
two-world Topic page, live on GitHub Pages (Pages run #14 green on `main@febb4d5`). Artifacts:
`docs/specs/topic-page-v1.md`, `docs/design/topic-page-v1.md`, `docs/CURATION_STANDARD.md`, the test
harness (`test/`, `e2e/`, 127 passing). AC1–AC23 GREEN; no high-sev security finding. Next round:

- **Two live-browser human checkpoints** (couldn't be verified headlessly in the cloud build): on the
  live site, confirm (1) in-app wikilink nav *feel* — click an article link, no full reload, title URL
  with no `qid=` in the bar; (2) the `404.html` SPA boot for an **unseeded** title (e.g.
  `/wikiplus/topic/Aardvark/`) renders the shell cleanly (no visible 404 flash) and reads the title
  from the path.
- **Run the Playwright e2e in CI** (`yarn test:e2e` with `npx playwright install chromium`) — it can't
  run in the cloud sandbox; wire it into a workflow so the scroll-sync + wikilink-nav e2e actually executes.
- **Deferred scope from the v1 spec:** live YouTube auto-suggestion (the `NEXT_PUBLIC_YOUTUBE_API_KEY`
  no-op-when-unset path), TikTok auto-suggestion, real write/curation **persistence + Auth.js gating**
  (Promote/Add/dismiss are mock UI this round), phrase/span-level anchoring (section-level today),
  "see all"/pagination, Instagram/Vimeo + real oEmbed, and the production read-path (SEO/ISR/Redis/
  Server Actions). Topic search/discovery box.
- **Carried defects/deviations:** D3 — rail mini-TOC (design §10.5) was omitted; D4 — article tables
  are CSS-hidden (`display:none`), which silently drops real data on table-heavy articles — render them
  instead of hiding next round.

## Later — harden build-loop enforcement (optional)
- The `/build-loop` skill enforces the pipeline by *ordered, gated delegation the orchestrator follows*.
  What no skill can force is a fresh orchestrator choosing to invoke it and not wear hats in the first
  place. If that slips again, consider a structural backstop: a `Stop`/pre-push **hook** that blocks a
  feature commit lacking a spec/design/QA artifact, or an **Agent-SDK** cloud agent that holds the
  pipeline in code. Both are heavier than the prototype needs today — note, don't build yet.
