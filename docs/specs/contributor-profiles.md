# Spec: Contributor profiles, "my curations", and public "context by <curator>" attribution (milestone D3)

- **Issue:** [#54](https://github.com/ragesoss/wikiplus/issues/54) — milestone **D**, run **3 of 5
  (D3)** · **Type:** build · **Status:** spec
- **Owner:** Product · **Feeds:** UX (the profile page + "my curations" entry + the "context by"
  attribution treatment + the General-band owner affordance, all on the Indigo Press identity),
  Development (two new **read** methods on the seam + a profile route + the attribution link + the
  General-band edit/delete reuse), Curation/Editorial (D3 **realizes** §5.3's "ready to show 'context
  by <curator>'" public attribution — a hand-shake, not a hand-off) · **Verified by:** QA & Review + UX
- **Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP,
  section **D** (the curation-action product layer).
- **Builds on:**
  - **C** (`docs/specs/wikimedia-oauth.md`) — the real `contributor` identity (the **Wikimedia
    username** is the contributor's public display handle; `contributorId` + `username` are on the
    session), and C's explicit deferral of "**Contributor profiles / 'my curations' views / public
    attribution pages**" to D (C Out-of-scope; that deferral is the charter for this run).
  - **D1** (`docs/specs/curate-add-persistence.md`) — a clip persists attributed to the signed-in
    contributor (`clip.curatorId` set by the boundary; `clip.curatedBy` = their Wikimedia username).
  - **D2** (`docs/specs/clip-edit-delete.md`) — the **owner-only** `updateClipAction` /
    `deleteClipAction` (server-side, **id-based** ownership gate: `clip.curatorId === session
    contributor id`), the reusable `EditModal` + `DeleteConfirmDialog`, and the §5.3 edit
    re-affirmation. D2 scoped its owner affordances to `ClipCard` (the section rail) **only** — it
    left clips filed **General** (rendered as `GeneralStrip` tiles) with no edit/delete affordance.
    The routed D2 follow-up on issue #54 asks D3 to close that gap (see **Decision 3**).
- **Inputs (authoritative — do not relitigate):**
  - `docs/CURATION_STANDARD.md` **§5.3** — a context note is attributable to its **curator/
    contributor** (distinct from the §5.2 **creator**); "the build should be ready to show 'context
    by <curator>' even if the prototype's stubbed identity makes it implicit." C made the identity
    real; D3 makes the attribution **public and browsable**.
  - `docs/CURATION_STANDARD.md` **§5.2** — creator credit (display name + handle + platform, links
    out to the creator on their platform). The **creator** is the external person who made the
    video; the **curator** is the wiki+ user who wrote the note. They are **distinct** and must not
    be conflated on the profile or the clip (see **Decision 3b**).
  - `docs/VISION.md` — core objects (Topic / Clip / Creator / **Contributor·curator**); "a community
    doing for creator video what Wikipedia editors do for text" — a curator's vouches are theirs, and
    a profile is where that body of work becomes legible.
  - `docs/ARCHITECTURE.md` — *Guiding principle: the read path is the scale lever*; *Authentication &
    identity* (the `contributor` row, the Wikimedia username as handle, JWT session); *Internal-link
    resolution* (the canonical title-based route pattern D3's profile route parallels). **D3 must add
    no per-user work to the cached topic read path** (see **Decision 5**).
  - The code (read, not paraphrased):
    - `lib/data/store.ts` + `lib/data/index.ts` — the `DataStore` seam; D3 adds **two reads** here.
    - `lib/db/drizzle-store.ts` + `lib/db/schema.ts` — the `contributor` table (`id`, `handle`
      [= the Wikimedia username; **non-unique** display column], `displayName`, `avatarUrl`), the
      `clip` table (`curatorId` FK → `contributor.id`; `curatedBy` = the username string), the
      `account` table (`name`/`email`/`avatarUrl` — **email is non-public identity**).
    - `lib/db/mappers.ts` — `rowToClip` already surfaces `clip.curatorId` read-only (D2 Decision 6a).
    - `lib/auth/config.ts` — the session carries `user.contributorId` + `user.username`.
    - `components/topic/ClipCard.tsx` — the curated clip card (creator credit footer at §5.2; the
      decorative `curatedBy · curatedAt` provenance line; the D2 owner Edit/Delete row).
    - `components/topic/GeneralStrip.tsx` — the General-band tile (no owner affordance today — the
      D2 gap), and `app/topic/TopicView.tsx` (`ownsClip()`, `myContributorId` from `useSession()`,
      `EditModal` / `DeleteConfirmDialog` already wired for the rail).
    - `components/topic/EditModal.tsx` + `components/topic/DeleteConfirmDialog.tsx` — reusable as-is.
- **Hand-off:** UX (the buildable flow/design spec for the stories below), then Development.

---

## Problem & user value

The curation loop is now real end to end: a signed-in curator promotes/adds a clip (D1), and edits or
deletes the clips they own (D2). C made every vouch attributable to a **real Wikimedia identity** —
but that identity is still nearly invisible. Three concrete gaps remain, all about making a curator's
body of work **legible and attributable in public**, which is the half of VISION's thesis C/D1/D2 set
up but did not deliver:

1. **A curator's work is scattered and unbrowsable.** Marcus (the curator persona) has curated clips
   across several topics, but there is **no place that shows "the clips Marcus curated."** A reader who
   trusts one of Marcus's notes cannot see what else he has vouched for; Marcus cannot see his own body
   of work in one place. VISION's "a community doing for creator video what Wikipedia editors do for
   text" depends on a contributor being a *visible, browsable* identity — as a Wikipedia editor's
   contributions page is. Today there is none.

2. **The §5.3 "context by <curator>" attribution is still implicit.** C made the contributor real and
   §5.3 says "the build should be ready to show 'context by <curator>'." Today a curated clip shows the
   note and a small decorative `curatedBy · curatedAt` provenance line — but the note is **not**
   visibly, clearly attributed to a *person you can click through to*. A reader weighing a note cannot
   ask "who wrote this, and what else have they curated?" — which is exactly the trust signal a
   curation layer needs. (CURATION §5.3 is explicit that this attribution is the **curator's**, distinct
   from the §5.2 **creator** credit — the two must not be conflated.)

3. **An owner cannot manage all of their own clips.** D2 left owner Edit/Delete reachable only on
   section-rail clips (`ClipCard`); clips filed **General** (rendered as `GeneralStrip` tiles) carry no
   affordance. Because the **curate form defaults to "General,"** this bites the primary path: a curator
   can create a General clip but cannot then edit or delete it from the UI. (The `updateClipAction` /
   `deleteClipAction` server actions are section-agnostic and already support it — only the affordance
   is missing.) Routed from the D2 run as a D3 ask.

**Who acts and why.** A **reader** (anonymous) weighing a note can click **"context by <curator>"** to
reach that curator's **public profile** — the clips they have vouched for, across topics, with context
— and decide how much to trust this voice. A **signed-in curator** reaches **their own** curations as
the owner-view of their own public profile ("my curations"), and from there (and on the Topic page's
General band) can edit or delete **any** clip they own. **No** non-public identity (email) is ever
exposed.

This is milestone **D3**: the **public contributor profile + "my curations" entry + the public
"context by <curator>" attribution**, plus closing the D2 General-band owner-affordance gap. It is
*new read surfaces + an attribution link + reuse of D2's edit/delete on the General band* — **not** new
writes, not new auth, not profile editing.

---

## Scope (what D3 does)

1. **A public contributor profile page at `/contributor/<username>`** (Decision 1). Given a Wikimedia
   username, the page shows the contributor's **public identity** (the username; avatar if the
   `contributor.avatarUrl` was granted) and the **list of clips they have curated**, each with enough
   **topic context** to be meaningful out of the Topic-page setting: the clip's caption, its creator
   credit (§5.2), its stance/accuracy chips and context note, and **which Topic it sits on** (the topic
   title, linking to that Topic page). Reading the profile is **anonymous** — no login required (it is a
   public attribution surface). An unknown username (no such contributor) renders a clear **not-found**
   state, not a server error. A contributor with **no** clips renders a coherent **empty** profile (the
   identity + an "hasn't curated any clips yet" line), not a broken page.

2. **A new read on the seam: list clips by contributor** (Decision 1/5). A `listClipsByContributor`-shape
   method on the `DataStore` seam (`lib/data/store.ts` / `lib/data/index.ts`), routed to a new read-only
   Server Action over a new `DrizzleDataStore` method that selects the contributor's clips (joined to
   their parent topics so each clip carries its topic title + QID for the "on Topic" link). This is a
   **read** (anonymous, no `requireContributor` gate — like `listClips`). It is **its own route's**
   query, not on the cached topic read path (Decision 5).

3. **A new read on the seam: resolve a contributor by username** (Decision 1). A
   `getContributorByUsername`-shape method (seam → read-only Server Action → `DrizzleDataStore`) that
   resolves a Wikimedia username to the public-safe contributor identity (id, username/handle, avatar
   if present) — **never** email or any non-public field (Decision 1). Returns null for an unknown
   username (drives the not-found state). Because `contributor.handle` is a **non-unique** display
   column (C: two distinct subjects may present the same username string), the lookup must resolve to a
   **deterministic single** identity (see **Decision 1**, *non-unique handle* note) so a username maps to
   one profile.

4. **"My curations" = your own public profile, reached as the owner** (Decision 2). A signed-in
   contributor reaches their own curations via a header entry that links to **their own**
   `/contributor/<own-username>` (their `session.user.username`). It is the **same** public profile page
   — when the viewer **is** the profile's owner, it additionally shows the owner affordances (Edit/Delete
   per #6) and reads as "my curations." There is **no** separate private view, no separate route, no
   private data: "my curations" is your public profile seen by you (Decision 2). The header entry appears
   **only when signed in** (it needs your username).

5. **Public "context by <curator>" attribution on a clip** (Decision 3b). On a curated clip, the context
   note carries a **"context by <curator>"** attribution that **links to the curator's profile**
   (`/contributor/<curatedBy>`). It renders on the curated **`ClipCard`** (the rail) and on the
   curated **`GeneralStrip`** tile (the General band). The attribution names the **curator** (§5.3) and
   is **visually and textually distinct** from the §5.2 **creator** credit (the video's creator, which
   stays as-is and links out to the platform) — the two are never merged (Decision 3b). On a **legacy
   `@prototype`** clip the attribution shows a **non-linked** label (no browsable profile — Decision 4).

6. **Owner Edit/Delete reaches the curator's General-filed clips** (Decision 3 — the folded-in D2
   follow-up). The owner-only Edit/Delete affordance (D2) is extended to **General-band clips** so an
   owner can edit/delete **all** of their clips, including General ones, from the UI — reusing D2's
   `EditModal` and `DeleteConfirmDialog` and D2's existing server actions unchanged. The affordance is
   shown **only** on clips the signed-in viewer owns (the existing `ownsClip()` / `clip.curatorId`
   mechanism), **never** when logged out, **never** on others' or `@prototype` clips. The **server-side
   id-based ownership gate from D2 is the security control and is unchanged** — this run only adds the
   *affordance* on a surface that lacked it. (Where the owner affordance lives on the General-band tile,
   and on the profile's clip list, is UX's to place; that it appears only for the owner, and the gate is
   unchanged, is fixed here.)

