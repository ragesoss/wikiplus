"use client";

// ── SkinToggle (issue #143, design docs/design/skin-toggle.md). ─────────────────────────────────
// The in-app binary skin control: a single `<button type="button">` that flips the app between the
// light Indigo Press zine and the zine-dark skin LIVE — no reload, no flash (AC2/AC3). It lives on
// the persistent chrome row of every SiteHeader host, immediately left of the auth slot (design §7),
// so it is reachable on BOTH auth states (AC1). The logged-in account-menu mirror (in AuthControl's
// SignedIn) calls the SAME `useSkin().toggle()` — one action, one state (design §2).
//
// FORM (design §3 / §5.3): a toggle BUTTON, NOT a `role="switch"` and NOT `aria-pressed` — the label
// states the DESTINATION ("Dark" when light is active), which is the honest mental model for swapping
// between two first-class presentations. No disabled state (§4.6) — the switch is client-side and the
// DB persist is fire-and-forget, so it is always operable.
//
// NO-FLASH FIRST FRAME (design §4.5): the button BOX renders immediately (stable layout), but the
// directional word + glyph wait until the resolved skin is known on the client (`ready`), so a dark /
// OS-dark reader never sees the light "Dark" label flash. The visible word may hide at the densest
// widths (`iconOnly`); the full `aria-label` never does (AC13).

import { useSkin, otherSkin, type Skin } from "@/lib/skin/client";
import { MoonGlyph, SunGlyph } from "./SkinGlyph";

/** The verbatim microcopy (design §5.1). Keyed by the CURRENT resolved skin; the visible word is the
 *  destination, the accessible name the full verb phrase. */
const VISIBLE_WORD: Record<Skin, string> = {
  zine: "Dark", // light active → one tap to dark
  "zine-dark": "Light", // dark active → one tap to light
};
function accessibleName(skin: Skin): string {
  return `Switch to ${otherSkin(skin) === "zine-dark" ? "dark" : "light"} skin`;
}

export function SkinToggle({
  /** design §7.4: ALWAYS icon-only — a `min-w-[44px]` square (glyph + the full `aria-label`, no
   *  visible word). The dense Topic host uses this at every width. */
  iconOnly = false,
  /** design §7.1–§7.3: a CSS-driven responsive collapse for the home / page / flat hosts — the
   *  labeled chip at `≥ 480px`, an icon-only square BELOW `480px` (the same `480px` swap the login
   *  uses). Implemented purely in CSS so the SSR/hydration markup is identical at every width (no
   *  flash); the visible word hides and the box squares up below the breakpoint, the `aria-label`
   *  never changes. Ignored when `iconOnly` is set (Topic is icon-only at all widths). */
  responsiveCollapse = false,
}: {
  iconOnly?: boolean;
  responsiveCollapse?: boolean;
} = {}) {
  const { skin, ready, toggle } = useSkin();

  // The accessible name is ALWAYS the full verb phrase (design §5.1): the visible "Dark"/"Light" word
  // alone is ambiguous without the glyph, and it is hidden outright in the icon-only form — so the
  // meaning is always in the accessible tree (AC13). When `ready` is false the resolved skin is not
  // yet known; the seeded light default's name is a safe placeholder (the box has no visible word yet)
  // and it corrects on the same tick the word/glyph appears.
  const label = accessibleName(skin);

  // Match the login chip's affordance language (design §3): the hardbox border + the login's hover
  // drop-shadow + ink-on-band (`text-ink-plus`). Transparent fill (inherits the chrome band), so it
  // themes for free on both skins. `min-h-[44px]` (and `min-w-[44px]` icon-only) for the touch
  // target. The site-wide `:focus-visible` 3px `--color-focus-ring` (offset 2px) is the focus state.
  const COMMON =
    "inline-flex min-h-[44px] items-center border-2 border-hardbox text-sm font-bold text-ink-plus transition hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]";
  // Three geometries, all SSR-identical markup:
  //   - iconOnly (Topic §7.4): a 44px square at every width.
  //   - responsiveCollapse (home/page/flat §7.1–§7.3): a square BELOW 480px, the labeled pill at
  //     `≥ 480px` — a pure CSS swap (`min-w` + `justify-center` + `gap`/`px` flip at `min-[480px]`).
  //   - default: the labeled pill at every width.
  const geometry = iconOnly
    ? "min-w-[44px] justify-center px-2 py-1.5"
    : responsiveCollapse
      ? "min-w-[44px] justify-center px-2 min-[480px]:min-w-0 min-[480px]:justify-start min-[480px]:gap-1.5 min-[480px]:px-3 py-1.5"
      : "gap-1.5 px-3 py-1.5";

  // The visible word is shown only in the labeled forms, and (responsiveCollapse) only `≥ 480px`. It
  // is always in the DOM, hidden via `hidden` (so the SSR/hydration markup is identical — no flash);
  // the `aria-label` carries the meaning at every width (AC13).
  const wordClass = iconOnly
    ? "hidden"
    : responsiveCollapse
      ? "hidden min-[480px]:inline"
      : undefined;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={toggle}
      className={`${COMMON} ${geometry}`}
      data-testid="skin-toggle"
    >
      {/* The directional word + glyph wait for the resolved skin (`ready`) so a dark reader never sees
          the light label flash (§4.5). The box above renders immediately for stable layout. */}
      {ready ? (
        <>
          {skin === "zine-dark" ? (
            <SunGlyph className="h-4 w-4 shrink-0" />
          ) : (
            <MoonGlyph className="h-4 w-4 shrink-0" />
          )}
          <span className={wordClass}>{VISIBLE_WORD[skin]}</span>
        </>
      ) : null}
    </button>
  );
}
