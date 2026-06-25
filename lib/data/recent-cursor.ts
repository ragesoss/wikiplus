// The recent-curations feed cursor (issue #160 / design §3.4). An OPAQUE, STABLE keyset cursor
// over the clip's `(createdAt, id)` — the authoritative ordering key for "most recently curated"
// (the same persisted `created_at` `listClipsByContributor` / `listClips` order by; `Clip.curatedAt`
// is a DECORATIVE relative label, never the orderable field). `id` (the serial PK) is the
// tiebreaker so a same-timestamp batch (a single seed) still has a total, deterministic order.
//
// WHY A KEYSET CURSOR, NOT AN OFFSET (§3.4): a global chronological list grows at the head on every
// curation. An offset (`LIMIT n OFFSET k`) would re-include or skip rows as new clips arrive between
// a reader's page loads — dupes and gaps. A keyset cursor pins the boundary to a concrete
// `(createdAt, id)` value, so "the page strictly older than X" is stable no matter what lands at the
// head meanwhile. The feed appends pages and never reorders loaded items (§3.4).
//
// The cursor is OPAQUE to the client: it base64url-encodes `{ t, i }` (the last returned item's
// createdAt ISO string + its numeric id). The client only round-trips it back into the next
// `listRecentCurations({ cursor })` call; it never parses it. A malformed/forged cursor decodes to
// null and the read simply starts from the head (a robust, side-effect-free degrade — the feed is a
// public read with no auth or mutation to protect).

export interface RecentCursor {
  /** The boundary clip's `createdAt` as an ISO timestamp string. */
  t: string;
  /**
   * The boundary clip's id — the same-timestamp tiebreaker. A NUMBER for the production
   * DrizzleDataStore (the serial PK) or a STRING for the localStorage reference impl (its
   * `c_xxxx` id); both compare deterministically within their own store, and the cursor never
   * crosses stores, so the union is safe.
   */
  i: number | string;
}

/** base64url-encode a cursor → the opaque string handed to the client. */
export function encodeRecentCursor(cursor: RecentCursor): string {
  const json = JSON.stringify(cursor);
  // base64url (URL/JSON-safe, no padding) so the string survives serialization untouched.
  return Buffer.from(json, "utf8").toString("base64url");
}

/**
 * Decode an opaque cursor string back to `{ t, i }`, or `null` when it is absent, malformed, or
 * carries the wrong shape. A `null` decode means "start from the head" — a forged or stale cursor
 * never throws and never reaches the DB as a bad value.
 */
export function decodeRecentCursor(
  cursor: string | null | undefined
): RecentCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as unknown;
    const t = (parsed as RecentCursor)?.t;
    const i = (parsed as RecentCursor)?.i;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof t === "string" &&
      (typeof i === "string" ||
        (typeof i === "number" && Number.isFinite(i)))
    ) {
      return { t, i };
    }
    return null;
  } catch {
    return null;
  }
}
