import type { ParsedVideo } from "@/lib/embed/facade";
import type { ResolvedMeta } from "@/lib/embed/oembed";
import type { ClipMediaSource } from "./curate-clip";

// Build the add-by-link `ClipMediaSource` from a parsed link + the oEmbed resolve outcome
// (issue #64, design states C/E/G; spec D-YouTube field mapping; CURATION §5.5 / C10).
//
// PURE (no "use server", no React) so the resolved/placeholder media-source construction is unit-
// testable directly and shared by AddModal's resolved (C), failure-fallback (E), and TikTok/
// unsupported (G) branches. The modal owns the STATE machine; these helpers own the VALUES that
// land in `caption` / `creator` / `thumbnailUrl` — and the C10 honesty contract:
//   - RESOLVED  → real title/name/url + a derived (or omitted) handle. The mock strings ("Pasted
//                 clip (mock preview)", "pasted", "Pasted {platform} clip") NEVER appear here.
//   - PLACEHOLDER → an honestly-labeled stand-in: "Unresolved {Platform} clip" caption,
//                 "Creator not resolved" name, NO creator.url (no fake/dead link), NO handle (no
//                 "pasted" placeholder). Reads as unresolved, never as a real creator.

/**
 * Derive a creator `@handle` the SAME way the candidate pipeline does (lib/candidates/youtube.ts:111,
 * `` `@${channelTitle.replace(/\s+/g, "").toLowerCase()}` ``) so both add paths label creators
 * identically (C10). The handle is DISPLAY SUGAR, not an identity key. Returns undefined when no
 * sensible handle derives (an empty/whitespace-only author name) so the credit degrades to name-only
 * (C10 name-only form) rather than showing an empty/fake `@` — never the literal "pasted".
 */
export function deriveHandle(authorName: string): string | undefined {
  const slug = authorName.replace(/\s+/g, "").toLowerCase();
  return slug ? `@${slug}` : undefined;
}

/**
 * RESOLVED media source (design state C, AC1/AC2). Maps the oEmbed metadata into the existing
 * `ClipMediaSource` shape: `title → caption`, `author_name → creator.name`,
 * `author_url → creator.url`, and `thumbnail_url → thumbnailUrl` (a referenced URL, never hosted —
 * AC7) falling back to the parser's derived thumb. `creator.handle` follows the D1 precedence: the
 * canonical `@handle` from the share URL (TikTok) when present, else `deriveHandle(author_name)`
 * (the YouTube floor), else omitted (name-only) — never "pasted".
 */
export function resolvedMediaSource(
  parsed: ParsedVideo,
  meta: ResolvedMeta,
  platformLabel: string,
  topicQid: string,
  watchUrl: string
): ClipMediaSource {
  return {
    topicQid,
    platform: parsed.platform,
    platformLabel,
    orientation: "vertical",
    watchUrl,
    embedUrl: parsed.embedUrl,
    // Prefer the oEmbed thumbnail; fall back to the parser's derived thumb (D-YouTube).
    thumbnailUrl: meta.thumbnailUrl ?? parsed.thumbnailUrl,
    caption: meta.title,
    creator: {
      name: meta.authorName,
      // Handle precedence (D1): the canonical `@handle` from the share URL (TikTok), else the
      // author-name derivation (the YouTube floor), else omitted (name-only) — never "pasted" (C10).
      handle: parsed.creatorHandle ?? deriveHandle(meta.authorName) ?? "",
      platform: parsed.platform,
      // The C10 minimum-credit outbound link; omitted only if oEmbed gave no author_url.
      url: meta.authorUrl,
    },
  };
}

/**
 * PLACEHOLDER media source (design states E + G, AC4/AC5/AC6; C10). Used when resolution FAILED
 * and the curator chose "Add anyway" (E), or for an unsupported platform (G). Reads as unresolved:
 * an "Unresolved {Platform} clip" caption + a "Creator not resolved" name with NO outbound link and
 * NO handle — the credit analogue of "seed clip · no curator". The embed/watch/thumbnail come from
 * the real parse (AC7: the video still plays); only the auto-metadata is a labeled stand-in.
 */
export function placeholderMediaSource(
  parsed: ParsedVideo,
  platformLabel: string,
  topicQid: string,
  watchUrl: string
): ClipMediaSource {
  return {
    topicQid,
    platform: parsed.platform,
    platformLabel,
    orientation: "vertical",
    watchUrl,
    embedUrl: parsed.embedUrl,
    thumbnailUrl: parsed.thumbnailUrl,
    caption: `Unresolved ${platformLabel} clip`,
    creator: {
      name: "Creator not resolved",
      handle: "", // NO "pasted" placeholder handle (C10).
      platform: parsed.platform,
      // NO creator.url — never a fake/dead outbound link (C10).
    },
  };
}
