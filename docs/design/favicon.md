# Favicon / app-icon mark — the "+" aperture tile

**Role:** UX / Design · **Status:** design spec + delivered assets · **Phase:** prototype ·
**Resolves:** `VISUAL_IDENTITY.md` §10 item 4 (and the §6 Tier-D open-question note).

This artifact carries the decision history; the timeless docs (`VISUAL_IDENTITY.md`) state only
the current intent.

---

## 1. The decision

The favicon / app-icon is the **indigo "+" zine tile carrying a HINT of the white-hot aperture** —
a warm-lit "+" knocked out of the indigo block, with a thin gold rim on the cut edge. It is the
most-compressed expression of the projector lamp from the header (`VISUAL_IDENTITY.md` §2.3 — the
"+" is an aperture you look into).

Two rejected alternatives, and why:

- **The bare flat tile** (the Tier-D `GlyphTile` — solid indigo, drawn white "+", no warmth). It
  reads at any size but it is a flat plus glyph, not *the aperture*; it loses the one idea the whole
  identity is built on — that the "+" is a lamp you look into. Recognizability as "the wiki+ mark"
  suffers at 32px+ where there is room to show the warmth.
- **The full lit lamp** (gold rim + multi-stop radial core + soft drop-shadow glow + screen-blend
  bleed, as the header renders it). At 16px the glow, the bleed, and the radial banding all collapse
  into a few muddy brown pixels around an indistinct "+"; the ink border and the gold rim fight for
  the same 1–2 edge pixels. It turns to mud.

