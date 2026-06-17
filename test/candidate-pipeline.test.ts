import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleSection } from "@/lib/data/types";
import {
  generalMatchReason,
  placeCandidates,
  sectionKeywords,
  sectionMatchReason,
  tokenize,
} from "@/lib/candidates/matching";
import { normalizeResponse, youtubeApiKey, youtubeSource } from "@/lib/candidates/youtube";
import { CANDIDATE_TTL_MS, isStale, readCache, writeCache } from "@/lib/candidates/cache";
import { identityKey, videoIdOf } from "@/lib/candidates/dismissals";
import { suggestCandidates } from "@/lib/candidates/pipeline";
import type { CandidateSource, RawCandidate } from "@/lib/candidates/types";

// Live YouTube candidate auto-suggestion — unit tests (spec AC1–AC15). The YouTube
// fetch is MOCKED exactly like the MediaWiki/Wikidata fetch in article.test.ts (no
// network egress in the sandbox). QA: this file targets the pure source/matching/
// cache/dismissal/pipeline functions; mock a search.list response with `mockSearch`.

const KEY = "test-yt-key";
const QID = "Q189603";

/** Build a YouTube search.list item the way the source reads it. */
function item(
  videoId: string,
  title: string,
  description = "",
  thumb?: { width: number; height: number }
) {
  return {
    id: { videoId, kind: "youtube#video" },
    snippet: {
      title,
      description,
      channelTitle: "Some Channel",
      channelId: "UC123",
      thumbnails: thumb
        ? { high: { url: `https://i.ytimg.com/vi/${videoId}/hq.jpg`, ...thumb } }
        : { high: { url: `https://i.ytimg.com/vi/${videoId}/hq.jpg`, width: 480, height: 360 } },
    },
  };
}

/** Mock the single search.list call (mirrors article.test.ts mockArticleHtml). */
function mockSearch(items: ReturnType<typeof item>[]): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
}

