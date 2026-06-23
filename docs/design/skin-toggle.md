# Design spec: In-app skin toggle (light ↔ zine-dark)

- **Status:** Design contract for build-loop (UX) — GitHub issue #143. Written **before** Dev.
- **Owner:** UX / Design
- **Implements:** The user-facing control deferred by #119 — the in-app switch between the default
  **light Indigo Press zine** and the **zine-dark** skin, the instant no-reload switch, and the
  reflection of an OS-default skin. The *persistence* mechanics (cookie + per-user DB, the
  cache-agnostic guarantee, the `prefers-color-scheme` resolution order) are Product/Dev calls
  fixed in the spec; this doc is the **control's** contract — its form, placement, states, microcopy,
  iconography, interaction, responsive behavior, and accessibility, on **both** skins.
- **Inputs read:** `docs/specs/skin-toggle.md` (AC1–AC16; §6.1 persistence model, §6.2 OS default,
  §6.3 logged-out reachability, A3.1 binary); `docs/design/skin-system-zine-dark.md` (§4 the dark
  plus palette + AA ratios, §4.5 focus ring, §6 the flat Tier-C dark header, §8 not-color-alone);
  `docs/VISUAL_IDENTITY.md` (§10.1 the universal projector header, §7.3 gold-is-decorative);
  `docs/TOPIC_PAGE_DESIGN.md` (the two-world header, chip vocabulary); `components/header/SiteHeader.tsx`
  (the FOUR hosts: home / topic / page / flat, the persistent chrome row, the `< md` narrow-search
  collapse); `components/auth/AuthControl.tsx` + `components/header/HeaderAuth.tsx` (the auth
  affordance, the breakpoint-driven `home` ↔ `topic-compact` skin, the `narrowSearchExpanded`
  icon-only collapse, the logged-in Radix account menu); `app/layout.tsx` (`SKIN_BOOTSTRAP`);
  `app/globals.css` (the committed `[data-skin="zine-dark"]` token block + `--color-focus-ring`).
- **Hand-off:** Development builds the control per this doc + the persistence per spec §6, records the
  architecture decision in `docs/ARCHITECTURE.md`, updates `docs/VISUAL_IDENTITY.md` (the header gains
  a control), and refreshes the screenshot gallery on **both** skins. QA verifies AC1–AC16. UX
  evaluates the built control on both skins.

This is the design contract for the **control**, not a CSS authoring guide. Token names and the
committed dark-skin values are cited so Dev never guesses; the exact CSS/markup is Dev's within these
references.

---

## 1. Personas / stories served

Grounded in spec §1 and `skin-system-zine-dark.md` §1. A skin is **chrome, not content** — these
stories are about comfort and reach, never about changing what the product *says*.

- **The low-light reader (logged-out).** *As a reader viewing wiki+ at night or in a dim room, I want
  to switch the bright white article column to the dark presentation from inside the app — without
  making an account — so the page stops glaring, while the fact-vs-opinion signals and curation
  context stay exactly as legible and labeled.* → The control must be **present and operable
  logged-out**, on a persistent affordance, with no account required (AC1).
- **The dark-mode-default reader.** *As a reader whose device is set to dark, I'd like wiki+ to meet
  that preference on first visit without flipping anything — and if I do open the control, I want it
  to honestly tell me which skin I'm looking at right now.* → The control must **reflect the active
  skin** even when that skin came from the OS default, not only from an explicit choice (§4.5, AC11).
- **The preference-sticks reader (returning).** *As a returning reader, I want the skin I chose to
  still be there — and the control to show it as the current state — so I'm oriented, not re-deciding.*
  → The control reads the *resolved* skin, so a returning dark reader sees a control that already says
  "dark is on."
- **The keyboard / assistive-tech reader.** *As a reader who navigates by keyboard or screen reader, I
  want to reach the control in a sensible tab order, hear what it does and the current skin, operate it
  with the standard keys, and see a clear focus ring on whichever skin I'm in.* → AC12–AC14.

The control never re-words a signal, never touches article faithfulness, and introduces **no gold** as
a functional signal (VI §7.3). It is the smallest additive header affordance the #119 seam was built
to make cheap.

