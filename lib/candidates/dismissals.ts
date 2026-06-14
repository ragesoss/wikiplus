import type { Candidate } from "@/lib/data/types";

// Sticky dismissal store (spec Decision 3, AC9; design §6.3). Mirrors the production
// `dismissed_candidate` table — keyed by (topicQid, platform, videoId) so a dismissed
// candidate does NOT resurface on reload or re-fetch. Per-browser localStorage in the
// prototype; the production move is a store swap, not a redesign.

const KEY = "wikiplus.dismissed_candidates";

/** A stable per-video identity for dedup (matches the production unique key shape). */
export interface VideoIdentity {
  topicQid: string;
  platform: string;
  videoId: string;
}

/** Parse a provider video id out of a candidate's watch/embed URL (Decision 3). */
export function videoIdOf(c: {
  platform: string;
  watchUrl: string;
  embedUrl?: string;
}): string | null {
  const urls = [c.watchUrl, c.embedUrl ?? ""];
  for (const raw of urls) {
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      if (id) return id;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        if (id) return id;
      }
      const m = url.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/);
      if (m) return m[1];
    }
    if (host.endsWith("tiktok.com")) {
      const m = url.pathname.match(/\/video\/(\d+)/);
      if (m) return m[1];
    }
  }
  return null;
}

/** Stable dedup key: platform + provider video id (Decision 3). */
export function identityKey(platform: string, videoId: string): string {
  return `${platform}:${videoId}`;
}

function read(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") as Record<string, true>;
  } catch {
    return {};
  }
}

function entryKey(d: VideoIdentity): string {
  return `${d.topicQid}|${d.platform}|${d.videoId}`;
}

/** Persist a dismissal so the candidate does not resurface (AC9). */
export function recordDismissal(c: Candidate): void {
  if (typeof window === "undefined") return;
  const videoId = videoIdOf(c);
  if (!videoId) return;
  const all = read();
  all[entryKey({ topicQid: c.topicQid, platform: c.platform, videoId })] = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* non-fatal */
  }
}

/** The set of dismissed `platform:videoId` keys for a topic (for pipeline dedup). */
export function dismissedKeysForTopic(topicQid: string): Set<string> {
  const out = new Set<string>();
  const prefix = `${topicQid}|`;
  for (const k of Object.keys(read())) {
    if (!k.startsWith(prefix)) continue;
    const [, platform, videoId] = k.split("|");
    if (platform && videoId) out.add(identityKey(platform, videoId));
  }
  return out;
}
