# Design Spec: TikTok detail fetching on add-by-link

- **Status:** v1, committed (UX, build-loop for `tiktok-detail-fetching`). Written **before**
  implementation — this is the contract Development builds against, not a doc edited to match what
  shipped.
- **Owner:** UX / Design.
- **Inputs (read first — this spec grounds in them, does not restate them):**
  - `docs/specs/tiktok-detail-fetching.md` — the Product spec. This design serves **AC1–AC12** and
    embodies the resolved decisions **D1–D4** (handle source, failure→state D, resolve floor,
    timeout). It does **not** re-open any decision.
  - `docs/design/add-link-metadata.md` (issue #64) — the committed **A→B→{C|D|E|F|G}** state machine
    this feature reuses **unchanged**. This spec adds **no new states**; it specifies the
    TikTok-specific content inside the existing states and the AC10 copy change.
  - `docs/CURATION_STANDARD.md` **§5.5 / C10** — the credit contract for an oEmbed-resolved clip:
    minimum credit = real `author_name` + working `author_url` link; handle is **display sugar, not
    an identity key**; an unresolved clip's credit must read as unresolved (no fabricated name, no
    fake/dead link, no false "Resolved via oEmbed").
  - `docs/TOPIC_PAGE_DESIGN.md`, `docs/VISUAL_IDENTITY.md` — Indigo Press palette (`brand #676EB4`,
    `sprout #2A8270`, `action #1F6F95`, `ink #2C2C2C`; gold `#E5AB28` an accent, **never a functional
    signal**) and the a11y baseline (AA contrast, visible focus, keyboard, text-not-color,
    reduced-motion).
- **Implementable against (current code this spec governs):**
  `components/topic/AddModal.tsx` (the **only** file whose UI this spec changes —
  `ResolvedPreview`, `PlaceholderPreview`, the entry-hint and unsupported copy), `add-media.ts`
  (`resolvedMediaSource` / `deriveHandle` — the values the preview must mirror; D1 handle
  precedence), `lib/embed/facade.ts` (`ParsedVideo` + the TikTok parse branch — gains
  `creatorHandle`), `components/topic/VideoThumb.tsx` (TikTok pill `#C03060`, vertical aspect — the
  reader-side realization).

> **Scope reminder.** This feature adds **no new states and no new screens**. TikTok now flows
> through the **same** A→B→{C|D|E} machine YouTube already uses. The persisted `Clip` /
> `ClipMediaSource` shape is unchanged (AC11). The design work is: (1) confirm states C/D/E read
> correctly with **TikTok** content and the **URL-derived `@handle`** (D1); (2) the AC10 copy
> change so nothing implies TikTok is unfetched; (3) the C10 attribution check. The
> `unsupported`/state-G arm **remains in the code** for Instagram/other — TikTok simply stops
> reaching it (D2).

---

## 1. Persona & user story (the slice this feature serves)

The #64 personas carry over unchanged; this feature serves the slice each cares about for TikTok.

- **Mei — the curator.** TikTok is a primary platform for the short vertical clips wiki+ curates.
  Today, pasting a TikTok link lands her on a "Creator not resolved" placeholder with no caption and
  no thumbnail — she did the hard part (the context note) but the clip carries a stand-in credit she
  has to live with. She wants the **same** trustworthy preview she already gets for YouTube: the real
  caption, the real creator name + outbound link, the real `@handle` from the URL, and a real
  thumbnail, **before she commits**.
- **Devi — the reader.** Never sees the modal, lives with its output: a TikTok clip on a Topic page
  must now name the **actual creator** and link out to them (C10), not show a placeholder.

