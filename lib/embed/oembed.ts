"use server";

import type { Platform } from "@/lib/data/types";

// oEmbed metadata resolution for the add-by-link flow (issue #64, spec
// docs/specs/add-link-metadata.md D-YouTube, design docs/design/add-link-metadata.md state B/C).
//
// WHY A SERVER ACTION (the recorded CORS decision — spec Open question "client vs server", AC8):
//   YouTube's oEmbed endpoint (https://www.youtube.com/oembed) does NOT send an
//   Access-Control-Allow-Origin header, so a browser fetch CORS-fails and would push EVERY add
//   into the failure state (state D) — a regression that defeats AC1. Running the fetch in a
//   Server Action sidesteps CORS entirely AND is the natural home for the descriptive User-Agent
//   (AC8) — browsers forbid setting User-Agent on a client fetch; the server can. This mirrors the
//   established Server-Actions client→server boundary (lib/server/actions.ts) and the Wikimedia
//   etiquette pattern in lib/wiki/article.ts. It stays STATELESS — no schema, no secret, no cache
//   (spec scope: "No read-path caching"; AC10). It is NOT auth-gated/rate-limited: it is a
//   read-only metadata lookup, and the *write* (the add) is still gated at addClipAction.
//
// D-TikTok DECISION (the placeholder arm — spec D-TikTok, design state G; recorded here + in
// ARCHITECTURE): ONLY YouTube resolves. TikTok/Instagram/other recognized links are intentionally
// NOT fetched here — they return `{ ok: false, reason: "unsupported" }` so the modal renders the
// honest placeholder (no fabricated metadata, no false "resolved via oEmbed" — C10). TikTok oEmbed
// is markedly less reliable for our use (CORS posture, author_url/thumbnail availability, embed
// script fragility — TikTok auto-suggestion is already deferred in ARCHITECTURE for the same
// reason). A consistent honest placeholder beats an intermittently-working resolve.

// Wikimedia/Wikimedia-adjacent etiquette: a descriptive User-Agent identifying wiki+ + a contact
// (CLAUDE.md / ARCHITECTURE "Etiquette"; consistent with the `UA` in lib/wiki/article.ts). On a
// SERVER fetch (unlike the browser) we CAN set User-Agent, so the request honestly identifies us.
const UA = "wiki+/0.0 (prototype; https://wikiplus.wikiedu.org/)";

const YOUTUBE_OEMBED = "https://www.youtube.com/oembed";

/** The real metadata an oEmbed resolve yields, mapped to our `ClipMediaSource` fields (D-YouTube). */
export interface ResolvedMeta {
  /** oEmbed `title` → clip `caption` (AC1/AC2). */
  title: string;
  /** oEmbed `author_name` → `creator.name` (the C10 minimum-credit name). */
  authorName: string;
  /** oEmbed `author_url` → `creator.url` (the C10 working outbound link). May be absent. */
  authorUrl?: string;
  /** oEmbed `thumbnail_url` → `thumbnailUrl` (a REFERENCE, never hosted — AC7). May be absent. */
  thumbnailUrl?: string;
}

/**
 * The resolve outcome the modal switches on (design A→B→{C|D|E|G}):
 *   - `{ ok: true, meta }`            → state C (resolved): real title/creator/thumbnail.
 *   - `{ ok: false, reason: "failed" }`      → state D (failure): a recognized link we tried to
 *                                              fetch but couldn't (network/provider/empty/malformed)
 *                                              — Try again / Add anyway.
 *   - `{ ok: false, reason: "unsupported" }` → state G (placeholder arm): a recognized platform we
 *                                              do not fetch (TikTok/Instagram/other) — straight to
 *                                              the honest placeholder, no "Try again".
 */
export type ResolveResult =
  | { ok: true; meta: ResolvedMeta }
  | { ok: false; reason: "failed" | "unsupported" };

/**
 * Resolve a recognized video's metadata for the add-by-link preview/persist (issue #64).
 *
 * Contract (the modal relies on this — it NEVER throws):
 *   - YouTube: fetch `https://www.youtube.com/oembed?url=<watchUrl>&format=json` (no API key —
 *     D-YouTube, AC10) with the descriptive User-Agent (AC8). A 200 with at minimum a non-empty
 *     `title` and `author_name` is a resolve (`ok: true`). Anything else — non-2xx, network error,
 *     malformed/empty JSON, or missing the load-bearing fields — is `{ ok: false, reason: "failed" }`
 *     (state D), NEVER a fabricated success (AC4 / C10).
 *   - Non-YouTube recognized platforms (tiktok/instagram/other): `{ ok: false, reason: "unsupported" }`
 *     (state G placeholder arm — D-TikTok). No fetch is made.
 *
 * @param platform the parsed platform (`parseVideoUrl`'s `ParsedVideo.platform`).
 * @param watchUrl the canonical/pasted watch URL (the oEmbed `url` param).
 */
export async function resolveOEmbedAction(
  platform: Platform,
  watchUrl: string
): Promise<ResolveResult> {
  // D-TikTok placeholder arm: only YouTube is fetched (see file header / ARCHITECTURE).
  if (platform !== "youtube") {
    return { ok: false, reason: "unsupported" };
  }

  try {
    const url = `${YOUTUBE_OEMBED}?url=${encodeURIComponent(watchUrl)}&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      // Stateless per-add lookup — no caching (spec scope: no read-path caching).
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: "failed" }; // 4xx/5xx (private/region-locked/down).
    const data = (await res.json()) as Partial<{
      title: string;
      author_name: string;
      author_url: string;
      thumbnail_url: string;
    }>;
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const authorName =
      typeof data.author_name === "string" ? data.author_name.trim() : "";
    // The load-bearing C10 floor: a real title + a real author name. Without BOTH, this is NOT a
    // resolve — fall through to the failure state rather than show a half-empty "resolved" credit.
    if (!title || !authorName) return { ok: false, reason: "failed" };
    const authorUrl =
      typeof data.author_url === "string" && data.author_url.trim()
        ? data.author_url.trim()
        : undefined;
    const thumbnailUrl =
      typeof data.thumbnail_url === "string" && data.thumbnail_url.trim()
        ? data.thumbnail_url.trim()
        : undefined;
    return { ok: true, meta: { title, authorName, authorUrl, thumbnailUrl } };
  } catch {
    // Network error / offline / JSON parse failure → state D (failure), never a silent mock (AC4).
    return { ok: false, reason: "failed" };
  }
}
