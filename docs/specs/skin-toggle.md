# Spec: In-app skin toggle (light ↔ zine-dark), persisted

- **Status:** Product spec for build-loop — GitHub issue #143. Written **before** UX/Dev.
- **Owner:** Product
- **Implements:** Issue #143 — add the user-facing control that #119 (PR #141) deliberately
  deferred. #119 shipped the skin *seam* (a `data-skin`-attribute / token layer) and proved it with
  the **zine-dark** skin, switchable only by an operator-level `WIKIPLUS_SKIN` env default or a
  `wikiplus-skin` cookie. This issue adds the **in-app control**, the **instant no-reload switch**,
  and **persistence** (per-browser cookie for everyone; per-user DB for logged-in users) — without
  regressing the cache-agnostic read-path property the seam was built to protect.
- **Inputs read:** `docs/ARCHITECTURE.md` §"Skin system (theming as an isolated, cache-agnostic
  layer)" — esp. the **Read-path decision** (the binding constraint); `docs/design/skin-system-zine-dark.md`
  (§2 what a skin owns / §10 selection mechanism / the deferred-follow-up note this issue answers);
  `docs/VISION.md` (non-goals); `docs/TOPIC_PAGE_DESIGN.md` + `docs/VISUAL_IDENTITY.md` §10.1 (the
  universal projector header); `app/layout.tsx` (`SKIN_BOOTSTRAP` pre-paint script + the
  `wikiplus-skin` cookie / `WIKIPLUS_SKIN` env seam); `lib/auth/config.ts` (the Auth.js `jwt`/`session`
  callbacks — where logged-in identity resolves and the one sign-in DB write happens);
  `lib/db/schema.ts` (the `contributor` table); `components/auth/AuthControl.tsx` +
  `components/header/SiteHeader.tsx` (the header auth affordance — likely placement seam).
- **Hand-off:** UX authors the design spec for the control (placement, states, labels, iconography,
  the instant-switch behavior, the logged-out-reachable entry) *before* Dev. Dev implements the
  control + the persistence + cookie sync per the product calls in §6, records the architecture
  decision in `docs/ARCHITECTURE.md`, and refreshes the screenshot gallery. QA verifies the AC. UX
  evaluates the built control on **both** skins.

---

## 1. Problem & user value

After #119, wiki+ can *render* a dark skin, but a reader has no way to choose it — the only switches
are an operator's build-time env default and a hand-set cookie. The product value of the dark skin
is unreachable to the people it was built for.

Who needs the control and why:

- **The low-light reader.** *As a reader viewing wiki+ at night or in a dim room, I want to switch
  the bright white article column to the dark presentation from inside the app, so the page stops
  glaring — while the fact-vs-opinion signals and curation context stay exactly as legible and
  labeled.* (From `skin-system-zine-dark.md` §1.) Today this reader cannot act on that want at all.
- **The preference-sticks reader.** *As a returning reader, I want the skin I chose to still be
  there next visit — on this browser without logging in, and across my devices if I'm logged in — so
  I set it once, not every visit.* The cookie covers the per-browser case for everyone; the DB
  covers the cross-device case for logged-in users.
- **The dark-mode-default reader.** *As a reader whose device is set to dark, I'd like wiki+ to meet
  that preference on first visit without my having to flip anything* — addressed by the
  `prefers-color-scheme` default decision in §6.2.

The control is **chrome, not content** (per the skin contract): it changes presentation only. It
never changes what the product *says*, never re-words a signal, never touches the article's
faithfulness. It is the smallest additive surface the #119 seam was designed to make cheap.

**What "good" looks like here:** a reader who wants dark finds the control without hunting, flips it,
sees the page change instantly with no reload and no white flash, and finds that choice still in
place the next time they open wiki+ — on the same browser logged-out, and on any device when logged
in. A reader who never touches it is unaffected (the light Indigo Press zine remains the default,
unless their OS asks for dark and §6.2 honors it).

---

## 2. Scope / out of scope

### In scope

- A **discoverable in-app control** that switches the app skin **light Indigo Press zine ↔ zine-dark**.
- The **instant switch**: on toggle, the page re-skins **live — no reload, no flash** (flip
  `data-skin` on `<html>` in place).
- **Per-browser persistence for everyone** via the existing `wikiplus-skin` cookie (works
  logged-out).
