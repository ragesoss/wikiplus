"use client";

// ── FooterSkinToggle — the canonical in-app skin control (footer placement). ─────────────────────
// The binary light ↔ zine-dark toggle that lives in SiteFooter, alongside "About your data." It
// consumes the SAME `useSkin` hook as the old header chip — one state, one handler — so it remains
// in sync with any other instance (the MutationObserver in useSkin keeps them all aligned).
//
// FORM: a quiet `<button type="button">` sized to match the footer link's affordance — NOT the
// bordered hardbox chip the header once used. `text-sm text-link` + hover underline + the site
// focus ring: inline with the footer, unobtrusive. Touch target ≥ 44px (min-h-[44px]) with
// comfortable `py-1` padding, matching the footer link's clickable region. No disabled state
// (§4.6) — the toggle is always operable (client-side + fire-and-forget DB persist).
//
// MICROCOPY (design §5.1 verbatim):
//   light active → visible "Dark",   aria-label="Switch to dark skin"
//   dark active  → visible "Light",  aria-label="Switch to light skin"
// The decorative moon/sun glyph is aria-hidden; the WORD carries meaning (AC13 — never icon alone).
//
// NO-FLASH FIRST FRAME (design §4.5): the button box renders immediately for stable layout, but
// the directional word + glyph wait until the resolved skin is known on the client (`ready`), so a
// dark reader never sees the light "Dark" label flash.
//
// AA on BOTH skins: text-link (`--color-link`) + the site focus ring are skin-aware tokens that
// already pass AA on both the light footer surface and the dark footer surface. No gold (VI §7.3).

import { useSkin, otherSkin, type Skin } from "@/lib/skin/client";
import { MoonGlyph, SunGlyph } from "@/components/header/SkinGlyph";

const VISIBLE_WORD: Record<Skin, string> = {
  zine: "Dark",
  "zine-dark": "Light",
};

function accessibleName(skin: Skin): string {
  return `Switch to ${otherSkin(skin) === "zine-dark" ? "dark" : "light"} skin`;
}

export function FooterSkinToggle() {
  const { skin, ready, toggle } = useSkin();
  const label = accessibleName(skin);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={toggle}
      data-testid="footer-skin-toggle"
      // Quiet footer affordance: text-link color (matches the "About your data" link), inline
      // flex, min-h-[44px] touch target, no border/chip. The site focus-visible ring (from
      // globals.css `:focus-visible`) applies automatically — AA on both skins.
      className="inline-flex min-h-[44px] items-center gap-1 py-1 text-sm text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-2"
    >
      {/* The directional word + glyph wait for the resolved skin (`ready`) so a dark reader never
          sees the light label flash (design §4.5). The button box above renders immediately. */}
      {ready ? (
        <>
          {skin === "zine-dark" ? (
            <SunGlyph className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <MoonGlyph className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{VISIBLE_WORD[skin]}</span>
        </>
      ) : null}
    </button>
  );
}
