// Canonical Topic URL helpers — title-based routing (`/topic/<Title>`), paralleling
// Wikipedia's `/wiki/<Title>`. The Wikidata QID stays under the hood (the internal
// store key, resolved lazily) and NEVER appears in the address bar.
// See docs/ARCHITECTURE.md ("Internal-link resolution" — owner-directed title scheme).
//
// Static export under GitHub Pages adds two wrinkles these helpers absorb so call
// sites (the wikilink rewrite, <Link>s, the SPA 404 fallback) stay simple:
//   - a `basePath` ("/<repo>") prefixes every URL in the deployed bundle, and
//   - `trailingSlash: true` (next.config) means the static asset for a route lives at
//     `/topic/<Title>/` — a hard navigation to the slashless form would 404 from Pages.

/** basePath baked into the static export (empty in local dev; "/<repo>" on Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * Build the canonical, navigable href for a Topic, by **title**. Encodes the title,
 * adds the trailing slash (matches `trailingSlash: true`), and — when `withBase` —
 * prefixes the deploy basePath. Use `withBase: true` for raw `<a href>`s injected into
 * sanitized article HTML (a hard navigation must resolve under the Pages subpath); use
 * the default (no base) for Next `<Link href>` / `router.push`, which add the basePath
 * themselves.
 */
export function topicHref(title: string, opts?: { withBase?: boolean }): string {
  const path = `/topic/${encodeURIComponent(title)}/`;
  return opts?.withBase ? `${BASE_PATH}${path}` : path;
}

/**
 * Parse a Topic title out of a pathname (the SPA 404 fallback re-routes from
 * `location.pathname`). Strips the basePath, matches `/topic/<Title>(/)?`, and decodes
 * the title. Returns null for any non-topic path. The `?qid=` route is NOT a title path
 * (it's `/topic` with a query) and returns null here.
 */
export function titleFromPathname(pathname: string): string | null {
  let path = pathname;
  if (BASE_PATH && path.startsWith(BASE_PATH)) path = path.slice(BASE_PATH.length);
  const m = path.match(/^\/topic\/([^/?#]+)\/?$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}
