# Spec: Drop `output:'export'` — run wiki+ as a Next.js Node SSR server

**Issue:** [#37](https://github.com/ragesoss/wikiplus/issues/37) · **Type:** build (infrastructure / runtime — no user-facing UI change) · **Status:** spec
**Owner:** Product · **Feeds:** UX (parity contract — no new flows), Development (build) · **Verified by:** QA & Review + UX
**Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP, section **A, item 1 (A.1)**
**Builds on:** [#13](https://github.com/ragesoss/wikiplus/issues/13) (bare-path redirect), [#23](https://github.com/ragesoss/wikiplus/issues/23) (title-route canonicalization), [#11](https://github.com/ragesoss/wikiplus/issues/11) (slug encoding)
**Blocks / unblocks:** the rest of the Functional-prototype milestone — A.2 (host pick + provisioning + auto-deploy), B (Drizzle `DataStore`), C (Wikimedia OAuth via Auth.js), D (curation Server Actions)

---

## Problem & intent

wiki+ ships today as a **static export** (`output:'export'`) to GitHub Pages, with `localStorage`
standing in for a server. That was the right call for the prototype: it exercises the read + curate
UX and the data model with **no infra to operate**, and it auto-deploys from a mobile-drivable cloud
loop. But the static export is a hard ceiling on the next milestone. The Functional-prototype MVP
(#35) requires **real login** (Wikimedia OAuth via Auth.js) and **real multi-user curation writes**
(Server Actions) — both of which require a **running Node server**, not a pile of static files. A
static export cannot run Server Actions, cannot hold a session, and forces the `dynamicParams = false`
+ `404.html`-as-SPA-shell workaround for any Topic title that wasn't pre-built at deploy time.

This issue makes the **foundational runtime switch**: drop `output:'export'` and run wiki+ as a real
**Next.js App Router Node SSR server** — `next build` produces a server build, `next start` serves it,
and an unknown Topic title renders **on demand server-side** instead of via the `404.html` trick. It
is the gate every later milestone item (B, C, D) sits behind.

This is an **infrastructure/runtime change with no user-facing product feature.** The reader
experience must behave **identically** to today.

### Decisions honored (resolved 2026-06-16, owner sign-off — do not re-open)

1. **Drop `output:'export'` → yes.** A Node SSR server is the milestone premise.
2. **Atomic #37, with the GitHub Pages auto-deploy PAUSED as part of this issue.** This change is
   **verified locally and NOT live-deployable by design.** Pausing `.github/workflows/deploy.yml` is
   **in scope here** so `main` stays honest after the export is dropped (a push must not run a
   `yarn build` that no longer emits `out/` and publish a broken/empty Pages artifact). The host pick
   is the separate **next** issue (A.2).
3. **Host + DB → committed self-hosted VPS + Docker Compose + Caddy + Cloudflare.** Provisioning and
   re-enabling auto-deploy against that host is **A.2, not this issue.**

---

## User value

The user value here is **foundational + parity-preserving**, not a new reader-facing feature.

- **Foundational (unblocks the milestone).** A real Node server is the single prerequisite that makes
  the rest of the Functional-prototype milestone buildable: persistence (B), login (C), and real
  curation writes (D) all require a running server with Server Actions. After this lands, those become
  buildable work instead of blocked work.
- **Simpler, more correct routing.** With a server rendering unknown titles on demand, the
  static-export workarounds (`dynamicParams = false`, the `404.html`-is-`not-found.tsx` SPA-shell
  trick, the `deploy.yml` coupling to it) stop earning their keep. Removing them reduces the surface
  area future work has to reason about.
- **Parity — the reader notices nothing.** The whole point of the prototype's UX (a reader leaves with
  2–5 clips they're glad they watched and understands how to weigh each) must survive the switch
  untouched. Article body, TOC, QID resolution, candidate search, and the `localStorage` `DataStore`
  behave **exactly as today.** "Success" for the reader is the *absence* of any observable change.

---

## Scope

In scope for #37:

1. **`next.config` — drop the static export.** Remove `output:'export'`; `next build` produces a
   **server build**, not a static `out/`. Reassess the export-only concessions:
   - Keep **`basePath` env-driven** (`NEXT_PUBLIC_BASE_PATH`) so the current Pages subpath and a
     future root-domain host both work; its final value waits on the host pick (A.2).
   - Reassess `images.unoptimized`, `trailingSlash`, and the `assetPrefix` coupling — keep, drop, or
     simplify each, and **document what changed and why** (in the doc update and the spec/PR).
   - `outputFileTracingRoot` stays (it pins the workspace root for tracing).
2. **Routing simplification.** With a server, render unknown titles on demand: set `dynamicParams =
   true` (or drop the constraint) on the Topic catch-all (`app/topic/[[...slug]]/page.tsx`); keep
   `generateStaticParams` only where it still earns its keep. Remove the `404.html`-is-`not-found.tsx`
   SPA-shell trick and the `deploy.yml` coupling to it.
3. **`#23` canonicalization + `#13` bare-path redirect keep working.** Title-route canonicalization
   (URL/heading split, redirect-following, `router.replace` to canonical, no loop) and the bare-path
   `/<Title>` → `/topic/<Title>/` redirect both keep behaving as they do today. The bare-path redirect
   **stays client-side this round** (recommended; the server-side-HTTP-redirect version is deferred).
4. **SSR-safe client data access.** The `localStorage` `DataStore` and all `NEXT_PUBLIC_*` reads stay
   **client-only** — no server-side `localStorage` access, no hydration mismatch. The app renders and
   behaves identically to today across all states (empty / loading / error / populated).
5. **Enable — not build — Server Actions.** Confirm the runtime supports Server Actions for the later
   items (B–D). Add **no** product write-flow. A throwaway smoke action (or a documented confirmation
   that one runs) is sufficient evidence; it is removed or clearly marked as a smoke artifact and ships
   no reader-facing behavior.
6. **Test harness.** Playwright e2e **builds + serves the Node server** (`next build && next start`)
   instead of building the export and serving `out/`. Vitest units carry forward unchanged.
7. **Pause the Pages auto-deploy.** `.github/workflows/deploy.yml` no longer auto-publishes to GitHub
   Pages on push to `main`. (Re-enabling auto-deploy against the VPS host is A.2.)
8. **Docs.** Update `docs/ARCHITECTURE.md`: the prototype now runs as a Node SSR server; which
   static-export workarounds were removed/simplified; the new run/test commands. Touch *Prototype
   phase*, *Routing*, and *Path to production* at minimum.

---

## Out of scope (explicit)

Mirrors the issue and the parent epic. Out of scope for #37:

- **Picking / provisioning the host + DB, and the auto-deploy-from-`main` pipeline** (#35 A.2 /
  decision #1). This change is **verified locally, not deployed.** A.2 provisions the committed
  self-hosted VPS + Docker Compose + Caddy + Cloudflare stack and restores auto-deploy against it.
- **Drizzle schema / `DrizzleDataStore`** (#35 B). The `localStorage` `DataStore` stays in place; the
  swap point (`lib/data/index.ts`) is untouched.
- **Wikimedia OAuth / Auth.js** (#35 C). Auth stays stubbed; reading stays anonymous.
- **Any curation Server Actions / write-flows** (#35 D). Server Actions are *enabled as a capability*
  here, not *used* for any product behavior.
- **ISR / Redis `cacheHandler` / Cloudflare edge**, server-side `article_index`, real oEmbed embeds,
  and moving the YouTube **search** server-side — all production-MVP, deferred in #35. The prototype
  renders per request.
- **Moving article / QID / candidate logic server-side.** #35's server boundary holds: the server
  **never talks to Wikipedia.** Title→QID, the article body, the TOC, and the YouTube candidate search
  all stay client-side, exactly as today.
- **Moving the bare-path redirect server-side.** Recommended deferral — keep the client-side redirect
  behavior this round; the server-side-HTTP-redirect version comes with the production read-path.
- **Secrets / env wiring for the new host** (`AUTH_SECRET`, Wikimedia consumer key/secret,
  `DATABASE_URL`) — A.2 and later. The existing `NEXT_PUBLIC_YOUTUBE_API_KEY` behavior is unchanged
  (unset in local/CI → search no-ops, as today).

---

## Acceptance criteria

Each item is individually testable; QA maps each to pass/fail.

1. **No static export.** `next.config` no longer sets `output:'export'`. `next build` produces a
   **server build** (`.next/` server output), **not** a static `out/` export — no `out/` directory is
   emitted by the build.
2. **Server serves the app.** `next start` (after `next build`) serves the app and the seeded Topic
   pages (e.g. `/topic/Photosynthesis/`) render correctly through the running server.
3. **Unknown titles render on demand server-side.** An arbitrary `/topic/<Title>/` that is **not** in
   `generateStaticParams` (e.g. a never-seeded title) renders on demand from the running server — with
   **no `404.html` trick** and **no `dynamicParams = false` constraint** blocking it. (Resolution of
   that title against Wikipedia still happens client-side, per the server boundary; the criterion is
   that the route is served on demand rather than 404'd.)
4. **`#23` canonicalization still works.** Arriving at a typed/pasted `/topic/<typed>/` still
   canonicalizes the URL and heading: redirect-following (`jfk` → `John F. Kennedy`), the
   canonical-title-vs-display-title split, the `router.replace` to the canonical slug, and **zero**
   replaces on an already-canonical arrival (no loop, no history churn) — all behave as today.
5. **`#13` bare-path redirect still works.** A bare single-segment path (e.g. `/San_Francisco`) still
   redirects to `/topic/<Title>/`, lands directly in the loading state (never the "Topic not found."
   flash), preserves query + hash, and respects the reserved-prefix allowlist — behaving as today. The
   redirect remains **client-side** this round.
6. **Reader experience identical — no hydration mismatch / no console errors.** Article body, TOC, QID
   resolution, and candidate search behave identically to today, and the `localStorage` `DataStore`
   reads/writes behave identically. There is **no hydration mismatch and no console error/warning**
   across the **empty, loading, error, and populated** Topic states. (`NEXT_PUBLIC_*` reads and
   `localStorage` access stay client-only — no server-side `localStorage`.)
7. **Server Actions are an available capability.** A throwaway smoke Server Action runs successfully
   on the server (or a documented confirmation demonstrates Server Actions execute) — proving the
   capability is available for B–D. **No** product write-flow is added by this change.
8. **`yarn build` green.** `yarn build` completes successfully and produces the server build.
9. **`yarn typecheck` green.** `yarn typecheck` passes with no errors.
10. **`yarn test` green.** `yarn test` (Vitest units/components) passes.
11. **`yarn test:e2e` green against the Node server.** The Playwright harness builds + serves the
    **Node server** (`next build && next start`, not `serve -s out`) and the core-loop e2e specs pass
    against it.
12. **Pages auto-deploy paused.** `.github/workflows/deploy.yml` **no longer auto-publishes to GitHub
    Pages** on push to `main` (the push-triggered Pages publish is disabled/removed). Pushing to `main`
    does not attempt a static-export Pages deploy. (Re-enabling auto-deploy against the VPS is A.2.)
13. **`docs/ARCHITECTURE.md` updated.** The doc reflects that the prototype now runs as a Node SSR
    server, names which static-export workarounds were removed/simplified (and what `next.config`
    concessions changed and why), and gives the new run/test commands — touching at least the
    *Prototype phase*, *Routing*, and *Path to production* sections so the doc stops describing a static
    export as the current state.

---

## Success metric

This is a **foundational** change; success is measured by *what it unblocks* and *what it preserves*,
not by a reader-facing metric.

- **Unblocks the milestone (primary).** After this lands, the next Functional-prototype items become
  buildable rather than blocked: **A.2** (host provisioning + auto-deploy), **B** (Drizzle
  `DataStore`), **C** (Auth.js / Wikimedia OAuth), and **D** (curation Server Actions). Concrete
  evidence: Server Actions execute on the server (AC7), so the C/D write-path has a runtime to target.
- **Parity preserved (gating).** The reader experience is **observably unchanged** — every reader-path
  acceptance criterion (AC2–AC6) passes, with no hydration mismatch and no console errors across all
  Topic states. A change that unblocks the milestone but regresses the reader experience has **not**
  succeeded.
- **`main` stays honest.** After merge, a push to `main` does **not** publish a broken/empty Pages
  artifact (AC12) — the repo remains in a true state (runnable Node server, deliberately not
  auto-deployed) until A.2 wires the new host.

---

## Hand-off

- **UX** — no new user stories or flows. UX's job here is a **parity contract**: confirm the built
  Node-SSR app is observably identical to the current static-export app across the empty / loading /
  error / populated Topic states (AC6), with no hydration flicker or console noise. There is no new
  layout or visual design to produce.
- **Development** — build to the Scope + Acceptance criteria above: drop `output:'export'`, simplify
  routing (`dynamicParams`, remove the `404.html` SPA-shell trick), keep `#13`/`#23` working
  (bare-path redirect stays client-side), keep `localStorage`/`NEXT_PUBLIC_*` client-only, enable
  Server Actions (smoke only), update the Playwright harness to the Node server, pause `deploy.yml`,
  and update `docs/ARCHITECTURE.md`. **No** product write-flows, **no** Drizzle/Auth.js/ISR/Redis, and
  the server **never** talks to Wikipedia.
- **QA & Review** — verify each numbered AC pass/fail; pay special attention to AC6 (hydration / no
  console errors across all states) and AC12 (no broken Pages publish on push). A fresh-eyes security
  glance at any new server entry point (the smoke Server Action) is warranted even though no auth or
  write-flow ships.
