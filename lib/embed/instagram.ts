import { parseVideoUrl } from "./facade";

// Instagram metadata from Instagram's public embed page (docs/specs/instagram-resolve.md,
// CURATION §5.5 "Instagram — credit from the public embed page").
//
// Instagram's oEmbed needs a Meta app token, but the embed page Instagram publishes for third-party
// embedding (`/<p|reel>/<code>/embed/captioned/`) is token-free and carries the creator username,
// the caption, and the current thumbnail. This module fetches and reads that page SERVER-SIDE only
// (the add-by-link resolve, the thumbnail redirect route, the deploy-time backfill). It is pure — no
// "use server", no Next imports — so the esbuild migrate bundle can import it.
//
// Every fetch targets a FIXED www.instagram.com origin + a validated shortcode (no SSRF), sends the
// descriptive User-Agent, and is bounded by a timeout. Instagram's thumbnail URLs are signed and
// expire within days, so they are never persisted: callers store the stable wiki+ redirect path
// (`instagramThumbnailPath` in ./facade) and the route resolves the current image on demand.

const UA = "wiki+/0.0 (prototype; https://wikiplus.video/)";
const FETCH_TIMEOUT_MS = 5000;

/** Max stored caption length; longer captions are cut at a word boundary with an ellipsis. */
export const MAX_INSTAGRAM_CAPTION = 300;

/** Instagram's shortcode alphabet — the only characters that ever reach a fetch URL. */
const SHORTCODE = /^[A-Za-z0-9_-]{1,64}$/;
/** Instagram's username alphabet (letters, digits, `.`, `_`; ≤ 30 chars). */
const USERNAME = /^[A-Za-z0-9._]{1,30}$/;
/** The thumbnail hosts a redirect may point at (Instagram's own CDNs). */
const THUMB_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/;

export function isInstagramShortcode(code: string): boolean {
  return SHORTCODE.test(code);
}

/** What the embed page yields. `caption` may be empty; `imageUrl` is a short-lived signed URL. */
export interface InstagramEmbed {
  username: string;
  caption: string;
  imageUrl?: string;
}

/**
 * The resolved metadata for an Instagram clip (the `ResolvedMeta` shape). `thumbnailUrl` is the
 * post's CURRENT signed CDN image — fit for the add-modal preview only; it expires, so it is never
 * persisted (the server stores the stable redirect path on write — lib/server/actions.ts).
 */
export interface InstagramMeta {
  title: string;
  authorName: string;
  authorUrl: string;
  thumbnailUrl?: string;
}

/**
 * Read an Instagram embed page. Returns null when the page is Instagram's "unavailable" embed
 * (`EmbedBroken…`) or carries no valid username — the resolve floor (CURATION §5.5).
 */
export function parseInstagramEmbed(html: string): InstagramEmbed | null {
  if (html.includes('class="EmbedBroken')) return null;
  const userMatch = html.match(/<span class="UsernameText">([^<]*)<\/span>/);
  const username = userMatch ? decodeEntities(userMatch[1]).trim() : "";
  if (!USERNAME.test(username)) return null;
  return { username, caption: readCaption(html), imageUrl: readImage(html) };
}

/** The `div.Caption` text: the creator-name link dropped, tags flattened, entities decoded. */
function readCaption(html: string): string {
  const start = html.indexOf('<div class="Caption">');
  if (start < 0) return "";
  const body = html.slice(start + '<div class="Caption">'.length);
  // The caption text ends at its first nested block (`CaptionComments`) or its own close.
  const ends = [body.indexOf("<div"), body.indexOf("</div>")].filter((i) => i >= 0);
  const inner = ends.length ? body.slice(0, Math.min(...ends)) : body;
  const text = decodeEntities(
    inner
      .replace(/<a class="CaptionUsername"[^>]*>[\s\S]*?<\/a>/, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
  );
  return text.replace(/\s+/g, " ").trim();
}

/** The `img.EmbeddedMediaImage` src, accepted only on an Instagram CDN over https. */
function readImage(html: string): string | undefined {
  const tag = html.match(/<img\b[^>]*class="EmbeddedMediaImage"[^>]*>/)?.[0];
  const src = tag?.match(/\ssrc="([^"]*)"/)?.[1];
  if (!src) return undefined;
  const url = decodeEntities(src);
  return isInstagramImageUrl(url) ? url : undefined;
}

/** An https URL on Instagram's image CDNs — the only redirect target the thumbnail route allows. */
export function isInstagramImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && THUMB_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * The stored caption: the post caption with its trailing hashtag run dropped and length-capped;
 * "Instagram post by @username" when the post has no caption text (CURATION §5.5).
 */
export function instagramTitle(embed: InstagramEmbed): string {
  // A hashtag counts only when it starts the text or follows whitespace ("We're #1" keeps its tag
  // only if more text follows; "foo#bar" is not a hashtag).
  const caption = embed.caption.replace(/(?:(?:^|\s+)#[^\s#]+)+\s*$/u, "").trim();
  if (!caption) return `Instagram post by @${embed.username}`;
  if (caption.length <= MAX_INSTAGRAM_CAPTION) return caption;
  // Cut on whole code points (an emoji or other astral character is never split), leaving room for
  // the ellipsis within the cap.
  let cut = "";
  for (const ch of caption) {
    if (cut.length + ch.length > MAX_INSTAGRAM_CAPTION - 1) break;
    cut += ch;
  }
  const atWord = cut.replace(/\s+\S*$/u, "");
  return `${atWord.length > MAX_INSTAGRAM_CAPTION / 2 ? atWord : cut}…`;
}

/**
 * Fetch an Instagram embed page by shortcode. `kind` picks the `/reel/` or `/p/` form; `captioned`
 * adds the caption block. Returns the HTML, or null on any non-2xx / network error / timeout.
 */
export async function fetchInstagramEmbed(
  code: string,
  { kind = "p", captioned = false }: { kind?: "p" | "reel"; captioned?: boolean } = {}
): Promise<string | null> {
  if (!isInstagramShortcode(code)) return null;
  const url = `https://www.instagram.com/${kind}/${code}/embed/${captioned ? "captioned/" : ""}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Resolve an Instagram watch URL to persistable metadata, or null when it cannot be resolved
 * honestly (unrecognized link, unavailable post, fetch failure, no username). Never throws.
 */
export async function resolveInstagram(watchUrl: string): Promise<InstagramMeta | null> {
  const parsed = parseVideoUrl(watchUrl);
  if (!parsed || parsed.platform !== "instagram") return null;
  const kind = parsed.embedUrl.includes("/reel/") ? "reel" : "p";
  const html = await fetchInstagramEmbed(parsed.videoId, { kind, captioned: true });
  const embed = html ? parseInstagramEmbed(html) : null;
  if (!embed) return null;
  return {
    title: instagramTitle(embed),
    authorName: embed.username,
    authorUrl: `https://www.instagram.com/${embed.username}/`,
    thumbnailUrl: embed.imageUrl,
  };
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode the HTML entities Instagram's embed markup uses (named, decimal, and hex). */
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ent: string) => {
    if (ent[0] === "#") {
      const cp = ent[1] === "x" || ent[1] === "X"
        ? parseInt(ent.slice(2), 16)
        : parseInt(ent.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : whole;
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? whole;
  });
}
