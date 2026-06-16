// Canonical Topic URL helpers — title-based routing (`/topic/<Title>`), paralleling
// Wikipedia's `/wiki/<Title>`. The Wikidata QID stays under the hood (the internal
// store key, resolved lazily) and NEVER appears in the address bar.
// See docs/ARCHITECTURE.md ("Internal-link resolution" — owner-directed title scheme).
//
// Two config wrinkles these helpers absorb so call sites (the wikilink rewrite,
// <Link>s, the bare-path redirect) stay simple:
//   - an optional `basePath` (empty for the root-served Node SSR server; set by a future
//     subpath host via NEXT_PUBLIC_BASE_PATH) prefixes every URL, and
//   - `trailingSlash: true` (next.config, KEPT through the SSR switch — issue #37) makes
//     `/topic/<Title>/` the one canonical form; the server redirects the slashless form
//     to it (under the old static export the slash matched a built `<route>/index.html`).

/** basePath (empty for the root-served Node SSR server; "/<sub>" if a host sets it). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// ── Canonical title ⇄ URL-slug encoding (the single source of truth) ──────────
// Topic URLs mirror Wikipedia's `/wiki/<Title>`, where a space renders as an
// underscore (`San Francisco` → `San_Francisco`). The ONLY special case is the
// space↔underscore swap; every other character keeps standard
// `encodeURIComponent`/`decodeURIComponent` behavior so the title segment is
// always a single, unambiguous path segment (reserved chars `&`,`?`,`#`,`/`,`+`
// stay percent-encoded). `topicHref` and `staticTopicParams` (lib/data/seed.ts)
// both route through `titleToSlug` so the pre-built static path and the runtime
// href are byte-for-byte identical. (#11; reused by #12 navbar search + #13
// bare-path redirect.) See docs/ARCHITECTURE.md ("Internal-link resolution").
//
// Per Wikipedia parity, underscore and space are interchangeable in titles: a
// title containing a literal `_` and one containing a space both serialize to `_`
// and both parse back to a space. Accepted, not a defect (spec #11 AC7).

/**
 * Encode a Topic title into its URL path segment: spaces → `_`, everything else
 * percent-encoded by `encodeURIComponent`. Order matters — we encode FIRST (so a
 * space becomes `%20` and reserved chars are escaped), then map the `%20`
 * sequences to `_`. Encoding first means we never touch a percent-escape we
 * introduced, so an underscore is never double-encoded (a literal `_` is left
 * untouched by `encodeURIComponent` and stays `_`).
 */
export function titleToSlug(title: string): string {
  return encodeURIComponent(title).replace(/%20/g, "_");
}

/**
 * Decode a URL path segment back into the clean space-form Topic title:
 * underscores → spaces, then percent-decode the rest. We swap `_`→space first so
 * legacy `%20` URLs (from before this encoding) also decode to a space — both
 * `San_Francisco` and `San%20Francisco` yield `San Francisco` (spec #11 AC9).
 * Falls back to the raw segment if it is not valid percent-encoding.
 */
export function slugToTitle(slug: string): string {
  const spaced = slug.replace(/_/g, " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

/**
 * Build the canonical, navigable href for a Topic, by **title**. Encodes the title
 * via {@link titleToSlug} (spaces → `_`, reserved chars percent-encoded), adds the
 * trailing slash (matches `trailingSlash: true`), and — when `withBase` — prefixes
 * the deploy basePath. Use `withBase: true` for raw `<a href>`s injected into
 * sanitized article HTML (a hard navigation must resolve under the Pages subpath);
 * use the default (no base) for Next `<Link href>` / `router.push`, which add the
 * basePath themselves.
 */
export function topicHref(title: string, opts?: { withBase?: boolean }): string {
  const path = `/topic/${titleToSlug(title)}/`;
  return opts?.withBase ? `${BASE_PATH}${path}` : path;
}

/**
 * Parse a Topic title out of a pathname (the SPA 404 fallback re-routes from
 * `location.pathname`). Strips the basePath, matches `/topic/<Title>(/)?`, and
 * decodes the segment via {@link slugToTitle} (underscores → spaces; legacy `%20`
 * still decodes to a space). Returns the clean space-form title that the store
 * lookup (`getTopicByTitle`) and Wikipedia resolution (`titleToQid`) expect.
 * Returns null for any non-topic path. The `?qid=` route is NOT a title path
 * (it's `/topic` with a query) and returns null here.
 */
export function titleFromPathname(pathname: string): string | null {
  let path = pathname;
  if (BASE_PATH && path.startsWith(BASE_PATH)) path = path.slice(BASE_PATH.length);
  const m = path.match(/^\/topic\/([^/?#]+)\/?$/);
  if (!m) return null;
  return slugToTitle(m[1]);
}

/**
 * The RAW URL slug segment of a Topic pathname — the bytes after `/topic/` and before
 * the trailing slash, decoded NOT AT ALL (unlike {@link titleFromPathname}, which
 * decodes to the space-form title). Used by the title-route canonicalization (#23) to
 * compare the slug a reader actually arrived on against `titleToSlug(canonicalTitle)`:
 * a literal-space arrival (`/topic/Calvin cycle/`) and a lowercase arrival
 * (`/topic/calvin_cycle/`) both differ from the canonical `Calvin_cycle` slug and so
 * must canonicalize, whereas `/topic/Calvin_cycle/` already matches and must not.
 * Returns null for any non-topic path.
 */
export function currentTopicSlug(pathname: string): string | null {
  let path = pathname;
  if (BASE_PATH && path.startsWith(BASE_PATH)) path = path.slice(BASE_PATH.length);
  const m = path.match(/^\/topic\/([^/?#]+)\/?$/);
  return m ? m[1] : null;
}
