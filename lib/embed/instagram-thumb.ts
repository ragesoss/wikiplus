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
// Lazy + cached (Wikimedia-style etiquette toward Instagram): the embed page is fetched only when a
// browser requests the thumbnail (`<img loading="lazy">`), each outcome is memoized in-process, and
// the response carries a public Cache-Control so the edge/browser absorb repeats. Only a validated
// shortcode reaches the fixed www.instagram.com fetch URL, and the redirect target must be https on
// Instagram's CDN — never an open redirect. Any failure is a 404, which the thumbnail's `onError`
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

async function lookup(code: string): Promise<string | null> {
  const cached = memo.get(code);
  if (cached && cached.expires > Date.now()) return cached.url;
  const html = await fetchInstagramEmbed(code);
  const imageUrl = html ? parseInstagramEmbed(html)?.imageUrl : undefined;
  const url = imageUrl && isInstagramImageUrl(imageUrl) ? imageUrl : null;
  remember(code, url);
  return url;
}

function notFound(): Response {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": `public, max-age=${MISS_TTL_S}` },
  });
}

/** The redirect (302) or 404 response for an Instagram shortcode's thumbnail. */
export async function instagramThumbResponse(code: string): Promise<Response> {
  if (!isInstagramShortcode(code)) return notFound();
  const url = await lookup(code);
  if (!url) return notFound();
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": `public, max-age=${HIT_TTL_S}`,
    },
  });
}

/** Test seam: forget memoized lookups. */
export function __resetInstagramThumbCache(): void {
  memo.clear();
}