---

## 2. The core design problem and the decision

**The constraint.** The only menu is the account dropdown, which exists **only when logged in**
(`AuthControl` → `SignedIn`). It therefore **cannot** be the sole home (AC1 / spec §6.3). And the
Topic chrome row is already tight: at `< md`, when the search disclosure opens
(`narrowSearchExpanded`), the projector wordmark is suppressed and the login **already collapses to
icon-only** to make room for the growing search field. A third *labeled* control on that row at narrow
widths would re-break the packing the header just solved.

**The decision (one canonical control).** The skin toggle is a **single always-present control** that
lives on the **persistent chrome row of `SiteHeader`**, immediately **to the left of the auth slot**,
in **every** host (home / topic / page / flat) and for **both** auth states. This satisfies AC1 on the
universal header (VI §10.1) without forking a bespoke surface, and it is the same node logged-out and
logged-in, so there is never a state-confusion problem.

**Mirrored entry in the account menu (additive, for discoverability — not a second control).** When
logged in, the Radix account menu also lists a **"Switch to dark skin" / "Switch to light skin"** item
above the `My curations` / `About your data` / `Sign out` group. This is a *convenience pointer to the
same action*, not a second source of truth: both the header control and the menu item call the **same
toggle handler**, and the menu item's label is **derived from the current resolved skin** exactly as
the header control's accessible name is. They cannot disagree because there is one piece of state (the
resolved skin) and one action (flip it); whichever the reader uses, the other reflects the new state on
next open. The menu item is *optional polish* — if Dev defers it, AC1 is still met by the header
control alone — but it is specified here because a logged-in reader will look in the account menu for
"settings," and the cost is one Radix item. (The header control is **always** present regardless.)

**Why not put it only in the account menu:** fails AC1 logged-out (no menu exists). **Why not a second
visible control on the chrome row at narrow widths:** breaks the `< md` packing. The single chrome-row
control + the optional menu mirror is the simplest path that serves both auth states from a persistent
affordance.

---

## 3. The control's form

A **binary toggle button** (light ↔ dark), per A3.1 — exactly two skins exist, "a 3rd skin / a picker"
is out of scope. It is a single `<button>` that flips between the two skins on activation, **not** a
two-option segmented picker and **not** an on/off switch styled as a track (a switch implies "on/off of
one thing"; this swaps between two equally-valid presentations, which a labeled toggle button states
more honestly).

**Visual treatment — a hardbox chip, consistent with the header auth affordance.** It reuses the
header's existing affordance language so it reads as a sibling of the login/account control, not a
foreign widget:

- A bordered chip: `border-2 border-hardbox` (light: `#2C2C2C`; dark: the lifted `--color-hardbox`
  light line — these tokens already flip per skin), the same `2px 2px 0 var(--color-hardbox-offset)`
  hover drop-shadow the login button uses, `min-h-[44px]` (and `min-w-[44px]` in its icon-only form)
  for the touch target.
- **Surface:** transparent / inherits the chrome band fill (it sits on `--color-header-field`, which is
  the cool field on light and the flat `#1E1E27` band on dark). Text/glyph color is `--color-ink-plus`
  (the plus ink role) so it reads as ink-on-band on both skins — **not** an accent color, and
  **never** gold (VI §7.3).
- **Contents:** a decorative icon (§6) **plus a text label** (§5) — the WORD carries the meaning
  (AC13), the icon is `aria-hidden`. On the narrowest Topic width the visible word collapses but the
  accessible name never does (§7).

**Two skins of the control, matching the two auth contexts (reuse, no fork):**

- **On the cool/flat band (home / page / flat hosts, and the Topic chrome row):** ink-on-band, the
  default. This is the universal case.
- **There is no "on-indigo" context for this control.** Unlike the login button, the skin toggle never
  sits inside the `+plus` indigo block — it lives on the chrome band beside auth. So it needs only the
  one band treatment, simplifying it relative to `AuthControl`.

---

## 4. Every state

