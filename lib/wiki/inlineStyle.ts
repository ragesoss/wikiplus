// Recover a layout-only subset of inline `style` from fetched Wikipedia article HTML —
// montage tiling (`.tmulti`/`.multiimageinner`/`.tsingle` widths + the per-image crop),
// per-cell table `background-color`, and the taxobox taxon-band color — WITHOUT re-opening
// the inline-`style` XSS surface. See docs/ARCHITECTURE.md ("DOMPurify allowlist"),
// docs/design/inline-style-subset-spike.md (the mechanism), and
// docs/design/inline-style-subset.md (the UX contract, incl. the AA darken-to-pass rule).
//
// The boundary is a PROPERTY ALLOWLIST + the SHARED css-tree value sanitizer the
// `<style>`-block path uses (`cssDeclSafety`). `position` is NEVER allowlisted inline (any
// value, including `relative`/`static`) — stricter than the block path — so no inline-styled
// element can leave normal flow to overlay wiki+ chrome. Because DOMPurify 3.x strips the
// `style` attribute before any `uponSanitizeAttribute`/`uponSanitizeElement` hook can observe
// it, the subset is recovered AROUND the unchanged DOMPurify pass via an inert
// `data-wikiplus-style` carrier (encode pre-sanitize on the raw-HTML parse, decode
// post-sanitize on the clean DOM — both in `fetchFullArticle`).
//
// `sanitizeInlineStyle` is the pure function that takes one element's raw `style` attribute
// bytes and returns the cleaned, allowlisted, value-sanitized subset (or `""` if nothing
// survives). The caller MUST read `getAttribute("style")` (raw literal bytes), never
// `el.style.cssText` (CSSOM-laundered: it drops `behavior`/`expression` and re-escapes,
// hiding the threat the wrong way and losing the bytes the browser tokenizes).
//
// css-tree is lazy-loaded via the lexer-free subpaths (no `mdn-data`), same as the block
// path; the value gate is the SHARED `loadDeclSafety()` copy.

import type { CssNode } from "css-tree";
import { loadDeclSafety } from "./cssDeclSafety";

/**
 * The inline-`style` property ALLOWLIST — the minimal sufficient layout-only set confirmed
 * by the spike against the live Cat/San Francisco montage + taxobox markup. Every property
 * not in this set is dropped; `position` is deliberately ABSENT (any value, always dropped).
 *
 *   width, max-width, height, overflow  — montage tiling (.tsingle/.multiimageinner widths
 *                                          + the per-image crop `height`/`overflow:hidden`)
 *   background-color, color             — per-cell colors (#93) + the taxon band (#74/#106)
 *   text-align, vertical-align          — cell/banner alignment
 *   border + border-*                   — montage `border:none`, faithful cell rules
 *
 * Only the explicit `background-color` longhand is here, NEVER the `background` shorthand
 * (which can carry a `url()`); only the `background-color` cell color is recoverable.
 */
const INLINE_ALLOW = new Set([
  "width",
  "max-width",
  "height",
  "overflow",
  "background-color",
  "color",
  "text-align",
  "vertical-align",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-width",
  "border-style",
  "border-color",
]);

/**
 * Sanitize ONE element's raw inline `style` attribute to the allowlisted, value-sanitized
 * layout-only subset. Returns the cleaned `;`-joined declaration string, or `""` if nothing
 * survives (the caller then writes no carrier attribute, so the element ends with no `style`
 * — identical to today, AC4). Async because css-tree is lazy-imported.
 *
 * Rules (spike §2.4):
 *   - parse as a `declarationList` (a `style`-attribute body: `;`-separated, no selector);
 *   - keep a declaration ONLY if its DECODED property name is in `INLINE_ALLOW` (AC5);
 *     `position` is not in the set, so EVERY `position` declaration is dropped (AC7);
 *   - run each kept value through the SHARED `valueIsDeclarationSafe` (AC6/AC8/AC9) — any
 *     url()/image-set()/expression()/-moz-element()/behavior token (incl. escape/comment
 *     obfuscation) drops the whole declaration;
 *   - re-emit with the DECODED canonical property name (so `\62 ackground-color` becomes
 *     `background-color`, carrying no hidden second meaning into the browser);
 *   - fail closed: any throw → `""`.
 */
export async function sanitizeInlineStyle(styleAttr: string): Promise<string> {
  if (!styleAttr || !styleAttr.trim()) return "";
  const [parse, walk, decl] = await Promise.all([
    import("css-tree/parser").then((m) => m.default),
    import("css-tree/walker").then((m) => m.default),
    loadDeclSafety(),
  ]);
  const { generate, normIdent, valueIsDeclarationSafe } = decl;

  try {
    const ast = parse(styleAttr, {
      context: "declarationList",
      parseValue: true,
      onParseError() {},
    });
    const kept: string[] = [];
    walk(ast, {
      visit: "Declaration",
      enter(node: CssNode) {
        if (node.type !== "Declaration") return;
        const prop = normIdent(node.property); // DECODED property name (AC9)
        if (!INLINE_ALLOW.has(prop)) return; // property allowlist (AC5) — drops `position` (AC7)
        const rawValue = generate(node.value);
        if (!valueIsDeclarationSafe(rawValue)) return; // shared X4 value gate (AC6/AC8/AC9)
        kept.push(`${prop}:${rawValue}`); // re-emit with the DECODED canonical name
      },
    });
    return kept.join("; ");
  } catch {
    return ""; // un-parseable style — fail closed (AC9)
  }
}

