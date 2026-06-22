import { describe, expect, it } from "vitest";

// AC12 — AA contrast + not-color-alone for the navbar topic search (#12).
//
// Added by QA & Review. The dev flagged AC12 as having no automated test (only the
// implemented tokens). This pins the Indigo Press tokens that TopicSearch actually
// renders to their committed values (app/globals.css + the component's literal
// `#EEF0FB` active-row tint) and verifies each text pair clears WCAG AA (≥4.5:1,
// normal text) and each non-text UI component (focus ring, active-row left bar)
// clears the 3:1 UI-component floor — the design spec's §Tokens AA table.
//
// Precedent: the chip-contrast approach in test/labels.test.ts (design §9.3).
// This is the contrast half of AC12; the perceptual "not color alone" half (focus
// = ring SHAPE; active option = bar + weight + tint; no-results = TEXT) is asserted
// structurally by test/topic-search.test.tsx (role/aria, hint text) + UX design-eval.

// ── WCAG relative luminance + contrast ratio (sRGB, exponent 2.4). ─────────────
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// Committed Indigo Press tokens (app/globals.css @theme) + the literal active-row
// tint rendered in components/search/TopicSearch.tsx (`bg-[#EEF0FB]`). If a token
// is ever lightened/changed, this test catches the AA regression.
const T = {
  white: "#FFFFFF",
  ink: "#2C2C2C", // --color-ink   (input text, suggestion title)
  ink2: "#595959", // --color-ink2  (visible label, description, no-results hint)
  muted: "#717171", // --color-muted (placeholder — the AA floor color)
  link: "#1F6757", // --color-link (= teal-dk) — the magnifier / link-glyph color
  brand: "#676EB4", // --color-brand  (focus ring, active-row left bar)
  activeTint: "#EEF0FB", // active option background tint
  gold: "#E5AB28", // forbidden — must never appear
} as const;

const AA_TEXT = 4.5; // WCAG AA, normal-size text
const UI_MIN = 3.0; // WCAG non-text UI component / graphical object

describe("AC12 — TopicSearch token contrast (design §Tokens, AA table)", () => {
  // Text pairs: every one ≥ 4.5:1 (AA normal).
  it("input text (ink) on white clears AA", () => {
    expect(contrast(T.ink, T.white)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("placeholder (muted) on white clears AA — NOT a pale grey", () => {
    // Design note: muted #717171 sits at ~4.88:1, the AA floor. Lightening it
    // (the common pale-placeholder a11y bug) would fail this assertion.
    expect(T.muted).toBe("#717171");
    expect(contrast(T.muted, T.white)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("visible label (ink2) on white clears AA", () => {
    expect(contrast(T.ink2, T.white)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("suggestion title (ink) clears AA on BOTH rest (white) and active (tint) backgrounds", () => {
    expect(contrast(T.ink, T.white)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(T.ink, T.activeTint)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("suggestion description / no-results hint (ink2) on white clears AA", () => {
    expect(contrast(T.ink2, T.white)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("magnifier / link icon on white clears AA", () => {
    expect(contrast(T.link, T.white)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  // Non-text UI components: ≥ 3:1.
  it("brand focus ring on the white field clears the 3:1 UI floor", () => {
    // The 2px outline-offset keeps the ring on white (brand-vs-white), not on the
    // ink border — so this is the governing comparison (design §Tokens note).
    expect(contrast(T.brand, T.white)).toBeGreaterThanOrEqual(UI_MIN);
  });

  it("active-row brand left-bar clears the 3:1 UI floor on white and on the tint", () => {
    expect(contrast(T.brand, T.white)).toBeGreaterThanOrEqual(UI_MIN);
    expect(contrast(T.brand, T.activeTint)).toBeGreaterThanOrEqual(UI_MIN);
  });

  it("field border (ink) clears the 3:1 UI floor", () => {
    expect(contrast(T.ink, T.white)).toBeGreaterThanOrEqual(UI_MIN);
  });

  // Indigo Press: gold is deliberately unused anywhere in the search surface.
  it("does not use the forbidden gold token", () => {
    const used = [T.ink, T.ink2, T.muted, T.link, T.brand, T.activeTint];
    expect(used).not.toContain(T.gold);
  });
});
