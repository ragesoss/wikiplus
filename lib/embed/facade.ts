import type { Platform } from "@/lib/data/types";

// Parse a pasted video URL into the minimal metadata we store ourselves, so the
// click-to-load facade can build a thumbnail + embed without a server-side
// oEmbed call. Embed by reference, never host.

export interface ParsedVideo {
  platform: Platform;
  videoId: string;
  embedUrl: string;
  thumbnailUrl?: string;
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
      return {
        platform: "tiktok",
        videoId: m[1],
        embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`,
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
