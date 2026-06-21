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

/** Parse a CSS color (`#rgb`, `#rrggbb`, `rgb()/rgba()`) to sRGB 0–255, or null if we can't
 *  read it (a keyword/`var()`/unknown form — left untouched, no adjustment). */
export function parseColor(value: string): [number, number, number] | null {
  const v = value.trim().toLowerCase();
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