The control is a toggle whose label/icon/accessible name are **derived from the current resolved
skin** (the `data-skin` value on `<html>`, which the pre-paint bootstrap has already set — including
the OS-default resolution, §4.5). It always presents the **action it will perform** as its primary
verb and the **current skin** in its state, so a reader is never guessing.

### 4.1 Light-active (current skin = light zine)

- Visible label: **"Dark"** (the destination — the one tap away). Icon: a **moon** glyph (decorative).
- Accessible name: **"Switch to dark skin"** (see §5 for the exact strings and the rationale for using
  the destination verb).
- Pressed state: `aria-pressed="false"` is **not** used (this is not an on/off switch — see §5.3); the
  control is a momentary toggle button whose label states the destination.
- Surface: chrome-band ink (`--color-ink-plus` `#2C2C2C` on the light cool field).

### 4.2 Dark-active (current skin = zine-dark)

- Visible label: **"Light"**. Icon: a **sun** glyph (decorative).
- Accessible name: **"Switch to light skin"**.
- Surface: chrome-band ink (`--color-ink-plus` `#ECEAF1` on the flat dark band `#1E1E27`).

### 4.3 Hover / press

- **Hover:** the hardbox drop-shadow appears — `box-shadow: 2px 2px 0 var(--color-hardbox-offset)` —
  identical to the login button's hover (`AuthControl` `base`). No color change on hover (color is
  never the affordance — the border + shadow are). A `transition` matches the login button.
- **Active/press:** the standard button press; no separate spec — the live skin flip (§6) is the
  feedback.

### 4.4 Focus

- `:focus-visible` → the global **3px `--color-focus-ring`, offset 2px** (the rule already in
  `globals.css`). On light that is `#676EB4`; on dark the committed lifted `#9097D8` (≈6.0:1 on
  `--surface`, §4.5 of the skin spec). No bespoke focus treatment — it inherits the site-wide ring, so
  it is visible on both skins by construction (AC12).

### 4.5 OS-default state (no explicit choice)

**Decision: the control reflects the *resolved* skin and does NOT surface the provenance** (OS-default
vs explicit-choice). The reader cares "am I in dark or light, and how do I change it" — not "did this
come from my OS or my last tap." Surfacing provenance would add a third visual state and microcopy
("Auto" / "System") that A3.1 explicitly rules out (binary, not a tri-state picker), and the spec's
resolution model (§6.2: explicit cookie → mirrored DB → OS `prefers-color-scheme` → light) already
makes "what skin am I in" a single deterministic answer the bootstrap has computed before paint.

So: with no stored preference on an OS-dark device, the bootstrap renders zine-dark; the control reads
the resolved `data-skin="zine-dark"` and shows **"Light" / "Switch to light skin"** (i.e. it correctly
says "you are in dark; tap to go light"). The *first* tap then writes an explicit cookie (and DB if
logged in) — from then on the choice is explicit, but the control's appearance is unchanged because it
only ever reflected the resolved skin. **No "Auto" pill, no system-default badge, no provenance
indicator.** (Assumption, recorded: if the owner later wants an explicit "match my system" reset, that
is a 3rd state and a separate follow-up — out of scope here, consistent with A3.1.)

**Implementation note for Dev (so the control is honest at first paint):** the control's label/icon
must be derived from the **resolved** `data-skin` the bootstrap set, not from a default assumption. The
toggle is a client component; read `document.documentElement.getAttribute("data-skin")` on mount (after
the bootstrap has run) to seed the control's state, then update it on each toggle. To avoid a one-frame
mismatch on dark (SSR markup carries no `data-skin` — AC9 — so a naively SSR'd control would render its
light label first), the control's **visible word** should follow the no-flash pattern the auth chip
uses: render label/icon only once the resolved skin is known on the client (a neutral or
visibility-deferred first frame), so a dark reader never sees "Dark" flash to "Light." The *button
itself* (border + tap target) may render immediately so layout is stable; only the directional
word/icon waits one tick for the resolved skin. This mirrors `AuthControl`'s loading-chip approach and
keeps AC9 (skin-agnostic SSR) intact.

