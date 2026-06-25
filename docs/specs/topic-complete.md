# Spec: Curator can mark a Topic "complete" (closed to suggestions)

- **Status:** Product spec for build-loop — GitHub issue #159. Written **before** UX/Dev.
- **Owner:** Product
- **Implements:** Issue #159 — "[build] Curator can mark a topic 'complete' (closed to suggestions):
  suppress auto-suggestions by default, with a per-viewer opt-in."
- **Inputs read:**
  - GitHub issue #159 — the owner intent, in-scope / out-of-scope, "done when", and the **critical
    naming constraint** (do not rename or replace the derived `fully-curated` state) encoded below.
  - `docs/VISION.md` — "What 'good' looks like" (a reader leaves with 2–5 clips they're glad they
    watched and understands how to weigh each; the plus side serves the self-directed learner first),
    the MVP loop, and the non-goals (OAuth-only, reading anonymous / contributing requires login).
  - `docs/TOPIC_PAGE_DESIGN.md` — §"Three states: empty / mixed / fully-curated" (the **derived**
    state model this spec must NOT alter, only disambiguate), §"Empty / zero-curation state",
    §"The General strip — the one crossover", §"Two infoboxes" (the wiki+ panel), §"Clip placement"
    + the TOC dual-count treatment — the committed Topic-page UX the suppression acts on.
  - `docs/ARCHITECTURE.md` — §"Data model" (the `topic` entity — where the new flag lives), §"Candidate
    suggestion & the empty state" (candidates are computed/cached, never stored; suppression is a
    presentation derivation), §"Prototype phase" (Server Actions + shared Postgres/Drizzle are built).
  - `docs/specs/curated-suggested-coexistence.md` (issue #60) — the derivation (`hasCurated` +
    `hasSuggestions` → empty / mixed / fully-curated) and the once-per-context unvetted-signal
    discipline that this flag's suppression switches off.
  - `docs/specs/skin-toggle.md` (issue #143) — the prior art for a **viewer-level, no-reload
    preference** layered over a cached read path without regressing cache-agnosticism; the per-viewer
    override here is the same shape, scoped tighter (session-local, per-topic, never persisted).
- **Hand-off:**
  - **UX / Design** — authors the design spec *before* Dev: the curator's mark/un-mark control and
    its placement + label (only signed-in); the unobtrusive **status indicator** on a complete topic
    and its two opt-in paths (turn on suggestions / add a video · curate); the per-viewer "show
    suggestions anyway" toggle and its reachability when logged-out; and the **complete + zero-video**
    minimal-plus-chrome render (calm, not blank or broken). UX owns wording, placement, and visual
    treatment; this spec sets only the outcomes and the model.
  - **Development** — implements against the UX design spec + the AC below: the `topic` flag + its
    two role-gated Server Actions, the default suppression derivation in `TopicView`, and the
    session-local per-topic override. *How* (the exact derivation seam, the override storage key) is a
    Dev call within the constraints in §3/§4.
  - **Curation / Editorial** — no new vocabulary needed; "marked complete" is a topic-level curation
    act, not a clip `stance`/`accuracy_flag`. Flagged here only so Editorial can confirm the
    indicator copy stays honest (it is a curator's judgment, not a site guarantee of completeness).
  - **QA & Review** verifies against the **Acceptance criteria** (§5); UX evaluates the built UI.

---

## 1. Problem

A curator who has finished a topic has no way to *say so*. They may have added every video they think
belongs — even if that is one, or zero — and decided the topic is done. But the Topic page keeps
nudging toward more videos regardless: auto-suggested, unvetted candidate tiles fill the General band
and the rail, dashed suggestion counts sit in the TOC, the "Suggested · uncurated" divider and the
"See N more" control persist, and the wiki+ panel keeps surfacing a suggestion volume. For a topic the
curator considers settled, this chrome is noise — it presents unvetted candidates the curator has
implicitly decided against, and it makes a deliberately-minimal topic read as perpetually unfinished.

Crucially, today's **derived** three-state model cannot express this. The `fully-curated` state (no
suggestion chrome) is reached *only* when there are zero **remaining** suggestions — an automatic
consequence of the candidate pool, not a curator's decision. A curator cannot reach a calm page while
suggestions still exist, and cannot declare a **zero-video** topic finished at all (zero curated + ≥1
suggestion is the `empty` bootstrap state, which is all suggestion chrome). The product is missing an
explicit "I'm done here" that a curator can set independent of the candidate counts.

## 2. User value

- **As a curator,** I can mark a topic complete (and un-mark it), so a topic I've finished stops
  surfacing unvetted suggestions to readers — the page reflects my judgment that curation is done,
  whether I curated many videos, one, or none.
- **As a reader of a complete topic,** I meet a calm, near-plain Wikipedia article with only an
  unobtrusive note that a curator marked it complete — no nudging toward more videos — *and* I retain
  a path to opt into suggestions for myself or to add a video if I disagree that it's done.
- **As the self-directed learner the plus side exists for** (`VISION.md`), I am not pushed unvetted
  candidates on a topic a human has declared settled, but I am never *locked out* of them: the opt-in
  is one click and the curated clips (if any) still read normally.

This protects "what good looks like": a complete topic with curated clips still shows those clips with
their full trust signals; a complete topic reads as a settled article, not an abandoned-looking empty
one. It honors VISION's "reader utility first" by keeping the opt-in available to anyone.

## 3. The naming decision + model (load-bearing)

### 3.1 The decision

| Concern | Decision |
|---|---|
| **DB field** (`topic` row) | `closed_to_suggestions` — boolean, `NOT NULL DEFAULT false` |
| **App / type field** | `closedToSuggestions` (camelCase, on the `Topic` type) |
| **User-facing verb / label** | **"Mark complete"** / a topic is **"marked complete"** (with the explanatory gloss **"closed to suggestions"**) |
| **Derived state (UNCHANGED)** | `fully-curated` — keep the existing name and meaning exactly |

The field name (`closed_to_suggestions`) and the user label ("complete") deliberately differ: the
**stored truth** is mechanical and precise (suggestions are closed), while the **reader/curator-facing
word** is the human intent ("I've finished this topic"). "Complete" is the verb the curator thinks in;
"closed to suggestions" is the gloss that says exactly what it does, so neither over-promises. We do
**not** name the field `complete` — that word collides conceptually with `fully-curated` and reads as a
site guarantee of completeness rather than one curator's judgment; `closed_to_suggestions` describes the
behavior (suppress suggestions) without claiming the topic is objectively finished.

### 3.2 Why it is distinct from `fully-curated` (the constraint)

`fully-curated` (per `TOPIC_PAGE_DESIGN.md` §"Three states") is an **automatically-derived** state:
`≥1 curated clip` **and** `0 remaining (deduped) suggestions`. It is a *consequence of the candidate
pool emptying out*, not a curator action, and it cannot apply at zero curated videos.

`closed_to_suggestions` is a **separate, explicit, curator-set flag** on the `topic` row. It differs on
every axis:

| | `fully-curated` (derived) | `closed_to_suggestions` (this flag) |
|---|---|---|
| Origin | Derived from counts | Explicitly set by a curator |
| Storage | Not stored (computed in `TopicView`) | Stored on the `topic` row (Postgres) |
| When it holds | Only when 0 remaining suggestions | Holds **even when suggestions exist** |
| At zero curated videos | Impossible (needs ≥1 curated) | **Allowed** (the intended end state) |
| Reversible | Changes as the pool changes | Reversible by any signed-in curator |
| Per-viewer override | n/a | Yes — session-local opt-in |

**This spec does not rename, replace, or change the derived three-state model** (empty / mixed /
fully-curated). It adds an **orthogonal topic-level flag** that, when set, suppresses suggestion chrome
*by default for that topic* regardless of which derived state the topic is in. The docs MUST be updated
to disambiguate the two (see §3.4); the derived model's behavior is untouched when the flag is off.

### 3.3 Interaction model (what the flag does)

`closed_to_suggestions = true` makes the **effective default** for every viewer be: *render the topic
as if it had no suggestions* — i.e. show only curated content (the `fully-curated` presentation when
≥1 curated clip; the minimal-plus render at 0 curated, §4.3). It does **not** delete, dismiss, or
rule out any candidate (no `dismissed_candidate` writes); the candidate pipeline is unchanged and
suggestions simply are not surfaced by default. A per-viewer override (§3.5) re-enables the normal
suggestion presentation **for that one viewer, on that one topic, for that session only**.

Curated content is **never** suppressed by this flag — curated clips, their chips, context notes, the
General band's curated group, and curated TOC counts all render exactly as they do today. The flag
suppresses only the **suggestion** layer.

### 3.4 Docs to update (disambiguation is part of done)

- `docs/TOPIC_PAGE_DESIGN.md` §"Three states" — add a short note that `fully-curated` is the
  *derived* no-suggestion state, and that a curator can *additionally* mark a topic **complete
  (closed to suggestions)** to suppress suggestions even when the derived state is `empty` or `mixed`;
  link to this spec. Do not alter the derived-state definitions.
- `docs/ARCHITECTURE.md` §"Data model" `topic` entity — add the `closed_to_suggestions` field;
  §"Candidate suggestion & the empty state" — note that suppression is a presentation derivation over
  the unchanged candidate pipeline (no pipeline change, no candidate storage change).

### 3.5 The per-viewer override (session-local, per-topic)

Any viewer — **including logged-out** — may turn suggestions back **on for themselves** on a complete
topic. The override is:

- **Per-viewer and local** — it changes nothing for any other viewer and does not change the topic's
  stored default. It is the viewer saying "show me the suggestions anyway."
- **Per-topic** — overriding on topic A does not affect topic B.
- **Session-local only** — it lives in client/session state (e.g. `sessionStorage`), **not** in the DB
  and **not** in a long-lived cross-device account preference. It need not survive a new browser
  session or cross devices (explicitly out of scope, §6). *(Implementation note for Dev/UX: prefer a
  mechanism that does not vary the cached read-path HTML per viewer — the suppression default is the
  same for everyone; the override is a client-side reveal, mirroring the skin-toggle read-path
  posture. The exact mechanism is a Dev call.)*
- **Reversible in-session** — a viewer who opted in can turn suggestions back off, returning to the
  complete-topic default presentation.

When a viewer has overridden, the topic renders its normal derived state (empty / mixed /
fully-curated) for that viewer — i.e. suggestions reappear exactly as if the flag were off.

### 3.6 Who can set / clear it

Setting and clearing `closed_to_suggestions` is a **curation act**: available to **any signed-in
curator** (the same bar as adding/curating). No moderation lock, no ownership restriction — any
signed-in curator can mark complete and any signed-in curator can un-mark it (§6). A **logged-out
reader cannot** set or clear the flag, and cannot add/curate; they can only use the per-viewer override
(§3.5) and follow the (login-gated) add/curate path.

---

## 4. Scope

### 4.1 In scope

- A topic-level `closed_to_suggestions` boolean (default `false`), persisted in shared Postgres, set
  and cleared by **any signed-in curator** via role-gated Server Action(s).
- **Default suppression** of *all* auto-suggestion chrome on a complete topic, for every viewer: no
  candidate tiles (General band or rail), no "Suggested · uncurated" divider, no "See N more" control,
  no dashed/suggested TOC counts, no rail "unvetted set" / `CandidateSetHeader`, and the wiki+ panel
  shows no suggestion volume / count line.
- A **session-local, per-topic, per-viewer override** to show suggestions anyway (logged-out
  included), reversible in-session, leaving the stored default and every other viewer unchanged.
- An **unobtrusive status indicator** on a complete topic with two paths: **(a) turn on suggestions**
  (the per-viewer override) and **(b) add a video / curate** (login-gated for logged-out viewers).
- The **complete + zero curated videos** render: a near-plain Wikipedia article with minimal plus
  chrome — calm, not blank or broken — carrying both opt-in paths.

### 4.2 Behavior across the derived states (when the flag is ON, no override)

| Topic's derived state | With `closed_to_suggestions = true` (default view) |
|---|---|
| `fully-curated` (≥1 curated, 0 suggestions) | Unchanged — already no suggestion chrome. The status indicator appears. |
| `mixed` (≥1 curated, ≥1 suggestion) | Renders like `fully-curated`: curated content only, **suggestion chrome fully suppressed** though suggestions exist. Status indicator + opt-in. |
| `empty` (0 curated, ≥1 suggestion) | Renders the **minimal-plus** zero-video view (§4.3) — *not* the suggestion-filled bootstrap. Status indicator + both opt-in paths. |

### 4.3 The complete + zero-video render

A topic marked complete with **zero curated videos** must render as a **near-plain Wikipedia article
with minimal plus chrome** — calm, not blank or broken:

- The article column renders normally (lead, sections, figures, the universal projector header).
- The plus rail does **not** show suggestion tiles, candidate counts, or the empty-state "N videos
  found to weigh in" volume block. The wiki+ panel's value line may remain (it orients the learner),
  but it carries **no suggestion volume** and no "curate a video found below" framing that points at
  suggestions that are being suppressed.
- The unobtrusive status indicator is present, stating the topic was marked complete, with the two
  opt-in paths: **turn on suggestions** (override) and **add a video / curate** (login-gated).
- It must not read as an error, a loading skeleton, or a dead empty page.

(UX owns the exact composition of this minimal render; this spec sets the outcome — calm, oriented,
not blank, with both paths.)

---

## 5. Acceptance criteria (numbered, testable)

Each is verifiable by QA against the built app.

1. **Curator can mark complete.** A signed-in curator viewing a topic with `closed_to_suggestions =
   false` can activate the mark-complete control; afterward the topic's stored
   `closed_to_suggestions` is `true`.
2. **Curator can un-mark complete.** A signed-in curator viewing a topic with `closed_to_suggestions =
   true` can clear it; afterward the stored value is `false` and the topic returns to its normal
   derived-state presentation by default.
3. **The flag persists (shared Postgres).** After a curator marks a topic complete, a *fresh* page
   load (new request / new session, any viewer) reads the topic as complete — the flag is durable in
   Postgres, not session/in-memory.
4. **Logged-out viewers cannot set or clear it.** A logged-out viewer is not offered (and cannot
   invoke) any control that changes `closed_to_suggestions`; an attempt to invoke the action without a
   signed-in curator is rejected and the stored value is unchanged.
5. **Default suppression — no candidate tiles.** On a complete topic with ≥1 remaining suggestion and
   no per-viewer override, no candidate/suggestion tiles render in the General band or the plus rail
   for any viewer.
6. **Default suppression — no "Suggested · uncurated" divider.** On the same topic, the General-band
   `Suggested · uncurated` divider does not render.
7. **Default suppression — no "See N more".** On the same topic, the "See N more" suggestion-overflow
   control does not render.
8. **Default suppression — no dashed/suggested TOC counts.** On the same topic, no TOC row shows a
   dashed/outline suggested (`~{s}`) count; only solid curated counts (or `no video`) appear. (TOC
   curated counts are unaffected.)
9. **Default suppression — no rail unvetted set header.** On the same topic, the rail
   `CandidateSetHeader` / "Suggested · uncurated" unvetted-set header does not render.
10. **Default suppression — no suggestion volume in the wiki+ panel.** On the same topic, the wiki+
    panel shows no suggestion count line (no `{V} curated · {M} suggested`, no dashed "{N} videos
    found to weigh in" block). (Curated counts, if any, still show.)
11. **Curated content is never suppressed.** On a complete `mixed` topic, every curated clip still
    renders with its full trust signals (stance + accuracy chips, context-note preview, `context by
    <curator>`), the General curated group renders, and curated TOC counts render — i.e. only the
    suggestion layer is suppressed.
12. **Per-viewer override re-enables suggestions locally.** On a complete topic, a viewer can activate
    a "show suggestions anyway" control; afterward suggestions render for that viewer exactly as the
    topic's normal derived state would (the chrome from AC 5–10 reappears for that viewer).
13. **The override is session-local and topic-specific.** The override is stored only in client/session
    state (not the DB): it does **not** change `closed_to_suggestions`, and applying it on topic A does
    not surface suggestions on a different complete topic B in the same session.
14. **The override does not affect other viewers.** With viewer X having overridden on a complete
    topic, a concurrent or subsequent **different** viewer (e.g. a fresh session / logged-out) of the
    same topic still sees the suppressed default — the stored default is unchanged for everyone else.
15. **The override is reversible in-session.** A viewer who overrode can turn suggestions back off,
    returning to the suppressed complete-topic default within the same session.
16. **Logged-out viewers can override.** A logged-out viewer can activate the per-viewer override and
    see suggestions, even though they cannot mark/un-mark complete or add/curate without logging in.
17. **Unobtrusive status indicator with both paths.** A complete topic (any derived state) shows an
    unobtrusive indicator that it was marked complete, carrying both a **turn-on-suggestions** path
    (the override) and an **add a video / curate** path (login-gated for logged-out viewers). It is
    not a blocking modal and not a loud banner that crowds out reading.
18. **Complete + zero videos renders minimal, calm chrome with both paths.** A complete topic with
    zero curated videos renders as a near-plain Wikipedia article with minimal plus chrome (no
    suggestion tiles, no empty-state suggestion-volume block), carrying the status indicator and both
    opt-in paths — it does not appear blank, broken, an error, or a loading skeleton.
19. **Accessibility baseline.** The mark/un-mark control, the override toggle, and the status
    indicator are keyboard-operable with visible focus, meet AA contrast, and carry text labels for
    their state (never color alone) — consistent with the project accessibility baseline.

---

## 6. Out of scope (explicit)

- **Renaming or changing the auto-derived three-state model** (empty / mixed / fully-curated). This
  spec only **disambiguates** it in the docs (§3.4) and layers an orthogonal flag on top.
- **Any cross-device / per-account persistence of the per-viewer override.** The override is
  session-local only; it need not survive a new session or cross devices, and it is never written to
  the DB or an account preference.
- **A moderation lock** that prevents other curators from un-marking complete. Any signed-in curator
  can reverse it; no ownership restriction, no lock.
- **An audit trail / history** of who marked complete and when (no `marked_by` / `marked_at` this run;
  the flag is a plain boolean).
- **Notifications / activity-feed entries** for the status change.
- **Suppressing or ruling out candidates in storage** (no `dismissed_candidate` writes from this
  flag; the candidate pipeline and its caching are unchanged).
- **Any change to curated content** — clips, chips, context notes, curated counts, the curate/add
  flows, upvotes, and moderation are untouched.

---

## 7. Success metric

**Primary — adoption of "settled" topics.** The share of curated topics (those with ≥1 curated clip)
whose curators mark complete, and the count of complete topics overall (including zero-video complete
topics) trending up over time, signals curators reaching for the "I'm done" declaration the feature
exists to provide. A healthy signal is that complete topics accumulate without a wave of un-marks
(un-mark rate stays low), indicating the mark reflects a real settled judgment rather than confusion.

**Secondary — the opt-in is used but not dominant.** On complete topics, a *non-trivial-but-minority*
share of sessions activate the per-viewer "show suggestions anyway" override. Near-zero would suggest
the suppression is unwanted-but-unnoticed or the opt-in is undiscoverable; a *majority* overriding
would suggest readers actively disagree that these topics are done (a signal to revisit the default).
The target is the calm default serving most readers while the minority who want more can always reach
it.

*(Analytics is a deferred role; these are the metric definitions Product owns until it splits out. No
instrumentation is required to ship this feature; the metrics define how we will judge it.)*