**User stories** (POV; feed Product's AC1–AC12):

1. *As a curator, when I paste a TikTok share link and ask for details, I want to see the real
   caption, creator name + outbound link, the creator's real `@handle`, and a real thumbnail before
   I commit — exactly as I do for YouTube — so I know I'm curating the right clip.* → AC1, AC3.
2. *As a curator, when TikTok's details can't be fetched, I want the same clear "couldn't fetch
   details" with Try again / Add anyway / Cancel I get for YouTube — never a dead end, never a "we
   don't fetch TikTok" message on a platform we now do fetch.* → AC6, AC10.
3. *As a curator pasting a TikTok link whose oEmbed is missing a piece (no creator link, no
   thumbnail), I want the resolve to still succeed and degrade honestly — a non-linked name, a
   gradient thumbnail — never a dead link or a fabricated picture.* → AC4, AC5.
4. *As a reader, I want a TikTok clip to name its real creator and link out, so I can trust the
   card.* → C10.

---

## 2. The flow — unchanged, now shared by TikTok

The state machine is exactly `docs/design/add-link-metadata.md` §2. **TikTok now takes the YouTube
path**: state **A** entry → **B** resolving → **C** resolved (success) **or** **D** failure (with
Try again / Add anyway / Cancel) → **E** honest placeholder (only via "Add anyway"). State **F**
(unrecognized link) and state **G** (`unsupported` → straight-to-placeholder) are unchanged; **G no
longer applies to TikTok** (D2) — it remains the arm for Instagram and "other".

```
  A entry ──Fetch details──▶ B resolving ──ok──▶ C resolved (TikTok caption + creator + @handle + thumb)
     │  (recognized TikTok)         │
     │                              └──fail/timeout/partial-floor──▶ D failure
     │                                                                 │
     └──unrecognized──▶ F (unchanged)            Try again ──▶ B    Add anyway ──▶ E placeholder
                                                                              (honest, non-linked credit)

  G (unsupported → E + "we don't fetch … yet") :  Instagram / other ONLY — TikTok no longer reaches it.
```

The invariant holds: curate fields + the "Add & curate" row render **only** in state **C** (resolved)
or **E** (accepted placeholder).

---

## 3. State C — Resolved, with TikTok content (AC1, AC3, D1)

State C is the existing `ResolvedPreview` (AddModal.tsx). With a good TikTok resolve it must read
correctly. **No layout change** from YouTube — same `border-l-4 border-brand bg-bg2 p-3` container,
same thumbnail-left / text-right row. The TikTok-specific points:

- **Real caption** from oEmbed `title`, clamped `line-clamp-2` (TikTok captions can be long /
  hashtag-laden — the clamp already handles this; no change).
- **Real creator name** from `author_name`, in the bold credit line.
- **The URL-derived `@handle` (D1) — the one TikTok-specific behavior change.** The handle shown in
  the credit's `{handle} · {platformLabel}` line must be, **in precedence order**:
  1. `parsed.creatorHandle` — the `@…` segment from the TikTok share URL (e.g. `@junglygarden`),
     when present;
  2. else `deriveHandle(meta.authorName)` — the C10 author-name derivation (the YouTube floor);
  3. else **omit** the handle → name-only (`{platformLabel}` alone). **Never** an empty `@`, never
     the literal `"pasted"`.
  > **Dev note — the preview currently ignores the URL handle.** `ResolvedPreview` today computes
  > `const handle = deriveHandle(meta.authorName)` (AddModal.tsx ~line 396) — it has no view of
  > `parsed.creatorHandle`. It already receives `parsed`, so Dev resolves the handle there with the
  > **same precedence** `resolvedMediaSource` uses (`parsed.creatorHandle ?? deriveHandle(author_name)`),
  > so the **previewed** handle and the **persisted** handle are identical. The preview and the
  > media-source helper must not diverge — they share the precedence rule, not a copy of it.
- **Outbound creator link** wraps name + handle line (`author_url` → `target="_blank" rel="noopener"`)
  — the C10 minimum credit. Unchanged from YouTube.
- **Real thumbnail** `<img>` from `thumbnail_url` (falling back to `parsed.thumbnailUrl`, which is
  `undefined` for TikTok → the gradient fallback; see §5). Unchanged frame
  (`h-16 w-24 shrink-0 border-2 border-ink object-cover`), `alt=""` (decorative; the caption carries
  meaning), broken-image `onError` → gradient fallback.
- **"Resolved via oEmbed" eyebrow** renders in state C **only**, for TikTok exactly as for YouTube
  (AC9). The platform pill reads **`TIKTOK`** (the `PLATFORM_LABEL["tiktok"]` value, uppercased by
  the existing `uppercase` class).
- **Polite success announcement** unchanged: "Video details resolved: {title} by {author_name}."

> **TikTok is vertical-first — does the preview need to change? No.** The state-C preview is a
> compact **16×24 landscape thumbnail tile** (`h-16 w-24`), a fixed credit chip, not a
> playback-aspect surface. It is identical for YouTube and TikTok and intentionally so: it previews
> the *credit anatomy*, not the clip's aspect ratio. TikTok's vertical 9:16 aspect is honored on the
> **reader-side card** (`VideoThumb` already renders `aspect-[9/16]` for `orientation: "vertical"`,
> and `resolvedMediaSource` already sets `orientation: "vertical"`) and in playback — **not** in the
> modal preview. Do **not** introduce a vertical preview tile in the modal; it would break the
> shared C layout for no gain. A TikTok thumbnail (often portrait or square) inside the fixed
> landscape frame is handled by `object-cover` (center-crop), the same as any non-16:9 thumbnail —
> acceptable and already the behavior.

---

## 4. State D — Failure, with TikTok (D2, AC6) — platform-neutral copy

A recognized TikTok link that we **try** and can't resolve (non-200, network error, malformed/empty
JSON, missing the `title`/`author_name` floor per D3, or the D4 timeout) routes to the existing
**state D** — identical to a YouTube failure. **No TikTok-specific failure state, no TikTok-specific
copy.**

