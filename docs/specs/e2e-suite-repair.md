# Spec — Repair the e2e (Playwright) suite — restore a meaningful QA e2e gate

- **Status:** Ready for Development + QA & Review (test-infrastructure repair spec — no user-facing surface)
- **Owner:** Product
- **Issue:** #47 (`type: build`)
- **Inputs:** `docs/AGENT_OPERATING_MODEL.md` (the QA gate: each acceptance criterion → a passing
  test, Phase 4), `docs/ARCHITECTURE.md` (*Prototype phase* — the Node SSR e2e target, issue #37),
  `docs/VISION.md` (the core loop the suite exercises), and the suite itself.
- **Grounding code (read, repaired by Development/QA — not Product):** `playwright.config.ts` (the
  `yarn build && yarn start` Node SSR webServer, `chromium`-only project), and the three specs under
  `e2e/`: `core-loop.spec.ts`, `article-fidelity.spec.ts`, `topic-search.spec.ts`. Fixtures are
  **inline `page.route(...).fulfill(...)` stubs** inside each spec's `stubWikipedia(page)` helper —
  there is no separate fixtures directory.
- **Feeds:** Development (categorize → tighten locators → complete fixtures → document the contract),
  QA & Review (verify against the acceptance criteria below; own the green gate going forward). UX is
  **not** in this loop — this run changes no rendered UI.

---

## Problem

`yarn test:e2e` does **not** pass clean on `main`. The Playwright suite — the three specs above,
which exercise the core loop (find topic → read → watch & weigh → contribute) against the Node SSR
server — carries pre-existing failures from two kinds of **test debt**:

- **Strict-mode locator ambiguities** — locators that resolve to more than one element. Playwright
  runs strict by default, so a multi-match is a hard failure even when the assertion's intent is
  satisfiable. (The suite already works around this in places with `.first()` — e.g.
  `getByText("＋ General").first()` in `core-loop.spec.ts` — which is exactly the disambiguation
  pattern to extend, *not* a pattern to delete assertions.)
- **Incomplete fixture stubs** — the inline `route.fulfill` mocks for the Wikipedia (REST `page/html`,
  action `w/api.php`, REST `search/title`) and Wikidata (`wikidata.org`) APIs return shapes that omit
  fields the app actually reads. The Wikidata sitelink/QID and the action-API `pageprops.wikibase_item`
  stubs are present, but the contract is undocumented and not uniformly complete across the three
  specs, so title→QID and article-resolution flows can break when a spec's stub drifts from what the
  read path consumes (`pageid`/`title` at minimum).

Across the work tracked in #37 and #45, QA could therefore assert only *"no new e2e failures vs.
`main`"* — never a clean *"e2e passes."* That is the weakest possible form of the gate.

## Why it matters (project value)

The build loop's QA gate (Phase 4, `AGENT_OPERATING_MODEL.md`) maps **each acceptance criterion to a
passing test**. With the e2e suite red on `main`, the AC-by-e2e for the core loop is not meaningful:
QA cannot distinguish "this feature's change broke the loop" from "the loop was already red," and is
forced into verify-on-live deferrals. Repairing the suite restores a **real end-to-end gate before
the next feature build (C — Wikimedia OAuth)** — a green e2e run becomes a precondition a future
spec's ACs can actually lean on. The value is entirely internal/project-facing: a trustworthy gate,
not a new reader-facing capability.

## Scope

In order — discovery first, then the smallest repairs that make the gate honest:

1. **Discovery & categorize.** Run `yarn test:e2e` on a fresh `yarn install --frozen-lockfile`
   checkout of this branch. Enumerate every failure and label each as exactly one of:
   **(a) strict-mode locator ambiguity**, **(b) incomplete fixture-stub**, or **(c) genuine app bug**.
   Record the baseline failure count and the per-failure category in the PR description. This
   categorization is the spine of the run — every later step traces to a labeled failure.
2. **Tighten locators (category a).** Disambiguate with scoped roles, `.first()`, or more specific
   selectors so each locator resolves to one element **without weakening what is asserted** (see AC4
   and the test-debt boundary below).
3. **Complete the fixture stubs (category b).** Make the Wikipedia (REST `page/html`, action
   `w/api.php`) and Wikidata (`wikidata.org`) `route.fulfill` mocks return complete, realistic shapes —
   the fields the app reads (`pageid`/`title` at minimum) — so article + topic-resolution flows
   exercise real code paths rather than passing by accident. Keep stubs deterministic and inline (the
   sandbox has no network egress; that constraint is unchanged).
4. **Document the fixture contract.** Write down the response shape each route must return and which
   fields the app reads, in `e2e/` (e.g. a README or a shared header comment) or `docs/`, so future
   specs match the contract instead of rediscovering it. This is the durable artifact of the run.
5. **Split out, don't mask, any genuine app bug (category c).** Apply the decision rule below.

## The test-debt vs. genuine-app-bug boundary (decision rule)

This is the key product judgment of the run. State it crisply and apply it to every failure:

> **A failure is test debt only if the *test* is wrong while the *app* is right** — the app behaves
> correctly and the failure is an over-broad locator (a) or a fixture that under-feeds a correct read
> path (b). Repair those here.
>
> **A failure is a genuine app bug if the *app* is wrong** — the app does not do what its already-shipped
> acceptance criteria require, and a correctly-written test with a complete, realistic fixture still
> fails. In that case the e2e change in *this* run is **only** to make the test correct and complete;
> the app defect is **split out and filed as a separate `type: build` issue with a reference back to
> #47**, and is **never** silently fixed inside this run and **never** masked (no `.skip`, no
> `.fixme`, no assertion deleted, no fixture rigged to paper over wrong behavior).

