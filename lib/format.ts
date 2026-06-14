// Small display-formatting helpers shared across Topic-page components.

/**
 * Grammatical count + noun: `pluralize(1, "video") → "1 video"`, `pluralize(3, "video")
 * → "3 videos"` (defect N3 — counts must be singular at 1). Pass an explicit plural for
 * irregular nouns; otherwise an "s" is appended.
 */
export function pluralize(n: number, singular: string, plural?: string): string {
  const word = n === 1 ? singular : (plural ?? `${singular}s`);
  return `${n} ${word}`;
}
