// The SINGLE enum→label map that drives every stance/accuracy chip's text.
// Per docs/CURATION_STANDARD.md §4 / design spec §13.1: chip text is derived from
// the enum value here — never free-texted or regex-guessed. Color reinforces; the
// LABEL is the signal (§4 non-color rule, AC21).

import type { AccuracyFlag, Stance } from "@/lib/data/types";

/** Stance chip label text. CURATION §2 Label column. */
export const STANCE_LABEL: Record<Stance, string> = {
  explainer: "Explainer",
  short: "Short",
  demonstration: "Demonstration",
  classroom: "Classroom",
  opinion: "Opinion",
  myth_busting: "Myth-busting",
  personal_experiment: "Personal experiment",
};

/** Curate-modal stance <select> order (design spec §6.8). */
export const STANCE_ORDER: Stance[] = [
  "explainer",
  "short",
  "demonstration",
  "classroom",
  "opinion",
  "myth_busting",
  "personal_experiment",
];

/** Accuracy chip label text. CURATION §3 Label column. */
export const ACCURACY_LABEL: Record<AccuracyFlag, string> = {
  accurate: "Accurate",
  accurate_with_caveat: "Accurate, with a caveat",
  primary_source: "Primary footage",
  opinion: "Opinion",
  mixed: "Mixed",
  misleading: "Misleading",
  inaccurate: "Inaccurate",
};

/** Curate-modal accuracy <select> order (design spec §6.8). */
export const ACCURACY_ORDER: AccuracyFlag[] = [
  "accurate",
  "accurate_with_caveat",
  "primary_source",
  "opinion",
  "mixed",
  "misleading",
  "inaccurate",
];

// --- AA-safe fills (design spec §9.3, binding) ---------------------------------
// Stance chip fill = deep-violet #5248AF (≈5.9:1 with white at 10px; the brand
// indigo #676EB4 is ≈4.0:1 and fails AA). Accuracy fills by tier; the red group
// shares one AA-safe red and is distinguished by LABEL text, never shade (C3).

/** Stance chip fill — always deep-violet (AA-safe), white text. */
export const STANCE_FILL = "#5248AF";

/**
 * Accuracy chip fill by enum. teal-dk #1F6757 (≈7:1) for the sound tier, action
 * #1F6F95 (≈5.5:1) for the caveat tier, darkened red #B0353B (≈5.0:1) for the
 * weigh-carefully group — all clear AA at 10px bold with white text.
 */
export const ACCURACY_FILL: Record<AccuracyFlag, string> = {
  accurate: "#1F6757",
  primary_source: "#1F6757",
  accurate_with_caveat: "#1F6F95",
  opinion: "#B0353B",
  mixed: "#B0353B",
  misleading: "#B0353B",
  inaccurate: "#B0353B",
};

/** Compose the full visible chip text, with the optional display-only modifier (C6). */
export function chipText(label: string, modifier?: string): string {
  return modifier ? `${label} · ${modifier}` : label;
}
