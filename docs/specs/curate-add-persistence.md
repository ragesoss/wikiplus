# Spec: Promote / Add-video persistence + CC BY-SA note-agreement capture (milestone D1)

- **Issue:** [#52](https://github.com/ragesoss/wikiplus/issues/52) — milestone **D**, run **1 of 5
  (D1)** · **Type:** build · **Status:** spec
- **Owner:** Product · **Feeds:** UX (the submit/success/error flows + the required-agreement
  control microcopy for both modals), Development (wire the two modals to the gated boundary +
  capture the agreement), Curation/Editorial (this implements §5.3 Decision C5 — a hand-shake, not
  a hand-off) · **Verified by:** QA & Review + UX
- **Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP,
  section **D** (the curation-action product layer). **Dependency root for D2/D3/D4.**
- **Builds on:** [#45](https://github.com/ragesoss/wikiplus/issues/45) (shared Postgres via Drizzle
  behind the Server Actions write boundary) and **C** (`docs/specs/wikimedia-oauth.md`): the
  `addClipAction` / `upsertTopicAction` write actions are **already `requireContributor`-gated**
  (C In-scope #7, AC7), and the in-product Promote / Add / dismiss triggers **already route through
  C's logged-out login gate** (C In-scope #8, AC10). C explicitly deferred the *modal-to-persistence
  wiring and the CC BY-SA agreement capture* to D (C "Out of scope — this is D", Decision D4).
- **Inputs (authoritative — do not relitigate):** `docs/CURATION_STANDARD.md` §1 (the note standard
  a promotion must meet), §5.3 / Decision C5 (notes are CC BY-SA 4.0; **agreement captured at
  submit**), §6 (promotion = a human writes the note + sets stance & accuracy); `docs/ARCHITECTURE.md`
  *Prototype phase* + the data-access boundary (DataStore seam → Server Actions → Drizzle);
  `docs/design/topic-page-v1.md` §6.6 / §6.8 / §6.9 (the Promote controls + the two modals, AC19);
  `lib/server/actions.ts`, `lib/data/store.ts`, `lib/data/types.ts`, `lib/db/schema.ts` (the write
  path + clip shape); `components/topic/CurateModal.tsx`, `components/topic/AddModal.tsx`,
  `components/topic/CurateForm.tsx`, `app/topic/TopicView.tsx` (the current mock submits + the gate).
- **Hand-off:** UX (the buildable flow/design spec for the stories below), then Development.

---

## Problem & user value

Milestone C made contribution **real and accountable**: a curator signs in with Wikipedia, the write
boundary is auth-gated, and a curated clip attributes to the real signed-in contributor. But C
deliberately stopped at the *foundation* — it did **not** wire the in-product curation flows to that
boundary. Today, on a Topic page, both curation modals still end in a `// mock submit`:

- **`CurateModal`** ("Curate this clip") — `onSubmit` calls `onClose()` and persists **nothing**
  (`components/topic/CurateModal.tsx`).
- **`AddModal`** ("Add a video" by link) — `onSubmit` calls `onClose()` and persists **nothing**
  (`components/topic/AddModal.tsx`).

So a signed-in curator who promotes a candidate, writes a context note, sets stance and accuracy, and
clicks **"✓ Publish curation"** gets a modal that closes and **a topic that is unchanged on reload**.
This is the single most user-visible gap C left open: the product's whole thesis — "a community doing
for creator video what Wikipedia editors do for text" — requires that a curator's vouch *persists* and
*shows*. Marcus (P2, the curator persona; design §1) currently experiences a flow that *teaches* the
curation standard but produces nothing.

Two consequences, both closed by D1:

1. **A vouch doesn't stick.** The auth-gated `addClipAction` (and its prerequisite `upsertTopicAction`)
   exist and attribute correctly, but no UI flow calls them. Promotion and add-by-link are still
   demos. The reader (Priya, P1) never sees a clip a curator just vouched for, because it was never
   written.
2. **The note license is asserted but not agreed-to.** `CurateForm` shows the passive line *"By
   publishing, you agree to release your context note under CC BY-SA 4.0"* (design §6.8), but there is
   no required agreement and **nothing is captured**. CURATION §5.3 / Decision C5 calls for the
   agreement to be *captured at submission time* — "persisted capture of that agreement arrives with
   auth/persistence." That is now: D1 must make the agreement a **required, captured** act, not a
   passive notice, so that what we persist alongside a CC BY-SA-licensed note is an actual record that
   its author agreed to that license.

**Who acts and why.** A **signed-in curator** promotes a good candidate or adds a clip the auto-suggester
missed, straight from the Topic page, and the clip **persists as a real curated clip attributed to
them** — earning its chips and context note. At submit they **agree to release their note under
CC BY-SA 4.0**, and that agreement is recorded. A **reader** is unaffected; reading stays anonymous and
the cached read path gains no per-user work.

This is milestone **D1**: the **promote / add-by-link product flow + the CC BY-SA agreement capture**.
It is *wiring + product flow + agreement capture*, **not** new auth (C did auth).

---

## Scope (what D1 does)

D1 connects the two existing modals to the existing auth-gated boundary, captures the note-license
agreement, and makes the new clip appear without a manual reload. Concretely:

1. **Promote-a-candidate persists (`CurateModal` → `addClipAction`).** When a signed-in curator
   promotes a candidate and publishes, the modal builds a `Clip` from the candidate's media/creator
   fields (carried into the modal) plus the curator's note, stance (+ optional modifier), accuracy
   (+ optional modifier), and section choice (general vs. a section slug+label), and calls
   `addClipAction`. The clip persists, attributed to the signed-in contributor by the boundary (C
   AC6 — the client does not supply `curatedBy`/`curatorId`; the boundary overrides them).

2. **Add-by-link persists (`AddModal` → `addClipAction`).** When a signed-in curator pastes a
   recognized YouTube/TikTok/Instagram link, the parsed video (`parseVideoUrl` — `lib/embed/facade.ts`:
   platform, videoId, embedUrl, thumbnailUrl, watchUrl) plus the curate fields are assembled into a
   `Clip` and persisted via `addClipAction`. If the current Topic page is for a topic not yet in the
   store, `upsertTopicAction` is called first (it is the prerequisite of `addClip`; the topic's QID is
   already resolved on the Topic page). The creator credit captured at add time is minimally what the
   link/preview yields; richer creator metadata is not blocking (see Out of scope / Decisions).

3. **CC BY-SA 4.0 note-license agreement is required and captured.** The submit-time agreement
   (CURATION §5.3 / C5) becomes a **required** condition of publishing on **both** modals: a curator
   cannot publish without affirmatively agreeing, and on success the agreement is **persisted** (see
   **Decision D1-1** for the captured shape). The passive notice in `CurateForm` is replaced by an
   explicit, required agreement control + the same one-line license statement.

4. **Real loading / success / error states replace the mock close.** On submit both modals enter a
   real **pending** state (the publish control is disabled/busy and not double-submittable); on
   **success** the modal closes and the curator sees the result reflected on the page (see #5); on a
   **server error** the modal **stays open** and surfaces an error (no silent close, no false
   "saved"). This matches the #45 async-write UX bar (no false success).

5. **The new clip shows without a manual reload, and a promoted candidate leaves the suggestion set.**
   On a successful publish, the returned clip is added to the Topic page's in-memory clip set so it
   renders (note + chips + credit) immediately — including flipping an empty topic to curated mode if
   it was the first clip. A **promoted candidate is removed from the live candidate / suggestion set**
   on success, deduped by the `platform:videoId` identity (`identityKey` / `videoIdOf`,
   `lib/candidates/dismissals.ts`) so the just-curated clip does not also linger as an
   un-vouched-for suggestion. Add-by-link similarly must not leave a duplicate suggestion for the same
   `platform:videoId` if one was showing.

6. **The logged-out path is preserved (no regression of C).** The Promote / Add triggers in
   `TopicView` keep routing through C's `requireLogin` gate (a logged-out curator is prompted to log
   in, never reaching a mock-close or a silent failure). D1 additionally handles the **session expired
   between opening the modal and submitting**: the boundary rejects with `AuthRequiredError`, which the
   modal surfaces as the expired-session login prompt rather than a generic error (the dismiss path
   already does this via `isAuthRequired` / `showExpiredGate` — D1 reuses that pattern).

---

## Out of scope

Kept out so this run stays small (one issue = one build-loop run). Each routes to its milestone-D run
or a deferred lane.

- **Editing / deleting your own clips** — needs ownership rules; that is **D2**. `updateClip` /
  `deleteClip` stay off the Server-Actions boundary (where #45/C left them). D1 only **adds** clips.
- **Contributor profiles / "my curations" views / public attribution pages** — **D3**.
- **Upvotes as a persisted per-user write** — **D4**.
- **Moderation tooling, the `vetted` review-hold workflow, per-identity rate-limit enforcement** —
  **D5**. A freshly added clip in D1 **publishes immediately** (see **Decision D1-2**); the `vetted`
  hold + rate limits are D5's to build (CURATION §7 sets the policy; D5 enforces).
- **A live oEmbed / network fetch of the pasted clip's real metadata.** D1 persists what
  `parseVideoUrl` + the existing client-side preview yield (the prototype's honest "mock preview — no
  network" path, design §6.9). Replacing the mock preview with a real oEmbed round-trip is a separate,
  deferrable enrichment; D1 must not be blocked on it and must persist a coherent clip from the parsed
  link regardless. (Embed-never-host is preserved either way.)
- **Note-quality / content validation beyond the existing limits.** D1 keeps the boundary's existing
  cheap guards (closed-enum stance/accuracy/platform, length caps — `lib/server/actions.ts`) and the
  `CurateForm` soft-cap counter (CURATION C1). It does **not** add editorial-quality enforcement of
  CURATION §1 (a human still has to write a good note); that is a moderation/review concern (D5 /
  Curation), not D1 gating. (See **AC10** for the minimum publish preconditions D1 *does* enforce.)
- **Server-side change to the auth gate.** The gate exists from C; D1 does not re-spec or re-implement
  auth, sessions, or the find-or-create identity mapping.
- **The production read-path** (ISR / Redis `cacheHandler`, Cloudflare edge). Unchanged; still
  deferred. D1 adds **no** per-user work to the read path; the only read-path change is that a write
  reflects in the same client session (#5), not a caching change.
- **A second OAuth provider (Google), account linking** — post-MVP, as in C.

---

## Acceptance criteria

Each item is independently testable; QA maps each to pass/fail with fresh, non-author eyes.
**"Signed in"** = a valid Wikimedia session per C's flow; **"signed out"** = no session. Per the C
pattern, a **live Wikimedia OAuth round-trip cannot run in CI** — QA verifies the gated-write behavior
with the **session stubbed** (a resolvable `contributor` injected, the provider call mocked), and the
DB via pglite, **consistent with how the Wikipedia/YouTube fetches are mocked** (`lib/server/actions.ts`
notes the server never calls Wikipedia/YouTube). Where an AC is about client UI state, it is verifiable
against the modal/`TopicView` behavior with the boundary stubbed.

**Promote a candidate (`CurateModal`)**

1. **AC1 — A promoted candidate persists and is attributed.** When a signed-in curator promotes a
   candidate, fills the note + stance + accuracy + section, agrees to the license, and clicks
   **"✓ Publish curation"**, exactly one new `clip` row is written via `addClipAction`, with the
   candidate's media/creator fields, the curator's note/stance/accuracy(+modifiers)/section, and
   `curatorId` = the **signed-in contributor** (and `curatedBy` = that contributor's Wikimedia
   username, set by the boundary — not by the client). The persisted `stance`/`accuracyFlag` are
   from the closed enums (CURATION §2/§3).

2. **AC2 — The promoted clip shows as curated on reload.** After AC1, reloading the Topic page (a
   fresh `listClips`) shows the clip rendered as a **curated clip** — its context note, stance chip,
   accuracy chip, and creator credit — in the section it was filed under (or General), counting toward
   the infobox/band counts. (It is no longer a candidate: no dashed treatment, no `match_reason`.)

3. **AC3 — A promoted candidate leaves the suggestion set immediately (no reload).** On a successful
   promote, the candidate it was promoted from is **removed from the live candidate / suggestion set
   in the same session without a manual reload**, deduped by its `platform:videoId` identity. The
   just-published clip does **not** simultaneously appear as both a curated clip and an un-vouched-for
   suggestion.

**Add a video by link (`AddModal`)**

4. **AC4 — Add-by-link persists.** When a signed-in curator pastes a recognized YouTube/TikTok/Instagram
   link, fetches the preview, fills the curate fields, agrees to the license, and clicks **"＋ Add &
   curate"**, exactly one new `clip` row is written via `addClipAction` from the parsed link
   (`parseVideoUrl`: platform, videoId, embedUrl, thumbnail/watch URL) + the curate fields, attributed
   to the signed-in contributor. If the topic was not yet in the store, `upsertTopicAction` is called
   first with the page's resolved QID + title, so the clip's parent topic exists.

5. **AC5 — The added clip shows without a manual reload.** On a successful add, the new clip is added
   to the Topic page's in-memory clip set and **renders as a curated clip in the same session without a
   manual reload** (flipping an empty topic to curated mode if it is the first clip). An unrecognized
   link still produces the existing inline "Unrecognized link" error and never reaches persistence
   (the modal's own client-side validation — design §6.9).

**CC BY-SA agreement (both modals)**

6. **AC6 — The agreement is required to publish.** On **both** modals, publishing is **blocked** until
   the curator affirmatively agrees to release their context note under CC BY-SA 4.0. With the
   agreement not given, the publish control does not submit and no clip is written. The one-line
   license statement (CURATION §5.3 wording: *"…release your context note under CC BY-SA 4.0."*)
   remains visible at the submit control. (Exact control + copy is UX's; the AC is: agreement is a
   *required precondition of the write*, not a passive line.)

7. **AC7 — The agreement is captured, not just displayed.** On a successful publish, the curator's
   agreement is **persisted** alongside the clip per **Decision D1-1**: a per-submit record carrying
   **(a)** that the contributor agreed to the note license, **(b)** the license identifier/version
   (`CC-BY-SA-4.0`), and **(c)** a timestamp. QA can confirm the captured agreement exists in the
   persisted data for a clip created via D1 (it is not inferable from a clip created by the seed/stub
   path). The clip's note remains attributable to its contributor (distinct from the creator) —
   CURATION §5.3.

**Auth & the logged-out / expired path**

8. **AC8 — Logged-out Promote/Add is prompted to log in (no silent failure, no mock close).** A
   signed-out curator who activates **Promote**, **"Be the first to curate"**, or **"＋ Add video"** is
   shown C's **"Log in with Wikipedia"** gate and the modal **does not open to a write that cannot
   succeed**. There is no mock-close, no silent no-op, and no false "saved." (This is the preservation
   of C AC10; D1 must not regress it.)

9. **AC9 — A session that expired before submit surfaces the login gate, not a generic error.** If the
   session is invalid at submit time, `addClipAction` / `upsertTopicAction` reject with
   `AuthRequiredError`; the modal surfaces the **expired-session login prompt** (the `isAuthRequired`
   path) rather than the generic write-error state, and **no clip is written**. (Verifiable at the
   boundary with no session: the action rejects and writes nothing — same gate C's AC7 tests.)

**State, dedup, and robustness**

10. **AC10 — Minimum publish preconditions are enforced client-side before the write.** A publish is
    not submitted unless: a non-empty context note is present, a stance and an accuracy value are
    selected (the selects default to valid enum values, so this is satisfied by default — the AC is
    that an empty note does not silently write a blank-note clip), the agreement is given (AC6), and —
    for add-by-link — a recognized link has been resolved (AC5). These are the buildable
    preconditions; full editorial-quality judgement of the note is out of scope (moderation/D5).

11. **AC11 — Real pending/success/error states; no double-submit, no false success.** On submit the
    publish control enters a disabled/busy **pending** state and cannot be double-submitted; on a
    boundary **error** the modal stays open and shows an error message (the curator's typed note is not
    lost); on **success** the modal closes and the result is reflected per AC2/AC3/AC5. A server error
    never closes the modal with a "saved" impression.

12. **AC12 — `yarn build` / `yarn typecheck` / `yarn test` green; the persistence + gate + agreement
    capture are tested without a live provider.** The full check set passes. New tests cover, with the
    session/provider **stubbed** and the DB via pglite (the C/#45 pattern): a signed-in promote and a
    signed-in add each write a clip with the right fields + attribution (AC1/AC4); the agreement record
    is persisted (AC7); an unauthenticated `addClipAction` / `upsertTopicAction` writes nothing and
    rejects (AC9); and a promoted candidate's `platform:videoId` no longer matches the live-suggestion
    set (AC3 — verifiable on the dedup helper / the candidate-filter logic).

13. **AC13 — `docs/ARCHITECTURE.md` reflects what shipped.** ARCHITECTURE's *Prototype phase* / data
    model records that the in-product Promote and Add-by-link flows now persist through the auth-gated
    Server-Actions boundary, and **where** the CC BY-SA note-agreement is captured (the column/record
    chosen per Decision D1-1). (Docs-as-built — the #45/C pattern.)

---

## Decisions (resolving the two carried-open questions; rationale recorded for UX/Dev/Curation)

### Decision D1-1 — Capture the note-license agreement **per submit** (timestamp + license version), persisted with the clip. **Confirmed.**

The note license is **per-note** (CURATION §5.3: a context note is licensed CC BY-SA 4.0 and is
attributable to *its* contributor), so the agreement is a property of *each published note*, not a
one-time account-level setting. Therefore D1 captures, on each successful publish, a record that the
**contributor agreed to release that note** under **`CC-BY-SA-4.0`**, with an **agreement timestamp**.

- *What gets persisted (the data shape is Dev's call, recorded in ARCHITECTURE per AC13; the captured
  facts are fixed here):* the agreed **license identifier/version** (`CC-BY-SA-4.0`) and the
  **agreement timestamp**, tied to the clip and its contributor. The simplest defensible home is
  **columns on the `clip` row** (e.g. `note_license` + `note_license_agreed_at`), since a clip in D1 has
  exactly one note authored by one contributor at one time — no separate agreement table is warranted
  yet. (Dev may instead use a dedicated agreement record if a cleaner fit; either satisfies AC7. A
  version string is captured rather than a hardcoded boolean so a future license-version bump is
  expressible.)
- *Why not account-level / one-time:* an account-level "I agree to license my contributions" toggle
  would not tie the agreement to the specific note text and time, and would not survive a future
  license change cleanly. Per-submit is the honest capture of "this note, this license, agreed then."
- *Why captured even though the prototype's identity is real now:* C made the contributor real, so the
  agreement now binds to a real Wikimedia identity — the capture is meaningful, not theatre.

### Decision D1-2 — A freshly added clip **publishes immediately**; no `vetted` review-hold in D1. **Confirmed.**

A clip created via Promote or Add-by-link in D1 is a **fully curated clip and shows immediately** — it
is **not** parked in a `vetted` hold. The `clip.vetted`-style review-hold workflow, per-identity rate
limits, and moderation tooling are **D5** (CURATION §7 sets the policy; enforcement is later; the C
spec and issue #52 both defer it).

- *Rationale:* D1's job is to close the persistence gap and prove the flow end-to-end. Login-gating
  (from C) already buys accountability and a rate-limit subject for later; adding a review-hold now
  would (a) require building the review surface that is explicitly D5, and (b) make D1's success
  unobservable (a promoted clip wouldn't show — defeating AC2/AC5). Immediate publish keeps "a curator
  vouches → a reader sees it" intact for the MVP. The data model already carries a `vetted`-style flag
  the D5 hold can switch on without reworking D1.
- *Risk accepted:* an immediately-visible write is the correct MVP posture (the same posture clips have
  today); abuse handling is a known, separately-scoped D5/Ops concern, not a D1 blocker.

---

## Success metric

D1 has no analytics backend (Analytics is deferred); success is the **persistence + agreement loop
working end-to-end**, verified at QA/UX review against the ACs:

- **Primary (the gap is closed):** A signed-in curator can **promote a candidate** *and* **add a clip
  by link** from the Topic page, and in **both** cases the clip **persists, attributes to them, and
  shows as curated on reload** (AC1/AC2/AC4/AC5) — and a promoted candidate **leaves the suggestion
  set** (AC3). This is the binary "a vouch sticks and shows" check: today it is zero (mock submit);
  D1 makes it real on both paths.
- **Secondary (the agreement is real):** Publishing **requires** agreeing to the CC BY-SA 4.0 note
  license, and that agreement is **captured** (license version + timestamp, per D1-1) for every D1
  clip — not merely displayed (AC6/AC7). This closes CURATION §5.3's "capture arrives with
  persistence."
- **Foundational (no regression, no false success):** Logged-out and expired-session attempts resolve
  to a login prompt and write nothing (AC8/AC9); errors keep the modal open with the note intact and
  never show a false "saved" (AC11). Reading stays anonymous and the read path gains no per-user work.

A future Analytics role would instrument promote/add conversion and clips-per-curator on the shared DB;
for D1 the success check is the manual end-to-end test above (both flows persist + attribute + show,
agreement captured, no false success), not a metric pipeline.

---

## Hand-off

- **UX:** produce the buildable flow/design spec for **D1** on top of the committed `topic-page-v1.md`
  §6.6/§6.8/§6.9 (which already specify the modals). What D1 needs from UX, grounded in those
  stories (S11 promote-with-note, S12 add-by-link, S14 "told my note will be CC BY-SA 4.0 at the moment
  I publish"):
  - **The required-agreement control + microcopy** on both modals (AC6): turn the passive *"By
    publishing, you agree…"* line into an explicit, **required** agreement at the submit control,
    keeping the CURATION §5.3 wording and the Indigo Press identity / AA accessibility baseline
    (text-labeled, keyboard-operable, focus-visible — never color alone).
  - **The pending / success / error states** for both modals (AC11): what the publish control looks
    like while writing, what the curator sees on success (the clip appearing per AC2/AC3/AC5), and the
    in-modal error state that keeps the modal open with the note intact on a server error — plus the
    **expired-session** case routing to C's login gate (AC9).
  - Confirm focus management on close (return focus to the originating Promote / Add trigger) survives
    the move from mock-close to real-submit. Evaluate the built UI against AC2, AC5, AC6, AC8, AC11.

- **Development:** build in-scope items 1–6 against AC1–AC13 — wire `CurateModal` → `addClipAction` and
  `AddModal` → (`upsertTopicAction` if needed →) `addClipAction`; assemble the `Clip` from the candidate
  / parsed link + curate fields; **capture the note-license agreement per D1-1** (the persisted shape —
  columns vs. record — is your call, recorded in ARCHITECTURE per AC13, as a clean Drizzle migration on
  the C schema); replace the mock close with real pending/success/error; add the new clip to client
  state and drop the promoted candidate from the live set by `platform:videoId` (AC3/AC5); keep C's
  trigger gate and add the expired-session (`AuthRequiredError`) handling (AC9). Do **not** add
  edit/delete to the boundary (D2). Add the AC12 tests (session/provider stubbed, pglite DB). Hand to
  QA & Review.

- **Curation/Editorial:** D1 **implements** §5.3 / Decision C5 (capture the note-license agreement at
  submit). No editorial change is requested — this is a hand-shake, not a hand-off. Flag for Curation
  only if the captured-agreement copy needs sign-off.

- **QA & Review:** verify AC1–AC13 with fresh, non-author eyes, plus the standard security pass — the
  boundary gate (AC9) is the only thing between an anonymous/expired request and a write, and no auth
  secret may reach the client bundle (the C bar still holds). Confirm the agreement capture (AC7) is
  real persisted data, not just a rendered notice, and that a promoted candidate genuinely leaves the
  suggestion set (AC3).

- **Operations:** no new infra. D1 adds at most a Drizzle migration (the agreement columns/record per
  D1-1) that must apply cleanly to the C schema on deploy — same migration path as #45/C.