7. **`docs/ARCHITECTURE.md` records the as-built profile route + what's public** (Decision 1/5). The
   *Authentication & identity* / *Internal-link resolution* sections record: the public profile route
   `/contributor/<username>`, that it exposes only public identity (username + avatar; **never** email),
   that "my curations" is the owner-view of that same route, the two new read methods on the seam, and
   that none of this adds per-user work to the cached topic read path.

---

## Out of scope

Kept out so this run stays one build-loop run. Each routes to its milestone-D run or a deferred lane.

- **Profile editing / bio / settings / a "customize your profile" surface.** D3 shows the public
  identity C already established (username + granted avatar); a contributor **cannot** edit a bio,
  display name, links, or avatar here. There is **no** profile-edit write in D3 (it is read-only over
  existing identity). Editable profiles are a later enhancement, not D3.
- **Follow / social graph / contributor-to-contributor relationships.** No following, no followers, no
  social features. A profile is a public attribution surface, not a social network. → post-MVP.
- **Upvotes as a persisted per-user write** — **D4**. The profile/clip list does not add or change vote
  counts; `clip.upvotes` renders as-is (decorative, as today) and is not D3's to set.
- **Moderation tooling / the `vetted` review-hold / removing *anyone's* clip / per-identity rate
  limits** — **D5** (CURATION §7 sets the policy; enforcement is later). The profile shows a
  contributor's clips as-is; it does not add a report/flag/remove-others capability.
