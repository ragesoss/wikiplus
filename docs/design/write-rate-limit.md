# Design Spec: The "you're doing that too fast" limit response (milestone D5a)

- **Status:** v1, committed (Phase 2 / UX, build-loop for issue [#57](https://github.com/ragesoss/wikiplus/issues/57) — milestone **D**, run **D5a** — first of three split from #56).
- **Owner:** UX / Design.
- **Inputs (read first — this spec grounds in them, does not restate them):**
  - `docs/specs/write-rate-limit.md` — the Product spec. This design serves the **UX-facing** ACs —
    chiefly **AC3** (the rejection is a *distinct, non-alarming* limit signal — **not** C's login gate,
    **not** the generic write error) and the **roll-back of any optimistic UI** on a limit rejection —
    and honors Decisions **1–4** (Postgres-backed ledger; the limited write set + the gate-then-limit
    ordering; a distinct non-alarming "too fast" notice; per-`contributor.id` scope). It also keeps
    AC1 true at the UI: **normal curation never shows this** — the notice only ever appears to a
    signed-in contributor who has just exceeded the cap.
  - `docs/design/curate-add-persistence.md` (D1) — the **in-modal error** pattern (`ModalActionRow`,
    `role="alert"`, modal stays open + note/fields preserved, publish returns to idle) and the
    **expired-session gate** route (`isAuthRequired` → `showExpiredGate()`). The limit notice on the
    modal surface **reuses** the in-modal alert mechanism, with **distinct copy + a distinct
    (non-alarming) treatment** so it never reads as the generic "Couldn't publish…" failure.
  - `docs/design/upvotes.md` (D4) — the **optimistic-with-rollback** posture (`runUpvote` clones
    `runDismiss`) and the **polite, non-blocking `role="status" aria-live="polite"` notice** surface
    (the §6.4 "Couldn't record your upvote…" notice). A rate-limit rejection on an upvote **reuses
    this exact surface** (same placement, same politeness, same rollback) with the **limit copy**
    instead of the generic copy.
  - `docs/design/clip-edit-delete.md` (D2) — the owner edit/delete writes also route through the same
    `isAuthRequired` → `showExpiredGate()` / else-notice branch; D5a brings them under the limit too
    (Decision 2), so they need the same reason-aware branch (§5.3).
  - `docs/design/topic-page-v1.md` — the committed Topic-page baseline: modal a11y (§11.4), the
    toast/notice surfaces, **focus-visible §11.2** (3px indigo outline, 2px offset), text-labeled
    signals **§11.1**, **responsive §12** (~1280 / ~768 / **~390px**). `docs/TOPIC_PAGE_DESIGN.md`
    (Indigo Press identity). `docs/CURATION_STANDARD.md` **§7** (the policy this enforces — "per-identity
    write limits to blunt spam floods; contribution is gated, reading is anonymous") and **§4** (the
    text-label + non-color rule).
- **Implementable against (current code this spec extends, not redesigns):**
  - `components/topic/ModalActionRow.tsx` — already takes an **`errorMessage`** prop (defaults to the
    D1 generic string) and renders the in-modal alert. D5a passes the **limit string** + a **variant**
    so the alert reads + looks distinct from the generic error (§5.1).
  - `components/topic/useCurateSubmit.ts` — its submit machine carries **`error: boolean`** and an
    `onSubmit` that resolves `{ outcome: "added" | "expired" }` or **rejects** on a generic error. D5a
    adds a **`"limited"` outcome** (modal stays open, fields preserved, publish to idle — like the
    generic error but with the limit copy, §5.1). Dev's exact mechanism; the contract is in §5.1.
  - `components/topic/CurateModal.tsx` + `components/topic/AddModal.tsx` — both render `ModalActionRow`
    and own the submit; they thread the limit variant through (§5.1).
  - `components/topic/UpvoteControl.tsx` — **unchanged** (it is a presentational control; the host owns
    the rollback + the notice). The limit appears only via the **host's** notice surface (§5.2).
  - `app/topic/TopicView.tsx` — `runUpvote` (lines 898–961) already rolls back on error and branches
    `isAuthRequired(err) ? showExpiredGate() : setUpvoteError(true)`; `runDismiss` (664–709) and the
    edit/delete handlers (1005–1044) do the same. D5a makes each **reason-aware** so the polite/in-modal
    notice can carry the limit copy on a `RateLimitedError` (§5.2 / §5.3). The **`upvoteError`** /
    **`dismissError`** boolean notice states + the `role="status" aria-live="polite"` regions (lines
    1146–1180) are the surfaces to reuse; D5a generalizes the boolean to a **reason** so one surface
    can show either the generic OR the limit text.
  - `lib/auth/microcopy.ts` — `AUTH_COPY`. D5a adds **one new verbatim entry** here — the limit message
    (NOT a `gates.*` login string, NOT the generic `errors.*` failure). §3 authors the exact string.
  - `lib/auth/auth-error.ts` — `isAuthRequired(err)` + `AUTH_REQUIRED_MARKER`. Dev adds the **client-safe
    rate-limit detector** beside it (Product spec — `isRateLimited(err)` / `RATE_LIMITED_MARKER`); UX
    does not design the detector, only relies on it to branch each call-site (§5).
- **Feeds:** Development (build to **this spec** for the D5a deltas, on top of the committed
  D1 modal-error pattern + the D4 polite-notice + optimistic-rollback). Then QA & Review
  (correctness/security) + UX evaluation (this spec + the stories, Phase 4).

> **This spec is the contract, written before implementation.** D5a is **one user-facing message**
> across the **existing** write surfaces — it does **not** redesign the modals or the upvote control.
> It specifies the **deltas**: (1) the **verbatim limit string** + its accessible role; (2) how the
> limit rejection reads on **each** surface — the **in-modal notice** on Promote/Add (distinct from the
> D1 generic error and the expired-session gate, modal stays open + fields preserved) and the **polite
> `role="status"` notice** on upvote (reusing D4's surface, with the optimistic vote rolled back); and
> (3) the **distinctness** rule (AC3) — the limit is unmistakably **not** the login gate (you are
> already signed in) and **not** the generic error (nothing is broken), carried by the **words**, not
> color. The server-side enforcement (the `write_event` window check + `RateLimitedError`) is
> Development's; this UI never claims to *be* the limit — it only **reads** the limit honestly when the
> boundary rejects. Every requirement is tagged with the Product AC and the story it makes buildable.

---

## 1. Personas & stories served

D5a is a **moderation-enforcement** run with a single, narrow user-facing footprint. Of the three
Topic-page personas (`topic-page-v1.md` §1 / `curate-add-persistence.md` §1), it touches **P2 the
curator/contributor** (and P1-as-signed-in-voter — a reader who upvotes is, for the limit, the same
signed-in write actor) only in the rare moment they exceed the cap. P3 the moderator is context only
(removal is D5c). The honest framing of *who hits this and why* drives every copy + treatment choice:

### Who actually sees this notice (the design's anchor)
The limit is tuned (Product: N=60 writes / 60s, one shared per-identity budget) so a **human curating
or reading at any natural rate never trips it** (AC1). So the audience for this notice is, almost
always, **a script or an automated session driving an authenticated identity** — the spam/flood case
§7 names. **Occasionally** it is an **over-eager but honest human** (a fast power-curator clearing a
backlog, a stuck retry-loop, a double-firing client). The notice must be **calm, non-punitive, and
actionable for the honest case** — it tells the benign truth and what to do (**wait a moment**) —
while costing the flood-script nothing it cares about. It must **never**:
- read as **"log in"** (they *are* logged in — the C/D1 login gate is wrong and confusing here), or
- read as **"something broke"** (nothing is broken; the generic "Couldn't publish / Couldn't record
  your upvote — please try again" is wrong and faintly alarming, and "try again" with no "in a moment"
  invites an immediate retry that just re-trips the limit).

### P2 — Marcus, the curator/contributor (the human edge case this serves)
The same persona D1 named. In D5a he is, on the rare occasion, the honest human who briefly went too
fast — a burst of promotes/adds/upvotes/dismisses in under a minute. D5a's job for Marcus: when the
(N+1)th write is rejected server-side, he sees a **clear, calm, momentary** signal that says *you're
going a little fast — give it a moment* — with his **typed note and field values intact** (on the
modal) or his **optimistic vote cleanly reverted** (on the upvote), so nothing he did is lost or
silently dropped, and he knows the fix is simply to wait and retry.

### P1 — Priya, the reader (unaffected; the reassurance she needs)
Anonymous reading is **untouched** — the limit only ever applies post-auth, per identity (Product
AC6). Priya, signed in and upvoting clips she's glad she watched at any human rate, **never sees this**.
If she somehow did (a stuck client), the rollback + the calm "give it a moment" keeps her trust: her
vote reverts to the truth, she is not accused of anything, and she can try again shortly.

### User stories this run serves (each feeds a Product AC; Product owns the criteria)
- **S33 — told *calmly* that I'm going too fast, not that I'm broken or logged out.** *As a signed-in
  contributor whose write was just rate-limited, I want a clear, non-alarming message that I'm doing
  that too fast and should wait a moment — never a "log in" prompt (I'm already logged in) and never a
  "something failed" error (nothing is broken) — so I understand it's a momentary brake, not my fault
  and not a bug.* *(AC3.)*
- **S34 — nothing I did is silently lost on a limit.** *As a contributor rate-limited mid-action, I
  want my typed note + fields kept (on Promote/Add) or my optimistic vote reverted to the truth (on
  upvote), so the rejected write reads as "not yet, wait a moment" — never as a phantom success and
  never as work thrown away.* *(AC3, and the AC2 rollback — the write did not happen.)*
- **S35 — I can just wait and retry.** *As a contributor who hit the cap, I want the control to return
  to a usable, idle state so that once the window passes I can simply try again — the message tells me
  the action (wait), and the UI lets me take it.* *(AC3, AC4 — the window resets.)*
- **S36 — normal curation shows me nothing.** *As a normal-speed curator/reader, I never want to see
  this — it must be invisible at any human rate.* *(AC1.)*

---

## 2. Where the limit can appear, and the one rule that unifies them

The limit can be hit on **every gated content write** (Product Decision 2): the **Promote/Add**
publish (`addClipAction`, and its prerequisite `upsertTopicAction`), the **upvote** toggle
(`toggleUpvoteAction`), the **dismiss** action (`recordDismissalAction`), and the owner **edit/delete**
(`updateClipAction` / `deleteClipAction`). Each already has a **client call-site** in `TopicView` (or
the submit machine) that catches the boundary's rejection and branches `isAuthRequired(err) ?
showExpiredGate() : <generic notice>`. **The single D5a delta is to widen that branch into three
arms** at every such call-site:

```
catch (err) {
  rollBackOptimisticUI();              // if any (upvote/dismiss) — D4/#45 posture, already present
  if (isAuthRequired(err))   showExpiredGate();          // expired session → the login gate (D1)
  else if (isRateLimited(err)) showLimitNotice();        // ← NEW: the calm "too fast" notice (this spec)
  else                       showGenericNotice();        // a real failure → the existing generic error
}
```

`isRateLimited(err)` is Development's client-safe detector (beside `isAuthRequired`, per the Product
spec — it inspects the caught error's `name`/`code`/marker, the same channel `auth-error.ts`
documents, robust to Next.js production message redaction). **UX does not design the detector**; UX
designs the **`showLimitNotice()`** experience per surface (§§5.1–5.3) and the **string** it shows
(§3). The three arms must be **mutually exclusive and unmistakable** (AC3): expired → the gate; limit →
the calm notice; everything else → the generic error. Ordering matches the boundary's
gate-then-limit-then-write contract (Product Decision 2), so an anonymous call never reaches the limit
arm.

---

## 3. The verbatim limit message (the new `lib/auth/microcopy.ts` entry)

This is the one new string D5a authors. It lives as a **new entry in `lib/auth/microcopy.ts`** — **not**
under `AUTH_COPY.gates.*` (those are login prompts; this user is logged in) and **not** under the
generic `AUTH_COPY.errors.*` failure strings (`provider`, `expiredSession` — those mean "broken / sign
in again"). It is a sibling, distinct **rate-limit** entry. Suggested placement (Dev's exact key):

```ts
// Issue #57 / D5a (design §3 — VERBATIM). The per-identity write rate-limit notice. NOT a login gate
// (the user IS signed in) and NOT a generic failure (nothing is broken) — a calm, momentary "too
// fast" signal that tells the (almost always honest) contributor the benign truth and the action:
// wait a moment, then retry. Reused on every gated-write surface (modal in-line + the polite notice).
rateLimit: {
  notice: "You're doing that a bit too fast — give it a moment, then try again.",
},
```

### 3.1 The string, and why these words (the tone is Product's; the words are UX's — §7 / Product Decision 3)
> **You're doing that a bit too fast — give it a moment, then try again.**

- **"You're doing that a bit too fast"** — names the *cause* plainly (rate, not error, not auth). "a
  bit" softens it for the honest human (non-punitive — no "slow down", no "you've been blocked", no
  "limit exceeded"); the flood-script doesn't care, so the politeness costs nothing.
- **"give it a moment"** — the **action**, and it tells them *the wait is the fix* — distinct from the
  generic error's bare "try again", which would invite an instant retry that just re-trips the cap.
  "a moment" matches the window being short (Product: ~60s) without quoting a hard number (the window
  is a sliding/fixed implementation detail; a countdown is out of scope — §6).
- **"then try again"** — confirms the path is **not closed** (it is a momentary brake, not a ban —
  S35 / AC4): once the window passes, the same action works.
- **No blame, no jargon, no alarm.** It never says "rate limit", "error", "failed", "blocked",
  "denied", "spam", or "log in". It reads the same whether you're the honest power-curator or the
  script — honest to both, accusatory to neither.

### 3.2 Accessible name / role per surface (where the string is announced)
The **same string** is used on every surface, but **how it is announced** differs by the surface's
existing pattern (specified in §5):
- **Modal surface (Promote/Add/Edit):** the string is the **`ModalActionRow` alert text**. The alert
  container is **`role="status"` `aria-live="polite"`** for the limit variant — **not** the D1 generic
  error's `role="alert"` (assertive). Rationale: a limit is **informational, not urgent** (nothing
  broke; the user just waits) — polite matches the calm intent and matches D4's choice of polite for
  the upvote notice. (The D1 generic-error path keeps `role="alert"` — a real failure is more
  assertive. The two roles are part of what makes them feel distinct; see §5.1.) The alert text **is**
  its own accessible name (visible text). Do **not** add a second `aria-label`.
- **Upvote / dismiss surface (the page-level polite notice):** the string is the **text content** of
  the existing `role="status" aria-live="polite"` region (the `upvoteError` / `dismissError` notice,
  `TopicView` lines 1146–1180). Same surface, same politeness — only the **words** change to the limit
  string when the reason is rate-limit. Announced once on appearance, never per render (§7).

In **all** cases the message is **text-carried** — the words alone convey the full meaning (cause +
action) to a screen-reader user, a colorblind user, and a high-contrast user (CURATION §4 / §11.1).
**Color never carries it.**

---

## 4. The distinctness rule (AC3 — load-bearing): not the gate, not the generic error

This is the spec's central requirement and what QA/UX verify hardest. On **every** surface the limit
notice must be **unmistakably** the third thing — neither the login gate nor the generic write error —
and the distinction must survive with **no color** (CURATION §4):

| Signal | Triggered by | What it says (words) | Treatment | Why it must differ |
|---|---|---|---|---|
| **Login gate** (C/D1) | `AuthRequiredError` (anonymous / expired session) | **"Log in to …"** + "Log in with Wikipedia" button (modal dialog) | A blocking dialog | The limit user **is** logged in — a "log in" prompt is wrong + confusing. |
| **Generic write error** (D1 / D4 / #45) | any non-auth, non-limit failure | **"Couldn't publish — please try again."** (modal) / **"Couldn't record your upvote — please try again."** (upvote) / **"Couldn't dismiss that — please try again."** | `role="alert"` red alert (modal) / red `role="status"` notice (page) | The limit user's write **didn't fail** — nothing broke. "Couldn't … " is wrong + faintly alarming. |
| **Rate-limit notice** (D5a — THIS) | `RateLimitedError` | **"You're doing that a bit too fast — give it a moment, then try again."** | `role="status"` polite, calm (non-red) treatment (§5) | The benign truth: a momentary brake. Calm, non-punitive, tells them to wait. |

**The words are the primary distinguisher** (AC3 / CURATION §4): a user who can perceive **no** color,
or who is on a screen reader, hears three plainly different sentences ("Log in to…" vs. "Couldn't… —
please try again" vs. "You're doing that a bit too fast — give it a moment…"). The **treatment**
(§5) reinforces but never carries the distinction. In particular:
- The limit notice **must not** use the same alarming **red** (`accred` / `bg-red-50`) framing as the
  generic error on either surface — a limit is not a failure (§5 specifies the calm treatment).
- The limit notice **must not** be a blocking dialog (that is the gate's shape) — it is inline /
  non-blocking (§5).
- **Gold `#E5AB28` is never used** for the limit signal (or any functional signal) — it is a tertiary
  accent only (CLAUDE.md / TOPIC_PAGE_DESIGN.md).

---

## 5. Per-surface treatment (the deltas)

### 5.1 Promote / Add (and Edit) modal — the in-modal limit notice

**Surface today (D1/D2):** `CurateModal` / `AddModal` (and the edit modal) render `ModalActionRow`,
which shows an in-modal **`role="alert"`** error (2px `accred` border, `#FDEDED` bg, `accred` text)
**above** the publish/cancel row, keeping the modal **open** with the **note + all fields preserved**
and the publish control **returned to its idle label** so the curator can retry (D1 §6). A separate
arm closes the modal and shows the expired-session gate on `AuthRequiredError` (D1 §7.2).

**D5a delta — a third, distinct in-modal outcome ("limited"):** when the submit rejects with a
`RateLimitedError`, the modal behaves **like the generic-error path in structure** (this is the
familiar, correct shape — modal stays open, fields preserved, publish to idle so they can wait and
retry) but reads + looks **distinct** (AC3):

1. **The modal STAYS OPEN.** No close, no "saved" impression. The typed note and **every field value
   are preserved** (the modal stays mounted — the same as the D1 generic error; do not reset the form).
   The CC BY-SA agreement stays checked (it was checked to get here). *(S34 / AC3.)*
2. **The publish control returns to its enabled, idle label** ("✓ Publish curation" / "＋ Add &
   curate" / "✓ Save changes") — pending is over; the curator can wait a moment and retry. **No
   double-submit guard change** — the existing `useCurateSubmit` pending/idle wiring stands; D5a only
   adds the new outcome. *(S35.)*
3. **The notice text is the §3 limit string**, surfaced in the **same `ModalActionRow` alert slot** (at
   the action row, where it is seen at the point of retry — not scrolled away), via the existing
   **`errorMessage`** prop. Verbatim: **"You're doing that a bit too fast — give it a moment, then try
   again."**
4. **The notice is visibly + textually distinct from the D1 generic error** (AC3). Two carried
   differences, neither color-alone:
   - **Words** (primary): "You're doing that a bit too fast — give it a moment…" vs. the generic
     "Couldn't publish — please try again." — a plainly different sentence.
   - **Treatment** (reinforcing): the limit variant uses a **calm, non-red** in-modal notice — **not**
     the `accred`/`#FDEDED` red alert. Use a low-key informational treatment within the Indigo Press
     identity: a neutral/ink border with a light neutral or **brand-tinted** background (e.g. a 2px
     `ink`-or-`brand` border, a pale neutral `bg-bg2`/white fill, **ink** body text) — calm, not
     alarming, clearly "a note" not "an error". **No red. No gold.** Dev mirrors the `ModalActionRow`
     alert structure but with this calm variant (a `variant: "error" | "limit"` prop, or a sibling
     notice element) — the contract is **distinct, non-red, non-alarming, text-carried**.
   - **Role:** the limit variant is **`role="status"` `aria-live="polite"`** (informational), **not**
     the generic error's `role="alert"` (assertive). It is announced when it appears without the
     urgency framing of the failure. *(See §3.2.)*
5. **NOT the expired-session gate.** A `RateLimitedError` must **not** route to `showExpiredGate()` /
   close-the-modal — that is the `AuthRequiredError` arm only. The user is logged in; the modal stays
   open with the calm notice. Dev branches on `isRateLimited(err)` **before** the generic `else`, and
   **separately** from `isAuthRequired(err)` (§2).

**Buildable contract for the submit machine (`useCurateSubmit` / `onSubmit`):** today `onSubmit`
resolves `{ outcome: "added" | "expired" }` or **rejects** on a generic error (the modal then shows the
`error` alert). D5a adds a **third resolved outcome `{ outcome: "limited" }`** (the host classifies the
caught `RateLimitedError` and resolves `"limited"` rather than rejecting), which the modal renders as
the **calm limit notice + idle publish** (modal stays open), distinct from both the rejected-generic
path and the `"expired"` close-to-gate path. Equivalently, `useCurateSubmit` may carry a `limited:
boolean` (or an `errorKind: "none" | "generic" | "limited"`) alongside `error`, and `ModalActionRow`
selects the string + variant from it. Dev's exact shape; the **UX contract** is: **modal open, fields
preserved, publish idle, the §3 string in a calm non-red `role="status"` notice — never the generic
red alert, never the gate.**

**Add-by-link note:** `upsertTopicAction` (the topic-create sub-step that runs before `addClipAction`
on a new topic) is a counted gated write (Product Decision 2). If it is what trips the limit, the
**same** modal limit notice applies — the user need not distinguish *which* sub-step was limited; both
mean "you're going too fast, the clip wasn't added, wait a moment." One string, one treatment.

### 5.2 Upvote toggle — the polite `role="status"` notice + optimistic rollback

**Surface today (D4):** `UpvoteControl` is presentational; `TopicView.runUpvote` applies the
optimistic vote (flip voted-state + count ±1) immediately, fires `toggleUpvoteAction`, reconciles on
success, and on error **rolls the optimistic vote back to the pre-click truth** then branches
`isAuthRequired(err) ? showExpiredGate() : setUpvoteError(true)`. `setUpvoteError(true)` shows the
page-level **polite** notice (`role="status" aria-live="polite"`, lines 1170–1180): "Couldn't record
your upvote — please try again."

**D5a delta — the limit reuses this exact surface, with the limit copy:**

1. **Roll back the optimistic vote** to the pre-click truth (the count and voted-state revert), the
   **same** as the expired/generic rollback `runUpvote` already does. A rate-limited upvote **did not
   happen** (AC2) — the control must show the truth (not voted, count unchanged), never a phantom
   "voted". *(S34 / AC3.)*
2. **Surface the §3 limit string** in the **existing polite notice surface** (the same
   `role="status" aria-live="polite"` region) — **reusing D4's upvote-error notice surface**, not a
   new one. *(S33.)*
3. **NOT the generic "Couldn't record your upvote" copy** and **NOT the login gate.** The
   `UpvoteControl` itself does **not** change (it is the same toggle); only the host's notice text
   switches to the limit string on a `RateLimitedError`. *(AC3.)*
4. **The notice is non-blocking + polite** (`role="status" aria-live="polite"`) — it must **not** steal
   focus mid-scroll, must **not** block the reader, and is announced once on appearance (not per
   render). It self-dismisses (a short timeout) or on the next interaction — the **same** dismissal
   behavior as the existing upvote/dismiss notice; it must not stick or stack (§6).
5. **Calm, non-alarming treatment** (AC3). The existing upvote/dismiss notice uses a red `bg-red-50` /
   `text-red-700` framing — **for the limit reason, use the calm non-red treatment** (§5.4) so it does
   not read as a failure. The reason determines the treatment: a real failure stays red; a limit is
   calm. **No red, no gold for the limit.**

**Buildable contract:** generalize the boolean **`upvoteError`** notice state to a **reason** — e.g.
`upvoteNotice: null | "generic" | "limited"` (Dev's shape) — so the **one** `role="status"` surface
renders **either** the generic red "Couldn't record your upvote — please try again." **or** the calm
limit "You're doing that a bit too fast — give it a moment, then try again." The `runUpvote` catch
branch sets the reason: `isAuthRequired → showExpiredGate()`; `else if isRateLimited → set "limited"`;
`else → set "generic"`. The rollback is unchanged (it already runs before the branch). **UX contract:**
the optimistic vote reverts to the truth AND the polite notice shows the limit string in a calm
(non-red) treatment — never the generic upvote-error copy, never the gate.

### 5.3 Dismiss + owner edit/delete — the same branch, treated per their surface

These are counted gated writes too (Product Decision 2), each with an existing
`isAuthRequired ? showExpiredGate() : <generic>` catch:
- **Dismiss** (`runDismiss`, lines 664–709) — same pattern as upvote: it optimistically removes the
  candidate, rolls back on error (the card reappears — the honest signal), and shows the page-level
  polite **`dismissError`** notice. **D5a delta:** add the rate-limit arm → on `RateLimitedError`, roll
  back (the candidate reappears) and show the **same §3 limit string** in the **same polite notice
  surface** (generalize `dismissError` to a reason exactly as §5.2 does for `upvoteError`), calm/non-red.
- **Owner edit/delete** (lines 1005–1044) — the **edit** path is a modal submit (its `ModalActionRow`),
  so a `RateLimitedError` there takes the **§5.1 in-modal limit notice** (modal open, fields preserved,
  calm notice). The **delete** path (if it surfaces a notice) takes the **§5.2 polite-notice** treatment
  (or the edit modal's, per its current surface). Add the rate-limit arm to each catch alongside the
  existing `isAuthRequired` branch.

These are **not** the high-value spam vectors (clip-add + upvote are), so they need **no special
copy** — the **same** §3 string and the per-surface treatment above. Brief by design: the unifying
rule (§2) covers them; Dev wires the three-arm branch into each existing catch.

### 5.4 The calm (non-red) notice treatment — Indigo Press, AA, never color-alone

The limit notice's treatment is **calm and informational**, distinct from the **red** generic-error
framing, within the committed identity (`globals.css` tokens):
- **Page-level polite notice (upvote/dismiss):** instead of the generic `bg-red-50` / `text-red-700`,
  use a **neutral/brand-tinted** calm treatment — e.g. a light neutral or pale-brand background
  (`bg-bg2` / a subtle `brand`-tint) with **`ink` (`#2C2C2C`) body text** (and an optional `ink` or
  `brand` left rule). Same rounded, same placement (`mx-auto max-w-[1200px] px-5`), same `role="status"
  aria-live="polite"`. The point is **"a note, not an alarm."**
- **In-modal notice (Promote/Add/Edit):** instead of the `accred`/`#FDEDED` red alert, the calm variant
  — a 2px `ink`-or-`brand` border, a pale neutral/white fill (`bg-bg2`/white), **`ink` text**, in the
  same `ModalActionRow` slot, `role="status"`.
- **AA contrast (binding — §11.2-adjacent, CURATION §4):** `ink` (`#2C2C2C`) body text on a
  white/`bg2`/pale-tint background clears **WCAG AA (≥4.5:1)** comfortably at the notice's ~`text-sm`
  size — this is the same ink-on-light the page body uses. If Dev tints with `brand`, the **text stays
  `ink`** (do not put small `brand` text on a tint without confirming AA — keep the carrier as `ink`).
  QA spot-checks the notice text against its background on both surfaces.
- **Never color-alone (CURATION §4 / §11.1):** the meaning is the **words** ("…too fast — give it a
  moment…"); the calm treatment only reinforces. A user perceiving no color still gets the full
  message and its distinctness from the gate + the generic error (the sentences differ). **No
  red** (it is not a failure), **no gold** (forbidden as a signal).

---

## 6. What this spec deliberately does NOT add (scope discipline)

- **No countdown / "try again in N seconds".** The string says "give it a moment" — no live timer, no
  quoted window (the window is an implementation detail and may be sliding; a countdown is out of scope
  and would over-engineer a notice the honest user sees seconds-rarely). *(Product Out-of-scope: no
  runtime admin/tuning UI; the window value is config.)*
- **No disabling the control or a cooldown UI.** The publish control returns to **idle** and the
  upvote control stays a normal toggle — the user simply waits and retries (S35). D5a adds **no**
  disabled/greyed cooldown state, no progress ring, no "you're being rate-limited" persistent banner.
  The notice is transient (modal: until next submit; page: self-dismiss/next-interaction — §5).
- **No new dialog / no blocking modal for the limit.** The gate is the only blocking dialog; the limit
  is inline (modal) / non-blocking (page). *(AC3 distinctness.)*
- **No "you're a bot" / punitive language, no admin contact, no appeal flow.** The honest human is the
  design's care; the script is unbothered by any of it. (Moderator action is D5c.)
- **No notice stacking / persistence.** One notice at a time per surface; it must not stack on repeated
  trips or persist across navigation (reuse the existing notice's self-dismiss). A flood-script
  re-tripping does not accrete notices.
- **No change to anonymous reading.** The limit only renders post-auth, per identity (AC6). An
  anonymous reader's surfaces are byte-for-byte unchanged; no notice, no per-user work.

---

## 7. Focus, keyboard & announcement (binding — §11.2 / CURATION §4)

- **The notice never steals focus mid-action.** Both surfaces' limit notices are **`role="status"
  aria-live="polite"`** — announced to assistive tech **without moving focus** (the user is mid-click /
  mid-scroll; an assertive grab would be wrong for an informational, momentary signal). This is the
  deliberate difference from the D1 **generic** in-modal error, which is `role="alert"` and (D1 §6)
  moves focus to the alert: a limit is **not** that urgent. *(S33.)*
- **The modal notice is reachable + does not trap.** On the modal surface the calm notice sits in the
  `ModalActionRow` slot **above** the publish/cancel row, inside the modal's existing focus trap
  (`ModalShell`). The user's focus stays where they were (on the publish control, which returns to
  idle) — they can immediately Tab to it and retry after a moment, or Esc/Cancel to close. The notice
  itself is announced via `role="status"`; it does not need to be focused (unlike the generic error,
  which is). The trap, Esc, and backdrop-close are **unchanged** (D1 §7.3).
- **The upvote/dismiss notice is keyboard-irrelevant to operate** — it is informational text, not an
  interactive element; the user's focus remains on the toggle/control they activated, which has rolled
  back to the truth and is immediately usable again (wait → re-activate). No focus change on the page.
- **Announced once, not per render.** The page-level `role="status"` region announces the limit string
  **on appearance only** — it must not re-fire on every render or on count hydration (the D4 §9
  "do not over-announce" rule). The reason state flips to `"limited"`, the region announces once, then
  self-dismisses.
- **Focus-visible everywhere** (§11.2): the publish/cancel/upvote controls keep the global 3px indigo
  `:focus-visible` outline; D5a adds no new interactive element, so no new focus target.

---

## 8. Responsive behavior (~390px; `topic-page-v1.md` §12)

Web-first, responsive. D5a adds **no new layout** — it reuses two existing notice surfaces that already
behave at all widths. The requirement is that the limit notice stays **readable and non-disruptive at
~390px**:
- **Modal in-line notice (Promote/Add/Edit):** the calm notice is **full-width** in the
  `ModalActionRow` slot, above the action row, inside the modal's `max-h-[90vh] overflow-y-auto` body
  (existing). On a phone the modal body scrolls; the notice + the publish/cancel row stay reachable.
  The wording wraps to multiple lines as needed and stays legible (`ink` on light, AA). No horizontal
  scroll at ~390px. *(Mirrors D1 §10.)*
- **Page-level polite notice (upvote/dismiss):** the existing `mx-auto max-w-[1200px] px-5` notice is
  full-width within the page gutters; on a phone it is a single readable line/paragraph that wraps. It
  is non-blocking and does not cover the control or the article. The control it relates to (the upvote
  toggle / the candidate card) has rolled back to the truth and stays a comfortable tap target
  (D4 §11). No horizontal scroll at ~390px.
- **Target tested widths (QA + UX eval):** ~1280px, ~768px, **~390px** — the limit notice on **both**
  surfaces (modal in-line + page polite) at each, with the modal fields preserved and the upvote/dismiss
  optimistic state rolled back.

---

## 9. Indigo Press palette & non-color rule (binding)

Within the committed identity (`CLAUDE.md`; `topic-page-v1.md` §5 / §9.3 notation):
- **Ink `#2C2C2C`** — the limit notice's **body text** on both surfaces (the calm carrier — AA on
  white/`bg2`/pale-tint, §5.4). Borders/offsets as elsewhere.
- **Brand indigo `#676EB4`** — available as a **subtle tint / left-rule** on the calm notice (it is the
  product's primary identity color and reads as "ours, a note", not "broken") — used as **reinforcement
  only**, never as the carrier; if used as small text Dev confirms AA or keeps the deep-violet
  `#5248AF` (`--color-violet`) for any small indigo text (§9.3). The text carrier stays `ink`.
- **`accred` red `#B0353B` / `bg-red-50` / `#FDEDED`** — the **generic-error / failure** color
  (D1/D4/#45). **The limit notice must NOT use it** — a limit is not a failure (AC3 distinctness). Red
  stays reserved for real errors + destructive actions.
- **Action blue `#1F6F95`, Sprout/teal `#2A8270`** — not limit signals.
- **Gold `#E5AB28`** — **not used.** Tertiary accent only; **never** a functional/signal color, and
  **never** enlisted for the limit notice. *(CLAUDE.md / TOPIC_PAGE_DESIGN.md.)*
- **Non-color rule (CURATION §4 / §11.1):** the limit signal is the **§3 sentence** — cause + action,
  in words. The calm treatment + role only reinforce. The distinction from the login gate and the
  generic error is carried by the **words** (three plainly different sentences) and the **shape**
  (blocking dialog vs. red alert vs. calm polite notice), never by color alone.

---

## 10. Acceptance-coverage map (AC → where this spec makes it buildable)

| AC | What it requires (UX-facing portion) | Spec sections |
|---|---|---|
| AC1 | Normal curation never trips/shows the limit | §1 (anchor), §6 (no persistent UI); UX evaluates at Phase 4 |
| AC2 | Over-limit write does not happen → optimistic UI rolled back | §5.1 (modal: nothing written, fields kept), §5.2/§5.3 (rollback) |
| AC3 | **Distinct, non-alarming limit signal — NOT the login gate, NOT the generic error** | §3 (string), §4 (the distinctness table), §5 (per-surface treatment), §9 (non-color) |
| AC4 | Window resets → user can wait + retry | §3.1 ("give it a moment, then try again"), §5.1.2 / §5.2 (control returns to usable idle), §6 |
| AC6 | Reading unaffected/anonymous | §1 (Priya), §6 (no change to anonymous reading) |
| AC7/AC8 | Backing recorded / tested w/o live provider | (Dev/QA — no design blocker; UX evaluates the built UI) |

---

## 11. Deltas from the committed baselines (Dev: build these on top)

The committed D1 modal-error pattern, the D4 polite-notice + optimistic-rollback, and the
`UpvoteControl` stand. D5a changes exactly these points; everything else is unchanged.

1. **One new verbatim string** in `lib/auth/microcopy.ts` — the §3 `rateLimit.notice` entry, distinct
   from `gates.*` and `errors.*`. *(AC3.)*
2. **Three-arm catch at every gated-write call-site** (§2): add `else if (isRateLimited(err))
   showLimitNotice()` between the existing `isAuthRequired → showExpiredGate()` and the generic `else`
   — at `runUpvote`, `runDismiss`, the edit/delete handlers, and the modal submit path. The detector
   `isRateLimited(err)` is Dev's (beside `isAuthRequired`). *(AC3.)*
3. **Modal: a third "limited" outcome** (§5.1) — `useCurateSubmit` / `onSubmit` gain a `"limited"`
   result (or a `limited`/`errorKind` flag); `ModalActionRow` renders the §3 string in a **calm,
   non-red `role="status"`** notice variant (modal open, fields preserved, publish to idle). Distinct
   from the D1 generic red `role="alert"` error and from the expired-session gate close. *(AC2, AC3.)*
4. **Upvote/dismiss: reason-aware polite notice** (§5.2/§5.3) — generalize the boolean `upvoteError` /
   `dismissError` to a reason (`null | "generic" | "limited"`) so the **same** `role="status"
   aria-live="polite"` surface shows **either** the generic red copy **or** the calm limit copy; the
   optimistic rollback is unchanged (it already runs before the branch). *(AC2, AC3.)*
5. **Calm non-red treatment** (§5.4) for the limit variant on both surfaces — `ink` text on
   white/`bg2`/pale-tint, AA; no `accred` red, no gold. *(AC3, CURATION §4.)*

No change to: the `UpvoteControl` component (presentational, unchanged), the modal layout/fields/agreement
(D1), the login gate (C — the limit user is logged in, never routed there), the generic-error copy +
red treatment (it stays for real failures), the optimistic-with-rollback mechanics (D4 / #45), the
chips/notes/credit, the article side, the cached read path (anonymous reading untouched — AC6), or the
server-side enforcement (Development's `write_event` window check + `RateLimitedError` — this UI never
claims to be the limit).

---

## 12. What UX will evaluate at Phase 4

Against this spec **and** the stories (S33–S36), on the running prototype with the session stubbed
signed-in and the boundary forced to reject with the rate-limit error (the C/D1/D2/D3/D4 pattern — no
live OAuth/flood in CI; QA drives the over-limit case at the action, UX evaluates the UI it produces):
- **Distinctness (AC3 — the load-bearing eval):** a rate-limited **Promote/Add** shows the **calm
  in-modal limit notice** with the §3 string — the **modal stays open, the note + fields intact**, the
  publish control idle — and it is **visibly + textually distinct** from (a) the D1 generic red
  "Couldn't publish…" alert and (b) the expired-session "Log in to curate / Your session ended…" gate.
  A rate-limited **upvote** shows the **calm polite `role="status"` notice** with the §3 string, the
  optimistic vote **rolled back** to the truth — distinct from the generic "Couldn't record your
  upvote…" notice and from the login gate. Same for **dismiss** (§5.3).
- **The words carry it (CURATION §4):** in grayscale / with a screen reader, the three signals are
  plainly different sentences; the limit notice reads as **calm, momentary, not-your-fault, "wait then
  retry"** — never "log in", never "failed/broken".
- **Nothing lost / no phantom success (AC2 / S34):** the rate-limited modal keeps the typed note; the
  rate-limited upvote/dismiss reverts to the truth — never a phantom "voted"/"published".
- **Retry path (AC4 / S35):** the control returns to a usable idle state; after the (simulated) window
  the same action succeeds.
- **Normal use shows nothing (AC1 / S36):** at any human rate, the notice never appears.
- **A11y in practice:** the notice is announced **politely** (`role="status"`) without stealing focus;
  AA contrast on the `ink`-on-light notice on both surfaces; operable + readable at ~390px; the modal
  trap/Esc/return unchanged.
- **Indigo Press fidelity:** `ink` carrier, optional brand tint; **no red** for the limit, **gold
  unused**; the signal is text-carried (§9).

Defects route back to **Development**; a pass is reported to the orchestrator. (UX evaluation is
distinct from QA & Review's correctness/security pass — UX asks "does the limit read calmly + distinctly,
and feel right?"; QA verifies the server-side over-limit-writes-nothing integrity AC2, the
`RateLimitedError` vs. `AuthRequiredError` distinction at the call-site AC3, and the window reset AC4 at
the action/store.)
