// Provider-video identity helpers for candidate dedup + dismissal (Decision 3).
//
// As of issue #45 the sticky-dismissal STORE moved behind the server data-access boundary
// (Postgres `dismissed_candidate`, reached via lib/server/actions.ts) — dismissals are now
// SHARED + DURABLE, not per-browser localStorage. So this file keeps only the PURE identity
// helpers (parse a provider video id from a URL; build the `platform:videoId` dedup key) that
// both the pipeline and the store use. The former localStorage read/write functions
// (recordDismissal / isDismissed / dismissedKeysForTopic) are gone — their behavior now lives
// in the DataStore (`recordDismissal` / `dismissedKeys`).

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