- **Retro-assigning legacy `@prototype` clips to a real owner / a browsable `@prototype` profile.** Per
  C Decision D6 / D2 Decision 5 there is no real person to assign them to; D3 does **not** create a
  public profile for the seeded stub (Decision 4).
- **A second OAuth provider (Google), account linking/merge, or a profile that aggregates multiple
  accounts.** As in C/D1/D2 — additive, post-MVP. A profile is keyed by the (single) Wikimedia username
  the contributor presents.
- **A directory/index of all contributors, or any "discover curators" listing.** D3 builds the
  per-contributor profile (reached from a clip's attribution link or your own header entry), **not** a
  browsable list of all contributors. → later.
- **The production read-path** (ISR / Redis `cacheHandler`, Cloudflare edge). Unchanged; still deferred.
  D3 adds **no** caching and **no** per-user work to the cached topic read path (Decision 5). The profile
  route is its own dynamic read page; the attribution link on a clip is static markup.
- **Note-quality / editorial enforcement.** D3 displays notes as curated; it adds no §1 quality gate
  (moderation/D5).

---

## Acceptance criteria

Each item is independently testable; QA maps each to pass/fail with fresh, non-author eyes.
**"Signed in"** = a valid Wikimedia session per C's flow; **"signed out"** = no session. **"Owner"** =
the signed-in contributor whose id equals a clip's `curatorId` (the D2 definition). Per the C/D1/D2
pattern, a **live Wikimedia OAuth round-trip cannot run in CI** — QA verifies any signed-in behavior
(the my-curations header entry, the owner affordances) with the **session stubbed** (a resolvable
`contributor` / `username` injected, the provider call mocked), and the DB via pglite, consistent with
how the Wikipedia/YouTube fetches are mocked (`lib/server/actions.ts`: the server never calls
Wikipedia/YouTube). The **public** profile read (AC1–AC4) requires **no** session and is verifiable
anonymously.

**The public contributor profile**

1. **AC1 — A profile page lists a contributor's curated clips with topic context.** Visiting
   `/contributor/<username>` for a contributor who has curated clips renders, with **no** login, that
   contributor's **public identity** (the Wikimedia username; the avatar if `contributor.avatarUrl` is
   present) and a list of **their curated clips**. Each listed clip shows enough to be meaningful out of
   the Topic-page setting: its caption, its creator credit (§5.2), its stance + accuracy chips and the
   context note, and **which Topic it is on** (the topic title) **linking to that Topic page**. The clips
   shown are exactly those whose `curatorId` is this contributor (a clip curated by a *different*
   contributor does **not** appear). (Verifiable against the new `listClipsByContributor` read with the
   DB via pglite.)