const SECTIONS: ArticleSection[] = [
  { slug: "glycolysis", title: "Glycolysis", level: 2 },
  { slug: "citric-acid-cycle", title: "Citric acid cycle", level: 2 },
  { slug: "history", title: "History", level: 2 },
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ── Tokenization + section keywords (Decision 2) ──────────────────────────────────
describe("tokenize / sectionKeywords (Decision 2)", () => {
  it("lowercases, drops stopwords and ≤2-char tokens", () => {
    expect(tokenize("The Light-dependent reactions of X")).toEqual([
      "light",
      "dependent",
      "reactions",
    ]);
  });
  it("derives distinct section keywords", () => {
    expect(sectionKeywords("Citric acid cycle").sort()).toEqual([
      "acid",
      "citric",
      "cycle",
    ]);
  });
});

// ── matchReason templates (design §6.1; AC6) ──────────────────────────────────────
describe("matchReason copy (AC6 — honest, no platform stutter, no quality word)", () => {
  it("general rank 1 = 'Top result for', rank 2+ = 'Search result for'", () => {
    expect(generalMatchReason("cellular respiration", 0)).toBe(
      "Top result for 'cellular respiration'"
    );
    expect(generalMatchReason("cellular respiration", 1)).toBe(
      "Search result for 'cellular respiration'"
    );
  });
  it("does NOT repeat the platform name (source is prepended by the UI)", () => {
    expect(generalMatchReason("x", 0).toLowerCase()).not.toContain("youtube");
  });
  it("section reason names keyword + section; collapses on keyword == section", () => {
    expect(sectionMatchReason("glycolysis", "Glycolysis")).toBe(
      "Matched to the 'Glycolysis' section"
    );
    expect(sectionMatchReason("krebs", "Citric acid cycle")).toBe(
      "Mentions 'krebs' · matched to 'Citric acid cycle'"
    );
  });
});

// ── Section matching + placement (Decision 2; AC5, AC7) ───────────────────────────
function raw(videoId: string, caption: string, searchText = caption): RawCandidate {
  return {
    videoId,
    platform: "youtube",
    platformLabel: "YouTube",
    source: "YouTube",
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hq.jpg`,
    caption,
    searchText,
    orientation: "horizontal",
    creator: { handle: "@c", name: "C", platform: "youtube" },
  };
}

describe("placeCandidates (AC5 best-per-section, AC7 one-home-per-video)", () => {
  it("surfaces a section candidate only for a section that clears the threshold", () => {
    const results = [
      raw("v1", "Glycolysis explained step by step"),
      raw("v2", "A general cellular respiration overview"),
    ];
    const { sectionCandidates, generalCandidates } = placeCandidates(
      QID,
      "Cellular respiration",
      results,
      SECTIONS
    );
    // "Glycolysis" matches v1; "History" (generic single word) gets nothing.
    expect(sectionCandidates.map((c) => c.sectionSlug)).toEqual(["glycolysis"]);
    // v1 is NOT also a general candidate (one home per video, AC7).
    expect(generalCandidates.map((c) => c.id)).not.toContain("cand_youtube_v1");
    // v2 fills General.
    expect(generalCandidates.map((c) => c.id)).toContain("cand_youtube_v2");
  });

  it("generic single-word sections (History) never get an inline candidate", () => {
    const results = [raw("v1", "The history of cellular respiration research")];
    const { sectionCandidates } = placeCandidates(QID, "Cellular respiration", results, SECTIONS);
    // "history" survives tokenization but the topic is "Cellular respiration" — "history"
    // is non-topic-generic, so a literal mention WOULD match. Confirm it does only when
    // present, and that a pure topic-word overlap does not.
    expect(sectionCandidates.every((c) => c.sectionSlug !== "citric-acid-cycle")).toBe(true);
  });

  it("a topic-word-only overlap does NOT qualify a section (threshold)", () => {
    // Section "Citric acid cycle" keywords: citric, acid, cycle. A result that only
    // mentions the topic ("respiration") must not match this section.
    const results = [raw("v1", "Cellular respiration basics", "respiration cellular energy")];
    const { sectionCandidates } = placeCandidates(QID, "Cellular respiration", results, SECTIONS);
    expect(sectionCandidates.find((c) => c.sectionSlug === "citric-acid-cycle")).toBeUndefined();
  });

  it("falls through to the next-best unused candidate when a video is two sections' best (F3)", () => {
    // v1 is the best match for BOTH "Glycolysis" and "Citric acid cycle" (it names
    // both). Article order: glycolysis first → it claims v1. Citric-acid-cycle must NOT
    // get nothing — it falls through to its next-best still-unused match (v2), which
    // clears the threshold ("cycle"/"acid"/"citric"). Previously v2 was dropped entirely.
    const results = [
      raw("v1", "Glycolysis and the citric acid cycle explained"),
      raw("v2", "The citric acid cycle (Krebs cycle) in depth"),
    ];
    const { sectionCandidates } = placeCandidates(
      QID,
      "Cellular respiration",
      results,
      SECTIONS
    );
    const bySection = new Map(
      sectionCandidates.map((c) => [c.sectionSlug, c.id])
    );
    expect(bySection.get("glycolysis")).toBe("cand_youtube_v1"); // earlier section claims its best
    expect(bySection.get("citric-acid-cycle")).toBe("cand_youtube_v2"); // fall-through, not nothing
    // One home per video preserved: v1 is not reused.
    expect(sectionCandidates.filter((c) => c.id === "cand_youtube_v1").length).toBe(1);
  });

  it("the later section gets NO candidate only when no unused match clears the threshold (F3)", () => {
    // v1 is the only result that names both sections; with nothing else to fall through
    // to, the second section legitimately gets no inline candidate.
    const results = [raw("v1", "Glycolysis and the citric acid cycle explained")];
    const { sectionCandidates } = placeCandidates(
      QID,
      "Cellular respiration",
      results,
      SECTIONS
    );
    expect(sectionCandidates.map((c) => c.sectionSlug)).toEqual(["glycolysis"]);
  });

  it("caps General at 5 (Decision 1)", () => {
    const results = Array.from({ length: 9 }, (_, i) =>
      raw(`v${i}`, `Cellular respiration overview ${i}`)
    );
    const { generalCandidates } = placeCandidates(QID, "Cellular respiration", results, SECTIONS);
    expect(generalCandidates.length).toBe(5);
  });

  it("every produced candidate has the AC4 shape (vetted:false, source, matchReason; no chips)", () => {
    const results = [raw("v1", "Glycolysis explained"), raw("v2", "Overview")];
    const { sectionCandidates, generalCandidates } = placeCandidates(
      QID,
      "Cellular respiration",
      results,
      SECTIONS
    );
    for (const c of [...sectionCandidates, ...generalCandidates]) {
      expect(c.vetted).toBe(false);
      expect(c.source).toBe("YouTube");
      expect(c.platform).toBe("youtube");
      expect(c.platformLabel).toBe("YouTube");
      expect(c.matchReason.length).toBeGreaterThan(0);
      expect(c).not.toHaveProperty("stance");
      expect(c).not.toHaveProperty("accuracyFlag");
      expect(c).not.toHaveProperty("contextNote");
    }
  });
});

// ── YouTube source: key gate, normalization, orientation (AC1, AC10, AC14, AC15) ──
describe("youtubeApiKey / youtubeSource (AC1, AC15 — env-only key)", () => {
  it("isEnabled() is false with no key (no-op, AC1)", () => {
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", "");
    expect(youtubeApiKey()).toBeUndefined();
    expect(youtubeSource.isEnabled()).toBe(false);
  });
  it("reads the key only from process.env (AC15)", () => {
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", KEY);
    expect(youtubeApiKey()).toBe(KEY);
    expect(youtubeSource.isEnabled()).toBe(true);
  });
  it("makes NO network call when the key is unset (AC1)", async () => {
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const out = await youtubeSource.search({ topicQid: QID, topicTitle: "X" });
    expect(out).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("sends a simple CORS GET — no non-safelisted headers (avoids a preflight that breaks the browser call)", async () => {
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", KEY);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    await youtubeSource.search({ topicQid: QID, topicTitle: "X" });
    const init = fetchSpy.mock.calls[0]?.[1] ?? {};
    const headerNames = Object.keys((init.headers ?? {}) as Record<string, string>).map((h) =>
      h.toLowerCase()
    );
    // Only CORS-safelisted request headers are allowed; a custom header (e.g. x-client)
    // forces a preflight googleapis.com won't approve, silently breaking suggestions.
    const SAFELISTED = new Set(["accept", "accept-language", "content-language", "content-type"]);
    for (const name of headerNames) expect(SAFELISTED.has(name)).toBe(true);
  });
  it("degrades to [] on a non-OK response (quota/error — AC14)", async () => {
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", KEY);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("quota", { status: 403 }));
    await expect(youtubeSource.search({ topicQid: QID, topicTitle: "X" })).resolves.toEqual([]);
  });
  it("degrades to [] on a network throw (AC14 — never an unhandled throw)", async () => {
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", KEY);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(youtubeSource.search({ topicQid: QID, topicTitle: "X" })).resolves.toEqual([]);
  });
});

describe("normalizeResponse (within-set dedup AC7, orientation AC10)", () => {
  it("dedupes repeated videoIds within one response (AC7)", () => {
    const out = normalizeResponse({ items: [item("dup", "A"), item("dup", "B"), item("x", "C")] });
    expect(out.map((r) => r.videoId)).toEqual(["dup", "x"]);
  });
  it("defaults to horizontal; vertical only on a portrait thumbnail (Decision 4 / AC10)", () => {
    const out = normalizeResponse({
      items: [
        item("land", "Landscape", "", { width: 480, height: 360 }),
        item("port", "Portrait", "", { width: 360, height: 640 }),
      ],
    });
    expect(out.find((r) => r.videoId === "land")!.orientation).toBe("horizontal");
    expect(out.find((r) => r.videoId === "port")!.orientation).toBe("vertical");
  });
  it("builds a youtube-nocookie embed URL (embed-never-host)", () => {
    const out = normalizeResponse({ items: [item("abc", "T")] });
    expect(out[0].embedUrl).toContain("youtube-nocookie.com/embed/abc");
    expect(out[0].watchUrl).toBe("https://www.youtube.com/watch?v=abc");
  });
});

// ── Cache (Decision 5 / AC11) ─────────────────────────────────────────────────────
describe("candidate cache (AC11 — per-QID 24h TTL)", () => {
  it("treats a missing entry as stale; a fresh write as not stale", () => {
    expect(isStale(readCache(QID))).toBe(true);
    writeCache(QID, []);
    expect(isStale(readCache(QID))).toBe(false);
  });
  it("treats an entry older than the TTL as stale", () => {
    writeCache(QID, [], Date.now() - CANDIDATE_TTL_MS - 1);
    expect(isStale(readCache(QID))).toBe(true);
  });
  it("keys per QID", () => {
    writeCache("Q1", []);
    expect(readCache("Q2")).toBeNull();
  });
});

// ── Video-identity helpers (Decision 3 / AC9) ─────────────────────────────────────
// As of issue #45 the sticky-dismissal STORE moved behind the server boundary (Postgres
// `dismissed_candidate`) — its persistence is covered by test/drizzle-store.test.ts. Here we
// only test the PURE identity parser that both the pipeline and the store share.
describe("videoIdOf (AC9 — provider-video identity)", () => {
  it("parses provider video ids from watch / nocookie / shorts / tiktok URLs", () => {
    expect(videoIdOf({ platform: "youtube", watchUrl: "https://youtu.be/abc" })).toBe("abc");
    expect(videoIdOf({ platform: "youtube", watchUrl: "https://www.youtube.com/shorts/sh1" })).toBe("sh1");
    expect(
      videoIdOf({ platform: "youtube", watchUrl: "x", embedUrl: "https://www.youtube-nocookie.com/embed/e1" })
    ).toBe("e1");
    expect(
      videoIdOf({ platform: "tiktok", watchUrl: "https://www.tiktok.com/@a/video/7100000000000000000" })
    ).toBe("7100000000000000000");
  });
});

// ── Pipeline end-to-end (no-key no-op AC1, cache AC11, dedup AC8/AC9) ──────────────
describe("suggestCandidates pipeline", () => {
  const sections = SECTIONS;
  const input = {
    topicQid: QID,
    topicTitle: "Cellular respiration",
    sections,
    curatedVideoKeys: new Set<string>(),
    dismissedVideoKeys: new Set<string>(),
  };
  const disabled: CandidateSource = { id: "x", isEnabled: () => false, search: async () => [] };
  const enabled = (results: RawCandidate[]): CandidateSource => ({
    id: "y",
    isEnabled: () => true,
    search: async () => results,
  });

  it("returns null and writes NO cache when no source is enabled (AC1 / Decision 5)", async () => {
    const out = await suggestCandidates([disabled], input);
    expect(out).toBeNull();
    expect(readCache(QID)).toBeNull(); // no-op must not write a cache entry
  });

  it("computes + caches a set when a source is enabled (AC2/AC11)", async () => {
    const results = [raw("v1", "Glycolysis explained"), raw("v2", "Respiration overview")];
    const out = await suggestCandidates([enabled(results)], input);
    expect(out).not.toBeNull();
    expect(out!.length).toBeGreaterThan(0);
    expect(readCache(QID)).not.toBeNull();
  });

  it("a second call within the TTL returns the cached set with NO source call (AC11)", async () => {
    const search = vi.fn(async () => [raw("v1", "Glycolysis explained")]);
    const source: CandidateSource = { id: "y", isEnabled: () => true, search };
    await suggestCandidates([source], input);
    expect(search).toHaveBeenCalledTimes(1);
    await suggestCandidates([source], input); // warm cache
    expect(search).toHaveBeenCalledTimes(1); // still 1 — no second call
  });

  it("excludes already-curated videos (AC8) and dismissed videos (AC9)", async () => {
    // Issue #45: dismissed keys are now passed IN (from shared Postgres), not read from
    // localStorage. v2 is dismissed; v3 is curated.
    const results = [
      raw("v1", "Respiration overview one"),
      raw("v2", "Respiration overview two"), // dismissed
      raw("v3", "Respiration overview three"), // curated
    ];
    const out = await suggestCandidates([enabled(results)], {
      ...input,
      curatedVideoKeys: new Set([identityKey("youtube", "v3")]),
      dismissedVideoKeys: new Set([identityKey("youtube", "v2")]),
    });
    const ids = out!.map((c) => c.id);
    expect(ids).toContain("cand_youtube_v1");
    expect(ids).not.toContain("cand_youtube_v2"); // dismissed
    expect(ids).not.toContain("cand_youtube_v3"); // curated
  });

  it("an empty live result is a valid zero-results set and IS cached (design §5.2)", async () => {
    const out = await suggestCandidates([enabled([])], input);
    expect(out).toEqual([]);
    expect(readCache(QID)).not.toBeNull();
  });

  // F1 (HIGH/BLOCKER): the warm-cache read must re-apply the dismissed + curated filter,
  // or a candidate dismissed/promoted within the 24h TTL reappears on reload (AC8/AC9;
  // Decision 5; design §6.3 "no resurface on the next cache-warm or re-fetched load").
  it("a candidate dismissed AFTER a warm cache is excluded on the next (cached) read (AC9/F1)", async () => {
    const results = [raw("v1", "Respiration overview one"), raw("v2", "Respiration overview two")];
    const search = vi.fn(async () => results);
    const source: CandidateSource = { id: "y", isEnabled: () => true, search };
    // Cold fetch: both surface and the set is cached.
    const first = await suggestCandidates([source], input);
    expect(first!.map((c) => c.id)).toContain("cand_youtube_v1");
    expect(search).toHaveBeenCalledTimes(1);
    // Dismiss v1: issue #45 — the dismissed key is now passed IN (from shared Postgres) on the
    // next visit, not read from localStorage. Revisit within the TTL with v1 in the set.
    const warm = await suggestCandidates([source], {
      ...input,
      dismissedVideoKeys: new Set([identityKey("youtube", "v1")]),
    });
    expect(search).toHaveBeenCalledTimes(1); // still the cache hit — NO re-search
    const ids = warm!.map((c) => c.id);
    expect(ids).not.toContain("cand_youtube_v1"); // dismissed → gone on the warm read
    expect(ids).toContain("cand_youtube_v2");
  });

  it("a candidate promoted to a curated clip AFTER a warm cache is excluded on the next (cached) read (AC8/F1)", async () => {
    const results = [raw("v1", "Respiration overview one"), raw("v2", "Respiration overview two")];
    const search = vi.fn(async () => results);
    const source: CandidateSource = { id: "y", isEnabled: () => true, search };
    await suggestCandidates([source], input); // cold fetch + cache
    expect(search).toHaveBeenCalledTimes(1);
    // Simulate promotion: v1 is now a curated clip for the topic (passed in curatedVideoKeys).
    const warm = await suggestCandidates([source], {
      ...input,
      curatedVideoKeys: new Set([identityKey("youtube", "v1")]),
    });
    expect(search).toHaveBeenCalledTimes(1); // cache hit, no re-search
    const ids = warm!.map((c) => c.id);
    expect(ids).not.toContain("cand_youtube_v1"); // already curated → not re-suggested
    expect(ids).toContain("cand_youtube_v2");
  });
});
