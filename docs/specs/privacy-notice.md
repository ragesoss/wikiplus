# Spec — Minimal privacy / data notice for the public-link prototype

**Issue:** #66 (epic #35 §E) · **Type:** build · **Milestone:** Functional prototype
**Status:** Product spec (Phase 1) — feeds UX (placement + microcopy) and Development (implementation).

> This is a **release gate** for the public-link prototype, not a nicety. Audience decision #3
> (#35) is now **public link** — anyone on the internet can reach the site and sign in. A visitor
> must be able to read, *before / at the moment of signing in*, an accurate notice of what wiki+
> stores about them and what stays anonymous, so connecting a real Wikimedia identity is informed.

---

## Problem

The prototype is live at a **public URL** (`wikiplus.wikiedu.org`) and supports real **Wikimedia
OAuth** sign-in. The only data disclosure today is the sign-in **gate** copy (`lib/auth/microcopy.ts`
`AUTH_COPY.gates.*`), which says "reading stays anonymous; contributing requires login" but does
**not** tell a visitor *what* is stored when they do sign in, or that an auth **cookie** is set. A
person handing over a real-world Wikimedia identity to a public site deserves to know — before they
click — what becomes durable and what never leaves the private side. There is no persistent,
linkable surface where that can be read at all (the app has **no footer**; `app/layout.tsx` is a
thin shell and each route owns its chrome).

This spec is **descriptive, not prescriptive**: it changes **nothing** about what we store or the
auth model. It makes the *already-built* behavior legible and honest.

## User value

- A public visitor can decide whether to sign in **with informed consent** — they know reading is
  anonymous, and exactly what a contribution creates (a stored identity + a session cookie).
- A returning or curious user can **re-find** the notice from a persistent, linkable place and link
  others to it.
- The product keeps its trust posture intact under a public audience: **honest, minimal, accurate** —
  no surprise, no overclaim, no legal theater.

## Product decision — depth (confirmed)

**A lightweight in-app notice suffices for this prototype. We do NOT write a formal legal privacy
policy / Terms of Service / GDPR-DSAR tooling now.** Reasoning:

- This is a **prototype** with a small, Wikimedia-adjacent audience; the data we hold is minimal and
  derived from a provider the user already trusts. The trust gap to close is *"what happens when I
  sign in here"*, which a short, accurate, plain-language notice answers directly.
- A formal legal document implies obligations (DSAR response SLAs, lawful-basis declarations,
  controller/processor language, data-export and deletion flows) that the prototype is not built to
  honor — shipping that text would be *less* honest than a plain, accurate notice. Account
  deletion / export are explicitly **deferred** (see Out of scope); claiming them in a policy we
  can't fulfill would be worse than not claiming them.
- The notice's job is **accuracy + reachability**, not legal completeness. When wiki+ moves to a
  production MVP with broad public traffic, a proper privacy policy / ToS is a separate, later
  deliverable (flag for the roadmap; out of scope here).

The notice must therefore be **honest about its own scope**: it describes *this prototype's* data
handling; it is not a legal agreement.

## As-built data inventory (verified against code)

This is the factual basis the notice must convey — verified directly against the schema, auth layer,
and the public projection (**code wins over any prose**). One discrepancy vs. the issue's bullet
list is flagged below.

### What is stored

| Datum | Where (table.column) | When created | Source | Public? |
|---|---|---|---|---|
| OAuth identity link — provider + stable subject id | `account.provider` (`"wikimedia"`), `account.providerAccountId` (Wikimedia `sub`) — `lib/db/schema.ts:216–234`, `unique(provider, provider_account_id)` | First sign-in (find-or-create — `lib/auth/contributor.ts:62`) | Wikimedia OAuth (identify scope) | **No** — never exposed on any public path |
| Cached provider profile bits — name, **email** (if granted), avatar | `account.name` / `account.email` / `account.avatarUrl` — `lib/db/schema.ts:226–228` | First sign-in | Wikimedia OAuth | **No** — `email` (and any non-public `account` field) **never** selected on a public path |
| Contributor (wiki+ curator) — username/handle, display name, avatar | `contributor.handle` / `displayName` / `avatarUrl` — `lib/db/schema.ts:177–209` | First sign-in (fresh contributor per never-seen subject) | Wikimedia username | **Yes** — username + avatar exposed via the public profile |
| Moderator/reviewer role flag | `contributor.isModerator` — `lib/db/schema.ts:201` | Granted out-of-band (DB flag or `WIKIPLUS_MODERATORS` env) | Owner/ops | **No** — intentionally not exposed on the public profile |
| **Session cookie** — stateless signed Auth.js **JWT** | Browser cookie; **no server-side session store, no DB session row** (`session: { strategy: "jwt" }` — `lib/auth/config.ts:84`) | At sign-in; cleared at sign-out | Auth.js (signed with `AUTH_SECRET`) | n/a — held in the visitor's browser |
| Curated **clip** + **context note** (+ stance/accuracy, section, license agreement) | `clip.*`, attributed via `clip.curatorId` / `clip.curatedBy` — `lib/db/schema.ts:54–174` | When the contributor adds/curates a clip (`addClipAction`) | The contributor's curation | **Yes** — clips + notes are public content |
| **Upvote** ("glad I watched this") | `clip_vote` row `(clipId, contributorId)` — `lib/db/schema.ts:277–301`, `unique(clip_id, contributor_id)` | When the contributor upvotes (`toggleUpvoteAction`) | The contributor's action | Count is public; *who voted* is not surfaced publicly |
| **Dismissal** (ruled-out suggestion) | `dismissed_candidate` row + `contributorId` — `lib/db/schema.ts:241–265` | When the contributor dismisses a candidate (`recordDismissalAction`) | The contributor's action | The suppression is shared; *who dismissed* is not surfaced publicly |
| **Write-event** ledger (rate-limit audit) | `write_event` `(contributorId, kind, created_at)` — `lib/db/schema.ts:320–343` | One row per counted gated write | Server (rate limiter) | **No** — internal, never surfaced |

> **The notice need not enumerate every internal table.** Faithful, plain-language coverage of the
> four categories the issue names — **account / contributor / session cookie / curation
> contributions** — is the bar. UX should fold the moderator flag, vote, dismissal, and write-event
> rows into "the curation actions you take and the role you may be granted" rather than listing
> column names. The table above is the *accuracy source*, not the user-facing wording.

### Reading is anonymous

Topic reads, the article body (fetched client-side from Wikipedia's CDN), search, and the public
profile reads are **anonymous** — no auth gate, no per-read DB identity write, and the JWT is only
*read* if already present. The only DB write a login makes is the **one** find-or-create identity
mapping in the `jwt` callback on sign-in (`lib/auth/config.ts:97–117`). **Only contributing creates
stored identity + the session cookie.** The notice must state this plainly.

### The public-vs-private boundary (with code citation)

- **PUBLIC** (browsable at `/contributor/<username>`): the Wikimedia **username** (`contributor.handle`)
  + the **granted avatar**, and the contributor's **curations** (clips, context notes). This is the
  public-safe projection `rowToPublicContributor` (`lib/db/mappers.ts:185–196`), whose input is a
  narrow `Pick<ContributorRow, "id" | "handle" | "avatarUrl">` — by construction it cannot carry an
  `account` field.
- **NEVER exposed on a public path:** `account.email`, the OAuth `providerAccountId`/`name`, the
  `isModerator` role, the write-event ledger, and which clips a person voted on or dismissed.
  `account.email` lives on a **different table** that is never joined on the profile read path
  (`PublicContributor` type contract — `lib/data/types.ts:71–89`).

The notice must accurately reflect this **"email is never exposed"** boundary as a positive promise.

### Attribution facts to verify (in scope for this gate)

- **Wikipedia article CC BY-SA 4.0 attribution — PRESENT.** `components/topic/ArticleBody.tsx:33–45`
  renders `From Wikipedia · CC BY-SA 4.0 · Wikidata Q…` linked to the source article (CURATION §5.1).
- **Context-note CC BY-SA 4.0 license — PRESENT at submit.** `lib/curation/note-license.ts` defines
  `NOTE_LICENSE` (`"CC-BY-SA-4.0"`), the verbatim license statement, and the agreement checkbox label
  (CURATION §5.3); the agreement is persisted as `clip.noteLicense` / `noteLicenseAgreedAt`.

### Discrepancy flagged (code vs. the issue's described model)

1. **Context-note license "where notes are … displayed."** The license is verifiably present **at
   submit** (above). Whether a license marker also rides the **public clip/note display** is **not**
   confirmed by the current read — the public attribution on a displayed note is the §5.4
   "context by `<curator>`" credit (`components/topic/ContextByLink.tsx`), which is *attribution*, not
   a *license* marker. This is a **verification point**, not an assumption: AC9 requires QA to confirm
   the §5.3 license is reflected on display, or to record that the prototype carries it at submit only
   (acceptable for this gate if recorded). If QA finds neither at submit nor display, that routes back
   to Dev. (No other discrepancy found; the issue's account/contributor/cookie/contributions bullets
   all match the schema.)

## Scope

1. A short, accurate **data notice** the prototype surfaces in two places (content this spec defines;
   exact wording = UX, placement = UX from the candidates below):
   - **At / before sign-in** — extend the sign-in disclosure so a visitor reads *what is stored* and
     *that reading is anonymous* **before completing sign-in** (today `AUTH_COPY.gates.*` says only
     that contributing needs login). The mechanism (extend the gate copy vs. link to the persistent
     surface from the gate) is a UX call, provided the substance is readable pre-sign-in.
   - **A persistent, linkable surface** — a short "About your data" / privacy notice reachable from a
     stable place (not only the gate), so it can be re-found and linked.
2. **Verify** the two attribution facts above are present + correct (article CC BY-SA, context-note
   CC BY-SA 4.0), and resolve the display discrepancy per AC9.
3. **Record** the canonical notice wording + its placement in **`docs/ARCHITECTURE.md`** (the
   privacy-boundary section).

**Candidate placements (UX decides — Product recommends, does not pick):** (a) a footer link — note
there is **no footer today**, so this means introducing one in the relevant route chrome; (b) an
entry in the account / user menu; (c) a dedicated short route (e.g. `/privacy` or `/about/data`) that
the gate and any link point to. A dedicated route + a link to it from at least one persistent place
is the most durable shape, but the choice is UX's against the design system.

## Out of scope

- A full legal **privacy policy / Terms of Service / GDPR-DSAR** tooling (deferred to production MVP).
- **Cookie-consent banner** machinery / analytics-consent UI (no analytics in the prototype).
- Any change to **what** data is stored or to the **auth model** — the notice *describes* the
  as-built system only.
- **Account deletion / data-export** flows (deferred; the notice must not promise them).
- Authoring the exact user-facing **microcopy** (UX) and picking the precise **placement** (UX).
- Multilingual / translated notice (English-only prototype).

## Acceptance criteria (testable)

1. **Readable before sign-in.** From the public site, signed-out, a visitor can read — *before
   completing a Wikimedia sign-in* — a notice stating (a) **reading is anonymous** and (b) **what is
   stored when you contribute** (an identity from your Wikimedia account + a session cookie). The
   text is reachable from the sign-in path without first authenticating.
2. **Persistent, linkable surface.** The notice is reachable from a **persistent place that is not
   only the sign-in gate** (e.g. a footer/menu link and/or a dedicated route) and has a **stable,
   linkable URL** a person can open directly and share.
3. **Accurate to the as-built schema.** The notice's substance matches the inventory above —
   `account` (provider + subject id; optional name/email/avatar), `contributor` (username + avatar),
   the **stateless Auth.js JWT session cookie**, and **curation contributions** (clips + context
   notes, upvotes, dismissals) tied to the contributor. It claims nothing not stored and omits
   nothing material from those four categories. (No table-name enumeration required; category-level
   accuracy is the bar.)
4. **Email-never-exposed boundary stated.** The notice accurately conveys the public-vs-private
   boundary: **username + avatar + curations are public; email (and other non-public account fields)
   are never exposed publicly** — consistent with `rowToPublicContributor` / the `PublicContributor`
   contract. The notice does not imply email is shown.
5. **"Reading stays anonymous" is explicit and true.** The notice states that browsing/reading
   requires no login and stores no personal identity, and that only contributing creates stored
   identity + the cookie — consistent with the JWT-only read path (no per-read identity write).
6. **No-overclaim / honest-depth.** The notice does **not** promise capabilities the prototype lacks
   (account deletion, data export, DSAR response) and is framed as a prototype data notice, not a
   legal agreement.
7. **Wikipedia article CC BY-SA attribution verified present.** `ArticleBody.tsx` renders the source
   attribution + CC BY-SA 4.0 + a link to the source article on a topic view (CURATION §5.1) — QA
   confirms it renders on a live topic, not just that the string exists.
8. **Context-note CC BY-SA 4.0 license verified present at submit.** The curate/add flow shows the
   §5.3 license statement + the agreement act, and a published clip persists `note_license` /
   `note_license_agreed_at` (CURATION §5.3) — QA confirms on the live flow.
9. **Context-note license on display resolved.** QA either (a) confirms a CC BY-SA 4.0 indication is
   present where a context note is **displayed** publicly, or (b) records that the prototype carries
   the §5.3 license **at submit only** (acceptable for this gate, recorded in `docs/ARCHITECTURE.md`).
   If neither submit nor display carries it, the defect routes back to Development.
10. **Recorded in `docs/ARCHITECTURE.md`.** The canonical notice **wording** and its **placement(s)**
    are recorded in the privacy-boundary section of `docs/ARCHITECTURE.md`, so the decision is durable
    and the next contributor finds it.
11. **Accessibility baseline.** The notice and its link(s) meet the project baseline: AA contrast,
    visible focus state, keyboard-reachable, text-labeled (never color alone) — per CLAUDE.md.

## Success metric (release-gate framing)

This is a binary **release gate**, so "success" is *trustworthiness + reachability*, verified, not a
traffic number (Analytics is deferred):

- **Gate metric (pass/fail):** ACs 1–11 all verified green by QA (and the built UI evaluated by UX)
  before the public-link prototype is considered launch-ready. The gate is **not** met if any of:
  a visitor cannot read what's stored before signing in; the notice is unreachable except at the
  gate; the notice misstates the schema or implies email is public; or the CC BY-SA attributions are
  absent.
- **Trust definition of "done & trustworthy":** a signed-out visitor on the public link can, in one
  obvious step, learn that **reading is anonymous and exactly what a contribution creates**, can
  **re-find and link** that statement, and finds it **accurate to what the system actually stores** —
  with **email never exposed** as a stated promise. When all of that holds, connecting a real
  Wikimedia identity to the public prototype is an **informed** choice.

## Hand-off

- **UX (next):** author the exact microcopy for both surfaces (sign-in disclosure + the persistent
  notice) from the inventory above; pick the placement among the candidates (footer link / account
  menu / dedicated route); design against the Indigo Press system + the accessibility baseline (AC11).
  Reconcile with the existing `AUTH_COPY.gates.*` language so the gate and the notice don't drift.
- **Development (after UX):** implement the two surfaces, extend `AUTH_COPY` (or link to the
  persistent surface) per the UX spec, **verify** AC7/AC8 and resolve AC9, and record the wording +
  placement in `docs/ARCHITECTURE.md` (AC10). No schema or auth-model change.
- **QA:** verify ACs 1–11 against the live built UI; route AC9 back to Dev if neither submit nor
  display carries the note license.