### 4.6 Disabled

**There is no disabled state.** The switch is purely client-side (flip `data-skin` + write the cookie),
so it is always operable — there is no async gate to disable on (unlike the login button's
"Connecting…"). For a logged-in user the DB write happens in the background and never blocks the visual
switch (spec §6.1: the cookie + live flip happen immediately; persistence is fire-and-forget). So the
control is never disabled and never shows a spinner.

---

## 5. Microcopy + accessible name (verbatim)

Text-labeled, never color/icon-alone (AC13). The icon is decorative; the **word** carries meaning.

### 5.1 The header control

| Current skin | Visible label (verbatim) | Accessible name / `aria-label` (verbatim) |
|---|---|---|
| light (zine) | `Dark` | `Switch to dark skin` |
| dark (zine-dark) | `Light` | `Switch to light skin` |

- **Visible word = the destination** (`Dark` when light is active; `Light` when dark is active). The
  destination is the more useful one-word label for a single-tap toggle: it answers "what does tapping
  do." It is short enough to survive the tight Topic chrome row (§7).
- **Accessible name = the full verb phrase** `Switch to <destination> skin`. When the visible word is
  hidden at the narrowest width (§7), the `aria-label` still carries the full phrase — exactly the
  `AuthControl` pattern (the visible word may hide; the meaning never does). When the visible word is
  shown, the button needs no separate `aria-label` (the visible text is the accessible name), **except**
  that the visible word alone ("Dark") is ambiguous without the icon, so set the `aria-label` to the
  full phrase at **all** widths for an unambiguous accessible name. (Assumption, recorded: always-set
  `aria-label` is simpler and unambiguous than conditionally relying on the visible word; it matches the
  login button which sets the full phrase whenever the visible label is partial.)

### 5.2 The account-menu mirror item (logged-in only)

| Current skin | Menu item label (verbatim) |
|---|---|
| light | `Switch to dark skin` |
| dark | `Switch to light skin` |

The menu item uses the **full phrase** as its visible label (a menu row has room; `My curations` /
`About your data` are full phrases too — it reads as one menu). Same `data-[highlighted]:bg-surface-2`
item styling as the existing items, placed **first** in the menu (above `My curations`) with the
existing hairline `Separator` keeping `Sign out` last. The word is the label — no icon required in the
menu (consistent with the other text-only items), though a leading decorative sun/moon glyph is
permitted if Dev matches it to the header icon.

### 5.3 Why a toggle BUTTON, not a `role="switch"`

A `role="switch"` (with `aria-checked`) frames the control as "dark mode: on/off," which (a) privileges
light as the "off/default" and dark as the "on" deviation — but the spec treats both as first-class
presentations, and (b) reads awkwardly with `prefers-color-scheme` where "dark" can be the resolved
default. A **toggle button** whose label is the **destination action** ("Switch to dark skin") is the
clearer mental model: it is a one-shot action, not a persistent on/off flag. So: a plain
`<button type="button">` with the `aria-label` above. **Do not** use `aria-pressed` or `role="switch"`.
(If a future 3rd skin lands, this same button grows into the account-menu-style picker — A3.1's
"markup can grow to a small menu" — without re-teaching the binary semantics.)

---

## 6. Iconography + the instant-switch interaction

### 6.1 Iconography

- A single **decorative** glyph beside the word: **moon** when light is active (the destination is
  dark), **sun** when dark is active (the destination is light). `aria-hidden="true"`; the WORD carries
  meaning (AC13) — the icon is never the sole signal.
- The glyph inherits `currentColor` = `--color-ink-plus`, so it is AA on both bands for free (it is ink,
  not an accent, and not gold). A simple inline SVG (no external asset), `h-4 w-4`, matching the
  `WikiGlyph` sizing in the login button so the two chrome chips align.
- **Forced-colors / high-contrast:** the glyph + border use `currentColor` / system colors and the word
  is always present, so the control survives `forced-colors: active` exactly as the rest of the header
  does — the meaning is in the word regardless (AC13 / skin spec §8).

### 6.2 The instant switch (AC2 / AC3)