- **Per-user persistence for logged-in users** via the `contributor` record, restored on a new
  session/device, with the cookie kept in sync so first paint is correct (§6.1).
- The **default behavior** when there is no stored preference — including the `prefers-color-scheme`
  decision (§6.2).
- The **logged-out-reachable placement** requirement for the control (§6.3; visual design is UX's).
- The accompanying **doc update** (`docs/ARCHITECTURE.md` skin-system section extended with the
  persistence + cache-agnostic guarantee; `docs/VISUAL_IDENTITY.md` if the header gains a control)
  and the **screenshot-gallery refresh** for the control + any new menu state.

### Out of scope (explicit)

- **A third skin.** light ↔ zine-dark is a binary toggle here. A skin *picker* / any 3rd skin is a
  separate follow-up from #119.
- **The #119 dark-only polish follow-ups** — GeneralStrip/AuthControl loading-shimmer compositing on
  dark; the PinnedPlayer `bg-ink` dock note. Tracked separately; not gated by this issue.
- **Changing skin token *values* or what a skin owns.** The palette and the seam's responsibilities
  are fixed by #119; this issue only *drives* the existing switch from a UI. No new skinnable
  surface, no recolor.
- **Re-architecting the read path / adding a skin cache key.** The SSR shell stays skin-agnostic; the
  control is a presentational/client concern (§6.1). Introducing any per-skin server markup,
  per-skin cache variance, or per-skin revalidation is explicitly forbidden and is a defect (AC10).
- **Server-rendered skin resolution.** No reading the cookie/DB to *render* `data-skin` server-side
  on the request path. Resolution stays in the pre-paint browser script (the seam #119 built).
- **A true "dark-theater" projector inversion** of the header (the burn-to-white aperture on dark) —
  out of scope per `skin-system-zine-dark.md` §6; the dark skin uses the flat Tier-C lockup it
  already ships.
- **Analytics instrumentation / a dashboard.** The success metric (§7) is *defined* here; building
  measurement is deferred (Analytics is deferred until traffic — CLAUDE.md).

---

## 3. Assumptions (from ambiguity — UX/Dev may refine)

- **A3.1** The control is a **2-state toggle** (light ↔ dark), not a picker, because exactly two
  skins exist and "a 3rd skin" is out of scope. If UX finds a 3rd-skin future likely soon, a toggle
  whose markup can grow to a small menu is acceptable — but the MVP behavior is binary.
- **A3.2** The cookie name and contract are **`wikiplus-skin`** with values `"zine"` (light, the
  default — may be absent) and `"zine-dark"`, matching the existing `SKIN_BOOTSTRAP` script and the
  #119 seam. The control writes those exact values; no new cookie. (Dev: keep the bootstrap's
  `s !== "zine"` light-default branch intact.)
- **A3.3** The control's likely home is the **header** — the universal `SiteHeader`/projector host,
  with the logged-in entry plausibly in the `AuthControl` account menu (which already lists "My
  curations" / "About your data" / "Sign out"). This is a *placement hypothesis for UX*, not a
  mandate; the binding requirement is reachability on both auth states (§6.3 / AC1).
- **A3.4** The DB preference lives as a new **nullable column on `contributor`** (e.g.
  `skin_preference`), `null` = "no stored preference" (fall through to cookie/OS default). This is a
  Dev/schema call; recorded here so the round-trip AC (AC6) has a concrete target. It is additive and
  non-destructive (matches the `is_moderator` additive-column precedent).
- **A3.5** The cookie is a **first-party, non-`HttpOnly`** cookie (the pre-paint script must read it
  in the browser; it already does), `SameSite=Lax`, `Path=/`, with a long `Max-Age` (≈1 year) so the
  preference survives. It carries no PII and is not a security token. (Dev confirms exact attributes.)

---

## 4. Success metric

Analytics is deferred (CLAUDE.md), so this is **directional** for the prototype — defined now so it
can be wired when measurement exists, and so QA/UX know what the feature is *for*.

- **Primary — the choice sticks.** Of sessions where a reader changes the skin via the control, the
  share whose next visit on the **same browser** opens in the chosen skin should be **≈100%**
  (cookie persistence is deterministic, not probabilistic — anything below 100% is a persistence
  bug, not low adoption). This is the metric the AC make *verifiable now* (AC5/AC6) even before
  analytics exists.
- **Secondary — adoption (directional).** The share of distinct browsers/users that have ever set a
  non-default skin via the control. No target for the prototype; we watch whether the dark skin is a
  feature people reach for (informs whether a future 3rd skin / picker is worth it).
- **Guardrail — zero light-skin regression & zero cache fragmentation.** The default-light
  experience is unchanged for readers who never touch the control (AC9), and the cached SSR shell
  count does **not** multiply by skin (AC10). These are pass/fail guardrails, not trends.

---

## 5. Acceptance Criteria (testable)

Each AC is a condition Phase-4 QA verifies (unit/integration/e2e or an explicit manual check where a
visual property is involved). "The control" = the in-app skin toggle this issue adds.

- **AC1 — Discoverable + reachable on BOTH auth states.** The control is present and operable both
  **logged-out** and **logged-in**. A logged-out reader (who has no account menu) can reach it from a
  persistent, always-present affordance (§6.3); a logged-in reader can reach it too. Verifiable: an
  e2e check finds and operates the control in a logged-out session **and** in a logged-in session.

- **AC2 — Toggle flips the skin LIVE (no reload).** Activating the control changes the skin in place:
  `document.documentElement` gains/loses `data-skin="zine-dark"` (light = attribute absent or
  `"zine"`) **without a navigation / full page reload**. Verifiable: e2e asserts the `data-skin`
  attribute value changes after activation while the page's navigation/load count does not increment.

- **AC3 — No flash on the live switch.** The live switch does not flash the opposite skin (no
  white-on-dark or dark-on-light frame) — it re-skins via the existing CSS token layer, not by
  unmounting/reloading the tree. Verifiable: the switch toggles only the `data-skin` attribute on the
  existing DOM (no remount); a manual/visual check confirms no intermediate-skin frame. (This is the
  in-session counterpart to AC8's first-paint no-flash.)

- **AC4 — The cookie is set/updated correctly.** Activating the control writes the `wikiplus-skin`
  cookie to the chosen value (`"zine-dark"` for dark; `"zine"` or cleared for light, per A3.2's
  light-default branch), first-party, `SameSite=Lax`, `Path=/`, long-lived (A3.5). Verifiable: e2e
  reads `document.cookie` / the response and asserts the value after each toggle direction.

- **AC5 — The choice survives a fresh load on the same browser (cookie).** After toggling to dark and
  performing a **fresh full load** of any page in the **same browser** (no login required), the page
  renders in the chosen skin from first paint, driven by the cookie via the pre-paint bootstrap.
  Verifiable: e2e toggles dark, reloads, asserts `data-skin="zine-dark"` is present before/at first
  paint (the bootstrap path), with no reset to light.

- **AC6 — A logged-in user's preference round-trips through the DB and is restored cross-session.**
  When a **logged-in** user sets the skin, the preference is persisted on their `contributor` record
  through the data seam. On a **new session or new device** (a fresh browser with **no**
  `wikiplus-skin` cookie, then logging in as that user), the stored preference is **restored** and
  the page ends up in that skin — and the cookie is **brought into sync** so the pre-paint bootstrap
  is correct (§6.1). Verifiable: integration test asserts the DB write on toggle; e2e asserts that a
  cookieless login as a user with a stored dark preference results in `data-skin="zine-dark"` and a
  `wikiplus-skin=zine-dark` cookie present after the session is established.

- **AC7 — Cookie ↔ DB stay consistent for logged-in users.** For a logged-in user, the cookie the
  bootstrap reads and the DB preference do not silently disagree after a toggle: a toggle updates
  both (cookie immediately for the live switch + persistence; DB through the seam), and a login
  mirrors the DB preference into the cookie (§6.1). Verifiable: integration/e2e asserts that after a
  logged-in toggle to dark, both the cookie and the DB row read `zine-dark`; and that login mirrors
  DB→cookie. (A logged-out user has cookie only — no inconsistency possible.)

- **AC8 — First paint is correct, no flash, on every load.** On any page load (logged-out or
  logged-in), the resolved skin is applied by the **pre-paint inline script** before first paint, so
  there is no flash-of-wrong-skin. For a logged-in user whose preference was just mirrored to the
  cookie (§6.1), the very next load paints correctly from the cookie. Verifiable: the bootstrap sets
  `data-skin` synchronously in `<head>` (as today); e2e/manual confirms no wrong-skin frame on
  reload in dark.

- **AC9 — The SSR'd HTML shell stays skin-agnostic (cache-agnostic guarantee — verifiable).** The
  server-rendered markup contains **no per-request `data-skin`** attribute and varies in **no way**
  by the requester's skin: the same SSR HTML is produced regardless of the `wikiplus-skin` cookie or
  any stored preference. Verifiable: a test requests the same page (a) with no skin cookie, (b) with
  `wikiplus-skin=zine` and (c) with `wikiplus-skin=zine-dark`, and asserts the **server response
  body is identical** (the `<html>` tag carries no `data-skin`; `data-skin` is only ever set by the
  client bootstrap). The skin is applied entirely client-side.

- **AC10 — No skin cache key / no per-skin cache variance.** No code path introduces a cache key,
  `Vary` header, ISR variant, or revalidation tag keyed on skin / the `wikiplus-skin` cookie / the DB
  preference for the read path. Verifiable: grep/inspection finds no skin-derived cache key or
  skin-based `Vary`; the AC9 identical-body test is the behavioral proof. (This is the
  read-path-decision invariant from `ARCHITECTURE.md`; breaking it is a defect, not a tradeoff.)

- **AC11 — Default behavior honors OS dark preference, cache-agnostically (§6.2 decision).** With
  **no** stored preference (no `wikiplus-skin` cookie and, if logged in, a `null` DB preference), the
  app's default skin is resolved by the **pre-paint script in the browser** from
  `window.matchMedia('(prefers-color-scheme: dark)')`: OS-dark ⇒ render zine-dark; otherwise ⇒ render
  the light zine. This resolution happens **only** in the browser bootstrap — **never** in server
  markup (so AC9/AC10 hold). An explicit user choice (cookie/DB) always **overrides** the OS default.
  Verifiable: e2e with no cookie + emulated `prefers-color-scheme: dark` asserts `data-skin="zine-dark"`
  at first paint; with an explicit light cookie + OS-dark, asserts light wins; the AC9 identical-body
  test still passes (no server markup change).

- **AC12 — Keyboard-accessible.** The control is reachable and operable by keyboard alone: it is in
  the tab order, has a visible focus state (the shared `--focus-ring`), and toggles via
  Enter/Space (or the standard activation for whatever control type UX specifies). Verifiable: e2e
  tabs to the control and activates it via keyboard, asserting the skin flips.

- **AC13 — Text-labeled, never color-alone.** The control's current state and its action are carried
  by **text** (a label/accessible name), never by color or an unlabeled icon alone — consistent with
  the project's not-color-alone baseline. Its accessible name conveys what it does and/or the current
  skin. Verifiable: the control exposes a non-empty accessible name reflecting state/action; a
  text label is present (not an icon-only, color-only affordance).

- **AC14 — AA on BOTH skins.** The control meets WCAG AA contrast for its text/affordance and its
  focus ring **in both the light and the dark skin** (it renders in the header chrome on each).
  Verifiable: the control's foreground/background and focus-ring pairings clear AA on each skin's
  surface (checked against the §4.2/§4.3/§4.5 ratios already committed in
  `skin-system-zine-dark.md`); UX confirms in the built-UI evaluation on both skins.

- **AC15 — Light skin unchanged for the untouched reader; seam invariants intact.** A reader who
  never operates the control (and whose OS is not dark, per AC11) sees the light Indigo Press zine
  exactly as before this issue. The control introduces **no** change to skin token values, to what a
  skin owns, or to any component's *logic* beyond adding the control itself — the #119 isolation
  property holds. Verifiable: the light baseline gallery is unchanged except for the new control's
  own surface(s); no token-value diffs.

- **AC16 — Docs + screenshot gallery updated.** `docs/ARCHITECTURE.md` skin-system section records
  the persistence model + the cache-agnostic guarantee (§6.1) and the OS-default decision (§6.2);
  `docs/VISUAL_IDENTITY.md` is updated if the header gains the control; the screenshot gallery is
  refreshed for the control and any new menu/header state per CLAUDE.md. Verifiable: the docs contain
  the decision; the gallery `index.html` + PNGs are regenerated and committed in the same PR.

---

## 6. Product calls (decided — recorded for Dev to enter in `docs/ARCHITECTURE.md`)

These were left open by the issue. They are decided here so the loop runs autonomously; Dev records
the architecture-level ones in `docs/ARCHITECTURE.md` (extending the skin-system section).

### 6.1 Persistence model + the cache-agnostic guarantee — DECIDED (confirm the recommended model)

**Decision:** Adopt the issue's recommended model. The **`wikiplus-skin` cookie is the single client
source of truth** the pre-paint bootstrap reads — it works logged-out and is what makes first paint
correct with no flash. For **logged-in** users, the preference is *additionally* persisted on the
`contributor` record (a nullable `skin_preference` column, A3.4) and **mirrored into the cookie at
auth/session time**, so:

- **On toggle (logged-out):** the control sets the cookie and flips `data-skin` live. That's the
  whole story — no DB, no server round-trip needed for the visual switch.
- **On toggle (logged-in):** the control sets the cookie + flips `data-skin` live (instant, same as
  logged-out) **and** persists the choice to the `contributor` row through the data seam (a Server
  Action / the `DataStore` write boundary — Dev's mechanism). The cookie is updated immediately so
  the live switch and the next paint are both correct without waiting on the write.
- **At login / session establishment:** mirror the user's stored `skin_preference` (if non-null) into
  the `wikiplus-skin` cookie, so a fresh browser/device that logs in ends up with the cookie the
  bootstrap reads — first paint on the *next* navigation is correct (AC6/AC8). The natural seam is the
  Auth.js `jwt` callback's sign-in pass (`lib/auth/config.ts`), which already does the one find-or-create
  DB write at sign-in — reading `skin_preference` there and setting the cookie keeps reads JWT-only and
  adds no per-read DB hit. (Dev: a cookie cannot be written from inside the JWT callback's return; use
  the documented Auth.js mechanism — e.g. mirror via the sign-in event / the `/api/auth` response, or a
  thin post-login client step that reads the session's preference and sets the cookie. The
  *requirement* is DB→cookie mirroring at login; the exact hook is Dev's.)

**Why this preserves #119's guarantee:** the server **never** reads the cookie or the DB to render
`data-skin`. The SSR shell is byte-identical across skins (AC9); the cache is never fragmented by
skin (AC10). All skin resolution stays in the browser pre-paint script reading the cookie — exactly
the seam #119 built. The DB is a *durable backstop* that seeds the cookie for cross-device continuity;
it never enters the read/render path.

**Conflict rule (cookie vs DB for a logged-in user):** the cookie is authoritative for *rendering*
(it's what the bootstrap reads). At login the DB seeds the cookie (DB→cookie). A subsequent toggle
updates both (the toggle is the user's live intent → cookie immediately + DB persisted). So the
"latest explicit user action" wins, and the two converge; they never need a server-side per-read
reconciliation. (Edge case for Dev: if a user has a stored dark preference and an existing light
cookie on a returning device, treat the **most recent explicit toggle** as truth — practically, login
mirrors DB→cookie so the cross-device preference follows the user; a same-device later toggle then
overrides. Document the chosen tie-break in `ARCHITECTURE.md`.)

This is the **architecture decision Dev records in `docs/ARCHITECTURE.md`**: cookie = single client
source of truth for rendering; DB = per-user durable backstop mirrored into the cookie at login; no
server-side skin in the render path; no skin cache key.

### 6.2 `prefers-color-scheme: dark` default — DECIDED: **YES** (honor it, cache-agnostically)

**Decision:** With **no stored preference** (no cookie and, if logged in, `null` DB preference), the
default **honors the OS `prefers-color-scheme: dark`** — OS-dark readers get zine-dark on first
visit; everyone else gets the light Indigo Press zine.

**Rationale:** The dark skin exists for the low-light / dark-mode reader (the personas in
`skin-system-zine-dark.md` §1). Honoring the OS preference is the lowest-friction way to serve the
"dark-mode-default reader" persona — they get what they already told their device they want, with no
hunting for a toggle. An explicit choice via the control always overrides the OS signal (an explicit
cookie/DB value beats `prefers-color-scheme`), so the reader is never trapped.

**Constraint (binding):** this MUST stay cache-agnostic. `prefers-color-scheme` is resolved **in the
pre-paint browser script** via `matchMedia` — **never** in server markup (the server cannot and must
not know the client's color scheme for rendering; doing so would fragment the cache and is forbidden
by AC9/AC10). Resolution order in the bootstrap: **explicit cookie → (logged-in: mirrored DB value,
already in the cookie) → OS `prefers-color-scheme` → light default.** Because the DB value is mirrored
into the cookie at login, the bootstrap only ever needs to read the cookie + `matchMedia` — it never
queries anything. This is **AC11**.

(Note for Dev: the existing `SKIN_BOOTSTRAP` already runs pre-paint and reads the cookie; adding the
`matchMedia` fallback when the cookie is absent is the minimal additive change and keeps the script
tiny and dependency-free.)

### 6.3 Placement for logged-out readers — DECIDED (requirement; visual design is UX's)

**Decision / requirement:** The control MUST be reachable **regardless of auth state**. The account
menu only exists when logged in, so it **cannot** be the only home for the control. There must be a
**persistent, always-present affordance** — present on the universal header (`SiteHeader` /
projector host, per the universal-header principle) for **every** reader, logged-in or out — through
which a logged-out reader can switch skins. (Reuse the universal header host rather than forking a
bespoke control surface — CLAUDE.md / VISUAL_IDENTITY §10.1.)

**What is fixed (Product):** "reachable logged-out" is a hard requirement (AC1). **What is UX's:** the
exact form and placement — e.g. an always-present header control for everyone (and, if desired, the
*same* control or an entry also surfaced inside the logged-in account menu for discoverability), the
visual treatment, the icon + label, whether it's a toggle switch vs. a labeled button. Product does
not dictate the layout; it dictates that a logged-out reader can find and use it from a persistent
affordance, and that it satisfies AC12–AC14 (keyboard, text-labeled, AA on both skins). UX should
avoid duplicating the same control in two places in a way that confuses state; one canonical
always-present control that serves both auth states is the simplest path and is preferred unless UX
finds a discoverability reason to also mirror it in the account menu.

---

## 7. Hand-off — what each downstream role needs next

- **UX (next):** a design spec for the control, written *before* Dev. Decide its form (toggle vs.
  labeled button — A3.1 says binary), its placement on the universal header satisfying the
  **logged-out-reachable** requirement (§6.3), its states (light-active / dark-active, focus,
  hover/press), its label + accessible name (text-labeled, §AC13), and its iconography — on **both**
  skins, AA-verified (§AC14). Specify the instant-switch interaction (no reload, no flash) and how the
  control reflects the OS-default state when no explicit choice is set. Route through `ux-designer`.
- **Development (after UX):** implement the control + the persistence per §6. Concretely: add the
  `skin_preference` nullable column to `contributor` (A3.4); on toggle, set the `wikiplus-skin` cookie
  **and** flip `data-skin` on `<html>` live, and for logged-in users persist to the contributor row
  through the data seam; mirror DB→cookie at login (§6.1); extend the `SKIN_BOOTSTRAP` pre-paint
  script with the `prefers-color-scheme` fallback (§6.2) keeping it tiny/dependency-free and
  **server-markup-free**; keep the SSR shell skin-agnostic (AC9/AC10). Record the architecture
  decision in `docs/ARCHITECTURE.md` (§6.1/§6.2) and update `docs/VISUAL_IDENTITY.md` if the header
  gains a control. Refresh the screenshot gallery (the control + any new menu/header state, on both
  skins). No change to skin token values or what a skin owns (AC15).
- **QA & Review (after Dev):** verify AC1–AC16. The load-bearing checks: **AC9** (identical SSR body
  across skin cookies) and **AC10** (no skin cache key) — these protect the read-path decision and
  must be tests, not eyeballing; **AC5/AC6** (cookie + DB round-trip / cross-device restore); **AC2/AC3/AC8**
  (live switch + no flash); **AC11** (OS default resolved client-side only). Plus a11y AC12–AC14 and the
  light-skin no-regression AC15.
- **Operations (after QA green):** the `skin_preference` column is an additive, non-destructive
  schema change (a migration) — ship it with the standard deploy; no read-path/cache config change is
  introduced (by design). Note the cookie attributes (A3.5) for any edge/cache config review (the
  cookie must not be stripped by the edge and must not become a cache key — it never is server-read).
