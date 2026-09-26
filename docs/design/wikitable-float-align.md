# Design — `wikitable` float, alignment, and fill fidelity

**Lane:** Express (a faithful-Wikipedia rendering fix on the established article system; no
schema/auth/policy change). **Owner prompt:** the small ISU-abbreviations table at the top of
*Figure skating jumps* should render like Wikipedia — header cells centered, the whole table
floated right, a table fill that reads against the surrounding prose.

## Reference (live Wikipedia, Vector 2022, *Figure skating jumps*)

Markup: `<table class="wikitable floatright">`, every cell a `<th>` (a `colspan="2"` title row,
then abbreviation/jump pairs). Computed on en.wikipedia.org:

| Property | Wikipedia | wiki+ before |
|---|---|---|
| table `float` | `right` (`.floatright`, site CSS) | none — sits alone above the lead prose |
| `th` `text-align` | `center` (`.wikitable > * > tr > th`) | `left` (generic fallback grid) |
| table fill | `#f8f9fa` | `#fff` (page field) |
| `th` fill | `#eaecf0` | `#eaecf0` |

## Contract

1. **Float utility classes.** A data table with `floatright` / `floatleft` (MediaWiki site-CSS
   classes wiki+ never fetches), **or** a `<table>` whose raw inline style is `float: right|left`,
   floats in the article column: `float` + matching `clear` (so it stacks under an infobox or
   another float instead of colliding), side margin `1em` toward the prose, `0.8em` below.
   The float lands on the `.wiki-tablewrap` scroll region (the table's parent), so the table keeps
   its keyboard-scrollable containment; the wrapper shrinks to the table and caps at 100% width.
   The inline `float` is never passed through as `style` — it is mapped to the fixed class name
   in the raw pre-pass (the inline-style allowlist is unchanged).
2. **`wikitable` header cells center** — Wikipedia's exact rule, `.wikitable > * > tr > th`.
   `.plainrowheaders th[scope=row|rowgroup]` stays left + normal weight (Wikipedia's exception,
   used by list tables). `.wikitable caption` centers (bold, as today).
3. **Cells inherit alignment.** The generic fallback grid stops forcing `td { text-align:left }`,
   so a table- or row-level `text-align` (recovered inline style) reaches its cells, as on
   Wikipedia. Non-`wikitable` `th` keep the existing left alignment (out of scope).
4. **Fill.** `.wikitable` takes `--article-box-bg` (light `#f8f9fa`, dark `#1b1f23`); `th` keeps
   `--article-th-bg`. Ink is unchanged (`--color-ink-article`) — AA holds on both fills in both
   skins (ink ≥ 11.7:1 on either fill; links ≥ 4.5:1 on `th` light, ≥ 6:1 dark).
5. **Responsive.** Below 640px the floated table un-floats and takes the column like any data
   table (a float beside ~300px of prose is unreadable). 640px and up it floats (tablet included —
   the table is narrow, unlike the 320px infobox, which stacks below 1024px).

## States / a11y

Static content — no loading/empty/error states beyond the article's own. The scroll region keeps
`role="region"`, `tabindex="0"`, and its caption-derived `aria-label`; floating changes only
position. Alignment and fill carry no meaning on their own (header-ness is `<th>` + bold).

## Evaluate

The *Figure skating jumps* lead at desktop (floats right beside the lead prose, centered cells,
`#f8f9fa`/`#eaecf0` fills), tablet (still floated), mobile (full-width, unfloated), and the dark
skin; a cladogram / infobox / wide data table page is unchanged.