On activation (click, or Enter/Space):

1. The handler flips `data-skin` on `document.documentElement` **in place** — light ⇄
   `data-skin="zine-dark"` — **no navigation, no reload, no remount** (AC2). Because the entire skin is
   the `[data-skin="zine-dark"]` CSS token block (already shipped), the whole page re-skins through the
   cascade in one frame: surfaces, ink, hardbox border/offset, chips, the article column, and the
   header band all re-paint together (AC3 — no intermediate-skin frame, since nothing unmounts).
2. The control's own label/icon flips to the new destination (the moon↔sun + `Dark`↔`Light` swap), so
   the control immediately reflects the new state.
3. The header treatment changes with everything else: on switching **to dark**, the lit aperture + beam
   layers hide and the flat Tier-C lockup remains (the committed dark-header behavior, skin spec §6 —
   the same CSS the `[data-skin="zine-dark"]` block already drives); on switching **to light**, the lit
   projector returns. This is automatic from the token/layer-visibility CSS — the control does not
   touch the header logic.
4. The cookie write + (logged-in) DB persistence happen alongside, per spec §6.1 — **not** gating the
   visual switch.

**What visibly changes on activation:** the whole-page skin (all surfaces/ink/article/header), and the
control's label+icon. **What does NOT change:** layout, geometry, scroll position, focus (the control
keeps focus — it is the same node, not remounted), copy, the chip *labels* and *mapping*, article
faithfulness, and the SSR markup (none — this is client-only). Reduced-motion is unaffected (the skin
re-colors; it does not animate a transition).

**No skin transition animation.** The switch is an instant re-paint, not a cross-fade. (Assumption,
recorded: a tween between skins risks a perceptible wrong-skin mid-frame and fights AC3's "no
intermediate-skin frame"; an instant flip is both safer and snappier. If the owner wants a brief
ease, it must be a same-skin property fade that never shows a hybrid — but the MVP is an instant flip.)

---

## 7. Placement per host + responsive behavior

The control is a `shrink-0` flex child placed **immediately before the auth slot** in the persistent
chrome row of each host, so the fixed left→right order on the chrome row is:

```
[ … search / wordmark … ] · [ SKIN TOGGLE ] · [ AUTH ]
```

It rides with `ml-auto` on the auth group (the auth already pushes right); the skin toggle sits just to
its left with a `gap-2`/`gap-3` matching the row. Because it is `shrink-0` and to the left of auth, it
never overlaps the wordmark/search and never folds to a second row.

### 7.1 Home host (`HomeSiteHeader`) — not sticky, Tier-A hero

The auth slot is an absolutely-positioned right-anchored group on the 56px wordmark row
(`.auth-slot`). **The skin toggle joins that group, to the left of `AuthControl`**, inside the same
right-anchored flex container. At every width it is the labeled chip (`Dark`/`Light` + glyph). Below
480px, where the login already drops " with Wikipedia," the skin toggle **collapses to icon-only** (the
glyph + the full `aria-label`, the visible word hidden) so the right group stays clear of the
left-anchored wordmark — same CSS-visibility swap the login uses, SSR-identical markup.

ASCII (desktop home):
```
┌──────────────────────────────────────────────────────────────────────────┐
│  wiki +plus  (lit projector)                       [🌙 Dark] [W Log in …]  │
└──────────────────────────────────────────────────────────────────────────┘
```
ASCII (≤480px home):
```
┌────────────────────────────────────────────┐
│ wiki+ (scaled)              [🌙] [W Log in]  │   ← skin toggle icon-only, login short
└────────────────────────────────────────────┘
```

### 7.2 Page host (`PageSiteHeader`) — sticky, scroll-aware, auth only

The chrome row is `pointer-events-none` with a single right-anchored `pointer-events-auto` auth group.
**The skin toggle joins that right-anchored group, to the left of `AuthControl`**, both
`pointer-events-auto`, pinned to the top `SLIM_BAR_HEIGHT` row so it is reachable at every scroll `p`.
Labeled chip at all widths ≥ the narrow break; icon-only below the same `480px` the login uses (there
is no search competing on this host, so it has room — keep the label down to `sm`, collapse to
icon-only only at the narrowest). It rides the beam→slim collapse for free (it is in the chrome row,
which is pinned), with no per-host wiring.

