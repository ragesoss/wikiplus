// About-page copy + constants (docs/design/about-page.md §3.7 / §4.3 / §6).
//
// Two kinds of copy live here, kept apart on purpose:
//   • PLACEHOLDER copy (the explainer heading / lead / steps) — lorem ipsum this round; the owner
//     supplies real copy later (spec ★). The STRUCTURE is the contract: real copy drops into the
//     text VALUES only, with no structural change (AC19). Both the §A in-scene card and the §B
//     section read from the single `HOW_IT_WORKS` object, so a copy edit updates both at once.
//   • FUNCTIONAL copy (the input's accessible name + helper, the scene's visually-hidden
//     description) — part of the a11y contract; it ships AS WRITTEN (§3.7 / §4.3), not placeholder.

/** The miniature's fallback article title (AC16). Used when the recently-curated pool has no
 *  title that fits the miniature's single title line — and as the deterministic capture pin (§7.2).
 *  15 chars, well within the fit-cap. */
export const DEFAULT_TITLE = "Acer palmatum";

/** The miniature title fit-cap (docs/design/about-projector-warmup.md §5.1, AC16): a recently-curated
 *  title is admitted to the pick pool only if its length ≤ this cap, so it renders on the miniature's
 *  single 352px / 28px-Georgia title line without wrapping at any tier. The cap is a FILTER — an
 *  over-long title is excluded, never truncated/wrapped/shrunk. Derived server-side in /about. */
export const TITLE_FIT_CAP = 20;

/** The projector power control's state-reflecting accessible name (§6.3, AC13): an action-label that
 *  names what activating it does, flipped with the power state. The status light's colour is
 *  decorative — the on/off state reaches assistive tech by this name (AC9). */
export const POWER_LABEL_ON = "Turn the projector off"; // shown when the projector is ON
export const POWER_LABEL_OFF = "Turn the projector on"; // shown when the projector is OFF

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
  heading: "Curating the best of what's missing from Wikipedia",
  lead:
    "Wikipedia does an incredible job of organizing knowledge through text and images. " +
    "But there's so much more out there, in the world of video.",
  steps: [
    {
      n: "01",
      label: "Watch videos in your encyclopedia",
      body: "As you read a Wikipedia article, browse related videos from YouTube, TikTok and beyond.",
    },
    {
      n: "02",
      label: "Find and curate the best videos",
      body: "When you find a great video, add it — along with a curation note about who made it, how accurate it is, and what it covers.",
    },
    {
      n: "03",
      label: "Join the global free knowledge community",
      body: "Organizing the world's knowledge is too big a job for one person, too complex for one medium, and too important to leave to for-profit companies.",
    },
  ],
} as const;

export type HowItWorksStep = (typeof HOW_IT_WORKS)["steps"][number];
