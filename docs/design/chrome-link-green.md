# Design spec — In-chrome text links go brand green (`link` token)

**Role:** UX / Design · **Status:** spec, INPUT to Development (written before implementation) ·
**Phase:** prototype · **Branch:** `brand-link-sprout`

## 1. Problem & intent

The search submit icon and the "About your data" footer link read as a **generic web blue**, not as
the wiki+ brand. Both use `text-action` (`#1F6F95`). `action` is a real brand token, but it is the
app's **universal interactive color** — it fills solid primary buttons (`bg-action`, white text)
*and* colors text links, so it cannot also be "the brand's link color." The owner wants the
interactive **link** affordance to read as the Indigo Press **green** instead of blue.

This spec recolors **every in-chrome text-link affordance** to brand green, so the app does not end
up with two competing link colors. Solid `bg-action` CTAs and Wikipedia article-content links are
explicitly out of scope (§5).

## 2. The decision

| Question | Decision |
|---|---|
| Color for body-size **text links** | **`teal-dk` `#1F6757`** (the darker brand green) — verified AA on every surface a link sits on (§3). NOT `sprout`. |
| Color for the **search submit icon** glyph + the disclosure-trigger glyph | **`teal-dk` `#1F6757`** as well. A glyph could use the lighter `sprout` (icons need only 3:1), but using ONE green for every interactive affordance is simpler, fully AA, and avoids a two-green chrome. |
| Hover treatment | **Unchanged** — keep the existing `hover:underline` / `hover:bg-bg2`. Do **not** add a hover color shift; the green stays the green, the underline carries hover. |
| Focus-visible ring on these links | Follow the link color: **`ring-link` (= `teal-dk`)**, not `ring-action`. Consistency (the focus cue matches the thing focused) and contrast (6.7:1 on white, 5.9:1 on bg2 — well past the 3:1 non-text bar). |
| New token vs. reuse | **Add ONE semantic alias `--color-link: var(--color-teal-dk)`.** Reuse the existing green *value*; give it a name that says *what it is* (the interactive link affordance). This makes the recolor a clean `text-action`→`text-link` swap on the in-scope set, documents intent at the call site, and leaves one obvious knob if the link green is ever retuned. No new color value is introduced. |

**Why `teal-dk`, not `sprout`:** `sprout #2A8270` only clears AA on pure white (4.64:1, and barely);
it **fails** AA-for-body-text on every grey/tinted panel a link actually lands on. Several in-scope
links sit on exactly those surfaces (`ClipCard` / `PlayerModal` cards, `LoginPrompt` gate panels,
the active-tint suggestion row). `sprout` would ship an accessibility regression. `teal-dk` is the
same green family, one step darker, and passes everywhere with margin.

## 3. AA contrast table (computed, WCAG 2.x relative luminance)

Body-text links must clear **4.5:1**; a graphical glyph (the magnifier) needs **3:1**; the
focus ring (non-text UI) needs **3:1**. Surfaces below are every background an in-scope `text-action`
affordance currently sits on (white card bodies, the `bg2` grey panels, the body grey, the cool
header field, and the `#EEF0FB` active-suggestion tint).

| Foreground | on white `#FFF` | on `bg2` `#F0F1F3` | on body-grey `#F7F7F7` | on header-field `#FAFBFE` | on active-tint `#EEF0FB` |
|---|---|---|---|---|---|
| **`link` / `teal-dk` `#1F6757`** ✅ chosen | **6.70** ✅ | **5.93** ✅ | **6.25** ✅ | **6.47** ✅ | **5.90** ✅ |
| `sprout` `#2A8270` ❌ rejected | 4.64 ✅ | **4.11** ❌ | **4.33** ❌ | **4.48** ❌ | **4.09** ❌ |
| `action` `#1F6F95` (today) | 5.58 ✅ | 4.93 ✅ | 5.21 ✅ | 5.39 ✅ | 4.91 ✅ |

`teal-dk` clears **4.5:1 on every surface** (text) and the **3:1** bars (glyph + focus ring) with
large headroom. It is the same green already used AA-safely for the "sound" accuracy chip fill
(`lib/curation/labels.ts` — `teal-dk #1F6757 ≈ 7:1`), so this is a consistent reuse, not a new tone.

## 4. Files & elements to change (IN scope) — the authoritative list for Dev

Confirmed by grepping `text-action` in the worktree. Each is an in-chrome **text link** or
**link-glyph** affordance. The change is mechanical: **`text-action` → `text-link`** and, where a
focus ring is present, **`ring-action` → `ring-link`**. Microcopy, markup, roles, and hover behavior
are unchanged.

