# Spec: Persistence — `DataStore` → Postgres + Drizzle (shared, multi-user curations)

**Issue:** [#45](https://github.com/ragesoss/wikiplus/issues/45) · **Type:** build (infrastructure + data layer — no user-facing product feature) · **Status:** spec
**Owner:** Product · **Feeds:** UX (parity contract + the multi-user shared-state contract), Development (build), Operations (Postgres on the VPS) · **Verified by:** QA & Review + UX
**Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP, section **B**
**Builds on:** [#37](https://github.com/ragesoss/wikiplus/issues/37) (Node SSR server; Server Actions enabled), [#42](https://github.com/ragesoss/wikiplus/issues/42) (live on `wikiplus.wikiedu.org` via Docker Compose + Caddy, CI→GHCR→SSH deploy)
**Blocks / unblocks:** **C** (Wikimedia OAuth via Auth.js — needs the `account`/`contributor` tables this lands) and **D** (the curation-action product layer — needs a server write boundary to auth-gate and validate)

---

## Problem & intent

Today the `DataStore` is `localStorage` (`lib/data/local-store.ts`). Every visitor sees only their
**own browser's** curations; nothing is shared, nothing survives a different device or person, and
two readers of the same topic never see each other's work. So even though the prototype is now live
on a real server at `wikiplus.wikiedu.org` (#37 + #42), it is **not functionally "live"** — it is a
single-user demo that happens to be on the internet. A curation made on `wikiplus.wikiedu.org` in one
browser is invisible in the next.

This issue replaces the `localStorage` `DataStore` with **Postgres (via Drizzle ORM)** behind a
**server data-access boundary**, so the seeded topics and every curated clip live in **one shared
database** on the VPS. After this, everyone hitting `wikiplus.wikiedu.org` reads and contributes to
the **same data** — curations are shared, multi-user, and durable across devices, sessions, and
deploys.

This is the **foundation the rest of the Functional-prototype milestone sits on**: **C** (real
sign-in) needs the `account`↔`contributor` identity tables; **D** (the curation-action product layer)
needs a server-side write boundary to auth-gate, validate, and capture the CC BY-SA agreement against.
B lands the **mechanical** half — "everything that worked on localStorage now works on shared
Postgres" — and leaves the **product** half to D.

**The central architectural constraint is unchanged: the server still never calls Wikipedia.**
Title→QID resolution, the article body, the table of contents, and the live YouTube candidate search
**stay client-side**, exactly as today. This issue moves only **our own data** (topics, clips,
contributor, dismissals) server-side; it does **not** move any Wikipedia/Wikidata/YouTube integration
server-side.

### Decisions honored (from the issue — folded in by the owner; do not re-open)

1. **B routes BOTH reads and writes through a server boundary** (Server Actions or route handlers)
   backed by a `DrizzleDataStore` — as **mechanical store wrappers**. The existing curate / add /
   dismiss / upvote flows keep working unchanged, but now write to shared Postgres. This keeps B a
   coherent "everything that worked on localStorage now works on shared Postgres," and gives a clean
   B/D split.
2. **The product layer is D, not B.** Auth-gating the write boundary, server-side validation, the
   CC BY-SA 4.0 agreement capture, and any curation UX redesign are explicitly **out of scope here**.
3. **Real sign-in is C, not B.** B lands the `contributor`/`account` tables (Auth.js-adapter-shaped,
   so C is additive) but attributes interim writes to a **single stub "prototype" contributor**.
4. **No `article_index`, no ISR/Redis `cacheHandler`.** Those belong to the production read-path and
   stay deferred. The `topic` table carries display attributes only (no cached article data).
5. **Kept whole, not split.** Large but coherent single build, per the owner's decision in the issue.

---

## User value

The value is **shared, durable, multi-user curation** — the thing that turns the prototype from a
single-browser demo into a functionally-live site:

- **A reader on `wikiplus.wikiedu.org` sees real, accumulated curation** — the seeded topics, plus
  whatever anyone has curated — not an empty page or only their own browser's leftovers. This is the
  precondition for the core reader value (leave with 2–5 clips you're glad you watched, each with a
  context note that helps you weigh it): a curator's work has to reach *other* readers to matter.
- **A curator's contribution persists and is visible to others** — across their own devices, across
  sessions, across deploys, and to other people. Curation stops being throwaway.
- **The foundation for C and D is in place** — the identity tables and the server write boundary that
  real sign-in and the curation product layer build on, with no rework of the core data layer.

There is **no new reader-facing feature and no UX redesign** in B. The reader and curate experiences
must behave **identically** to today; the change is that the data is now shared and durable instead of
per-browser. (The home page's "data lives in your browser's local storage" note is the one visible
copy change — it is no longer true.)

---

## Scope

In scope (mirrors the issue's deliverables 1–8):

1. **Confirm the data-access mechanism (decided: a server boundary).** The `DataStore` is consumed
   client-side today; Postgres forces it server-side. Pick **Server Actions vs. route handlers** for
   the boundary and **record the decision in `docs/ARCHITECTURE.md`**. The boundary is a thin set of
   **mechanical wrappers** over the store — no product logic.
2. **Drizzle schema + migrations** for `topic`, `clip`, `contributor`, `account`, and
   `dismissed_candidate`, runnable on deploy. Schema shape per `docs/ARCHITECTURE.md` *Data model
   (initial)* and `lib/data/types.ts`:
   - `topic` — internal PK, `wikidata_qid` **unique**, `title`, `lang`, `description`, timestamps —
     **no `article_index`**.
   - `clip` — every field the current `Clip` type carries (media/creator/orientation,
     `general`+`sectionSlug`(+`sectionLabel`), `contextNote`, `stance`(+`stanceModifier`),
     `accuracyFlag`(+`accuracyModifier`), `upvotes`, `curatedBy`, `createdAt`), `topic_id` → topic.
   - `contributor` — internal PK, display fields, timestamps.
   - `account` — **Auth.js-adapter-shaped** (`provider`, `provider_account_id`,
     `unique(provider, provider_account_id)`, `contributor_id` → contributor) so C is additive.
   - `dismissed_candidate` — `topic_id` → topic, `provider`, `provider_video_id`, `contributor_id`,
     `unique(topic_id, provider, provider_video_id)` (the sticky-dismissal identity).
3. **`DrizzleDataStore`** implementing the **full `DataStore` interface** server-side, behind the
   `lib/data/index.ts` seam, and the sticky-dismissal persistence currently in
   `lib/candidates/dismissals.ts` (the `dismissed_candidate` write/read) moved behind the boundary so
   dismissals are shared/durable like clips.
4. **Server data-access layer + rewire all client call sites.** Rewire `app/page.tsx`,
   `app/contribute/page.tsx`, and `app/topic/TopicView.tsx` from in-browser `store.*` to the server
   boundary for **all DB reads and writes** (`listTopics`, `getTopic`, `getTopicByTitle`,
   `upsertTopic`, `listClips`, `listCandidates`, `addClip`, `updateClip`, `deleteClip`, and the
   dismissal write/read). **Title→QID, the article fetch, the TOC, and the live YouTube candidate
   search stay client-side** (`suggestCandidates`'s live pipeline reads the client-inlined YouTube key
   and runs in the browser — it is not a DB call and does **not** move to the server). No SSR
   hydration mismatch.
5. **Seed into the DB.** Port `lib/data/seed.ts` to a **server-side seed** (migration or script) so
   the prototype opens **non-empty for everyone**, and retire the per-browser `seedIfEmpty`
   localStorage path.
6. **Stand up Postgres on the VPS.** Enable the `postgres` service in
   `deploy/docker-compose.yml` (the commented block), add a `postgres_password` Docker secret, wire
   `DATABASE_URL` to the app, and apply migrations on deploy. Update `docs/ops/vps-setup.md`.
7. **Tests.** Cover `DrizzleDataStore` **without a live DB in CI** (pglite or a Postgres service
   container); carry forward the existing `DataStore` / `deriveStats` contract tests against the new
   store.
8. **Docs.** Update `docs/ARCHITECTURE.md` (the `DataStore` is now Drizzle/Postgres; the server
   data-access boundary; the read(server-DB) / write(server-DB) / client(Wikipedia) flow; the
   migration + seed approach) and `docs/ops/vps-setup.md` (Postgres bring-up + secret + migrations).

---

## Out of scope (explicit — route elsewhere)

- **Wikimedia OAuth / Auth.js — real sign-in (issue C).** B lands the `contributor`/`account` tables
  but attributes interim writes to a **single seeded "prototype" contributor** (or `null`/anonymous).
  → Development/Product on **C**.
- **The curation-action product layer (issue D)** — auth-gating the write boundary, server-side
  validation, the **CC BY-SA 4.0 agreement capture at submit time**, and any curation **UX redesign**.
  B's wrappers are mechanical; the policy/validation/agreement layer is D. → Curation/Editorial sets
  the standard; UX + Development build it in **D**.
- **ISR / Redis shared `cacheHandler`** and the production read-path caching. Still deferred.
  → Operations + Development, production-MVP.
- **`article_index`** (server-cached lead + section list). Not added — the server never fetches
  Wikipedia in B. → deferred with the server-side Wikipedia integration.
- **Moving Wikipedia / QID resolution / the YouTube candidate search server-side.** All stay
  client-side, unchanged. → deferred to the production read-path.
- **Cloudflare edge cache, Redis services in Compose.** → production-MVP (Operations).
- **Moderation tooling, rate-limit enforcement, the `vetted` review-hold workflow.** Policy is set
  in `docs/CURATION_STANDARD.md` §7; enforcement is later. → Curation/Editorial + Operations.

---

## Acceptance criteria

Each item is independently testable; QA maps each to pass/fail.

**Schema, store, and the boundary**

1. **AC1 — Schema + migrations apply cleanly.** Drizzle schema + migrations for `topic`, `clip`,
   `contributor`, `account`, and `dismissed_candidate` exist and apply cleanly to a fresh Postgres
   from zero (no manual SQL, no errors). The unique constraints hold: `topic.wikidata_qid` unique,
   `account (provider, provider_account_id)` unique, `dismissed_candidate (topic_id, provider,
   provider_video_id)` unique.
2. **AC2 — Schema matches the data model.** The `topic` table has **no `article_index`** column; the
   `clip` table carries every field on the current `Clip` type (`lib/data/types.ts`); the `account`
   table is Auth.js-adapter-shaped (so C can adopt it without a schema rewrite). QA confirms by
   inspecting the schema against `lib/data/types.ts` + `docs/ARCHITECTURE.md` *Data model (initial)*.
3. **AC3 — `DrizzleDataStore` passes the `DataStore` contract tests.** A `DrizzleDataStore`
   implements the **full** `DataStore` interface (`lib/data/store.ts`) and passes the carried-forward
   `DataStore` contract tests (the same behavioral tests the localStorage store passed), including the
   `deriveStats` derivation over a clip set.
4. **AC4 — One concrete store named at the seam.** `lib/data/index.ts` is the **only** place naming
   the concrete store, and it now selects `DrizzleDataStore` for the deployed app (the documented swap
   point). The chosen boundary mechanism (Server Actions vs. route handlers) is implemented and used.
5. **AC5 — Sticky dismissals persist through the DB.** Dismissing a candidate writes a
   `dismissed_candidate` row through the boundary (not browser `localStorage`); a dismissed candidate
   does **not** resurface on reload, in another session, or in another browser, matched by the
   `(topic_qid/​id, provider, provider_video_id)` identity.

**Call-site rewire + the client/server boundary**

6. **AC6 — All `store.*` DB reads and writes go through the server boundary.** Every DB read and write
   in `app/page.tsx`, `app/contribute/page.tsx`, and `app/topic/TopicView.tsx` goes through the server
   boundary — none touch a browser `DataStore` and none read the DB in the browser.
7. **AC7 — No DB access or `DATABASE_URL` in the client bundle.** The shipped client JS bundle
   contains **no** database driver, no Drizzle query code, and **no `DATABASE_URL`** (or any DB
   credential). Verifiable by inspecting the built bundle / a build-time check. (Contrast: the YouTube
   key is *intentionally* client-inlined — that is unchanged and not a regression.)
8. **AC8 — The server never calls Wikipedia.** Title→QID resolution, the article-body fetch, the TOC,
   and the **live YouTube candidate search** all still run **client-side**. No server code path issues
   a request to a MediaWiki / Wikidata / YouTube endpoint. (`suggestCandidates`'s live pipeline stays
   in the browser; only the seeded-fallback `listCandidates` and the persisted dismissals are DB-backed
   through the boundary.)
9. **AC9 — No SSR hydration mismatch / no new console errors.** The Topic page, home page, and
   contribute page render with **no React hydration mismatch warnings** and no new console errors,
   under SSR + client hydration.

**Shared, durable, multi-user behavior**

10. **AC10 — Seeded topics load from Postgres.** On the deployed app, the home topic list and a seeded
    Topic page (`Photosynthesis`, `Cellular respiration`, `Cat`) load their data **from Postgres**
    (the DB seed), **not** from a per-browser `localStorage` `seedIfEmpty`. The per-browser
    `seedIfEmpty` path is retired.
11. **AC11 — A curation is shared across browsers/sessions.** A clip curated (promoted / added by
    link) in one browser or session is **visible in another browser/session** on the same host, with
    no shared `localStorage` — proving the data is shared and persisted in Postgres. The infobox
    counts (videos/creators/curators) reflect the shared clip set.
12. **AC12 — Reader experience unchanged.** The reader and curate flows behave **identically** to
    today (read the article, watch & weigh clips with context notes + stance/accuracy chips, curate /
    add / dismiss / upvote) — same states, same copy except the now-false "data lives in your
    browser's local storage" home note, which is updated/removed.
13. **AC13 — Interim attribution to a stub contributor.** Until C, writes are attributed to a single
    seeded "prototype" contributor (or `null`/anonymous) — there is no real per-user identity, and no
    sign-in is introduced. The `account`↔`contributor` wiring exists in the schema, unused by writes.

**Operations + CI**

14. **AC14 — Postgres runs in the VPS Compose stack.** The `postgres` service is enabled in
    `deploy/docker-compose.yml` with a `postgres_password` Docker secret (not inline), the app's
    `DATABASE_URL` is wired to reach it, the app `depends_on` postgres, and a persistent `pgdata`
    volume is declared. No DB port is published to the internet (internal-only, like `app`).
15. **AC15 — Migrations apply on deploy.** The deploy pipeline applies migrations on deploy (the box
    never builds Next.js; migrations run as part of bring-up / a deploy step), so a push to `main`
    that changes the schema lands a migrated DB without a manual SSH step.
16. **AC16 — `DrizzleDataStore` is tested without a live DB in CI.** The store's tests run in CI
    (no network egress, no external DB) via **pglite** or a **Postgres service container** — green in
    the cloud/CI sandbox.
17. **AC17 — `yarn build` / `yarn typecheck` / `yarn test` all green.** The full local + CI check set
    passes.

**Docs**

18. **AC18 — `docs/ARCHITECTURE.md` updated.** It records: the `DataStore` is now Drizzle/Postgres;
    the chosen server data-access boundary (Server Actions vs. route handlers) and why; the
    read(server-DB) / write(server-DB) / client(Wikipedia) flow; and the migration + seed approach.
    The *Prototype phase* / *Deployment* sections no longer describe the prototype as localStorage /
    single-user for the deployed app.
19. **AC19 — `docs/ops/vps-setup.md` updated.** It documents Postgres bring-up: enabling the
    `postgres` service, creating the `postgres_password` secret, wiring `DATABASE_URL`, and applying
    migrations on deploy.

---

## Success metric

**Shared, multi-user persistence works on the live host, and B unblocks C/D.** Concretely:

- **Primary:** a curation created in one browser/session on `wikiplus.wikiedu.org` is visible in a
  **different** browser/session (AC11), and seeded topics load from Postgres (AC10) — the data is
  shared and durable, with **no per-browser `localStorage`** for app data. This is the binary
  "the prototype is functionally live for more than one user" check.
- **Secondary (parity):** the reader/curate experience is unchanged (AC12), no SSR hydration errors
  (AC9), and the server still never calls Wikipedia (AC8) — i.e. we gained shared persistence without
  regressing the read path or the client-side Wikipedia/YouTube architecture.
- **Foundational:** the `contributor`/`account` tables and the server write boundary exist (AC2, AC4,
  AC13), so **C** (auth) and **D** (the curation product layer) build on them additively — no rework
  of the data layer.

A future Analytics role would instrument curation volume and distinct-contributor counts on the
shared DB; for B, the success check is the manual two-browser test above (AC10 + AC11), not a metric
pipeline.

---

## Hand-off

- **UX:** B is a **parity + multi-user contract**, not a redesign — there are **no new flows** and no
  visual change beyond the home page's now-false "data lives in your browser's local storage" copy.
  UX produces the parity contract (the reader/curate experience is byte-for-byte the same) **plus the
  multi-user shared-state contract** (what "shared across browsers" must look like to a reader: another
  person's curation simply appears; no per-user empty state). UX evaluates the built UI against AC9 +
  AC12.
- **Development:** build deliverables 1–8 above against these acceptance criteria — Drizzle schema +
  migrations, `DrizzleDataStore`, the server boundary (pick Server Actions vs. route handlers and
  record it), the call-site rewire (reads **and** writes, keeping Wikipedia/YouTube client-side), the
  DB seed, Postgres in the VPS Compose stack + `DATABASE_URL` + deploy migrations, and the tests
  (pglite / service container). Hand off to QA & Review.
- **Operations:** stand up Postgres on the VPS (AC14, AC15, AC19) — enable the service, create the
  secret, wire `DATABASE_URL`, apply migrations on deploy.
- **QA & Review:** verify each AC1–AC19 pass/fail with fresh, non-author eyes, plus the standard
  security review (no DB credential in the client bundle is AC7; the boundary is the only DB access
  path).