### 7.3 Flat host (`FlatSiteHeader`) — static slim bar (e.g. /about)

A static `SLIM_BAR_HEIGHT` row: flat lockup left, `ml-auto` auth group right. **The skin toggle joins
that right group, to the left of `AuthControl`.** Labeled chip; icon-only only at the narrowest width.
Note: on `/about` the centerpiece theater scene is **exempt** from the skin (skin spec §7.1), but the
*page chrome* (this header, including the toggle) follows the skin normally — so the toggle still
re-skins the chrome and the surrounding page even though the fixed art does not invert.

### 7.4 Topic host (`TopicSiteHeader`) — the tight one (sticky, scroll-aware, search + auth)

The chrome row order is `search · [+ wordmark while narrow-search open] · [skin toggle] · auth`, with
the skin toggle as a `shrink-0 pointer-events-auto` child placed **immediately before the auth slot**
(left of the `ml-auto` auth group). Responsive rules, by breakpoint:

- **≥ md (desktop + tablet, inline search):** the toggle is the **icon-only** chip (glyph + full
  `aria-label`, no visible word) by default on the Topic host. Rationale: the Topic chrome row already
  carries the inline search field, the slim-state title cue (≥ lg), and the auth — adding a labeled
  toggle word risks crowding at the md–lg "iPad-mini" band that #144 specifically fixed. The icon-only
  toggle is a compact `min-w-[44px]` square that is unambiguous via its `aria-label` and its sun/moon
  glyph, and it never competes with the title cue (the cue is the first to drop under pressure — skin
  spec / SiteHeader comment — and the toggle is `shrink-0`). **This is the one host where the toggle is
  icon-only even at desktop width**, and it is deliberate: the Topic header is the app's densest chrome
  and the icon-only form is the safe, tested affordance pattern (the login itself goes icon-only here
  when pressed). The word is in the `aria-label`; the meaning is never lost (AC13).
- **< md (mobile, magnifier collapsed — search field NOT open):** the toggle is the same icon-only
  square, sitting between the (collapsed) search magnifier and the auth. There is room: collapsed, the
  row holds the magnifier (44px), the wordmark behind it, this 44px toggle, and the compact login. The
  toggle stays present and operable (AC1 logged-out on mobile).
- **< md, narrow search OPEN (`narrowSearchExpanded` = true):** this is the hard case — the field
  *grows* to fill the row, the wordmark moves to a middle `+` glyph, and the login collapses to
  icon-only. **Decision: the skin toggle HIDES while the narrow search is open** (it is not rendered /
  `display:none` in the `narrowSearchExpanded` state), exactly as the projector wordmark is suppressed
  and the login word is hidden in that same state. Rationale: when the reader has explicitly opened
  search, the row is dedicated to *finding an article* — three icon squares (magnifier-field · `+` ·
  login) plus a fourth (skin) would overflow the narrowest phones (320px). The toggle is a low-urgency
  preference control; search-in-progress takes the row. On closing the search the toggle reappears
  (the same close that restores the projector wordmark and the login word). **AC1 is still satisfied**
  because the toggle is present and operable in the *default* mobile state (collapsed search); it is
  only transiently hidden during an explicit, dismissible search interaction — not absent.

  Implementation: the Topic host already computes `narrowSearchExpanded` and passes it down (the
  `NarrowSearchProvider` / `useNarrowSearch` seam). The skin toggle reads the same signal (or the host
  conditionally omits it) — the identical mechanism `HeaderAuth` uses for its icon-only collapse. No new
  plumbing.