| # | File | Line(s) | Element | Change |
|---|---|---|---|---|
| 1 | `components/search/TopicSearch.tsx` | 420 | Search **submit** button (magnifier glyph) | `text-action` → `text-link` |
| 2 | `components/search/TopicSearch.tsx` | 518 | Disclosure **trigger** button (magnifier glyph, `< md`) | `text-action` → `text-link` |
| 3 | `components/chrome/SiteFooter.tsx` | 27 | "About your data" footer link | `text-action`→`text-link`; `ring-action`→`ring-link` |
| 4 | `components/profile/ProfileClipRow.tsx` | 48 | Parent-topic title link ("On <topic>") | `text-action` → `text-link` |
| 5 | `components/topic/ContextByLink.tsx` | 49 | "context by <curator>" link — **`surface="light"` branch only** | `text-action` → `text-link` |
| 6 | `components/topic/ClipCard.tsx` | 90 | Section-jump link ("↳ <section>") | `text-action` → `text-link` |
| 7 | `components/auth/LoginPrompt.tsx` | 71 | "About your data →" gate-notice link | `text-action` → `text-link` |
| 8 | `components/auth/LoginPrompt.tsx` | 124 | Secondary text link in the inline gate panel | `text-action` → `text-link` |
| 9 | `app/contribute/page.tsx` | 169 | "View the topic →" text link | `text-action` → `text-link` |
| 10 | `app/about/data/page.tsx` | 108 | "← Back to wiki+" link | `text-action`→`text-link`; `ring-action`→`ring-link` |
| 11 | `app/contributor/ProfileView.tsx` | 346 | "Back home" link (not-found state) | `text-action` → `text-link` |
| 12 | `components/topic/PlayerModal.tsx` | 134 (comment) + the `ContextByLink` it renders | The light-surface `ContextByLink` (covered by #5) | Comment wording update only — the link itself is #5; reword the inline comment from "AA-safe `text-action` link tone" to the new `link` tone |

Notes for Dev:
- **#5 / #12:** `ContextByLink`'s **`indigo` branch is untouched** — on the indigo band the link is
  white with a persistent underline (the underline, not color, carries "this is a link"). Only the
  `light` branch (line 49) recolors.
- **#12:** `PlayerModal` does not itself carry a `text-action` class; it renders `ContextByLink
  surface="light"`. The only edit here is the **explanatory comment** (line ~134) so it no longer
  says `text-action`. No behavior change.
- After the swap, **search the worktree to confirm zero in-chrome `text-action` text links remain** —
  the only surviving `text-action` should be the OUT-of-scope login-button skins (§5).

### Token + CSS (Dev)
Add the alias to the `@theme` block in `app/globals.css`, beside the existing tokens:

```css
--color-link: var(--color-teal-dk); /* interactive in-chrome text-link / link-glyph affordance.
   Brand green for AA on every chrome surface (white + grey panels); see docs/design/chrome-link-green.md.
   NOT the article wikilink (#3366cc) and NOT solid CTA fills (those stay --color-action). */
```

This makes `text-link`, `ring-link`, `border-link`, etc. available as Tailwind utilities. The reason
for the alias (rather than writing `text-teal-dk` directly) is legibility of intent: a reader of the
markup sees a **link** affordance, not "a teal thing."

## 5. OUT of scope — confirmed by grep, stays as-is

**Solid primary BUTTONS (`bg-action` + white text) — stay `action` blue.** White text on the green
would also need its own contrast re-check and would split the CTA color from the link color in a way
the owner has not asked for. Confirmed `bg-action` sites:
- `components/topic/ReviewRow.tsx:82` — moderator Approve button (`border-action bg-action`).
- `components/topic/ArticleNotFound.tsx:59` — primary navigational CTA.
- `app/contribute/page.tsx:297` — contribute submit button (`bg-action` + `ring-action`).
- `components/topic/AddModal.tsx:283` — `border-action` on a panel (not a text link).

**Login-button label skins on the indigo block — stay `action` blue.** These are *buttons*, not text
links — the same CTA family as above, just expressed as `bg-white text-action`:
- `components/auth/AuthControl.tsx:101` — `bg-white text-action` ("Log in with Wikipedia" on the indigo header block).
- `components/auth/LoginPrompt.tsx:45` — `bg-white text-action` (the login button's on-indigo skin).
Recoloring these green would make the *login button* green while the contribute/approve buttons stay
blue — an inconsistent CTA palette. They belong with the buttons (out), not the links (in).

**Wikipedia article-content links — untouched.** They use `--color-wikilink: #3366cc` (the faithful
Wikipedia blue) across `.wiki-body a`, citations, popovers, etc. The "faithful Wikipedia look"
principle (CLAUDE.md) means these must **not** change. They are not `text-action` and are not in §4.