2. **AC2 — Public identity only; no non-public field is exposed.** The profile page and the
   `getContributorByUsername` read expose **only** public identity — the username/handle and avatar (if
   granted). The contributor's **email** (or any other non-public identity field on `account`) is
   **not** present in the page markup, the read's return shape, or the client bundle. (Verifiable by
   inspecting the read's return type/shape and the rendered output for the absence of `email`.)

3. **AC3 — An unknown username and an empty profile both resolve cleanly (no server error).** Visiting
   `/contributor/<username>` for a username that matches **no** contributor renders a clear
   **not-found** state (a "no such contributor" page), not a crash or a 500. A profile for a contributor
   who exists but has curated **zero** clips renders a coherent **empty** profile (the identity + an
   "hasn't curated any clips yet" line), not a broken/blank page.

4. **AC4 — Legacy `@prototype` has no browsable public profile.** Visiting
   `/contributor/@prototype` (the seeded stub identity, C Decision D6) does **not** render a browsable
   public profile of the stub's clips: it resolves to the not-found / non-profile state (Decision 4). The
   stub is treated as "not a real person to profile," consistent with D2 AC8 treating its clips as
   owned-by-no-one.

**"My curations"**

5. **AC5 — A signed-in user reaches their own my-curations.** When signed in, the header offers an entry
   ("my curations" / the user's own identity) that navigates to **their own**
   `/contributor/<own-username>` (their `session.user.username`). The page that loads is the **same**
   public profile (AC1) for the signed-in user — showing the clips they curated — and, because the viewer
   is the owner, it additionally shows the owner affordances (AC7). When **signed out**, the header offers
   **no** my-curations entry (it requires the user's username). There is no separate private route or
   private data (Decision 2).

**Public "context by <curator>" attribution (distinct from creator credit)**

6. **AC6 — "context by <curator>" renders on a curated clip and links to the profile; it is distinct
   from creator credit.** A curated clip — on the **`ClipCard`** (rail) and on the curated
   **`GeneralStrip`** tile (General band) — renders a **"context by <curator>"** attribution naming the
   clip's curator (`clip.curatedBy`) that is a **link to `/contributor/<curatedBy>`**. This attribution
   is **visually and textually distinct** from the §5.2 **creator** credit (the video's creator
   name/handle/platform, which links out to the platform and is **unchanged**) — a reader can tell "who
   made the video" from "who wrote the context note." On a **legacy `@prototype`** clip the attribution
   shows a **non-linked** label (a plain "prototype" provenance text, **no** profile link), since the
   stub has no browsable profile (AC4 / Decision 4). (Exact placement/treatment is UX's; the AC is: a
   profile-linking curator attribution exists on curated clips, distinct from creator credit, and
   degrades to a non-linked label for `@prototype`.)

**Owner edit/delete for ALL owned clips, including General-filed (the folded-in D2 gap)**

7. **AC7 — The owner can edit/delete ALL their clips, including General-filed ones, with the ownership
   gate unchanged.** An owner sees Edit/Delete affordances on **every** clip they own, **including** a
   clip filed **General** (a `GeneralStrip` tile) — closing the D2 gap where General clips had no
   affordance. Editing reuses D2's `EditModal` and deleting reuses D2's `DeleteConfirmDialog` over the
   **unchanged** `updateClipAction` / `deleteClipAction` (section-agnostic already). The affordance is
   shown **only** on clips the signed-in viewer owns (via `ownsClip()` / `clip.curatorId`), **never**
   when logged out, **never** on a clip owned by a different contributor, and **never** on a
   `@prototype` clip (its `curatorId` matches no current user — D2 AC8). The owner affordance also
   appears on the **my-curations** surface (the owner-viewed profile, AC5) for every owned clip.

8. **AC8 — The server-side ownership gate is unchanged and remains the security control.** A direct
   `updateClipAction` / `deleteClipAction` call for a General-filed clip by a **non-owner** (a signed-in
   contributor whose id ≠ the clip's `curatorId`) or by an **anonymous** caller is **rejected
   server-side** and writes nothing — exactly as D2 AC4/AC5/AC6 require. D3 adds **no** new write action
   and **does not** weaken D2's gate; it only adds the *affordance* on the General surface and the
   profile. (Verifiable by a direct action invocation with a stubbed session for a different
   contributor — the D2 security test, re-confirmed unbroken.)

**Read-path discipline, build, docs**

9. **AC9 — No per-user work is added to the cached topic read path.** The Topic page's cached read path
   (`listClips` and the Topic shell) gains **no** per-user/per-session work from D3: the "context by"
   attribution on a clip is **static markup** built from `clip.curatedBy` already on the clip (no extra
   read), and the owner-affordance decision uses the **already-authenticated** client session compared to
   `clip.curatorId` already on the clip (no new server read on the topic path). The profile read
   (`listClipsByContributor` / `getContributorByUsername`) runs **only** on the `/contributor/<username>`
   route, **never** on the Topic page. (Verifiable: the Topic read path issues no new query for D3; the
   profile queries are reachable only from the profile route.)

10. **AC10 — `yarn build` / `yarn typecheck` / `yarn test` green; the new reads + the General-clip
    edit/delete are tested.** The full check set passes. New tests cover, with the DB via pglite and
    (where signed-in) the **session stubbed** (the C/D1/D2 pattern): `listClipsByContributor` returns
    exactly the clips a given contributor curated, joined with their topic context, and excludes others'
    clips (AC1); `getContributorByUsername` resolves a known username to public identity **without
    `email`** and returns null for an unknown username (AC2/AC3); the `@prototype` stub does not resolve
    to a browsable profile (AC4); an owner can edit and delete a **General-filed** clip and a **non-owner
    / anonymous** edit/delete of a General-filed clip is rejected and writes nothing (AC7/AC8 — the
    load-bearing security re-test). A **live OAuth round-trip cannot run in CI** — QA stubs the session
    for the signed-in/owner cases.

11. **AC11 — `docs/ARCHITECTURE.md` reflects what shipped.** ARCHITECTURE's *Authentication & identity*
    / *Internal-link resolution* records the public profile route `/contributor/<username>`, that it
    exposes only public identity (username + avatar — **never** email), that "my curations" is the
    owner-view of that same route (no separate private surface), the two new read methods on the seam,
    and that D3 adds **no** per-user work to the cached topic read path (Docs-as-built — the #45/C/D1/D2
    pattern).

---

## Decisions (resolving the prompt's questions 1–5; rationale recorded for UX/Dev/Curation/QA)

### Decision 1 — Profile URL scheme `/contributor/<username>`; what's public = username + granted avatar + their curated clips. Email and non-public identity NEVER. **Confirmed.**

The public profile lives at **`/contributor/<username>`**, where `<username>` is the **Wikimedia
username** (the contributor's `handle` — the stable public handle a reader already sees on a clip's
attribution and in the header). This parallels the canonical title-based Topic route
(`/topic/<Title>`) and Wikipedia's own `Special:Contributions/<user>` — a clean, guessable, shareable
public URL keyed on the public handle.

- **What a public profile shows:** the **username**, the **avatar** if `contributor.avatarUrl` was
  granted (C requests identify-only scope, so avatar may be absent — render gracefully), and the
  **list of clips the contributor curated** with **topic context** (caption, creator credit §5.2,
  stance/accuracy chips, context note, and the parent Topic title linking to the Topic page).
- **What it must NOT show:** the contributor's **email** or any other **non-public identity** field.
  The `account` table carries `email`; the `getContributorByUsername` read returns a **public-safe
  projection only** (id, handle/username, avatarUrl) — email is never selected, never serialized,
  never in the bundle (AC2). *Why:* a public attribution page must expose only what the contributor
  presents publicly (their Wikimedia username); their email is private OAuth profile data.
- **Non-unique handle (C reality, must be handled):** `contributor.handle` is a **non-unique** display
  column — C established that two **distinct** Wikimedia subjects may present the **same** username
  string and get **distinct** contributors (the identity anchor is the `account` row, not the handle).
  So a username does **not** guarantee a single contributor. D3 resolves this deterministically:
  `getContributorByUsername` resolves to a **single** identity by a stable ordering (e.g. the
  lowest/earliest `contributor.id` for that handle) so `/contributor/<username>` always maps to one
  profile and one clip list. *Why this is acceptable for the prototype:* handle collisions are a rare
  edge (a renamed-into or reused Wikimedia username); a deterministic pick keeps the public URL stable
  and never errors, and the clip list is still correctly scoped to that one resolved contributor's id
  (AC1). A richer disambiguation (per-id profiles) is a later enhancement, explicitly not D3. (Dev:
  record the chosen tie-break in ARCHITECTURE per AC11.)

*Why username-keyed and not contributor-id-keyed:* the public handle is what a reader sees and what
"context by <curator>" reads; a numeric id is internal and unfriendly. The deterministic-resolve rule
above absorbs the non-unique-handle edge without leaking the internal id into the URL.

### Decision 2 — "My curations" = your own public profile, viewed as the owner. No separate private view. **Confirmed (the simpler coherent option).**

A signed-in contributor reaches their own curations via a header entry that links to **their own**
`/contributor/<own-username>` — the **same** public profile page everyone else sees, except that when
the viewer **is** the owner it additionally shows the owner affordances (Edit/Delete, AC7) and may
read as "my curations." There is **no** separate `/my-curations` route, **no** separate private view,
**no** private data.

- *Why the simpler option:* a curator's curations are public by design (a profile is a public
  attribution surface). Building a separate private "my clips" view would duplicate the same query and
  the same list for no added value, and would invite a private/public data split that does not exist.
  "Your public profile, with owner controls when it's you" is one surface, one route, one query —
  coherent and minimal.
- *Consequence:* the header entry is shown **only when signed in** (it needs `session.user.username`);
  signed-out, there is no my-curations entry (AC5).

### Decision 3 — Fold the General-clip owner Edit/Delete gap into D3 (the routed D2 follow-up). **Confirmed — included, not split.**

The D2 follow-up (owner Edit/Delete unreachable for clips filed **General**, which render as
`GeneralStrip` tiles, not `ClipCard`) is **in scope for D3**, not split into a separate run.

- *Why include, not split:* the components already exist (`EditModal`, `DeleteConfirmDialog`), the
  server actions are **section-agnostic and unchanged** (D2 built them to edit/delete any owned clip
  regardless of placement), and the affordance mechanism (`ownsClip()` / `clip.curatorId` /
  `myContributorId`) is already wired in `TopicView`. Extending the owner affordance to the
  General-band tile (and to the profile's clip list) is a **small, additive** reuse — it does not
  materially balloon the run. It closes a **real gap on the primary path** (the curate form defaults to
  "General," so a curator can create General clips they then can't manage), and the my-curations
  surface is the natural home for "manage all my clips." Splitting it would leave that gap open across
  another run for no benefit.
- *What is NOT touched:* D2's **server-side id-based ownership gate** is the security control and is
  **unchanged** (AC8). D3 adds **no** new write action; it only surfaces the existing D2 affordance on
  a surface (and a page) that lacked it.

### Decision 3b — "Context by <curator>" links to the profile and is distinct from creator credit (§5.2 vs §5.3). **Confirmed.**

On a curated clip, the context note carries a **"context by <curator>"** attribution that **links to
`/contributor/<curatedBy>`**. It renders on the rail (`ClipCard`) and on the General-band tile
(`GeneralStrip`).

- *Distinct from creator credit (the load-bearing rule, CURATION §5.2/§5.3):* the **creator** credit
  (the video's maker — display name, handle, platform, links **out** to the platform) is **unchanged**
  and stays where it is. The **"context by <curator>"** attribution names the **wiki+ curator** who
  wrote the note (the `curatedBy` username) and links **in** to their wiki+ profile. They are
  **visually and textually distinct**; the build must never merge them or imply the creator wrote the
  note or vice-versa. (§5.3 is explicit: "the note-license agreement is the curator's act over their
  own note; it is not a creator attribution and must never be conflated with crediting the video's
  creator.")
- *What it reads:* a short, text-labeled attribution — e.g. "context by &lt;username&gt;" — the **word**
  carries the meaning (never color-alone; AA; keyboard-operable link), per CURATION §4 / the
  accessibility baseline. (Exact copy/placement is UX's; the canonical fact — a profile-linking curator
  attribution distinct from creator credit — is fixed here.)
- *Legacy `@prototype` (Decision 4 link):* on a clip attributed to the stub, the attribution renders as
  a **non-linked** "prototype" provenance label (no profile link), since there is no browsable profile.
  (Today's decorative `curatedBy · curatedAt` provenance line on `ClipCard` is the natural anchor to
  evolve into this attribution; Dev/UX decide whether "context by" replaces or augments it — the
  requirement is the linking attribution + the distinctness from creator credit.)

### Decision 4 — Legacy `@prototype` clips get no browsable public profile; their attribution is a non-linked label. **Confirmed (consistent with C D6 / D2 Decision 5).**

The seeded `@prototype` stub is **not a real person** (C Decision D6 — it backs pre-C clips, with no
retro-rewrite to a real person; D2 Decision 5 treats its clips as owned-by-no-one). D3 does **not**
create a browsable public profile for it:

- `/contributor/@prototype` resolves to the **not-found / non-profile** state (AC4), not a browsable
  list of stub-attributed clips. *Why:* a public profile asserts "here is a curator and their body of
  work"; the stub is a placeholder identity, not a curator who vouched — profiling it would imply a
  real voice that isn't there.
- A **clip attributed to `@prototype`** shows a **non-linked** "prototype" provenance label in place of
  the linked "context by <curator>" attribution (AC6 / Decision 3b) — honest about provenance, but no
  dead/implying link. *(Dev: the stub handle is `@prototype` — `lib/db/drizzle-store.ts` `STUB_HANDLE`;
  detect it to suppress the link.)*

### Decision 5 — D3 adds no per-user work to the cached topic read path. **Confirmed (ARCHITECTURE read-path principle).**

The profile and my-curations are their **own** route (`/contributor/<username>`), read-mostly and
reachable only from a clip's attribution link or the header — **not** the Topic page. The Topic page's
cached read path is untouched by D3:

- The **"context by <curator>" attribution** on a clip is **static markup** built from `clip.curatedBy`
  (already on every clip the topic read already loads) — it adds **no** extra read to the topic path.
- The **owner-affordance** decision reuses the existing D2 mechanism: the **already-authenticated**
  client session (`myContributorId`) compared to `clip.curatorId` (already on the clip) — **no** new
  server read on the topic path, computed in the client session as D2 established.
- The **profile reads** (`listClipsByContributor`, `getContributorByUsername`) run **only** on the
  profile route, never on the Topic shell.
- D3 adds **no** ISR/Redis caching (deferred); the profile route is a plain dynamic read page. A DB
  **index** on `clip.curator_id` (and on `contributor.handle`) would help the new queries if the data
  grew; that is an **additive, non-destructive** migration and is **optional** for the prototype's
  scale (note it; do not over-engineer — see **Schema / migration note**).

---

## Schema / migration note

**This is expected to be a no-destructive-schema-change run.** The new surfaces are **reads** over
existing tables and columns: `clip.curatorId` (FK → `contributor.id`) already exists, `contributor`
already carries `handle`/`displayName`/`avatarUrl`, and `rowToClip` already surfaces `curatorId`
read-only. The two new seam reads (`listClipsByContributor`, `getContributorByUsername`) and the new
`/contributor/<username>` route add **no** table or column.

- **Optional additive index (not required):** if Dev judges it worthwhile, a non-destructive Drizzle
  migration adding an **index on `clip.curator_id`** (the by-contributor query) and/or on
  `contributor.handle` (the username lookup) is acceptable and additive. At the prototype's scale it is
  **optional** — note it, don't over-engineer. No data migration, no column drop, no type change.
- If Dev discovers a genuine schema need beyond an optional index, that is a flag back to Product — the
  expectation set here is **no destructive migration**.

---

## Success metric

D3 has no analytics backend (Analytics is deferred); success is the **public attribution + profile +
my-curations loop working end-to-end**, verified at QA/UX review against the ACs:

- **Primary (a curator's work is legible and attributable in public):** From a curated clip a reader can
  click **"context by <curator>"** and land on that curator's **public profile** listing the clips they
  vouched for, with topic context (AC1/AC6) — and the attribution is clearly the **curator's**, distinct
  from the **creator** credit (AC6/Decision 3b). A signed-in curator reaches **their own** curations from
  the header (AC5). This is the binary "a vouch has a visible, browsable author" check: today it is zero
  (attribution is implicit; there is no profile).
- **Secondary (owner control is complete):** An owner can edit/delete **every** clip they own, including
  **General-filed** ones (AC7) — closing the D2 gap on the primary path — while the **server-side
  ownership gate is unchanged and still the security control** (AC8).
- **Foundational (correct edges, no regression):** Only **public** identity is exposed — never email
  (AC2); unknown/empty profiles and the `@prototype` stub resolve cleanly with no browsable stub profile
  (AC3/AC4); reading the profile is anonymous; and the **cached topic read path gains no per-user work**
  (AC9). Reading the Topic page is unchanged from D2 except the added (static) curator attribution link.

A future Analytics role would instrument profile views, click-through from "context by" to a profile, and
clips-per-contributor on the shared DB; for D3 the success check is the manual + tested end-to-end above
(profile lists a contributor's clips with topic context; "context by" links to it, distinct from creator
credit; my-curations reached; General-clip edit/delete works with the gate unchanged; email never
exposed; read path untouched), not a metric pipeline.

---

## Hand-off

- **UX:** produce the buildable flow/design spec for **D3** on top of the committed Topic-page design,
  C's header identity, and D2's edit/delete surface. What D3 needs from UX, grounded in the curator
  persona's stories (browse a curator's body of work; reach my own curations; manage all my clips):
  - **The public profile page** (`/contributor/<username>`, AC1–AC4): the public identity header
    (username + avatar if granted), the curated-clip list with **topic context** (each clip's
    caption/creator credit/chips/note + the parent Topic title linking to the Topic page), and the
    **not-found** (unknown username, AC4 for `@prototype`) and **empty** (no clips) states — honoring
    Indigo Press + AA. Reading is anonymous.
  - **The "my curations" header entry** (AC5): how a signed-in user reaches their own profile (their own
    `/contributor/<own-username>`); when it appears (signed-in only); how the owner-viewed profile reads
    as "my curations" and surfaces the owner affordances. No separate private view (Decision 2).
  - **The "context by <curator>" attribution** (AC6 / Decision 3b): where it sits on the `ClipCard`
    (rail) and the `GeneralStrip` tile (General band), its copy (a text-labeled curator attribution),
    that it **links to the profile**, and that it is **visually + textually distinct** from the §5.2
    creator credit (never merged). The non-linked **`@prototype`** label (Decision 4).
  - **The owner Edit/Delete on the General band + the profile** (AC7): place the existing D2 affordance
    on the `GeneralStrip` tile and on the my-curations clip list, owner-only (the `ownsClip()`
    mechanism), reusing D2's `EditModal` + `DeleteConfirmDialog` (no new modal). Never shown logged-out
    or on others'/`@prototype` clips.
  - Evaluate the built UI against AC1, AC2, AC5, AC6, AC7.

- **Development:** build in-scope items 1–7 against AC1–AC11 — add **two read methods** to the seam
  (`lib/data/store.ts` / `lib/data/index.ts`) routed to **read-only Server Actions** (no
  `requireContributor` gate — they are public/anonymous like `listClips`) over new `DrizzleDataStore`
  methods: `listClipsByContributor` (clips for a contributor id, joined to their parent topics for the
  topic title/QID context, mapped via `rowToClip`) and `getContributorByUsername` (a **public-safe
  projection** — id/handle/avatar, **never email** — resolving the non-unique handle to a single
  identity by the stable tie-break of Decision 1); add the **`/contributor/<username>` route**
  (App Router page) rendering the profile + not-found/empty states; suppress the profile for the
  `@prototype` stub (Decision 4 / AC4); add the **"context by <curator>" linking attribution** to
  `ClipCard` and `GeneralStrip`, **distinct** from the creator credit, degrading to a non-linked label
  for `@prototype` (Decision 3b/AC6); add the **header "my curations" entry** (signed-in only, links to
  the user's own profile — Decision 2/AC5); **extend the owner Edit/Delete affordance to the
  `GeneralStrip` tile** (and the profile clip list) reusing D2's `EditModal`/`DeleteConfirmDialog` and
  the **unchanged** `updateClipAction`/`deleteClipAction` + `ownsClip()` mechanism (Decision 3/AC7) —
  **do not** touch D2's server-side ownership gate (AC8). Keep the cached topic read path free of any
  new per-user work (Decision 5/AC9): the attribution is static markup from `clip.curatedBy`; the
  owner-affordance is the already-authenticated client-session compare. **No destructive migration**
  (see *Schema / migration note*; an additive index is optional). Add the AC10 tests (pglite DB;
  session stubbed for owner/my-curations cases; the non-owner/anonymous General-clip edit/delete
  rejection is the security re-test). Record the as-built route + what's public + the seam reads in
  ARCHITECTURE (AC11). Hand to QA & Review.

- **Curation/Editorial:** D3 **realizes** §5.3's "ready to show 'context by <curator>'" public
  attribution (the curator's, distinct from the §5.2 creator credit). No editorial change is requested —
  a hand-shake, not a hand-off. Flag for Curation **only** if the "context by <curator>" copy, or the
  non-linked `@prototype` label wording, needs sign-off (it should follow §5.2/§5.3's curator-vs-creator
  distinction).

- **QA & Review:** verify AC1–AC11 with fresh, non-author eyes, plus the standard security/privacy pass.
  The **two load-bearing checks:** (1) **no non-public identity leaks** — `getContributorByUsername` and
  the profile page expose only public identity, **never email** (AC2), in the return shape, the markup,
  and the client bundle; (2) the **server-side ownership gate is unchanged** — a non-owner / anonymous
  direct call to `updateClipAction`/`deleteClipAction` for a General-filed clip is rejected and writes
  nothing (AC8), tested at the **action**, not the button. Also confirm: the profile lists exactly the
  contributor's clips with topic context and excludes others' (AC1); unknown/empty/`@prototype` profiles
  resolve cleanly (AC3/AC4); "context by <curator>" links to the profile and is distinct from the
  creator credit, with a non-linked `@prototype` label (AC6); the owner affordance reaches General-filed
  clips (AC7); and the cached topic read path issues no new D3 query (AC9). A live OAuth round-trip
  cannot run in CI — stub the session for the my-curations/owner cases.

- **Operations:** no new infra, **no new secret**, **no destructive migration** (Schema note). Same
  deploy path as D1/D2/C. If Dev includes the optional additive index, it is a clean Drizzle migration
  that applies on `up -d` (the existing migration path) — nothing new to provision.
