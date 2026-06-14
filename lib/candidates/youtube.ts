import type { CandidateSource, RawCandidate, SourceContext } from "./types";

// The YouTube candidate source (spec AC2/AC13). ONE `search.list` call per topic
// (Decision 1: quota cost is per-call, 100 units/call), normalized to RawCandidate[].
//
// AC1/AC14/AC15: the key is read ONLY from process.env.NEXT_PUBLIC_YOUTUBE_API_KEY
// (never hard-coded). When unset, isEnabled() is false and the live path never runs.
// search() NEVER throws — any key/quota/network/parse failure resolves to [] so the
// pipeline degrades to seeded/empty without a broken page.

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
// Request a few more than we surface, to leave room for dedup + best-per-section
// before truncating the General list to 5 (Decision 1).
const MAX_RESULTS = 12;
// Descriptive identifier (Wikimedia/etiquette posture; AC14). Browsers forbid setting
// User-Agent, but we attach a referrer-friendly Accept and an identifying query note.
const UA = "wiki+/0.0 (prototype; https://ragesoss.github.io/wikiplus/)";

/** Read the build-time public key. Returns undefined locally/CI (AC1). */
export function youtubeApiKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

// Shape of the slice of the search.list response we read (others ignored).
interface YouTubeSearchItem {
  id?: { videoId?: string; kind?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    channelId?: string;
    thumbnails?: Record<
      string,
      { url?: string; width?: number; height?: number } | undefined
    >;
  };
}
interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
}

export const youtubeSource: CandidateSource = {
  id: "youtube",

  isEnabled(): boolean {
    return youtubeApiKey() !== undefined;
  },

  async search(ctx: SourceContext): Promise<RawCandidate[]> {
    const key = youtubeApiKey();
    if (!key) return []; // AC1 — no key, no call.
    try {
      const url =
        `${SEARCH_ENDPOINT}?part=snippet&type=video` +
        `&maxResults=${MAX_RESULTS}` +
        `&q=${encodeURIComponent(ctx.topicTitle)}` +
        `&key=${encodeURIComponent(key)}`;
      const res = await fetch(url, { headers: { Accept: "application/json", "X-Client": UA } });
      if (!res.ok) return []; // AC14 — quota/4xx/5xx degrade silently.
      const data = (await res.json()) as YouTubeSearchResponse;
      return normalizeResponse(data);
    } catch {
      return []; // AC14 — network/parse failure degrades silently.
    }
  },
};

/** Map a raw search.list response to normalized RawCandidate[] (within-set deduped). */
export function normalizeResponse(data: YouTubeSearchResponse): RawCandidate[] {
  const out: RawCandidate[] = [];
  const seen = new Set<string>();
  for (const item of data.items ?? []) {
    const videoId = item.id?.videoId;
    if (!videoId || seen.has(videoId)) continue; // AC7 — within-response dedup.
    seen.add(videoId);
    out.push(toRawCandidate(videoId, item.snippet ?? {}));
  }
  return out;
}

function toRawCandidate(
  videoId: string,
  snippet: NonNullable<YouTubeSearchItem["snippet"]>
): RawCandidate {
  const title = snippet.title ?? "Untitled video";
  const channelTitle = snippet.channelTitle ?? "YouTube creator";
  const channelId = snippet.channelId;
  const thumb = pickThumbnail(snippet.thumbnails);
  // Decision 4: default horizontal; vertical only on a positive Shorts signal —
  // here a portrait thumbnail aspect (search.list exposes no /shorts/ URL or
  // duration, so the aspect-ratio signal is the only one available pre-promote).
  const orientation =
    thumb && thumb.width && thumb.height && thumb.height > thumb.width
      ? "vertical"
      : "horizontal";

  return {
    videoId,
    platform: "youtube",
    platformLabel: "YouTube",
    source: "YouTube",
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    thumbnailUrl: thumb?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    caption: title,
    searchText: `${title} ${snippet.description ?? ""}`.trim(),
    orientation,
    creator: {
      handle: `@${channelTitle.replace(/\s+/g, "").toLowerCase()}`,
      name: channelTitle,
      platform: "youtube",
      url: channelId
        ? `https://www.youtube.com/channel/${channelId}`
        : undefined,
    },
  };
}

/** Prefer the highest-resolution thumbnail the snippet offers. */
function pickThumbnail(
  thumbnails?: NonNullable<YouTubeSearchItem["snippet"]>["thumbnails"]
): { url?: string; width?: number; height?: number } | undefined {
  if (!thumbnails) return undefined;
  return (
    thumbnails.high ?? thumbnails.medium ?? thumbnails.default ?? undefined
  );
}