**Possible follow-up (NOT this change):** recoloring solid CTAs to brand green is a defensible future
direction, but it is a separate decision (it touches white-on-green contrast and the whole
button family at once). This spec deliberately leaves CTAs blue so the *link* recolor can ship
cleanly on its own.

## 6. States & a11y the recolor must preserve

- **Focus-visible:** every link keeps a visible focus cue. Where a link already declares its own ring
  (`SiteFooter`, `about/data`), that ring moves to `ring-link`. Where a link relies on the global
  `:focus-visible { outline: 3px solid var(--color-brand) }`, leave it — brand indigo on the link's
  surfaces is ≥4.5:1 and remains a clear, distinct focus cue. Do **not** remove any focus affordance.
- **Hover:** unchanged (`hover:underline` on links; `hover:bg-bg2` on the search submit). No color
  hover.
- **Not color alone:** every affected affordance already carries a non-color signal — links are
  underlined on hover/focus (and the curator/back links carry a word), the magnifier has
  `aria-label="Search"` / `"Search topics"`. The recolor changes only the hue, so the
  text-labeled-signal baseline is preserved. The search **icon** is graphical (3:1 bar) and clears it.
- **Forced-colors / high-contrast:** unaffected — the system palette overrides `text-link` exactly as
  it overrode `text-action`.

## 7. Tests Dev must update (existing assertions reference `text-action`)

`test/data-notice-reach.test.tsx` and `test/topic-search-contrast.test.ts` assert the old token:
- `test/data-notice-reach.test.tsx` (≈ lines 189–225): three assertions match `/text-action/` on the
  back-link, the gate-notice footer link, and the `SiteFooter` link. Update to `/text-link/` (and the
  test names that say "use text-action"). The intent of the test — links carry a non-gold, ringed
  affordance — is unchanged; only the token name moves.
- `test/topic-search-contrast.test.ts` (≈ lines 40, 75–97): it computes the magnifier glyph's
  contrast under the name `action: "#1F6F95"`. Update the magnifier's color to `#1F6757` (the new
  `link` value) and keep the `>= AA` assertions; `teal-dk` passes the icon (3:1) and body (4.5:1)
  bars on every surface in §3, so the test stays green and now guards the real shipped color.

These are name/value updates that keep each test's intent. QA verifies the suite; Dev makes the edits
in the same change.

## 8. VISUAL_IDENTITY.md documentation edit

`docs/VISUAL_IDENTITY.md` is currently scoped to the wordmark and does not yet state the app-wide
link-color rule. Add a short subsection (e.g. a new **§4.4 "Interactive color: links vs. CTAs vs.
article links"**) recording the three-way split, so the rule is documented in the design
source-of-truth:

> **§4.4 Interactive color — three distinct roles, three colors.**
> - **In-chrome text links** (and link-glyphs like the search magnifier) are **brand green
>   `--color-link` = `teal-dk #1F6757`**, exposed as `text-link`/`ring-link`. Green is the link
>   affordance for the whole wiki+ chrome. `teal-dk` (not the lighter `sprout #2A8270`) is mandated
>   for **AA**: it clears 4.5:1 on white *and* on the grey/tinted panels links sit on (`bg2`,
>   body-grey, the cool header field, the `#EEF0FB` active tint), where `sprout` fails. See
>   `docs/design/chrome-link-green.md`.
> - **Solid primary CTAs** (`bg-action` + white text) remain **`action #1F6F95`** (blue). The action
>   blue is reserved for solid button fills; recoloring CTAs green is a possible future change, not a
>   current one.
> - **Wikipedia article-content links** stay **`--color-wikilink #3366cc`** — the faithful
>   Wikipedia blue is never overridden (the "faithful Wikipedia look" principle).

(This §8 documentation edit is made in this spec change, since it belongs to the design
source-of-truth. The component recolor itself is left to Development.)

## 9. Hand-off

- **Development builds:** add `--color-link` (§4 CSS), swap `text-action`→`text-link` and
  `ring-action`→`ring-link` on exactly the §4 list, update the two test files (§7), refresh the
  comment in `PlayerModal` (§4 #12). Do **not** touch the §5 OUT set. Do **not** touch the article
  body. Refresh the committed UI screenshot baseline for the affected surfaces (`scripts/dev/shots.sh
  --scene …/--group … --commit ui`) in the same PR.
- **UX evaluates** the built UI against this spec afterward: the green reads as brand (not generic
  blue), every in-scope link/glyph is the new green with a visible focus cue, no link is left blue,
  CTAs and article links are unchanged, and the AA holds in practice on the grey panels.