Rationale: this run's deliverable is a *trustworthy gate*. Smuggling an app fix in defeats independent
verification (the fix ships without its own spec/QA loop); masking a real failure makes the gate lie.
Either way the gate stops meaning what AC1 says it means. If the failure count cannot reach zero
**without** an app-side change, that change is out of scope here — file it and note in the PR that the
suite is green modulo the split-out issue(s), each referenced.

## Acceptance criteria

1. **Clean pass on a cold checkout.** On a fresh `yarn install --frozen-lockfile` of this branch,
   `yarn test:e2e` exits **0 with 0 failures** (the configured `chromium` project, against the
   `yarn build && yarn start` Node SSR server per `playwright.config.ts`).
2. **All three specs pass with nothing masked.** `core-loop.spec.ts`, `article-fidelity.spec.ts`, and
   `topic-search.spec.ts` all pass with **no test `.skip`'d, `.fixme`'d, `test.only`'d, or otherwise
   excluded** to get there. (QA can verify by grepping the suite for `.skip`/`.fixme`/`.only` and
   confirming the run report counts the same number of tests as before, none skipped.) If reaching
   zero requires an app-side change, the app bug is **split out and filed as a separate issue
   referencing #47** (per the boundary rule) and the PR names it — the in-suite change for that
   failure is test-correctness only.
3. **Fixtures feed the read path + a documented contract exists.** Every fixture stub returns the
   fields the app actually reads — **`pageid` and `title` at minimum** for the title/QID/article
   resolution path, plus the Wikidata sitelink→title and `pageprops.wikibase_item` shapes the specs
   already rely on. A **documented fixture contract** lives in `e2e/` or `docs/`, listing per route
   (`wikidata.org`, `w/api.php`, `api/rest_v1/page/html`, `w/rest.php/v1/search/title`) the required
   response shape and the fields the app consumes. (QA verifies the doc exists and that each spec's
   stubs conform to it.)
4. **No loss of real coverage.** Locator fixes **disambiguate** (scope/`.first()`/specific selector) —
   they do **not** delete or weaken assertions, and the count of meaningful `expect(...)` assertions
   does not drop. A diff that removes an assertion to make a test pass fails this criterion. (QA
   reviews the diff: every change is traceable to a labeled discovery-phase failure, and each removed
   line is a genuine duplicate/ambiguity fix, never a coverage cut.)

## Out of scope

- **Net-new e2e coverage for unbuilt features** — auth/OAuth, curation-persistence UI, or any flow
  not already exercised by the three specs. This run repairs the existing suite; it does not grow it.
- **App-side fixes for genuine bugs** uncovered during discovery — those are split out per the
  boundary rule, not done here.
- **CI/pipeline changes beyond making `yarn test:e2e` green** — no new workflow, no gating-policy
  change, no new browser project. (Wiring the now-green suite into a required CI check is a separate,
  later Operations decision, not this run.)
- **Any rendered-UI change** — there is no UX surface in this run; if a UI change seems necessary it
  is, by definition, an app bug to split out.

## Success metric

The QA e2e gate can assert a **clean "e2e passes" criterion (0 failures)** for the core loop, instead
of only *"no new e2e failures vs. `main`."* Concretely: after this run, `yarn test:e2e` is green on
`main`, and the next feature spec (C — Wikimedia OAuth) can map its acceptance criteria onto a suite
that starts from zero — the first build to enter Phase 4 against a green baseline. Secondary signal:
a future spec author can read the committed fixture contract and write conformant stubs without
rediscovering the response shapes (zero "fixture drift" failures attributable to an undocumented
contract).

## Hand-off

- **Development:** execute Scope steps 1–4 — discovery/categorize, tighten locators, complete fixtures,
  document the contract. For any category-(c) failure, stop and file a separate issue per the boundary
  rule; do not fix app code in this run.
- **QA & Review:** verify AC1–AC4 with fresh eyes, confirm nothing is masked (grep for
  `.skip`/`.fixme`/`.only`), review the diff for coverage loss, and confirm the fixture-contract doc
  exists and the specs conform. Own the green gate going forward.
- **UX:** none — this run changes no rendered UI.