// ── AA darken-to-pass for recovered colors (AC10 / UX contract §5) ──────────────────────
// A recovered per-cell `background-color` (and the taxon band) must clear AA contrast in our
// column. Recovered Wikipedia colors are typically light pastels under the dark article ink
// (#2c2c2c), which already clear 4.5:1 — but a recovered pair that FAILS is adjusted to pass
// rather than shipped failing, KEEPING the background hue (the cell still reads as "the green
// band / the yellow cell"). Meaning never rests on color alone: a colored cell's text/
// position/weight and the band's centered/bold/hairline carry the signal in greyscale.

/**
 * Complete CSS named-color → sRGB map (148 standard names + transparent).
 * Keyed lowercase. `transparent` resolves to null (no recoverable background).
 * Source: https://www.w3.org/TR/css-color-4/#named-colors
 */
const CSS_NAMED_COLORS: Record<string, [number, number, number]> = {
  aliceblue: [240, 248, 255],
  antiquewhite: [250, 235, 215],
  aqua: [0, 255, 255],
  aquamarine: [127, 255, 212],
  azure: [240, 255, 255],
  beige: [245, 245, 220],
  bisque: [255, 228, 196],
  black: [0, 0, 0],
  blanchedalmond: [255, 235, 205],
  blue: [0, 0, 255],
  blueviolet: [138, 43, 226],
  brown: [165, 42, 42],
  burlywood: [222, 184, 135],
  cadetblue: [95, 158, 160],
  chartreuse: [127, 255, 0],
  chocolate: [210, 105, 30],
  coral: [255, 127, 80],
  cornflowerblue: [100, 149, 237],
  cornsilk: [255, 248, 220],
  crimson: [220, 20, 60],
  cyan: [0, 255, 255],
  darkblue: [0, 0, 139],
  darkcyan: [0, 139, 139],
  darkgoldenrod: [184, 134, 11],
  darkgray: [169, 169, 169],
  darkgreen: [0, 100, 0],
  darkgrey: [169, 169, 169],
  darkkhaki: [189, 183, 107],
  darkmagenta: [139, 0, 139],
  darkolivegreen: [85, 107, 47],
  darkorange: [255, 140, 0],
  darkorchid: [153, 50, 204],
  darkred: [139, 0, 0],
  darksalmon: [233, 150, 122],
  darkseagreen: [143, 188, 143],
  darkslateblue: [72, 61, 139],
  darkslategray: [47, 79, 79],
  darkslategrey: [47, 79, 79],
  darkturquoise: [0, 206, 209],
  darkviolet: [148, 0, 211],
  deeppink: [255, 20, 147],
  deepskyblue: [0, 191, 255],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  dodgerblue: [30, 144, 255],
  firebrick: [178, 34, 34],
  floralwhite: [255, 250, 240],
  forestgreen: [34, 139, 34],
  fuchsia: [255, 0, 255],
  gainsboro: [220, 220, 220],
  ghostwhite: [248, 248, 255],
  gold: [255, 215, 0],
  goldenrod: [218, 165, 32],
  gray: [128, 128, 128],
  green: [0, 128, 0],
  greenyellow: [173, 255, 47],
  grey: [128, 128, 128],
  honeydew: [240, 255, 240],
  hotpink: [255, 105, 180],
  indianred: [205, 92, 92],
  indigo: [75, 0, 130],
  ivory: [255, 255, 240],
  khaki: [240, 230, 140],
  lavender: [230, 230, 250],
  lavenderblush: [255, 240, 245],
  lawngreen: [124, 252, 0],
  lemonchiffon: [255, 250, 205],
  lightblue: [173, 216, 230],
  lightcoral: [240, 128, 128],
  lightcyan: [224, 255, 255],
  lightgoldenrodyellow: [250, 250, 210],
  lightgray: [211, 211, 211],
  lightgreen: [144, 238, 144],
  lightgrey: [211, 211, 211],
  lightpink: [255, 182, 193],
  lightsalmon: [255, 160, 122],
  lightseagreen: [32, 178, 170],
  lightskyblue: [135, 206, 250],
  lightslategray: [119, 136, 153],
  lightslategrey: [119, 136, 153],
  lightsteelblue: [176, 196, 222],
  lightyellow: [255, 255, 224],
  lime: [0, 255, 0],
  limegreen: [50, 205, 50],
  linen: [250, 240, 230],
  magenta: [255, 0, 255],
  maroon: [128, 0, 0],
  mediumaquamarine: [102, 205, 170],
  mediumblue: [0, 0, 205],
  mediumorchid: [186, 85, 211],
  mediumpurple: [147, 112, 219],
  mediumseagreen: [60, 179, 113],
  mediumslateblue: [123, 104, 238],
  mediumspringgreen: [0, 250, 154],
  mediumturquoise: [72, 209, 204],
  mediumvioletred: [199, 21, 133],
  midnightblue: [25, 25, 112],
  mintcream: [245, 255, 250],
  mistyrose: [255, 228, 225],
  moccasin: [255, 228, 181],
  navajowhite: [255, 222, 173],
  navy: [0, 0, 128],
  oldlace: [253, 245, 230],
  olive: [128, 128, 0],
  olivedrab: [107, 142, 35],
  orange: [255, 165, 0],
  orangered: [255, 69, 0],
  orchid: [218, 112, 214],
  palegoldenrod: [238, 232, 170],
  palegreen: [152, 251, 152],
  paleturquoise: [175, 238, 238],
  palevioletred: [219, 112, 147],
  papayawhip: [255, 239, 213],
  peachpuff: [255, 218, 185],
  peru: [205, 133, 63],
  pink: [255, 192, 203],
  plum: [221, 160, 221],
  powderblue: [176, 224, 230],
  purple: [128, 0, 128],
  rebeccapurple: [102, 51, 153],
  red: [255, 0, 0],
  rosybrown: [188, 143, 143],
  royalblue: [65, 105, 225],
  saddlebrown: [139, 69, 19],
  salmon: [250, 128, 114],
  sandybrown: [244, 164, 96],
  seagreen: [46, 139, 87],
  seashell: [255, 245, 238],
  sienna: [160, 82, 45],
  silver: [192, 192, 192],
  skyblue: [135, 206, 235],
  slateblue: [106, 90, 205],
  slategray: [112, 128, 144],
  slategrey: [112, 128, 144],
  snow: [255, 250, 250],
  springgreen: [0, 255, 127],
  steelblue: [70, 130, 180],
  tan: [210, 180, 140],
  teal: [0, 128, 128],
  thistle: [216, 191, 216],
  tomato: [255, 99, 71],
  turquoise: [64, 224, 208],
  violet: [238, 130, 238],
  wheat: [245, 222, 179],
  white: [255, 255, 255],
  whitesmoke: [245, 245, 245],
  yellow: [255, 255, 0],
  yellowgreen: [154, 205, 50],
};

