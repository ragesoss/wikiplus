import {
  fetchInstagramEmbed,
  isInstagramImageUrl,
  isInstagramShortcode,
  parseInstagramEmbed,
} from "./instagram";

// Instagram thumbnail redirect (docs/specs/instagram-resolve.md AC4), served by
// app/api/thumb/instagram/[code]/route.ts. An Instagram clip stores that
// stable path as its `thumbnailUrl`; the route reads the post's current thumbnail from Instagram's
// public embed page and 302-redirects the browser to it on Instagram's CDN — the image is
// referenced, never hosted or proxied. Instagram signs its image URLs with a multi-day expiry, so a
// redirect cached for hours always lands on a live URL.
//
// Lazy + cached (Wikimedia-style etiquette toward Instagram): only a shortcode of a stored wiki+ clip
// is served; the embed page is fetched only when a browser requests the thumbnail
// (`<img loading="lazy">`); concurrent requests share one fetch; each outcome is memoized
// in-process; and the response carries a public Cache-Control so the edge/browser absorb repeats.
// Only a validated shortcode reaches the fixed www.instagram.com fetch URL, and the redirect target
// must be https on Instagram's CDN — never an open redirect. Any failure is a 404, which the thumbnail's `onError`
// turns into the gradient fallback.

const HIT_TTL_S = 6 * 60 * 60;
const MISS_TTL_S = 15 * 60;
const MAX_ENTRIES = 1000;

type Entry = { url: string | null; expires: number };
const memo = new Map<string, Entry>();

function remember(code: string, url: string | null): void {
  if (memo.size >= MAX_ENTRIES) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  const ttl = url ? HIT_TTL_S : MISS_TTL_S;
  memo.set(code, { url, expires: Date.now() + ttl * 1000 });
}

const inFlight = new Map<string, Promise<string | null>>();

/** Which embed-page form a stored clip uses (its canonical watch URL is `/reel/<code>/` or `/p/<code>/`). */
export type InstagramKind = "reel" | "p";

async function fetchThumbnail(code: string, kind: InstagramKind): Promise<string | null> {
  // The same captioned embed page the add-time resolve reads (lib/embed/instagram.ts), in the clip's
  // own `/reel/` or `/p/` form — the request proven to return the post's media.
  const html = await fetchInstagramEmbed(code, { kind, captioned: true });
  const imageUrl = html ? parseInstagramEmbed(html)?.imageUrl : undefined;
  // Send exactly the URL that was validated (the normalized href), never the raw scraped string.
  const url = imageUrl && isInstagramImageUrl(imageUrl) ? new URL(imageUrl).href : null;
  remember(code, url);
  return url;
}

async function lookup(code: string, kind: InstagramKind): Promise<string | null> {
  const cached = memo.get(code);
  if (cached && cached.expires > Date.now()) return cached.url;
  // Concurrent requests for one shortcode share a single Instagram fetch.
  const pending = inFlight.get(code);
  if (pending) return pending;
  const p = fetchThumbnail(code, kind).finally(() => inFlight.delete(code));
  inFlight.set(code, p);
  return p;
}

/**
 * A 404. A post Instagram can't serve is cached briefly; a shortcode not (yet) curated is `no-store`,
 * so a curator's browser that asked during the add flow sees the thumbnail as soon as the clip lands.
 */
function notFound(cacheable = true): Response {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": cacheable ? `public, max-age=${MISS_TTL_S}` : "no-store",
    },
  });
}

/**
 * The redirect (302) or 404 response for an Instagram shortcode's thumbnail. `curatedKind` returns
 * the stored clip's embed form for the shortcode (or null when no stored wiki+ clip uses it) BEFORE
 * any Instagram fetch, so the public route can never be used to make wiki+ fetch arbitrary posts.
 */
export async function instagramThumbResponse(
  code: string,
  curatedKind: (code: string) => Promise<InstagramKind | null>
): Promise<Response> {
  if (!isInstagramShortcode(code)) return notFound();
  const cached = memo.get(code);
  if (cached && cached.expires > Date.now()) {
    return cached.url ? redirect(cached.url) : notFound();
  }
  const kind = await curatedKind(code).catch(() => null);
  if (!kind) return notFound(false);
  const url = await lookup(code, kind);
  return url ? redirect(url) : notFound();
}

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": `public, max-age=${HIT_TTL_S}` },
  });
}

/** Test seam: forget memoized lookups. */
export function __resetInstagramThumbCache(): void {
  memo.clear();
  inFlight.clear();
}