The chosen middle keeps the **meaning of the lamp** (a warm-lit aperture, gold-at-the-rim) while
shedding everything that muddies small (`VISUAL_IDENTITY.md` §6 principle: "preserve the meaning,
shed the spectacle").

---

## 2. Geometry mapping from the header aperture

The icon reuses the header's canonical aperture geometry (`HeaderProjector.tsx`), recentered for a
standalone square.

| Aspect | Header (`HeaderProjector`) | Icon (`app/icon.svg`) | Why it changes |
|---|---|---|---|
| Box | 56px block height (`BH`); cut OFF-center at `CUT_CX≈27` in a wide block | 32×32 square viewBox, "+" **centered** at `cx=cy=16` | A standalone icon is a square mark, not a seam-straddling lockup — center the cut (per the brief). |
| "+" polygon | `plusPath(cx, cy, a, b)`, the 12-point plus | the SAME 12-point `plusPath`, hand-authored into the SVG `d` | Faithful reuse — identical vertex topology. |
| Arm half-thickness `a` | `ARM_A = 8` (of 56 → 0.143) | `5` (of 32 → 0.156) | A touch thicker proportionally so the arms survive 16px rasterization. |
| Arm reach `b` | `ARM_B = 18` (of 56 → 0.321) | `10` (of 32 → 0.3125) | Matched proportion. |
| Border | 2px ink `#2C2C2C` | 2px ink `#2C2C2C` | Identical — the `.plus-card` border. |
| Indigo field | `#676EB4`, "+" as even-odd KNOCKOUT | `#676EB4`, same even-odd knockout (`M0 0 H32 V32 H0 Z` + plus path, `fill-rule="evenodd"`) | Faithful — a true aperture, not a drawn glyph. |
| Core | radial `#fff` center warming to gold at rim (4 stops) | **2-stop** radial: `#FFFFFF` to 62% → `#FFECB2` (the header's `GOLD_FILL`) at 100% | Simplified to 2 stops — no radial banding at 16px. |
| Rim | 3px `#EECE87` @ 0.85, blurred, clipped to interior | **2px** `#EECE87`, solid (no blur), clipped to the "+" interior | The single signal-carrying edge gold (`GOLD_RIM_RGB`), kept; blur dropped (muddies small). |
| Beam / bleed / glow / pedia ghost | present | **all dropped** | None of these read at favicon scale; they only add mud. |

Layer order (bottom → top), mirroring the header's "core behind, block knockout on top, rim on the
cut edge" stack: warm-white/gold **core rect** (fills the tile; shows only through the cut) → indigo
**block with the "+" knockout** → **gold rim** stroke clipped to the "+" interior → **2px ink
border** (drawn last so the tile edge stays crisp).

---

## 3. 16px legibility decisions (the binding constraint)

- **Dropped** everything soft: no beam, no drop-shadow glow, no screen-blend bleed, no "pedia"
  halation ghost, no blur on the rim.
- **2-stop core** (white → gold), not the header's 4-stop radial — banding is invisible at 16px and
  only costs clarity.
- **Rim at 2px on a 32 viewBox** renders to ~1px of gold at 16px — exactly one warm pixel-ring
  around the white "+", which is the "hint of the aperture." Thicker rim → the gold starts to read as
  the muddy full lamp; thinner → the warmth disappears and it's the bare flat tile. 2px is the
  balance point (verified by rasterizing to 16/32/180 — see §5).
- **Ink border drawn last** so the tile silhouette stays crisp against light and dark browser chrome.
- The arms are proportionally a hair thicker than the header `GlyphTile` (a=5/32 vs 4/28) so the "+"
  doesn't thin out under sub-pixel rounding.

---

## 4. Delivered assets

- **`app/icon.svg`** — primary scalable favicon. viewBox `0 0 32 32`, transparent outside the tile
  (the indigo block is the opaque field). Next.js App Router auto-serves this as
  `<link rel="icon" type="image/svg+xml" href="…/icon.svg">`.
- **`app/apple-icon.png`** — 180×180 apple-touch variant, rasterized from the same mark. Fully
  opaque (no rounded corners, no transparency reliance — iOS composites on its own background and
  applies its own corner mask). Next serves it as `<link rel="apple-touch-icon" href="…/apple-icon.png">`.
  PNG (not SVG) because the App Router `apple-icon` convention only accepts raster formats
  (`jpg`/`jpeg`/`png`) — an `apple-icon.svg` is silently ignored and emits no tag.
- **`app/favicon.ico`** — legacy 16/32/48 frames, generated from the same `icon.svg` so it can't
  drift. Next serves it as `<link rel="icon" href="…/favicon.ico" sizes="48x48">` for older browsers
  and Windows pins.

`icon.svg` is hand-authored, self-contained SVG (no external refs, no fonts); the `.png` and `.ico`
are rasterizations of that same mark.

---

## 5. Preview (true rasterization, then upscaled to show pixels)

```
   16px              32px              180px
 ┌────────┐       ┌────────┐       ┌──────────┐
 │ ▓▓▓▓▓▓ │       │ ▓▓▓▓▓▓ │       │ ▓▓▓▓▓▓▓▓ │   ▓ = indigo #676EB4
 │ ▓░██░▓ │       │ ▓·██·▓ │       │ ▓··██··▓ │   █ = white-hot core
 │ ▓█████▓│       │ ▓██████│       │ ▓███████ │   · = thin gold rim #EECE87
 │ ▓░██░▓ │       │ ▓·██·▓ │       │ ▓··██··▓ │   outer line = 2px ink #2C2C2C
 └────────┘       └────────┘       └──────────┘
 warm-lit "+",    rim clearly      full aperture
 gold reads as    visible as a     read: white core,
 a 1px ring       gold ring        gold rim, clean
 around white     around white     ink border
```

At 16px the indigo field, ink border, white "+" and a one-pixel warm/gold ring all survive — the
aperture reads as *lit*, not a flat white plus. At 32px / 180px it is unmistakably the header's
warm-lit aperture in the indigo tile.

---

## 6. Wiring spec for Development

Wire these into the Next.js 15 App Router app. **Do not** wire by hand-editing `<head>` — use the
metadata-file conventions; Next generates the correct `<link>` tags.

1. **Nothing to write in `app/layout.tsx` for the icons.** App Router auto-discovers
   `app/icon.svg`, `app/apple-icon.png`, and `app/favicon.ico` as metadata files and injects:
   - `<link rel="icon" href="/favicon.ico?<hash>" type="image/x-icon" sizes="48x48">`
   - `<link rel="icon" href="/icon.svg?<hash>" type="image/svg+xml" sizes="any">`
   - `<link rel="apple-touch-icon" href="/apple-icon.png?<hash>" type="image/png" sizes="180x180">`
   The apple-touch asset must be a raster format (`png`/`jpg`/`jpeg`) — the `apple-icon` convention
   does not accept SVG. No `metadata.icons` entry is needed (and adding one would compete with the
   file convention — leave `metadata` as-is, just `title`/`description`).

2. **basePath / asset-prefix gotcha — VERIFY this.** The repo deploys to GitHub Pages under a
   basePath (`NEXT_PUBLIC_BASE_PATH`, e.g. `/wikiplus`) AND also runs as a standalone Node server at
   root (`docs/design/node-ssr-server.md`). Next.js **prefixes metadata-file icon URLs with
   `basePath` automatically** when `basePath` is set in `next.config`, so the emitted href should be
   `/wikiplus/icon.svg` on Pages and `/icon.svg` on the root Node server — no manual prefixing.
   **The developer must confirm this empirically**, because a wrong icon URL fails silently (browser
   just shows no/last favicon):
   - Build with the Pages env (`NEXT_PUBLIC_BASE_PATH=/wikiplus`) and grep the emitted HTML head for
     the icon `<link href>` — it must read `/wikiplus/icon.svg`, not `/icon.svg`.
   - Build/run the root Node server (no basePath) and confirm the href is `/icon.svg`.
   - If, under static export to Pages, the href comes out WITHOUT the basePath, that is the known
     export edge case — do NOT hardcode the prefix in `layout.tsx` (it would break the root server);
     instead surface it and we decide (a `metadata.icons` entry built from
     `process.env.NEXT_PUBLIC_BASE_PATH` is the fallback that stays correct on both hosts).

3. **`favicon.ico` — recommended, optional.** `app/icon.svg` covers every modern browser. A classic
   `app/favicon.ico` is worth adding only for very old browsers / Windows taskbar pinning; if added,
   generate it from the SAME mark at 16/32/48 (`magick -background none app/icon.svg -define
   icon:auto-resize=48,32,16 app/favicon.ico`) so it cannot drift from the SVG. Not required for the
   prototype; SVG is sufficient.

4. **No `next.config` change** is needed for the icons themselves — they ride the existing
   `basePath` config. Do not add an `assetPrefix` for them.

After wiring, confirm in a browser tab (and DevTools → Application → Manifest/Icons) that the favicon
shows the warm-lit "+" tile at the tab size on both the Pages URL and a local `next start`.