/** Parse a CSS color (`#rgb`, `#rrggbb`, `rgb()/rgba()`, or a CSS named color) to sRGB 0–255,
 *  or null if we can't read it (`transparent`, `var()`/unknown form — left untouched, no
 *  adjustment). `transparent` is intentionally null: it has no recoverable background color. */
export function parseColor(value: string): [number, number, number] | null {
  const v = value.trim().toLowerCase();
  // CSS named colors (incl. grey/gray variants, rebeccapurple) — full 148-name set.
  // `transparent` is absent from the map: resolves to null (no recoverable bg).
  if (v in CSS_NAMED_COLORS) return CSS_NAMED_COLORS[v];
  if (v === "transparent") return null;
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return [
        parseInt(h[0] + h[0], 16),
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16),
      ];
    }
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (rgb) {
    const c = [rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Math.max(0, Math.round(Number(n)))));
    if (c.some((n) => Number.isNaN(n))) return null;
    return [c[0], c[1], c[2]];
  }
  return null;
}

/** WCAG relative luminance of an sRGB triple. */
function luminance([r, g, b]: [number, number, number]): number {
  const ch = (n: number) => {
    const s = n / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG contrast ratio between two sRGB triples (≥ 1, larger = more contrast). */
export function contrastRatio(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const INK: [number, number, number] = [0x2c, 0x2c, 0x2c]; // --color-ink, article text default
const WHITE: [number, number, number] = [0xff, 0xff, 0xff];
const AA = 4.5;

/**
 * Given a recovered `background-color` and the text color drawn on it (a recovered `color`,
 * or the article ink when none is recovered), return a text color that clears AA against the
 * background — KEEPING the background hue (UX §5). Returns null when no adjustment is needed
 * (the pair already passes) or when we can't read the background (a keyword/var() left as-is).
 *
 * The adjustment darkens the text toward black or lightens it toward white — whichever the
 * background admits — so the recovered cell/band keeps its hue while the ink shifts to pass.
 * This is intentionally minimal: it adjusts the INK, never the recovered background, so no
 * recovered color is recolored away from Wikipedia's value.
 */
export function aaTextColor(
  backgroundColor: string,
  textColor: string | null
): string | null {
  const bg = parseColor(backgroundColor);
  if (!bg) return null; // unreadable background → leave the recovered value untouched
  const text = (textColor && parseColor(textColor)) || INK;
  if (contrastRatio(bg, text) >= AA) return null; // already passes — no change
  // Pick the extreme (black or white) that the background can support; the background's own
  // contrast to black vs. white tells us which direction clears AA on a light/dark fill.
  const toBlack = contrastRatio(bg, [0, 0, 0]);
  const toWhite = contrastRatio(bg, WHITE);
  const target = toBlack >= toWhite ? [0, 0, 0] : WHITE;
  const hex = `#${target.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  return hex;
}

export { INLINE_ALLOW };
