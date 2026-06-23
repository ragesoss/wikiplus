import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/auth/Providers";

export const metadata: Metadata = {
  title: "Wiki+plus",
  description: "A curation and contextualization layer over Wikipedia.",
};

// ── The skin seam (docs/design/skin-system-zine-dark.md §10 / issue #119). ──────────────────────────
// A skin is a pure CSS / `data-skin`-attribute concern (the override block lives in globals.css). The
// ONLY switch is the `data-skin` attribute on <html>; the default (absent / "zine") is the light
// Indigo Press zine.
//
// READ-PATH CONSTRAINT (recorded in docs/ARCHITECTURE.md): the SSR'd HTML shell must stay
// SKIN-AGNOSTIC so the (future) ISR/Redis read path needs no skin variance — the same cached page
// serves every skin. We therefore do NOT bake `data-skin` into the server-rendered markup from a
// per-request cookie (that would fragment the cache by skin). Instead a tiny PRE-PAINT inline script
// sets `data-skin` on <html> from a cookie (operator/spike override) falling back to the build-time
// `WIKIPLUS_SKIN` default — before first paint, so there is no flash and the cached shell is
// identical across skins. The polished in-app toggle + per-user persisted preference are out of
// scope for #119 (this is the minimal operator-level switch the seam makes a small additive change).
const DEFAULT_SKIN = process.env.WIKIPLUS_SKIN ?? "";
// Inline, synchronous, runs before paint. Reads the `wikiplus-skin` cookie (the spike's override),
// else the build-time default; sets the attribute only for a non-default skin so the light shell is
// untouched. Kept tiny + dependency-free; `\x3c` avoids any `</script>` parsing pitfall.
const SKIN_BOOTSTRAP = `(function(){try{var m=document.cookie.match(/(?:^|; )wikiplus-skin=([^;]*)/);var s=m?decodeURIComponent(m[1]):${JSON.stringify(
  DEFAULT_SKIN
)};if(s&&s!=="zine"){document.documentElement.setAttribute("data-skin",s);}}catch(e){}})();`;

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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
