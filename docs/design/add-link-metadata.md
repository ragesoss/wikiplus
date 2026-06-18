# Design Spec: Resolve real video metadata on add-by-link (issue #64)

- **Status:** v1, committed (Phase 2 / UX, build-loop for issue
  [#64](https://github.com/ragesoss/wikiplus/issues/64)). Written **before** implementation — this
  is the contract Development builds against, not a doc edited to match what shipped.
- **Owner:** UX / Design.
- **Inputs (read first — this spec grounds in them, does not restate them):**
  - `docs/specs/add-link-metadata.md` — the Product spec. This design serves **AC1–AC10**, the
    D-YouTube field mapping (settled), and the two recorded **Decisions** D-YouTube / D-TikTok. It
    makes the two UX calls the spec left open: the **"proceed unresolved" affordance** (AC5) and the
    **fallback copy/treatment** (AC4), and gives a UX recommendation on the **D-TikTok arm** and the
    **CORS approach** (both finalized by Dev).
  - `docs/CURATION_STANDARD.md` **§5.5 / Decision C10** (and §5.2 base creator-credit) — the credit
    contract for an oEmbed-resolved clip: minimum credit = real `author_name` + working `author_url`
    link; derive `creator.handle` like the candidate pipeline **or** name-only; an unresolved clip's
    credit must read as *unresolved* (no fabricated name, no fake/dead link, no false "resolved via
    oEmbed"). This spec embodies C10; it does not reopen it.
  - `docs/TOPIC_PAGE_DESIGN.md` — "Add a video" (§ "Add video"), the curated card anatomy the resolved
    metadata feeds (creator credit `name` / `handle · platformLabel`, outbound link — §5.2), and the
    Indigo Press identity + accessibility baseline.
  - `CLAUDE.md` — Indigo Press palette (`brand #676EB4`, `sprout #2A8270`, `action #1F6F95`,
    `ink #2C2C2C`; gold `#E5AB28` is a sparingly-used accent, **never a functional signal**) and the
    a11y baseline (AA contrast, visible focus, keyboard, text-labeled-not-color-alone, reduced-motion).
- **Implementable against (current code this spec extends, not redesigns):**
  `components/topic/AddModal.tsx` (the add-by-link modal — the **only** file whose UI this spec
  changes), `lib/embed/facade.ts` (`parseVideoUrl` / `ParsedVideo` — the existing parse step,
  preserved), `components/topic/curate-clip.ts` (`ClipMediaSource` — the media shape filled, unchanged),
  `components/topic/CurateForm.tsx` (`CurateFields` — the curation fields, unchanged), `lib/candidates/youtube.ts:111`
  (the handle-derivation Dev reuses), `components/topic/ClipCard.tsx` (the card credit the resolved
  preview mirrors), `components/topic/ModalShell.tsx` / `ModalActionRow.tsx` (dialog + action-row
  patterns reused verbatim).

> **Scope reminder (from the Product spec).** This changes **labeling/metadata + the modal flow**,
> nothing else: no schema change, no new secret, no read-path caching, no auth change, no change to
> embedding/playback or the curator-authored fields (note/stance/accuracy/section). The persisted
> `Clip` / `ClipMediaSource` shape is untouched (AC10) — this design only changes which **values**
> land in `caption` / `creator` / `thumbnailUrl`, and the **modal states** the curator moves through
> to get there.

---

## 1. Personas & user stories

The two personas issue #64 serves are already established in the project's personas; this spec names
the slice each one cares about here.

- **Mei — the curator (logged-in contributor).** Pastes a share link to add a clip auto-suggestion
  missed. She did the hard part — she'll write a context note, set stance/accuracy/section — and she
  needs the clip she's curating to be *the clip she means*: the right title, the right creator, a
  recognizable thumbnail. A "(mock preview)" placeholder undercuts her work and makes her doubt the
  tool. When the fetch fails she needs to **not be stranded** — a clear "couldn't fetch details," a
  retry, and an honest way to proceed.
- **Devi — the reader (anonymous).** Never sees this modal, but lives with its output. The curated
  card must **name the actual creator and video** and link out to them — that honest attribution is
  the floor of the product's promise (you can't weigh a creator's take if the card won't even say who
  they are). Devi is the reason a placeholder must *read as unresolved*, never masquerade as a real
  credit.

**User stories** (POV narratives; these feed Product's AC1–AC10):

1. *As a curator, when I paste a YouTube link and ask for details, I want to see the real title,
   creator name + link, and thumbnail **before I commit**, so I know I'm curating the right video.*
   → AC1, AC3.
2. *As a curator, I want the clip I add to carry that real metadata once I submit, so my note doesn't
   land on a "(mock preview)" label.* → AC2.
3. *As a curator, when the details can't be fetched, I want to be told clearly — not handed a fake
   creator — and I want a way forward (retry, proceed honestly, or cancel) so I'm never stuck.*
   → AC4, AC5.
4. *As a curator pasting a TikTok (or other partially-supported) link, I want the tool to be honest
   about what it can and can't resolve, so I'm not surprised by a placeholder later.* → AC6.
5. *As a curator who fat-fingers a non-video URL, I want the same clear "that's not a video link"
   nudge I get today, so I can fix the paste before anything is saved.* → AC9.
6. *As a reader, I want every curated card to name the real creator and link out to them, and I want a
   placeholder (when one exists) to read honestly as "creator not resolved," so I can trust what the
   card asserts.* → AC2, AC4 (C10).

---

## 2. The flow at a glance (state machine)

The modal already has two of these states (link-entry; the **Unrecognized link** parse error). This
spec adds the **resolving / resolved / resolution-failure** states between "Fetch details" and the
preview, and **corrects** the existing preview's copy. The curate fields + action row appear **only**
once a usable media source exists (resolved **or** an explicitly-accepted placeholder).

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │  A. LINK ENTRY  (initial)                                     │
                    │  url field + "Fetch details"; helper copy; no preview yet     │
                    └───────────────┬───────────────────────────────┬─────────────┘
                                    │ Fetch details                  │ Fetch details
                       parseVideoUrl │ → recognized                   │ → null (unrecognized)
                                    ▼                                 ▼
              ┌──────────────────────────────┐            ┌──────────────────────────────┐
              │  B. RESOLVING  (fetch in      │            │  F. UNRECOGNIZED LINK  (AC9)  │
              │  flight) aria-busy + polite   │            │  existing parse error, kept    │
              │  "Fetching video details…"    │            │  unchanged. No preview, no     │
              └───────┬───────────────┬───────┘            │  curate fields. Re-paste to    │
                resolve ok      resolve fails / offline /   │  retry.                        │
                      │          malformed / unsupported    └──────────────────────────────┘
                      ▼                       ▼
        ┌──────────────────────────┐  ┌──────────────────────────────────────────────┐
        │  C. RESOLVED (success)   │  │  D. RESOLUTION FAILURE  (AC4/AC5)              │
        │  real title→caption,     │  │  labeled "Couldn't fetch video details";       │
        │  creator name + outbound │  │  pasted link still shown; NO "resolved via     │
        │  link (+handle per C10),  │  │  oEmbed"; offers [Try again] + [Add anyway]   │
        │  real thumbnail.         │  │  + [Cancel].                                   │
        │  "Resolved via oEmbed"   │  └───────────────┬───────────────────┬───────────┘
        │  shows HERE ONLY (AC3).  │            Try again            Add anyway
        │  → curate fields + Add   │                  │                   │
        └──────────────────────────┘            back to B          ▼
                                                          ┌──────────────────────────────┐
                                                          │  E. UNRESOLVED PLACEHOLDER    │
                                                          │  accepted (AC5/C10)            │
                                                          │  clearly-labeled placeholder   │
                                                          │  credit ("Creator not          │
                                                          │  resolved"), NO outbound link, │
                                                          │  NO "resolved via oEmbed".     │
                                                          │  → curate fields + Add         │
                                                          └──────────────────────────────┘

      [G. TIKTOK / UNSUPPORTED PLACEHOLDER ARM]  — only if D-TikTok lands on the placeholder arm:
      a recognized TikTok/Instagram link skips B→C and resolves directly to E with an added
      MVP-limitation line. Honest by construction (see §6).
```

**One invariant across every branch:** the curate fields + the "Add & curate" action row render
**only** when a media source the curator has seen is in hand — state **C** (resolved) or state **E**
(explicitly-accepted placeholder). They never render in B (resolving), D (failure, undecided), or F
(unrecognized). This preserves the existing precondition ("a recognized link must have resolved before
submit is enabled" — AC9) while extending "resolved" to mean "resolved **or** placeholder-accepted."

---

## 3. State A — Link entry (initial)

The modal opens here. Layout is unchanged from today except the **helper copy** (which currently lies
about "no network call").

- **Header:** unchanged — `Add a video` on the `brand` bar, the `signed in as <username>` pill, and the
  `✕` Cancel.
- **URL field + button:** unchanged — the `Paste a YouTube or TikTok share link` label, the `type="url"`
  input (`name="link"`, the existing placeholder `https://youtu.be/… or https://www.tiktok.com/@user/video/…`),
  and the **`Fetch details`** button beside it.
- **Helper copy — REPLACE the current line.**
  - *Remove (verbatim, the false claim):* "We detect the platform from the link and mock a preview — no
    network call."
  - *New copy (verbatim):* **"We'll look up the video's title, creator, and thumbnail from the
    platform."**
  - Rationale: there now **is** a network call (or a server action), and we no longer "mock." The copy
    states what actually happens, plainly, without naming "oEmbed" to the curator (jargon — "oEmbed"
    belongs only in the resolved badge per AC3, and even there reads as a small technical eyebrow, see §5).
- **No preview, no curate fields, no action row** are shown until a fetch completes.
- **"Fetch details" enabled** whenever the field is non-empty (unchanged). Pressing it (or submitting
  the field by Enter — the input is in a form, so guard against the form-submit; "Fetch details" is the
  intended trigger) moves to **B (resolving)** for a recognized link, or **F (unrecognized)** for a parse
  miss. (Parse happens first, client-side, exactly as today; resolution only runs on a recognized link.)

---

## 4. State B — Resolving (fetch in flight)

New state. Non-blocking, accessible, brief. This is the window while the oEmbed metadata is fetched
(client fetch or server action — Dev's call, see §10).

- **Placement & treatment:** in the spot the preview block will occupy, render an inline **resolving
  panel** in the same container style as the preview (`border-l-4 border-brand bg-bg2 p-3`) so the
  layout doesn't jump when it resolves into C. It contains:
  - A **small spinner** (the project's existing spin treatment) **with `motion-reduce:hidden`** — under
    reduced-motion the spinner is suppressed and the text alone carries the state (CLAUDE.md
    reduced-motion baseline). Do **not** rely on the spinner to convey "busy."
  - **Visible text (verbatim):** **"Fetching video details…"**
  - The **pasted link** shown beneath, truncated, so the curator can confirm what's being looked up:
    `<p class="truncate text-[11px] text-muted">{link}</p>`.
- **a11y:**
  - Wrap the panel (or its text) in `role="status" aria-live="polite"` so the state change is announced
    to assistive tech **politely** (not assertive — this is informational, matching the project's
    `ModalActionRow` limit-notice and `ArticleBody` loading conventions). Announce **"Fetching video
    details"**.
  - Set **`aria-busy="true"`** on the panel (mirrors `ArticleBody` / `AuthControl`).
- **Controls during B:**
  - **"Fetch details" disables** and its label becomes **"Fetching…"** while in flight (so it can't be
    double-fired; mirrors the `publishBusyLabel` pattern in `ModalActionRow`).
  - **Cancel (`✕`)** stays available — the curator can always abandon (focus-trap + Esc still work via
    `ModalShell`).
  - No curate fields, no Add row yet.
- **No artificial delay.** B may be near-instantaneous on a fast resolve; that's fine — it's a real
  state, not a minimum-duration spinner. If the fetch is so fast B never paints, the announcement for C
  still fires (§5 a11y).

---

## 5. State C — Resolved (success) — the corrected preview

This is the **only** state that may claim "resolved via oEmbed" (AC3). It replaces today's preview,
which falsely shows that claim over mock text. The resolved preview **mirrors the curated card's credit
anatomy** (`ClipCard.tsx`) so the curator previews what the reader will see.

**Layout** (same container as today: `border-l-4 border-brand bg-bg2 p-3`, thumbnail + text column):

- **Thumbnail (real).** Replace today's gradient placeholder `<span>` with an actual `<img>` of the
  resolved `thumbnailUrl` (oEmbed `thumbnail_url`, falling back to the parser's `i.ytimg.com/…/hqdefault.jpg`
  per D-YouTube). Keep the existing frame (`h-16 w-24 shrink-0 border-2 border-ink`, `object-cover`).
  - `alt=""` (decorative — the title beside it carries the meaning; mirrors the card's `aria-hidden`
    thumb). If the image 404s, fall back to the gradient placeholder treatment so the row never breaks
    (a missing thumbnail is **not** a resolution failure — title + creator still resolved).
- **Platform pill (unchanged):** the `bg-ink … text-white` `{PLATFORM_LABEL}` pill (e.g. `YOUTUBE`).
- **Resolved eyebrow — corrected (verbatim):** **"Resolved via oEmbed"** in the existing small
  uppercase `text-violet` eyebrow style. This line is rendered **only in state C** — never in B, D, E,
  F, or G. It is the *honest* version of today's contradiction. (It is fine for it to read as a small
  technical eyebrow; it is reassurance that the title/creator below are real, not curator-facing jargon
  to act on.)
- **Title → caption (real, verbatim from oEmbed `title`).** Replace today's hard-coded "Pasted clip
  (mock preview)" with the real `title`, in the existing `text-[13px] font-bold text-ink` line. Clamp to
  two lines (`line-clamp-2`) so a long title doesn't blow out the modal.
- **Creator credit (real — the C10 floor).** Below the title, render the creator credit **mirroring the
  card** (`ClipCard.tsx` lines 98–118), as an **outbound link**:
  - An `<a href={creator.url}` `target="_blank"` `rel="noopener">` wrapping:
    - the creator **name** (`creator.name` = oEmbed `author_name`) in a bold line, and
    - **`{handle} · {platformLabel}`** beneath, where `handle` is derived per the candidate pipeline
      (`@` + author name, lowercased, spaces removed — `lib/candidates/youtube.ts:111`).
  - **C10 degraded form (name-only).** If no sensible handle derives, show **`{name}`** then
    **`{platformLabel}`** alone (drop the `@handle ·`), still wrapped in the outbound `author_url` link.
    **Never** show an empty or fake handle, and never the literal `"pasted"`.
  - The link is the **C10 minimum credit made visible**: real name + working outbound link. The eyebrow
    "Resolved via oEmbed" + this real, clickable credit together tell the curator the attribution is
    genuine.
- **Pasted link** line: may be dropped in C (the resolved credit supersedes it) or kept small/muted —
  UX prefers **dropping** it in C to reduce clutter, since the real title+creator now identify the
  video. (It remains shown in B, D, E, F where there's no resolved identity yet.)
- **Then:** the existing `CurateFields` + `ModalActionRow` render exactly as today (note/stance/accuracy/
  section + the required CC BY-SA agreement + "＋ Add & curate"). **No change** to the curate surface or
  the submit lifecycle.

**a11y for the C transition:** when resolution completes, the `role="status" aria-live="polite"` region
announces the success, e.g. **"Video details resolved: {title} by {creator.name}."** Move focus to the
**first curate field** (the Context note textarea) so a keyboard/AT user lands where the work continues —
the preview itself is read by the polite announcement, the textarea is the next action. (Match the
focus-on-reveal discipline `CurateForm`'s agreement region already uses.)

**On submit (AC2):** the persisted clip's `caption` = the real title, `creator.name`/`handle`/`url` = the
real channel (name, derived-or-omitted handle, `author_url`), `thumbnailUrl` = the real thumbnail. The
strings **"Pasted clip (mock preview)"**, **"pasted"** (handle), and **"Pasted {platform} clip"** (name)
**must not** appear on a resolved clip. (Dev contract — this spec's UI never emits them in state C.)

---

## 6. State D — Resolution failure (AC4) + the "proceed unresolved" call

New state, reached when a **recognized** link's metadata can't be fetched: provider/network error,
malformed or empty oEmbed response, or offline. It is **visibly distinct** from success (C) and must
**never** claim "resolved via oEmbed" or show fabricated metadata (AC4, C10).

> **It is NOT the §F parse error.** F (Unrecognized link) is "this isn't a video URL at all" (parse
> failure, pre-resolution); D is "this is a valid YouTube/TikTok link but we couldn't fetch its
> details" (resolution failure). They are different copy and different treatments (see §7 for the
> contrast). AC9 keeps F intact; AC4 adds D.

**Treatment** (deliberately differentiated from the brand-bordered success/resolving panel — failure
gets the project's **warning** treatment, not the brand-left-border preview):

- A bordered notice in the established failure style used elsewhere in this modal — `border-2`,
  pale-warning fill, `font-semibold` — but **distinct from the red `accred` "Unrecognized link" alert**
  (F). Use the **action/blue** family (or a neutral warning), **not** red: a fetch failure is "we
  couldn't reach it / try again," not "you did something wrong" (red is reserved for the validation
  error and over-length). The label text — not the color — carries the meaning (CLAUDE.md non-color
  rule).
- **`role="alert"`** (assertive — the curator pressed a button and needs to know it didn't work; this
  is an outcome, like `ModalActionRow`'s error variant), OR escalate the polite `role="status"` region's
  message — Dev may keep one live region and swap its content; either satisfies "announced."
- **Heading copy (verbatim):** **"Couldn't fetch video details"**
- **Body copy (verbatim):** **"We recognized the link but couldn't load its title, creator, or
  thumbnail right now. Check your connection and try again, or add it with the details unresolved."**
- The **pasted link stays visible** (truncated, `text-muted`) beneath the body, so the curator sees
  what failed and can confirm it's the link they meant.

**The "proceed unresolved" affordance — UX DECISION (resolves the spec's open question).**

> **DECISION (UX, AC5): offer an explicit "Add anyway" path, not retry-only.** State D presents
> **three** controls, so a graceful outcome is always reachable (AC5) and the curator is never trapped:
>
> 1. **"Try again"** — primary affordance; re-runs the resolve (→ back to **B**). This is the
>    encouraged path (most failures are transient — offline, a hiccup). Bordered button, brand/action
>    weight, the visual primary.
> 2. **"Add anyway"** — secondary; accepts an **unresolved placeholder** clip and moves to **E**. This
>    guarantees the curator's work (the note they're about to write) is never blocked by a flaky fetch.
>    Lower-emphasis than "Try again" (plain/outline button) so retry is clearly preferred, but it is a
>    real, reachable path.
> 3. **"Cancel"** — closes the modal (the existing `✕` / Cancel).
>
> *Why this over retry-only:* the guardrail metric (the spec's success-metric guardrail) is "the
> add-by-link flow does not get *less* completable." Retry-only would strand a curator whose provider is
> genuinely unreachable (a private/region-locked video, a persistently-CORS-blocked provider, a
> down oEmbed endpoint) — their written note would have nowhere to land. "Add anyway" keeps the flow
> completable **while** the honesty rule (C10) guarantees the placeholder reads as unresolved, never as a
> real creator. Retry-first ordering keeps the resolved path the default outcome (so the success metric —
> ~100% real-metadata YouTube adds — isn't undermined by an over-eager escape hatch).

**a11y / keyboard for D:** all three controls are real `<button>`s, in DOM order **Try again →
Add anyway → Cancel**, each keyboard-focusable with a visible focus ring; the focus trap (`ModalShell`)
keeps Tab inside. On entering D, move focus to **"Try again"** (the primary recovery) so a keyboard user
can recover with one Enter. The failure heading is in the live region so AT hears it.

---

## 7. State E — Unresolved placeholder accepted (AC5 + C10)

Reached **only** by an explicit curator act — pressing **"Add anyway"** in D (or arriving directly via
the TikTok/unsupported placeholder arm, §8). This is the **honest placeholder**: it lets the curator
proceed, but its credit must **read as unresolved**, never masquerade as a real creator (C10, the credit
analogue of §5.4's "seed clip · no curator").

**Treatment** (a preview block, but **plainly marked as a placeholder** — NOT the brand-left-border
"resolved" preview, and NOT carrying any outbound creator link):

- Use a **neutral/muted** container (e.g. `border-2 border-dashed border-ink/30 bg-bg2 p-3`) — the
  **dashed** border deliberately echoes the project's "un-vouched / not-real" candidate visual language
  (`TOPIC_PAGE_DESIGN.md` unvetted treatment), signaling "this isn't confirmed." The solid brand-left
  border of C is reserved for resolved.
- **Platform pill:** the `{PLATFORM_LABEL}` pill as in C (the platform *is* known — it parsed).
- **NO "Resolved via oEmbed" eyebrow** (C10/AC4 — it wasn't). Instead, a small text eyebrow (verbatim):
  **"Not resolved"** in a muted style (`text-muted`, uppercase like the other eyebrows). Text carries it,
  not color.
- **Placeholder caption (verbatim):** **"Unresolved {Platform} clip"** (e.g. "Unresolved YouTube clip",
  "Unresolved TikTok clip"). This reads honestly as a stand-in, not a real title. It must **not** be
  "Pasted clip (mock preview)" (the old mock string, AC2/C10).
- **Placeholder credit — reads as unresolved, NOT a real creator (C10).** Render as **plain text, NOT a
  link** (no outbound `creator.url` — a fake/dead link is a C10 violation):
  - **Creator line (verbatim):** **"Creator not resolved"**
  - beneath it, the platform in words: **"{platformLabel}"** (e.g. "YouTube").
  - No avatar circle, no `@handle` (an avatar/handle would dress it up as a real credit). It is the
    credit analogue of the non-linked **"seed clip · no curator"** label — honest, non-linked, plainly a
    stand-in.
- **The pasted link stays visible** (truncated, `text-muted`) — it's the one real, verifiable thing, and
  it's what the reader's card will link `watchUrl` to (playback still works via the parsed `embedUrl`,
  AC7).
- A small reassurance line beneath (verbatim): **"You can still add and curate this clip — the video
  plays, but its title and creator weren't fetched."** (Sets expectations: the embed works; only the
  metadata is missing.)
- **Then:** `CurateFields` + `ModalActionRow` render exactly as in C — the curator writes their note and
  adds. The note is real; only the video's auto-metadata is a labeled placeholder.

**Persisted placeholder (Dev contract — C10/AC4):** on submit of an E-state clip, `caption` =
`"Unresolved {Platform} clip"`, `creator.name` = `"Creator not resolved"`, **`creator.url` is omitted**
(no fake/dead link), `creator.handle` is **omitted** (no `"pasted"` placeholder handle). `watchUrl` /
`embedUrl` / `thumbnailUrl` come from the parse (real, AC7). Nothing claims "resolved via oEmbed."

> **Reader-side consequence (informational, not new work).** On the card, a "Creator not resolved" clip
> renders the creator line as **plain text** (no outbound link) — the card's credit `<a>` should degrade
> to a non-link span when `creator.url` is absent. UX flags this so Dev confirms the card doesn't render
> a dead/empty `href`; it is the read-path realization of C10's "no fake outbound link." (Whether the
> card needs a tiny "details unresolved" affordance is **out of scope** for #64 — this spec governs the
> *add modal*; the card already handles a missing `creator.url` gracefully or Dev makes it do so.)

---

## 8. State G — TikTok / unsupported placeholder arm (AC6) + the D-TikTok UX recommendation

The Product spec leaves **D-TikTok** as a recorded decision Dev finalizes: TikTok either **resolves**
(behaves like YouTube → states B→C) or lands on the **graceful placeholder** (→ state E) with the MVP
limitation made visible. This spec is written so **both arms hold** and gives a UX recommendation.

> **UX RECOMMENDATION (Dev finalizes): land D-TikTok on the placeholder arm for this loop.**
> *Reasoning from a UX standpoint:* TikTok's oEmbed is markedly less reliable for our use than
> YouTube's (CORS posture, `author_url`/thumbnail availability, and embed/script fragility — TikTok
> auto-suggestion is **already deferred** in ARCHITECTURE for exactly this reason). A resolve that
> works intermittently produces an *inconsistent* curator experience (sometimes real, sometimes the
> failure state) on a path the product already treats as partial. A **consistent, honest placeholder**
> for TikTok is the calmer, more trustworthy MVP experience: the curator always knows what they're
> getting, and C10's honesty rule guarantees it reads correctly. **If** Dev finds TikTok oEmbed
> resolves cleanly with the descriptive User-Agent (AC8) and without CORS/embed fragility, the
> resolve arm (B→C) is welcome — the UX holds either way. *Record the chosen arm in this spec or
> ARCHITECTURE.*

**If TikTok (and other recognized-but-unresolvable platforms — Instagram, "other") land on the
placeholder arm**, state G is **state E with one added line**, so it reads honestly as an MVP limitation
rather than a failure the curator could fix by retrying:

- Skip B→C/D; on "Fetch details" of a recognized TikTok/Instagram link, go **directly to E** (the
  unresolved-placeholder treatment in §7), with **no "Try again"** (retrying won't help — it's a support
  limitation, not a transient error).
- **Added MVP-limitation line (verbatim), shown above the E reassurance line:** **"We don't fetch
  {Platform} video details yet — you can still add and curate this clip."** (e.g. "We don't fetch TikTok
  video details yet…"). This is honest about *why* (a current product limitation), not alarming, and
  doesn't imply the curator erred.
- Everything else is E: dashed container, "Not resolved" eyebrow, "Unresolved {Platform} clip" caption,
  "Creator not resolved" non-linked credit, pasted link visible, curate fields + Add. The persisted shape
  is the E placeholder (no fake name/link, no "resolved via oEmbed").
- **a11y:** the MVP-limitation line lives in the polite `role="status"` region announced on entering the
  state. Focus moves to the first curate field (as in C/E) since there's no "Try again" to recover to.

> **If Dev chooses the TikTok resolve arm instead:** TikTok behaves exactly like YouTube — B (resolving)
> → C (resolved, with the real TikTok title/creator/thumbnail and "Resolved via oEmbed") on success, or
> D (failure) on a genuine fetch error (where "Try again" + "Add anyway" apply). No new states; G simply
> isn't used. The placeholder copy in §7 still governs any TikTok *failure* that drops to E via "Add
> anyway."

---

## 9. State F — Unrecognized link (AC9) — preserved, made distinct from D

**Unchanged in behavior; this spec only ensures it stays distinct from the new failure state D.** The
existing pre-persistence parse validation (`parseVideoUrl` returns `null`) keeps its current treatment:

- The existing **red `accred` alert** (`border-2 border-accred bg-[#FDEDED] … text-accred`,
  `role="alert"`), copy **verbatim, unchanged:** **"Unrecognized link — paste a YouTube or TikTok URL."**
- **No preview, no resolving panel, no curate fields, no Add row** — the link never reaches resolution
  or persistence (AC9).
- **The distinction from D, made explicit (so the two never blur):**
  | | **F — Unrecognized link (AC9)** | **D — Resolution failure (AC4)** |
  |---|---|---|
  | Cause | the paste **isn't a video URL** (parse miss) | a **valid** YouTube/TikTok link, fetch failed |
  | Color/treatment | **red** validation alert | **action/blue** (or neutral) warning notice |
  | Copy | "Unrecognized link — paste a YouTube or TikTok URL." | "Couldn't fetch video details" + body |
  | Recovery | re-paste a valid link (no in-state buttons) | **Try again** / **Add anyway** / Cancel |
  | Reaches resolution? | **no** | yes (it tried) |
  - The different *color families* are a reinforcing cue, but the **labels** ("Unrecognized link" vs.
    "Couldn't fetch video details") carry the difference (non-color rule). A curator (and AT user) can
    tell "I pasted the wrong thing" from "the lookup failed" by text alone.

---

## 10. CORS / where the fetch runs — UX recommendation (Dev finalizes)

The Product spec leaves **client-vs-server (CORS)** an open Dev call. From a UX standpoint **either is
acceptable** — the states above are agnostic to where the fetch runs — but:

> **UX RECOMMENDATION: a small server action / route handler.** It is the natural place to attach the
> **descriptive User-Agent** (AC8), it sidesteps the CORS uncertainty on `youtube.com/oembed` (a
> client fetch that CORS-blocks would push *every* add into state D — a UX regression that defeats
> AC1), and it keeps the resolved/failure split clean (a real 200-with-metadata vs. anything else =
> failure). It stays stateless — no schema, no secret, no cache (per scope). **If** Dev confirms the
> client fetch works cross-origin reliably, client-side is fine and AC8 is satisfied vacuously. *Record
> the chosen approach (and the D-TikTok arm) in this spec or ARCHITECTURE.* The UX holds either way:
> the curator only ever sees A→B→{C|D|E|F|G}.

This choice does **not** change any state, copy, or layout in this spec — it only affects whether B's
fetch is a `fetch()` in the client or an awaited server action, both of which present identically.

---

## 11. Responsive behavior

The modal is a `ModalShell` with `className="w-full max-w-lg"` and the form is
`max-h-[90vh] overflow-y-auto`. The added states keep that envelope.

- **Desktop / ≥`sm`:** modal centered, `max-w-lg`. The resolving/resolved/placeholder panels are the
  existing two-column (thumbnail left, text right) preview row; the **D failure controls** (Try again /
  Add anyway / Cancel) sit in a row.
- **Mobile / <`sm`:** `ModalShell`'s `p-4` + `w-full` already make the dialog effectively full-width on
  a phone; the `max-h-[90vh] overflow-y-auto` lets the curate fields scroll. Specifics:
  - The **URL field + "Fetch details"** keep the existing `flex gap-2` row; if cramped, the button may
    wrap below the input — acceptable (it's `shrink-0`).
  - The **D failure controls stack vertically** (full-width buttons, `Try again` on top) under `sm`, so
    they're thumb-friendly and the primary recovery is the topmost target. (Match the modal-action
    stacking the project already uses on narrow widths.)
  - The **resolved/placeholder preview** keeps thumbnail-left; on the narrowest widths the title
    `line-clamp-2` and the credit `truncate` prevent overflow (as the card already does).
  - Tap targets: all buttons and the creator link meet a comfortable touch size (the existing button
    padding suffices; the C creator link is a full row).

---

## 12. Accessibility requirements (baseline, written into the contract)

All of these are mandatory (CLAUDE.md baseline; AA, focus, keyboard, text-not-color, reduced-motion):

1. **Loading announcement (B).** The resolving state is announced via a `role="status"
   aria-live="polite"` region ("Fetching video details") and the panel carries `aria-busy="true"`. The
   spinner is **decorative** (`aria-hidden`) and **suppressed under `motion-reduce`** — text alone
   conveys "busy."
2. **State-change announcements.** Success (C) and failure (D) and the TikTok-limitation (G) are each
   announced — C/G via the **polite** live region (informational), D via **`role="alert"`** (assertive
   outcome) or the same live region with the failure message. One live region whose content swaps is
   acceptable.
3. **Focus management on state change.**
   - B: keep focus on "Fetch details" (now "Fetching…", disabled) → the trap holds; or let it rest, the
     announcement covers it.
   - **C / E / G:** move focus to the **Context note textarea** (the next action) on reveal.
   - **D:** move focus to **"Try again"** (the primary recovery).
   - `ModalShell` already traps Tab, closes on Esc, and **returns focus to the trigger** on close — all
     reused unchanged.
4. **Visible focus** on every interactive element — the URL field, "Fetch details", the C creator link,
   the D buttons (Try again / Add anyway / Cancel), the curate fields, and the Add/Cancel row. Use the
   project's existing focus-visible treatment (no new pattern).
5. **Text-labeled, never color alone.**
   - F (red) vs. D (blue/neutral) are differentiated by **label text** ("Unrecognized link…" vs.
     "Couldn't fetch video details"), not only color.
   - "Resolved via oEmbed" (C) vs. "Not resolved" (E) is a **word**, not a color, distinction.
   - Gold (`#E5AB28`) is **not** used as a functional signal anywhere in this flow (CLAUDE.md).
6. **AA contrast** for every new string against its fill: the corrected helper copy, "Fetching video
   details…", "Resolved via oEmbed", the real title/credit, "Couldn't fetch video details" + body, the D
   button labels, "Not resolved" / "Unresolved {Platform} clip" / "Creator not resolved" / the
   reassurance + MVP-limitation lines. Verify each text-on-fill pair (`text-violet` eyebrow on `bg-bg2`;
   the action/blue failure notice; the dashed-placeholder `text-muted`) meets WCAG AA.
7. **Keyboard operability** of recovery: "Try again" and "Add anyway" are real buttons reachable and
   activatable by keyboard; the whole flow is completable without a pointer.
8. **Reduced-motion:** the only motion is B's spinner; it's `motion-reduce:hidden`. No other animation is
   introduced.
9. **Decorative images:** the real thumbnail `<img>` uses `alt=""` (the title carries meaning); a broken
   thumbnail falls back to the gradient placeholder, never a broken-image icon with no alt.

---

## 13. Copy table (every new/changed string, verbatim — Dev uses these exactly)

| # | Where | String (verbatim) | Notes |
|---|---|---|---|
| 1 | A — helper, **replaces** the false "…mock a preview — no network call." | **We'll look up the video's title, creator, and thumbnail from the platform.** | No "oEmbed" jargon to the curator; no "mock"/"no network" claim. |
| 2 | A — "Fetch details" button (idle) | **Fetch details** | Unchanged. |
| 3 | B — button busy label | **Fetching…** | Disabled while in flight. |
| 4 | B — resolving panel text + announcement | **Fetching video details…** | `role="status"` polite; `aria-busy`. |
| 5 | C — resolved eyebrow (**only** state that shows it) | **Resolved via oEmbed** | Corrected: now truthful (AC3). |
| 6 | C — title | *(real oEmbed `title`)* | Replaces "Pasted clip (mock preview)" (AC1/AC2). |
| 7 | C — credit | *(real `creator.name`)* / **{handle} · {platformLabel}** | Outbound `author_url` link; name-only if no handle (C10). |
| 8 | C — success announcement | **Video details resolved: {title} by {creator.name}.** | Polite live region. |
| 9 | D — heading | **Couldn't fetch video details** | Blue/neutral, NOT red; distinct from F. |
| 10 | D — body | **We recognized the link but couldn't load its title, creator, or thumbnail right now. Check your connection and try again, or add it with the details unresolved.** | Pasted link shown beneath. |
| 11 | D — primary button | **Try again** | Re-runs resolve → B. Gets focus on entering D. |
| 12 | D — secondary button | **Add anyway** | → E (accept placeholder). Lower emphasis. |
| 13 | D — tertiary | **Cancel** | Existing `✕`/Cancel. |
| 14 | E — eyebrow (replaces the C "Resolved via oEmbed") | **Not resolved** | Muted; text, not color (C10/AC4). |
| 15 | E — placeholder caption | **Unresolved {Platform} clip** | e.g. "Unresolved YouTube clip". NOT "Pasted clip (mock preview)". |
| 16 | E — placeholder creator (NON-link, no avatar/handle) | **Creator not resolved** + **{platformLabel}** | No `creator.url`, no `@handle` (C10). |
| 17 | E — reassurance | **You can still add and curate this clip — the video plays, but its title and creator weren't fetched.** | Sets expectation: embed works. |
| 18 | G — added MVP-limitation line (placeholder arm only) | **We don't fetch {Platform} video details yet — you can still add and curate this clip.** | e.g. "…TikTok…". Honest limitation, no "Try again". |
| 19 | F — unrecognized link (UNCHANGED) | **Unrecognized link — paste a YouTube or TikTok URL.** | Red `accred` alert; AC9, no change. |

---

## 14. Acceptance-criteria traceability

| AC | How this design satisfies it |
|---|---|
| **AC1** — YouTube resolves into the preview (real title + creator + thumbnail) | **State C** (§5): real `title`→caption, real `creator.name` + outbound `author_url`, real thumbnail `<img>`, all shown before submit. |
| **AC2** — YouTube resolves into the persisted clip | §5 "On submit" — Dev contract: real `caption`/`creator`/`thumbnailUrl`; the mock strings ("Pasted clip (mock preview)", "pasted", "Pasted {platform} clip") never appear in state C. |
| **AC3** — preview updates before submit; "resolved via oEmbed" only on a real resolve | Flow §2 (B→C before the Add row); §5 — the "Resolved via oEmbed" eyebrow renders **only** in C, never in B/D/E/F/G; copy table #5 vs. #14. |
| **AC4** — failure → clear labeled state, never a silent mock, distinct from success | **State D** (§6): "Couldn't fetch video details" warning (blue/neutral), pasted link visible, **no** "resolved via oEmbed"; visually distinct (dashed/warning vs. brand-border success). **State E** placeholder credit "Creator not resolved" (C10) reads as unresolved. |
| **AC5** — failure never traps; a graceful outcome always reachable | §6 DECISION — three controls **Try again / Add anyway / Cancel**; "Add anyway" → **E** (a real completable path) guarantees the curator's note always has a home. Keyboard-reachable; focus to "Try again". |
| **AC6** — TikTok handled per the recorded decision | §8 — recommendation = placeholder arm (**state G** = E + MVP-limitation line, honest, no false claim); **or** resolve arm (B→C) if Dev confirms it's practical. Either arm never claims unverified metadata, never throws. |
| **AC7** — embed-never-host preserved | The flow changes only metadata text + a thumbnail **reference** URL; `embedUrl`/`watchUrl` + click-to-load are untouched; the placeholder (E) still plays via the parsed `embedUrl`. No media fetched/stored. |
| **AC8** — descriptive User-Agent on any server-side fetch | §10 — UX recommends a server action precisely because it's the natural home for the descriptive User-Agent; if client-side, AC8 is vacuous. Dev records the approach. (No UI implication.) |
| **AC9** — unrecognized links still hit existing validation, no regression | **State F** (§9): the existing red `accred` "Unrecognized link — paste a YouTube or TikTok URL." alert, no preview, never reaches persistence — **unchanged**; explicitly differentiated from D. |
| **AC10** — no schema change, no new secret | Scope reminder (top) + §5/§7 fill existing `ClipMediaSource` fields only; no new field, no key. (UI/contract-level; Dev confirms in code.) |

---

## 15. C10 / Curation-standard rules honored (explicit)

- **Minimum credit = real name + working link (C10/§5.2).** State C renders `creator.name` (oEmbed
  `author_name`) + an **outbound link** to `author_url` — the load-bearing credit. The "Resolved via
  oEmbed" eyebrow appears only when this real credit is present.
- **Handle derivation (C10).** `creator.handle` derived the candidate-pipeline way (`@` + author name,
  lowercased, spaces removed — `lib/candidates/youtube.ts:111`); **name-only is acceptable** when no
  sensible handle derives; the literal **`"pasted"`** handle never appears on a resolved clip.
- **Unresolved reads as unresolved, never a real creator (C10/§5.5).** State E (and G): a **non-linked**
  "Creator not resolved" credit, an "Unresolved {Platform} clip" caption, a "Not resolved" eyebrow — **no
  fabricated name, no fake/dead outbound link, no "resolved via oEmbed" claim**. It is the credit analogue
  of §5.4's non-linked "seed clip · no curator".
- **Embed-never-host + descriptive User-Agent confirmed (C10/AC7/AC8).** oEmbed = metadata only; the
  thumbnail is a referenced URL; the placeholder still plays via the parsed `embedUrl`; the server-side
  fetch (if used) carries the descriptive User-Agent. No new obligation.

---

## 16. Hand-off

- **To Development.** Build the A→B→{C|D|E|F|G} flow in `components/topic/AddModal.tsx` (the only file
  whose UI changes): replace the helper copy (#1), add the resolving panel (B), wire the resolve into
  "Fetch details", populate the **real** preview (C) mirroring `ClipCard.tsx`'s credit, implement the
  **failure** state (D) with **Try again / Add anyway / Cancel**, the **unresolved placeholder** (E,
  honest non-linked credit per C10), and the **TikTok/unsupported** arm (G) if D-TikTok lands on the
  placeholder arm. Keep state **F** (Unrecognized link) and the existing submit lifecycle / required
  CC BY-SA agreement **unchanged**. Use the copy in §13 verbatim. Finalize + **record** the D-TikTok arm
  (UX recommends placeholder) and the CORS approach (UX recommends a server action with the descriptive
  User-Agent) — the UX holds either way. No schema change, no new secret (AC10). Then hand to QA & Review.
- **To QA & Review / UX evaluation (after build).** Verify AC1–AC10 against §14; UX will evaluate the
  built modal against this spec — visual fidelity of C/D/E/G, the corrected copy, focus moves, the polite
  loading announcement, AA contrast of the new strings, and that no path is a dead end and no placeholder
  masquerades as a real credit (C10).
- **Not in scope here (route elsewhere):** the `stance`/`accuracy`/credit *vocabulary* → Curation/
  Editorial (embodied, not defined, here); acceptance criteria / metrics → Product; implementation,
  the CORS + D-TikTok code decisions, the card's missing-`creator.url` rendering → Development;
  correctness/security verification → QA & Review.
