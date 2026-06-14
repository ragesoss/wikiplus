import { describe, expect, it } from "vitest";
import {
  ACCURACY_FILL,
  ACCURACY_LABEL,
  ACCURACY_ORDER,
  STANCE_FILL,
  STANCE_LABEL,
  STANCE_ORDER,
  chipText,
} from "@/lib/curation/labels";
import type { AccuracyFlag, Stance } from "@/lib/data/types";

// AC9 / AC21 / CURATION §2–§4: chip text is driven by the SINGLE closed enum→label
// map — never free-texted or regex-guessed. These tests pin the map to the
// CURATION_STANDARD Label columns and verify the AA-safe fills (design §9.3).

// Relative luminance + WCAG contrast ratio (white text on the fill).
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastWithWhite(hex: string): number {
  const L = luminance(hex);
  return (1.0 + 0.05) / (L + 0.05);
}

const ALL_STANCES: Stance[] = [
  "explainer",
  "short",
  "demonstration",
  "classroom",
  "opinion",
  "myth_busting",
  "personal_experiment",
];
const ALL_ACCURACY: AccuracyFlag[] = [
  "accurate",
  "accurate_with_caveat",
  "primary_source",
  "opinion",
  "mixed",
  "misleading",
  "inaccurate",
];

describe("stance label map (CURATION §2)", () => {
  it("maps every stance enum to its canonical Label", () => {
    expect(STANCE_LABEL).toEqual({
      explainer: "Explainer",
      short: "Short",
      demonstration: "Demonstration",
      classroom: "Classroom",
      opinion: "Opinion",
      myth_busting: "Myth-busting",
      personal_experiment: "Personal experiment",
    });
  });

  it("covers all stance values (closed enum, no gaps)", () => {
    for (const s of ALL_STANCES) expect(STANCE_LABEL[s]).toBeTruthy();
    expect(STANCE_ORDER).toEqual(ALL_STANCES);
  });
});

describe("accuracy label map (CURATION §3)", () => {
  it("maps every accuracy enum to its canonical Label", () => {
    expect(ACCURACY_LABEL).toEqual({
      accurate: "Accurate",
      accurate_with_caveat: "Accurate, with a caveat",
      primary_source: "Primary footage",
      opinion: "Opinion",
      mixed: "Mixed",
      misleading: "Misleading",
      inaccurate: "Inaccurate",
    });
  });

  it("distinguishes the red-group values by LABEL text, not shade (C3)", () => {
    // opinion / mixed / misleading / inaccurate share one fill but differ in text.
    const reds: AccuracyFlag[] = ["opinion", "mixed", "misleading", "inaccurate"];
    const fills = new Set(reds.map((f) => ACCURACY_FILL[f]));
    expect(fills.size).toBe(1); // same color
    const labels = new Set(reds.map((f) => ACCURACY_LABEL[f]));
    expect(labels.size).toBe(reds.length); // distinct text
  });

  it("covers all accuracy values (closed enum)", () => {
    for (const a of ALL_ACCURACY) expect(ACCURACY_LABEL[a]).toBeTruthy();
    expect(ACCURACY_ORDER).toEqual(ALL_ACCURACY);
  });
});

describe("chipText composition (C6 modifier is display-only)", () => {
  it("renders Label alone with no modifier", () => {
    expect(chipText("Explainer")).toBe("Explainer");
  });
  it("renders 'Label · modifier' when a modifier is present", () => {
    expect(chipText("Accurate", "fast-paced")).toBe("Accurate · fast-paced");
  });
});

describe("AA chip contrast (design §9.3, AC21 — binding)", () => {
  it("stance fill #5248AF clears AA (≥4.5:1) with white text", () => {
    expect(STANCE_FILL).toBe("#5248AF");
    expect(contrastWithWhite(STANCE_FILL)).toBeGreaterThanOrEqual(4.5);
  });

  it("every accuracy fill clears AA (≥4.5:1) with white text", () => {
    for (const flag of ALL_ACCURACY) {
      const ratio = contrastWithWhite(ACCURACY_FILL[flag]);
      expect(ratio, `${flag} (${ACCURACY_FILL[flag]})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses the deep-violet fill, not the brand indigo, for the stance chip", () => {
    // Design §9.3 directs the stance fill to #5248AF (not the brand #676EB4).
    // (NB: by the standard WCAG sRGB formula the brand indigo is ~4.7:1, not the
    // ~4.0:1 the design doc estimated — but #5248AF is used regardless and clears
    // AA comfortably; see QA report finding N1.)
    expect(STANCE_FILL).toBe("#5248AF");
    expect(STANCE_FILL).not.toBe("#676EB4");
  });
});