ASCII (Topic ≥ md, inline search — toggle icon-only):
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ [🔎 Search Wikipedia…]      wiki +plus(seam)      Article title   [🌙] [W name ▾]│
└───────────────────────────────────────────────────────────────────────────────┘
```
ASCII (Topic < md, search collapsed — toggle present):
```
┌──────────────────────────────────────────┐
│ [🔎]  wiki+        [🌙]  [Ⓦ ▾]            │   ← magnifier · wordmark · skin toggle · login
└──────────────────────────────────────────┘
```
ASCII (Topic < md, search OPEN — toggle HIDDEN):
```
┌──────────────────────────────────────────┐
│ [🔎 Search Wikipedia……………]  [+]  [Ⓦ ▾]   │   ← field grows · + glyph · icon-login; NO skin toggle
└──────────────────────────────────────────┘
```

### 7.5 Tab order (all hosts)

DOM order = visual order = tab order: the skin toggle is **between** the wordmark/search and the auth,
so the keyboard path is `… wordmark/search … → skin toggle → auth`. The toggle is a single tab stop
(one `<button>`); Enter/Space activates it (default button behavior — AC12). The account-menu mirror
item is reached only after opening the account menu (Radix manages that roving focus); it is not a
separate top-level tab stop.

---

## 8. Accessibility (AA on BOTH skins)

AA is baseline on both skins — the control is not exempt because dark is "the alternate."

- **Keyboard (AC12):** in the tab order (§7.5); a native `<button>`, so Enter/Space activate it; the
  global `:focus-visible` 3px `--color-focus-ring` outline (offset 2px) is the visible focus state on
  both skins (light `#676EB4`, dark `#9097D8` ≈6.0:1 on `--surface` — skin spec §4.5). No bespoke focus
  handling needed; it inherits the site ring.
- **Text-labeled, never color/icon alone (AC13):** the accessible name is always the full verb phrase
  (§5.1); the visible word is shown wherever the row has room and collapses only to the `aria-label` at
  the densest widths (the Topic host and the narrowest home/page widths), exactly as the login does.
  The sun/moon glyph is decorative (`aria-hidden`) and is never the sole carrier. **No gold** encodes
  any state (VI §7.3). State (which skin is active) is conveyed by the destination word/icon, not by
  the control's color.
