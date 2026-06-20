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
// RESOLVED PLATFORMS (spec D-TikTok, design state C/D; recorded here + in ARCHITECTURE): YouTube
// AND TikTok resolve real metadata through the SAME server-side oEmbed loop. Each platform has its
// own public oEmbed endpoint (`OEMBED_ENDPOINT`); the fetch, mapping, resolve floor (a non-empty
// `title` AND `author_name` — D3), and failure routing are identical. A failure / non-200 /
// malformed / timeout returns `{ ok: false, reason: "failed" }` (state D — Try again / Add anyway),
// NOT `unsupported`. Instagram/other stay on the `unsupported` placeholder arm (no public token-free
// oEmbed for our use), returning `{ ok: false, reason: "unsupported" }` with no fetch — the modal
// renders the honest placeholder (no fabricated metadata, no false "resolved via oEmbed" — C10).

// Wikimedia/Wikimedia-adjacent etiquette: a descriptive User-Agent identifying wiki+ + a contact
// (CLAUDE.md / ARCHITECTURE "Etiquette"; consistent with the `UA` in lib/wiki/article.ts). On a
// SERVER fetch (unlike the browser) we CAN set User-Agent, so the request honestly identifies us.
const UA = "wiki+/0.0 (prototype; https://wikiplus.wikiedu.org/)";

// Public, token-free oEmbed endpoints for the platforms we resolve. Both sidestep CORS via the
// Server Action (no `Access-Control-Allow-Origin` from either provider — see WHY A SERVER ACTION).
const OEMBED_ENDPOINT: Partial<Record<Platform, string>> = {
  youtube: "https://www.youtube.com/oembed",
  tiktok: "https://www.tiktok.com/oembed",
};

// Bounded fetch timeout (D4). TikTok oEmbed can hang; an unbounded fetch would leave the modal stuck
// in state B (Resolving). A timeout aborts the fetch → caught below → `{ ok: false, reason: "failed" }`
// (state D), the same as any other failure. Applied to both platforms (pure robustness, no
// success-path behavior change).
const FETCH_TIMEOUT_MS = 5000;

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
  /**
   * oEmbed player `width`/`height` (the platform-agnostic orientation signal — issue #100). When
   * both are present, `add-media` derives `orientation` from their aspect (`height > width ⇒
   * vertical`), mirroring the candidate path (lib/candidates/youtube.ts). May be absent (a provider
   * that omits them, or a non-`video`/`rich` type) — the resolved arm then falls back to the
   * per-platform default. We read the player dims rather than `thumbnail_width/height` because the
   * player box is the clip's true frame; the thumbnail can be letterboxed.
   */
  width?: number;
  height?: number;
}

/**
 * The resolve outcome the modal switches on (design A→B→{C|D|E|G}):
 *   - `{ ok: true, meta }`            → state C (resolved): real title/creator/thumbnail.
 *   - `{ ok: false, reason: "failed" }`      → state D (failure): a recognized link we tried to
 *                                              fetch but couldn't (network/provider/empty/malformed)
 *                                              — Try again / Add anyway.
 *   - `{ ok: false, reason: "unsupported" }` → state G (placeholder arm): a recognized platform we
 *                                              do not fetch (Instagram/other) — straight to the
 *                                              honest placeholder, no "Try again".
 */
export type ResolveResult =
  | { ok: true; meta: ResolvedMeta }
  | { ok: false; reason: "failed" | "unsupported" };

/**
 * Resolve a recognized video's metadata for the add-by-link preview/persist (issue #64 / D-TikTok).
 *
 * Contract (the modal relies on this — it NEVER throws):
 *   - YouTube / TikTok: fetch the platform's oEmbed endpoint (`OEMBED_ENDPOINT`) with
 *     `?url=<watchUrl>&format=json` (no API key — AC8/AC10) and the descriptive User-Agent (AC8),
 *     `cache: "no-store"`, bounded by a timeout (D4). A 200 with at minimum a non-empty `title` and
 *     `author_name` (the D3 floor) is a resolve (`ok: true`). Anything else — non-2xx, network
 *     error, malformed/empty JSON, missing the load-bearing fields, or a timeout — is
 *     `{ ok: false, reason: "failed" }` (state D), NEVER a fabricated success (D2 / C10).
 *   - Instagram/other recognized platforms: `{ ok: false, reason: "unsupported" }` (state G
 *     placeholder arm). No fetch is made (no token-free oEmbed for our use).
 *
 * @param platform the parsed platform (`parseVideoUrl`'s `ParsedVideo.platform`).
 * @param watchUrl the canonical/pasted watch URL (the oEmbed `url` param).
 */
export async function resolveOEmbedAction(
  platform: Platform,
  watchUrl: string
): Promise<ResolveResult> {
  const endpoint = OEMBED_ENDPOINT[platform];
  // Platforms with no token-free oEmbed for our use (Instagram/other) stay on the placeholder arm.
  if (!endpoint) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    const url = `${endpoint}?url=${encodeURIComponent(watchUrl)}&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      // Stateless per-add lookup — no caching (spec scope: no read-path caching).
      cache: "no-store",
      // Bounded request (D4): a hang aborts → caught below → state D, never a stuck modal.
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, reason: "failed" }; // 4xx/5xx (private/region-locked/down).
    const data = (await res.json()) as Partial<{
      title: string;
      author_name: string;
      author_url: string;
      thumbnail_url: string;
      width: number;
      height: number;
    }>;
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const authorName =
      typeof data.author_name === "string" ? data.author_name.trim() : "";
    // The load-bearing C10 floor (D3): a real title + a real author name. Without BOTH, this is NOT
    // a resolve — fall through to the failure state rather than show a half-empty "resolved" credit.
    if (!title || !authorName) return { ok: false, reason: "failed" };
    const authorUrl =
      typeof data.author_url === "string" && data.author_url.trim()
        ? data.author_url.trim()
        : undefined;
    const thumbnailUrl =
      typeof data.thumbnail_url === "string" && data.thumbnail_url.trim()
        ? data.thumbnail_url.trim()
        : undefined;
    // The orientation signal (issue #100): keep the player dims only when BOTH are positive finite
    // numbers, so a partial/garbage dim can't masquerade as a signal — a missing/invalid pair leaves
    // both undefined and the resolved arm falls back to the per-platform default. Not load-bearing
    // for a resolve (a dimensionless resolve is still `ok: true`).
    const width = positiveDimension(data.width);
    const height = positiveDimension(data.height);
    return {
      ok: true,
      meta: { title, authorName, authorUrl, thumbnailUrl, width, height },
    };
  } catch {
    // Network error / offline / JSON parse failure / timeout → state D (failure), never a silent
    // mock (D2 / C10).
    return { ok: false, reason: "failed" };
  }
}

/** A usable oEmbed dimension: a positive, finite number; otherwise undefined (no orientation signal). */
function positiveDimension(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}
