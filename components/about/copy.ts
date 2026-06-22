// About-page copy + constants (docs/design/about-page.md §3.7 / §4.3 / §6).
//
// Two kinds of copy live here, kept apart on purpose:
//   • PLACEHOLDER copy (the explainer heading / lead / steps) — lorem ipsum this round; the owner
//     supplies real copy later (spec ★). The STRUCTURE is the contract: real copy drops into the
//     text VALUES only, with no structural change (AC19). Both the §A in-scene card and the §B
//     section read from the single `HOW_IT_WORKS` object, so a copy edit updates both at once.
//   • FUNCTIONAL copy (the input's accessible name + helper, the scene's visually-hidden
//     description) — part of the a11y contract; it ships AS WRITTEN (§3.7 / §4.3), not placeholder.

/** The miniature's prepopulated article title (the handoff default; AC9). The owner may swap this
 *  cosmetic default later (spec ★). */
export const DEFAULT_TITLE = "Acer palmatum";

/** The title input's programmatic accessible name (NOT the visible value — §3.6/§3.7, AC16). */
export const TITLE_INPUT_LABEL =
  "Wikipedia article title — edit and press Enter to open that topic";

/** The title input's sr-only helper, associated via aria-describedby (§3.6/§3.7) — the "what Enter
 *  does" hint sighted users infer from context. */
export const TITLE_INPUT_HELP =
  "Type any Wikipedia article title and press Enter to open its wiki+ Topic page.";

/** The whole scene's visually-hidden text alternative (§4.3, AC15) — the picture's meaning in
 *  words, so a screen-reader user gets the thesis the decorative illustration carries. */
export const SCENE_DESCRIPTION =
  "A projector casts a beam of light onto a Wikipedia article. The light forms a plus shape made " +
  "of curated video clips — the wiki+ layer added on top of the encyclopedia.";

/** The explainer copy — PLACEHOLDER (lorem ipsum). Owner replaces the text values later (spec ★);
 *  the structure is fixed. 3 steps by default; the structure supports 3–4 (AC19) — a 4th step is a
 *  one-line array push, no structural change. */
export const HOW_IT_WORKS = {
  eyebrow: "How it works",
  heading: "Lorem ipsum dolor sit amet consectetur",
  lead:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor " +
    "incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud.",
  steps: [
    {
      n: "01",
      label: "Lorem ipsum dolor",
      body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod.",
    },
    {
      n: "02",
      label: "Tempor incididunt",
      body: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.",
    },
    {
      n: "03",
      label: "Duis aute irure",
      body: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.",
    },
  ],
} as const;

export type HowItWorksStep = (typeof HOW_IT_WORKS)["steps"][number];
