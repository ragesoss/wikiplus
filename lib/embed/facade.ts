import type { Platform } from "@/lib/data/types";

// Parse a pasted video URL into the minimal metadata we store ourselves, so the
// click-to-load facade can build a thumbnail + embed without a server-side
// oEmbed call. Embed by reference, never host.

export interface ParsedVideo {
  platform: Platform;
  videoId: string;
  embedUrl: string;
  thumbnailUrl?: string;
  /**
   * The canonical creator handle carried in the URL, when the platform's share URL exposes one.
   * TikTok share URLs embed the real `@handle` (`tiktok.com/@junglygarden/video/…`), which is a
   * strictly-better display label than the author-name derivation (CURATION §5.5 / C10, D1). An
   * in-memory parse field only — not persisted shape. Absent for YouTube/Instagram share forms,
   * which carry no clean handle.
   */
  creatorHandle?: string;
  /**
   * A canonical, tracking-free watch URL, when the platform's share links carry noise (Instagram's
   * `?igsh=` / username-prefixed forms). The add flow stores this as `watchUrl` in place of the
   * pasted link. Absent when the pasted link is already the watch URL we keep.
   */
  canonicalUrl?: string;
}

export function parseVideoUrl(raw: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");

  // YouTube
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    if (id) return youtube(id);
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      if (id) return youtube(id);
    }
    const shorts = url.pathname.match(/^\/shorts\/([^/]+)/);
    if (shorts) return youtube(shorts[1]);
  }

  // TikTok
  if (host === "tiktok.com") {
    const m = url.pathname.match(/\/video\/(\d+)/);
    if (m) {
      // The canonical `@handle` segment of the share URL (D1) — the real platform handle, used in
      // precedence over the author-name derivation for the resolved credit (C10).
      const handleMatch = url.pathname.match(/^\/@([^/]+)/);
      const creatorHandle = handleMatch ? `@${handleMatch[1]}` : undefined;
      return {
        platform: "tiktok",
        videoId: m[1],
        embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`,
        creatorHandle,
      };
    }
  }

  // Instagram (Reels + posts). Share links arrive as `/reel/<code>`, `/reels/<code>`, `/p/<code>`,
  // `/tv/<code>`, or username-prefixed `/<user>/reel/<code>`, usually with a `?igsh=` tracking query.
  // The shortcode is validated to Instagram's alphabet so nothing untrusted reaches the iframe `src`.
  if (host === "instagram.com" || host === "m.instagram.com") {
    const m = url.pathname.match(
      /^\/(?:[A-Za-z0-9._]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]+)\/?$/
    );
    if (m) {
      const kind = m[1] === "reel" || m[1] === "reels" ? "reel" : "p";
      const canonical = `https://www.instagram.com/${kind}/${m[2]}/`;
      return {
        platform: "instagram",
        videoId: m[2],
        embedUrl: `${canonical}embed/`,
        thumbnailUrl: instagramThumbnailPath(m[2]),
        canonicalUrl: canonical,
      };
    }
  }

  return null;
}

/**
 * The stable wiki+ thumbnail path for an Instagram shortcode. Instagram's own thumbnail URLs are
 * signed and expire within days, so clips store this path instead; the route
 * (app/api/thumb/instagram/[code]/route.ts) redirects the browser to the current image on
 * Instagram's CDN — referenced, never hosted. The caller has already validated `code`.
 */
export function instagramThumbnailPath(code: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/thumb/instagram/${code}`;
}

function youtube(id: string): ParsedVideo {
  return {
    platform: "youtube",
    videoId: id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}