- **AA contrast on the control's own surface, BOTH skins (AC14)** — the pairings Dev must hit, cited
  from the committed `skin-system-zine-dark.md`:
  - **Light skin:** the control is `--color-ink-plus #2C2C2C` text/glyph + `border-hardbox #2C2C2C` on
    the cool header field `--color-header-field #FAFBFE` → effectively the same near-black-on-near-white
    the rest of the light header chrome uses (well > 7:1, AAA). The focus ring `#676EB4` on the cool
    field is the committed site ring.
  - **Dark skin:** the control is `--color-ink-plus #ECEAF1` text/glyph + the light hardbox line on the
    flat band `--color-header-field #1E1E27`. `#ECEAF1` on `#1E1E27` ≈ **the same family as
    `#ECEAF1` on `#16161D` ≈ 15:1 / on `#22222C` ≈ 13:1** committed in skin spec §4.2 — comfortably AAA
    for the text/glyph. The focus ring `--color-focus-ring #9097D8` on the dark band ≈ **6.0:1**
    (skin spec §4.5) — a clearly visible keyboard cue. **Dev must verify** the toggle's ink/band and
    ring pairings clear AA on the *actual* rendered band on each skin (the band is `#1E1E27` on dark,
    not `#16161D`); the ratios above are the targets.
  - The hardbox **border** is a structural line (≥3:1 as a UI-component boundary on both skins — it is
    the same `--color-hardbox` the login button's border uses, which already ships AA on both skins).
- **Touch target:** `min-h-[44px]`, and `min-w-[44px]` in the icon-only form, so the tap target meets
  the 44px floor on every host (matching the login button — AC consistency).
- **No motion:** the switch is an instant re-paint (§6.2); there is no animation to gate for
  `prefers-reduced-motion`. The hover drop-shadow is a static box-shadow, not a transition the reduced-
  motion reader needs gated (it matches the login button's hover, already shipped).
- **Forced-colors:** the word + the system-color border survive `forced-colors: active`; the control
  reads as a labeled button regardless of skin.

---

## 9. What Development should build

1. **One toggle component** — a client `<button type="button">` (a small dedicated component, e.g.
   `components/header/SkinToggle.tsx`) that: reads the resolved `data-skin` on mount (after the
   bootstrap), renders the destination label + sun/moon glyph + the full `aria-label` per §5/§6, flips
   `data-skin` on `<html>` in place on activation (AC2/AC3), and writes the `wikiplus-skin` cookie (and
   for logged-in users persists to the DB through the data seam — spec §6.1). No `aria-pressed`, no
   `role="switch"` (§5.3). No disabled state (§4.6). Use the no-flash first-frame pattern for the
   directional word/icon so a dark reader never sees the light label flash (§4.5).
2. **Place it in `SiteHeader`'s persistent chrome row, left of the auth slot, in ALL FOUR hosts**
   (home / topic / page / flat), per §7. Reuse the existing right-anchored auth group container; the
   toggle is a `shrink-0` (`pointer-events-auto` on the scroll-aware hosts) child immediately before
   `AuthControl`. Do **not** fork the header (VI §10.1).
3. **Responsive collapse per §7:** labeled chip where there is room; icon-only at the narrowest
   home/page widths (the same `480px`/`sm` swap the login uses); **icon-only by default on the Topic
   host** (the dense chrome); and **hidden while `narrowSearchExpanded`** on the Topic host (read the
   existing `useNarrowSearch` signal — no new plumbing). The visible word may hide; the `aria-label`
   never does.
4. **Account-menu mirror (logged-in, optional polish):** add a first Radix `DropdownMenu.Item` in
   `SignedIn` labeled `Switch to dark skin` / `Switch to light skin` (derived from the resolved skin),
   above `My curations`, sharing the existing item styling + the `Separator` keeping `Sign out` last.
   It calls the **same** toggle handler as the header control (one action, one state — §2). If deferred,
   AC1 is still met by the header control; if built, it must not become a second source of truth.
5. **Both-skin treatment:** the control is ink-on-band (`--color-ink-plus`) + `border-hardbox` + the
   login's hover shadow + the site `:focus-visible` ring — all already skin-aware tokens, so the
   control themes for free. No new token values, no gold (AC15 / VI §7.3).
6. **Screenshot gallery:** this adds a control to the universal header (a shared change) — refresh the
   gallery so the toggle appears on **both** skins across the relevant header states. Add the new
   surface/state to `e2e/screenshots/catalog.ts` as needed (the Topic icon-only form, the narrow-search-
   open hidden state, the account-menu mirror item, light + dark) so it is captured and indexed.

---

## 10. What UX will evaluate (after Dev), on BOTH skins

- **Reachability (AC1):** the control is present and operable **logged-out** (no account needed) and
  **logged-in**, on every host, via the standard screenshot matrix (logged-out × logged-in × widths ×
  both skins). Confirm the Topic narrow-search-open state hides it gracefully and it returns on close
  (it is never *absent* in the default state).
- **Form + placement:** a binary toggle button (not a switch, not a picker), left of auth, in all four
  hosts; never overlapping the wordmark/search; never a second row; the Topic icon-only default reads
  cleanly at md–lg (the #144 band).
- **Instant switch (AC2/AC3):** activating flips the whole page in place — surfaces, ink, article,
  header (lit→flat on dark) — with no reload and no intermediate-skin frame; the control's own label/
  icon flips; focus stays on the control.
- **Microcopy/accessible name (AC13):** the verbatim labels (§5); the full `aria-label` at every width;
  the word/icon never the sole signal; no gold.
- **A11y in practice (AC12/AC14):** tab to it on each skin; the focus ring is visible on both
  (`#676EB4` / `#9097D8`); Enter/Space toggle; the ink/band + ring pairings clear AA on the *rendered*
  bands (light cool field; dark `#1E1E27`).
- **State honesty (§4.5):** an OS-dark first visit shows the control reading "Light / Switch to light
  skin" (it reflects the resolved skin), with no provenance badge.
- **No light-skin regression (AC15):** the light baseline is unchanged except for the new control's own
  surface.

Design defects route back to **Development**; a pass signals the build-loop forward.
```
