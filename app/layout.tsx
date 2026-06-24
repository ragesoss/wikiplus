import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/auth/Providers";
import { SkinSync } from "@/components/header/SkinSync";

export const metadata: Metadata = {
  title: "Wiki+plus",
  description: "A curation and contextualization layer over Wikipedia.",
};

// ── The skin seam (docs/design/skin-system-zine-dark.md §10 / issues #119, #143). ───────────────────
// A skin is a pure CSS / `data-skin`-attribute concern (the override block lives in globals.css). The
// ONLY switch is the `data-skin` attribute on <html>; the default (absent / "zine") is the light
// Indigo Press zine. The footer toggle (components/chrome/FooterSkinToggle.tsx, in SiteFooter)
// drives this seam from the UI.
//
// READ-PATH CONSTRAINT (recorded in docs/ARCHITECTURE.md): the SSR'd HTML shell must stay
// SKIN-AGNOSTIC so the (future) ISR/Redis read path needs no skin variance — the same cached page
// serves every skin. We therefore do NOT bake `data-skin` into the server-rendered markup from a
// per-request cookie (that would fragment the cache by skin). Instead a tiny PRE-PAINT inline script
// sets `data-skin` on <html> entirely in the browser — before first paint, so there is no flash and
// the cached shell is identical across skins.
//
// RESOLUTION ORDER (spec §6.1 / §6.2): explicit `wikiplus-skin` cookie → (a logged-in user's stored
// DB preference, already MIRRORED into the cookie at login — so the script only ever reads the cookie,
// never the DB) → the OS `prefers-color-scheme: dark` default (matchMedia) → the light zine. An
// EXPLICIT choice (the cookie, value `"zine"` or `"zine-dark"`) always overrides the OS signal: a
// `"zine"` cookie holds light even on an OS-dark device. The build-time `WIKIPLUS_SKIN` env seeds the
// default when there is no cookie (an operator override). All of this is resolved in this browser
// script; the server never reads the cookie/DB to render `data-skin` (AC9/AC10/AC11).
const DEFAULT_SKIN = process.env.WIKIPLUS_SKIN ?? "";
// Inline, synchronous, runs before paint. `s` = the explicit cookie value (else the build-time
// default, possibly ""). When `s` is a non-default explicit skin, apply it (cookie wins). When there
// is NO explicit choice ("" — no cookie, no env default), fall back to the OS dark preference via
// matchMedia. A `"zine"` value is an explicit LIGHT choice that suppresses the OS fallback. Kept tiny
// + dependency-free; the only interpolation is the JSON-encoded env default (never a raw cookie).
const SKIN_BOOTSTRAP = `(function(){try{var m=document.cookie.match(/(?:^|; )wikiplus-skin=([^;]*)/);var s=m?decodeURIComponent(m[1]):${JSON.stringify(
  DEFAULT_SKIN
)};if(s&&s!=="zine"){document.documentElement.setAttribute("data-skin",s);}else if(!s&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.setAttribute("data-skin","zine-dark");}}catch(e){}})();`;

// Thin shell: each route owns its own chrome. The Topic page is a full-bleed
// two-world surface with its own sticky split-wordmark header (design §5.1);
// home/contribute render inside their own constrained container.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Pre-paint skin bootstrap (see the seam note above) — sets data-skin before first paint so
            the cached, skin-agnostic shell renders the selected skin with no flash. */}
        <script dangerouslySetInnerHTML={{ __html: SKIN_BOOTSTRAP }} />
      </head>
      <body>
        <Providers>
          {/* Issue #143: the DB→cookie skin mirror at login (spec §6.1) — a render-free client step
              inside the session context. It rides the existing /api/auth/session fetch; no read-path
              cost, no server-side skin resolution. */}
          <SkinSync />
          {children}
        </Providers>
      </body>
    </html>
  );
}
