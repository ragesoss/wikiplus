// Bare-path fallback — the reserved-prefix allowlist + the redirect-target rule.
//
// SOURCE OF TRUTH for issue #13. See docs/specs/bare-path-redirect.md
// ("The reserved-prefix allowlist decision" — the normative rule) and
// docs/design/bare-path-redirect.md (the no-flash / a11y UX contract).
// Recorded in docs/ARCHITECTURE.md ("Prototype phase → routing").
//
// The feature: a bare single-segment path (e.g. `/San_Francisco`) is a Topic
// shorthand and is redirected to the canonical `/topic/<Title>/`. The default for
// an unmatched bare segment is "it's a Topic title"; the allowlist below is the
// finite, maintained set of EXCEPTIONS that must never be hijacked into a Topic.
//
// FUTURE-PROOFING POLICY (spec §"Rule for adding future /<section> views"):
//   Every new top-level route added under `app/<section>/` MUST be added to
//   RESERVED_SEGMENTS below in the SAME change. A new top-level section is by
//   definition a reserved prefix, not a bare title. AC8's test asserts every
//   current top-level route is reserved, so a route added without updating this
//   list fails a test rather than hijacking a URL in production.

import { BASE_PATH, slugToTitle, topicHref } from "@/lib/wiki/topicRoute";

/**
 * Reserved top-level route segments — the enumerated exceptions. Add a new entry
 * here in the SAME change that adds a new `app/<section>/` route (future-proofing
 * policy above; enforced by AC8's test). `topic` is included for clarity, though
 * the `/topic` prefix is also caught structurally by the loop guard below.
 */
export const RESERVED_SEGMENTS = ["topic", "contribute", "_next"] as const;

/**
 * Is a single path segment reserved (never a bare Topic title)?
 *   - enumerated top-level routes (RESERVED_SEGMENTS),
 *   - a segment containing `.` — an asset / file-extension request
 *     (`favicon.ico`, `404.html`, `*.js`); a dotted title stays reachable via its
 *     canonical `/topic/<Title>/` (spec assumption),
 *   - a segment containing `:` — a reserved namespace form (`Help:Contents`,
 *     `Special:Random`); the article-link rewrite already routes `:`-links to
 *     Wikipedia, not to `/topic/`.
 * These last two are PREDICATES (not an enumerated asset list) so the rule is
 * robust to assets and namespaces we have not named.
 */
export function isReservedSegment(segment: string): boolean {
  if (RESERVED_SEGMENTS.includes(segment as (typeof RESERVED_SEGMENTS)[number]))
    return true;
  if (segment.includes(".")) return true;
  if (segment.includes(":")) return true;
  return false;
}

/**
 * Strip the deploy basePath and a single trailing slash, returning the in-app
 * path (always starting with `/`). Mirrors `titleFromPathname`'s basePath handling
 * so the two agree on the deployed Pages subpath.
 */
function normalizePath(pathname: string): string {
  let path = pathname;
  if (BASE_PATH && path.startsWith(BASE_PATH)) path = path.slice(BASE_PATH.length);
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}

/**
 * The bare-path predicate (the normative rule, spec §"The rule"). Returns the
 * single unreserved segment of a bare title path, or `null` if the path is NOT a
 * bare title (home, multi-segment, reserved, or already under `/topic`).
 *
 * Redirect IFF all hold for `pathname` (after stripping basePath + one trailing
 * slash):
 *   1. exactly one non-empty segment (`/<segment>`, no further `/`),
 *   2. the segment is not reserved (isReservedSegment),
 *   3. the path is not already under `/topic` (loop guard — caught by (2) via the
 *      `topic` reserved segment, but checked structurally here too for any
 *      `/topic/...` multi-segment form).
 */
export function bareTitleSegment(pathname: string): string | null {
  const path = normalizePath(pathname);
  if (path === "/") return null; // home / empty
  // Single segment only: `/foo`, never `/foo/bar` (incl. `/topic/<Title>`).
  const m = path.match(/^\/([^/]+)$/);
  if (!m) return null;
  const segment = m[1];
  if (isReservedSegment(segment)) return null;
  return segment;
}

/**
 * Compute the bare-path redirect target, or `null` for any path the rule does not
 * own (a no-op — reserved, multi-segment, home, or already under `/topic`).
 *
 * On a hit, returns `/topic/<Title>/` with the segment normalized through #11's
 * encoding (`slugToTitle` → `titleToSlug` inside `topicHref`) so `/Multi Word` and
 * `/Multi_Word` both land on `/topic/Multi_Word/`. Query + hash are preserved onto
 * the destination in that order (spec AC3). The target is under the reserved
 * `/topic` prefix, so `barePathRedirectTarget(target) === null` (the loop guard,
 * spec AC4).
 *
 * `search` / `hash` accept either the leading punctuation form (`"?a=b"`, `"#x"`)
 * or the bare form (`"a=b"`, `"x"`); empty / falsy values are dropped.
 */
export function barePathRedirectTarget(
  pathname: string,
  search?: string,
  hash?: string
): string | null {
  const segment = bareTitleSegment(pathname);
  if (segment === null) return null;
  const title = slugToTitle(segment);
  let target = topicHref(title); // `/topic/<Title>/`, no basePath (router adds it)
  const q = normalizeQuery(search);
  const h = normalizeHash(hash);
  if (q) target += q;
  if (h) target += h;
  return target;
}

function normalizeQuery(search?: string): string {
  if (!search) return "";
  const s = search.startsWith("?") ? search.slice(1) : search;
  return s ? `?${s}` : "";
}

function normalizeHash(hash?: string): string {
  if (!hash) return "";
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  return h ? `#${h}` : "";
}
