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

  // Instagram
  if (host === "instagram.com") {
    const m = url.pathname.match(/\/(reel|p)\/([^/]+)/);
    if (m) {
      return {
        platform: "instagram",
        videoId: m[2],
        embedUrl: `https://www.instagram.com/${m[1]}/${m[2]}/embed`,
      };
    }
  }

  return null;
}

function youtube(id: string): ParsedVideo {
  return {
    platform: "youtube",
    videoId: id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}