- **Treatment:** the existing `border-2 border-action bg-bg2` notice (action/blue, **not** red —
  distinct from the red state-F parse error), `role="alert"`.
- **Copy — keep it platform-neutral (verbatim, unchanged from #64):**
  - Heading: **"Couldn't fetch video details"**
  - Body: **"We recognized the link but couldn't load its title, creator, or thumbnail right now.
    Check your connection and try again, or add it with the details unresolved."**
  > **Decision (UX): the failure copy does NOT name the platform.** It must read identically for a
  > YouTube failure and a TikTok failure. Naming TikTok ("Couldn't fetch this TikTok…") would (a)
  > require platform-conditional copy for a state #64 deliberately made platform-agnostic, and (b)
  > risk drifting toward "TikTok doesn't work" — the exact implication AC10 forbids on a platform we
  > now fetch. The pasted link shown beneath the body already tells the curator *which* link failed;
  > the heading tells them *what* failed. Platform-neutral is correct and is already what the code
  > emits — **confirmed, no change.**
- **Controls (verbatim, unchanged):** **Try again** (primary, brand, gets focus on entering D) /
  **Add anyway** (secondary, → E) / **Cancel**. The pasted TikTok link stays visible (truncated,
  `text-ink2`).

---

## 5. Partial-data degradations (AC4, AC5) — exact rendering

TikTok oEmbed has **variable** field availability (the reason this is spec'd, not assumed). The
resolve floor (D3) is **`title` AND `author_name`**; `author_url` and `thumbnail_url` are optional
and degrade gracefully **without** dropping out of state C.

### 5.1 Missing `author_url` → non-linked creator name (AC4)

When `title` + `author_name` resolve but `author_url` is absent (`meta.authorUrl === undefined`),
state C still renders (it is a successful resolve), but the credit is **not a link** — exactly the
C10 name-without-link degradation. `ResolvedPreview` already branches on `meta.authorUrl`:

- **Has `author_url`:** the credit is an `<a href={author_url} target="_blank" rel="noopener">`
  wrapping the name line + the `{handle} · {platformLabel}` line.
- **No `author_url`:** the **same two text lines** render inside a non-interactive `<span>` (no
  `href`, no `target`, not focusable) — a plain credit, **never** a dead/empty link, never a
  fabricated URL.
- In **both** branches the handle precedence from §3 (D1) applies: a TikTok with no `author_url` but
  a URL handle still shows `@junglygarden · TikTok` as **text**. The name + (absent) link no longer
  carries the C10 attribution weight, but the resolve is still real (real caption, real name) and the
  credit reads honestly — it is **not** the "Creator not resolved" placeholder (which is reserved for
  a *failed* resolve the curator accepted via "Add anyway").

> **C10 consistency.** C10 makes the **name + working `author_url` link** the attribution floor and
> permits **name-only** when no clean handle exists. A successful resolve missing only `author_url`
> sits within C10: a real name is shown; we simply have no outbound link to offer, so we render none
> rather than a fake one. This is the resolved-but-partial case, distinct from the unresolved
> placeholder — and the code already distinguishes them. **Confirmed, no UI change needed** beyond
> ensuring the §3 handle precedence feeds this branch too.

### 5.2 Missing `thumbnail_url` → gradient fallback (AC5)

A missing thumbnail is **not** a resolution failure. When `thumbnail_url` is absent,
`meta.thumbnailUrl` is `undefined` and `parsed.thumbnailUrl` is **also** `undefined` for TikTok (the
parser derives no thumb for TikTok — confirmed in `facade.ts`, no `thumbnailUrl` on the TikTok
branch). So `thumb` is `undefined` and `ResolvedPreview` renders the **gradient fallback** tile:

- The existing `<span aria-hidden className="candthumb relative block h-16 w-24 shrink-0 border-2
  border-ink bg-gradient-to-br from-brand to-violet" />` — the Indigo `brand → violet` gradient in
  the same `h-16 w-24` frame, with the project's "candidate / un-vouched" hatch texture
  (`candthumb`). Decorative (`aria-hidden`); the caption beside it carries meaning.
- The **same** fallback covers a `thumbnail_url` that 404s at load (the `onError` → `thumbBroken`
  path already present). A TikTok resolve with a real caption + creator but a missing/broken
  thumbnail shows: gradient tile + `TIKTOK` pill + "Resolved via oEmbed" + real caption + real
  credit. That is a **successful** state-C resolve, not a failure. **Confirmed, no change** — TikTok
  exercises this path more often than YouTube (which usually has a thumbnail), so this is the
  TikTok-stressed branch QA/UX should verify visually.

---

## 6. Copy changes (AC10) — exact strings

AC10: **no surface in AddModal may tell the curator TikTok details aren't / can't be fetched.** Two
strings are in scope.

### 6.1 The `unsupported` MVP-limitation line (state G) — stays, but TikTok never reaches it

The `PlaceholderPreview` `unsupported` line (AddModal.tsx ~line 494) reads:

> "We don't fetch {platformLabel} video details yet — you can still add and curate this clip."

This line **stays in the code verbatim** — it is correct and required for **Instagram / other**,
which remain on the `unsupported` arm (state G). The fix is **routing, not copy**: because
`resolveOEmbedAction("tiktok", …)` now returns `ok`/`failed` (never `unsupported`), TikTok never
reaches `PlaceholderPreview` with `unsupported === true`, so this line **never renders for TikTok**.
AC10 is satisfied by D2's routing change, which Dev owns — **no string edit to this line; do not
generalize or remove it.**

> **UX assertion for QA:** with TikTok no longer hitting the `unsupported` arm, the only way a TikTok
> clip reaches `PlaceholderPreview` is via "Add anyway" from state D (`unsupported: false`), which
> shows the honest reassurance line but **not** the MVP-limitation line. QA must confirm no TikTok
> path ever renders "We don't fetch TikTok video details yet…".

### 6.2 The link-entry hint (state A) — confirm it reads as fetching BOTH platforms

The entry hint (AddModal.tsx ~line 229) reads:

> "We'll look up the video's title, creator, and thumbnail from the platform."

This is **already platform-neutral and already accurate for both YouTube and TikTok** ("the platform"
= whichever the curator pasted). It does **not** name a platform and does **not** imply TikTok is
excluded — it now correctly describes the TikTok path too. **Decision (UX): keep verbatim, no
change.** The field label ("Paste a YouTube or TikTok share link") and the input placeholder
(`https://youtu.be/… or https://www.tiktok.com/@user/video/…`) already name **both** platforms as
fetchable — together with the unchanged hint they read, correctly, as "we fetch details for YouTube
and TikTok." Nothing in state A implies TikTok is unfetched.

### 6.3 Copy table (every string AC10 touches, with the verdict)

| # | Where (AddModal) | String (verbatim) | Verdict for this feature |
|---|---|---|---|
| 1 | A — field label | **Paste a YouTube or TikTok share link** | **Unchanged.** Already names both as fetchable. |
| 2 | A — input placeholder | **https://youtu.be/… or https://www.tiktok.com/@user/video/…** | **Unchanged.** Already shows the TikTok share form. |
| 3 | A — entry hint | **We'll look up the video's title, creator, and thumbnail from the platform.** | **Unchanged (confirmed).** Platform-neutral; now accurate for TikTok too. |
| 4 | D — heading | **Couldn't fetch video details** | **Unchanged.** Platform-neutral by decision (§4). |
| 5 | D — body | **We recognized the link but couldn't load its title, creator, or thumbnail right now. Check your connection and try again, or add it with the details unresolved.** | **Unchanged.** Platform-neutral. |
| 6 | C — resolved eyebrow | **Resolved via oEmbed** | **Unchanged.** Now also shows on a real TikTok resolve (AC9). |
| 7 | E — placeholder caption / credit | **Unresolved {Platform} clip** / **Creator not resolved** | **Unchanged.** "Unresolved TikTok clip" reads honestly on the Add-anyway path. |
| 8 | E — reassurance | **You can still add and curate this clip — the video plays, but its title and creator weren't fetched.** | **Unchanged.** Honest on the TikTok Add-anyway path. |
| 9 | G — `unsupported` MVP-limitation line | **We don't fetch {platformLabel} video details yet — you can still add and curate this clip.** | **Unchanged in code; TikTok never reaches it (D2).** Still renders for Instagram/other. **Do not edit or remove.** |

> **Net of AC10: zero literal string edits in AddModal.** The honesty fix is the **routing** change
> (D2: TikTok → `failed`/`ok`, never `unsupported`) plus the **D1** handle change in
> `ResolvedPreview`. This is by design — the #64 copy was authored platform-neutral, anticipating
> this reversal. Dev must **not** invent a TikTok-specific string; doing so would re-introduce the
> very "TikTok is special / unfetched" framing AC10 removes.

---

## 7. State E — the Add-anyway placeholder, with TikTok (AC7)

Reached only when the curator presses **Add anyway** in state D (TikTok no longer auto-routes here).
The existing `PlaceholderPreview` renders **without** the `unsupported` line (`unsupported === false`):

- Dashed `border-2 border-dashed border-ink/30 bg-bg2` container (un-vouched visual language).
- `TIKTOK` pill, **"Not resolved"** text eyebrow (text, not color).
- **"Unresolved TikTok clip"** caption; **"Creator not resolved"** non-linked credit; **"TikTok"**
  platform line; the pasted link visible; the reassurance line.
- Persisted via `placeholderMediaSource`: caption `"Unresolved TikTok clip"`, name "Creator not
  resolved", **no** `creator.url`, **no** handle — unchanged (AC7). The clip still plays via the real
  `embedUrl`/`watchUrl`.

No change here; this is the YouTube-identical Add-anyway fallback, now reachable for TikTok.

---

## 8. Responsive / vertical-thumbnail behavior

- **Modal preview (states C/D/E):** unchanged from #64 §11 — `max-w-lg`, full-width on phones,
  `max-h-[90vh] overflow-y-auto`. The state-C thumbnail tile is the fixed `h-16 w-24` landscape
  frame for all platforms (see §3 — the modal previews credit anatomy, not aspect). A TikTok thumb is
  center-cropped via `object-cover`; on a missing thumb the gradient tile fills the same frame.
- **State-D controls** stack vertically under `sm` (Try again on top) — unchanged.
- **Reader-side vertical:** the TikTok card on the Topic page renders 9:16
  (`VideoThumb` `aspect-[9/16]` for `orientation: "vertical"`, which `resolvedMediaSource` already
  sets). The resolved real thumbnail now fills that vertical frame instead of the gradient
  placeholder — **the visible win of this feature on the read path.** No `VideoThumb` change is
  required; this spec only notes that a TikTok thumbnail now populates the existing vertical tile.

---

## 9. Accessibility (baseline) — what TikTok content stresses

Because TikTok reuses the #64 surfaces verbatim, the a11y contract is **inherited** from
`docs/design/add-link-metadata.md` §12 (loading announcement, state-change announcements, focus moves
C→note / D→Try again, visible focus, text-not-color, reduced-motion spinner, decorative thumbnail
`alt=""`). Those are confirmed compliant and unchanged. The TikTok-specific points to verify:

1. **AA contrast — no new colored surfaces.** This feature adds **no new color**: state C keeps the
   `text-violet` "Resolved via oEmbed" eyebrow on `bg-bg2`, the `ink`/`muted` credit text, the
   `bg-ink` `TIKTOK` pill (white-on-ink). All already pass AA (verified for #64). The **reader-side**
   `TIKTOK` pill on `VideoThumb` uses `#C03060` with white text (≈4.7:1 — AA-safe, already
   documented in `VideoThumb.tsx`). **No new text-on-fill pair is introduced**, so there is nothing
   new to re-test for contrast — confirm, don't re-derive.
2. **Text-labeled signals (never color alone).** The `TIKTOK` platform pill is a **word**, not a
   color — a colorblind curator/reader reads "TIKTOK," not pink. "Resolved via oEmbed" vs. "Not
   resolved" remains a **word** distinction. The action/blue state-D notice is labeled "Couldn't
   fetch video details." All inherited; confirmed.
3. **The partial-data branches must stay keyboard-coherent.** In §5.1 (no `author_url`) the credit
   becomes a **non-interactive `<span>`** — it must therefore **not** be in the tab order and must
   **not** present an interactive role (no `href`, no `tabindex`, no `role="link"`). The existing
   code already renders a plain `<span>` in this branch — confirm Dev does not accidentally make it
   focusable when wiring the D1 handle. A name-only credit (no handle, no link) is read by AT as plain
   text — correct.
4. **Focus on a partial resolve.** A successful-but-partial TikTok resolve (no link and/or no thumb)
   is still **state C**: focus moves to the Context note textarea on reveal (the existing
   `focusNoteSoon`), the polite "Video details resolved: …" announcement still fires. No special
   handling — partial is a success, not a failure. Confirm the announcement still names the real
   `author_name` even when `author_url` is absent (it reads `meta.authorName`, which is present by the
   D3 floor — fine).
5. **Decorative gradient fallback** is `aria-hidden` (§5.2) — a missing TikTok thumbnail never
   surfaces a broken-image icon or an empty `alt`. Inherited; confirmed for the TikTok-stressed path.

> **Net a11y:** nothing new to design; the contract is to **verify the reused surfaces still comply
> when fed TikTok content** — especially the no-`author_url` non-linked span (3) and the
> missing-thumbnail gradient (5), which TikTok exercises far more than YouTube did.

---

## 10. Acceptance-criteria traceability (UI-facing ACs)

| AC | How this design satisfies it |
|---|---|
| **AC1** — good TikTok resolve reaches state C | §3 — real caption + name + outbound link + thumbnail in the existing `ResolvedPreview`; `TIKTOK` pill; "Resolved via oEmbed". |
| **AC3** — handle source (D1) is the URL `@handle` | §3 — handle precedence `parsed.creatorHandle ?? deriveHandle(author_name) ?? omit`, applied **identically** in the preview and `resolvedMediaSource`; `@junglygarden` shows regardless of the `author_name` slug. |
| **AC4** — missing `author_url` → non-linked name | §5.1 — `ResolvedPreview`'s no-`author_url` branch renders a non-interactive `<span>` (name + handle/platform text), never a dead link; still state C. |
| **AC5** — missing `thumbnail_url` → gradient fallback | §5.2 — `thumb` undefined → the `brand→violet` `candthumb` gradient tile in the same frame; not a resolution failure. |
| **AC6** — failure → state D | §4 — non-200/error/floor-miss/timeout → the existing action/blue "Couldn't fetch video details" + Try again / Add anyway / Cancel, identical to YouTube; never a dead end, never false "Resolved via oEmbed". |
| **AC7** — Add-anyway placeholder honest | §7 — `PlaceholderPreview` (`unsupported: false`) → "Unresolved TikTok clip" / "Creator not resolved", no link, no handle; clip still plays. |
| **AC9** — "Resolved via oEmbed" only on real resolve | §3 — eyebrow renders in state C only, for TikTok as for YouTube; §6 #6 confirms the string is unchanged. |
| **AC10** — no AddModal surface says TikTok is unfetched | §6 — D2 routing means TikTok never reaches the `unsupported` line; the entry hint is platform-neutral and accurate; **zero string edits**; the MVP-limitation line stays for Instagram/other. |
| **AC11** — persisted shape unchanged | §3/§7 fill existing `ClipMediaSource` fields only; `creatorHandle` is an in-memory `ParsedVideo` field, not persisted shape. |
| **AC12** — YouTube unchanged | §3 — handle precedence is `creatorHandle ?? deriveHandle(...)`; YouTube carries no `creatorHandle`, so it keeps `deriveHandle` exactly; all C/D/E surfaces are the same components. |

---

## 11. C10 / Curation-standard rules honored

- **Minimum credit = real name + working link.** A good TikTok resolve renders `author_name` + an
  outbound `author_url` link (§3) — the C10 floor. The "Resolved via oEmbed" eyebrow appears only
  with this real credit.
- **Handle is display sugar, not an identity key (D1).** The URL `@handle` is a strictly-better
  display label than the derived slug; the **name + link** still carries the attribution weight. When
  no handle is available the credit is name-only. The literal `"pasted"` never appears on a resolved
  clip.
- **Partial resolve reads honestly, not as a placeholder (§5.1).** A resolve missing only
  `author_url` shows a real name as **non-linked text** — never a fake/dead link — while remaining a
  real (state C) resolve, distinct from the unresolved placeholder.
- **Unresolved reads as unresolved (§7).** The Add-anyway placeholder for TikTok is the non-linked
  "Creator not resolved" credit — no fabricated name, no fake link, no false "Resolved via oEmbed".

---

## 12. Hand-off

- **To Development.** No new states, no new screens, **no AddModal string edits**. The two UI changes:
  (1) **D1 handle precedence in `ResolvedPreview`** — resolve the shown handle as
  `parsed.creatorHandle ?? deriveHandle(meta.authorName)` (omit if neither), the **same** precedence
  `resolvedMediaSource` must use, so previewed and persisted handles match; (2) ensure the
  no-`author_url` branch stays a **non-interactive span** and the missing-thumbnail branch hits the
  gradient fallback (both already present — confirm they hold for TikTok content). The AC10 honesty
  fix is the **routing** change in `resolveOEmbedAction` (D2 — TikTok returns `ok`/`failed`, never
  `unsupported`), which Dev owns in `lib/embed/oembed.ts`; the AddModal copy needs **no edit**. Keep
  the `unsupported`/state-G arm and its MVP-limitation line for Instagram/other. Then hand to QA &
  Review.
- **To QA & Review / UX evaluation (after build).** Verify AC1–AC12; UX evaluates the built modal
  with **real TikTok content** — the `@junglygarden` case in state C (caption + `@junglygarden`
  handle + creator link + thumbnail + "Resolved via oEmbed"), a TikTok with no `author_url`
  (non-linked name span), a TikTok with no thumbnail (gradient fallback), a forced failure (state D,
  platform-neutral copy), and that **no** TikTok path renders "We don't fetch TikTok video details
  yet…" (AC10). Render the standard screenshot matrix if the TikTok preview changes are
  UI-significant.
- **Not in scope here (route elsewhere):** the `stance`/`accuracy`/credit *vocabulary* →
  Curation/Editorial (embodied, not defined, here); acceptance criteria / metrics → Product; the
  `resolveOEmbedAction` TikTok fetch, the `ParsedVideo.creatorHandle` parse, field mapping, timeout,
  the ARCHITECTURE D-TikTok doc update → Development; correctness/security verification → QA & Review.
