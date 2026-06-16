import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolvePage,
  stripDisplayTitle,
  titleToQid,
} from "@/lib/wiki/article";

// Issue #23 — canonicalize the Topic URL + heading to Wikipedia's canonical form.
// This file covers the RESOLUTION SEAM (resolvePage / stripDisplayTitle) and the
// titleToQid delegation. The end-to-end TopicView behavior (the router.replace
// canonicalization across AC1–AC6) lives in canonical-topic-url.view.test.tsx,
// which needs the next/navigation + article-module mocks. The live MediaWiki fetch
// is MOCKED here (no network egress in the sandbox; docs/ARCHITECTURE.md → Testing).

/**
 * Mock the single action-API query response. A real EXISTING page comes back with a
 * `pageid` + canonical `title`; `redirects=1` means the returned `title` is the
 * redirect/alias TARGET (so an input of `jfk` yields `title: "John F. Kennedy"`).
 */
function mockQuery(page: Record<string, unknown>): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ query: { pages: { "1": page } } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
}

afterEach(() => vi.restoreAllMocks());

describe("stripDisplayTitle (plain-text heading source — AC4 / out-of-scope HTML)", () => {
  it("returns a plain string unchanged (the common no-markup case)", () => {
    expect(stripDisplayTitle("Calvin cycle")).toBe("Calvin cycle");
    // The bell hooks lowercasing is itself plain text — preserved verbatim (AC4).
    expect(stripDisplayTitle("bell hooks")).toBe("bell hooks");
  });

  it("strips HTML markup to plain text (italics / subscripts deferred — out of scope)", () => {
    expect(stripDisplayTitle("<i>Panthera leo</i>")).toBe("Panthera leo");
    expect(stripDisplayTitle('H<sub>2</sub>O')).toBe("H2O");
    expect(stripDisplayTitle('<span class="x">E. coli</span>')).toBe("E. coli");
  });

  it("decodes entities and falls back to null for empty/missing input", () => {
    expect(stripDisplayTitle("AT&amp;T")).toBe("AT&T");
    expect(stripDisplayTitle(null)).toBeNull();
    expect(stripDisplayTitle(undefined)).toBeNull();
    expect(stripDisplayTitle("")).toBeNull();
  });
});

describe("resolvePage — canonical + display + QID in one call (#23 scope item 1)", () => {
  it("AC1: case normalization — calvin_cycle resolves to canonical 'Calvin cycle'", async () => {
    // The reader typed `calvin_cycle`; the API returns the canonical capitalized title.
    mockQuery({
      pageid: 12345,
      title: "Calvin cycle",
      displaytitle: "Calvin cycle",
      pageprops: { wikibase_item: "Q189445" },
    });
    const r = await resolvePage("calvin cycle");
    expect(r.canonicalTitle).toBe("Calvin cycle");
    expect(r.displayTitle).toBe("Calvin cycle");
    expect(r.qid).toBe("Q189445");
  });

  it("AC3: follows a redirect/alias — jfk resolves to 'John F. Kennedy'", async () => {
    // redirects=1: the returned page is the TARGET of the JFK redirect.
    mockQuery({
      pageid: 5119376,
      title: "John F. Kennedy",
      displaytitle: "John F. Kennedy",
      pageprops: { wikibase_item: "Q9696" },
    });
    const r = await resolvePage("jfk");
    expect(r.canonicalTitle).toBe("John F. Kennedy");
    expect(r.displayTitle).toBe("John F. Kennedy");
    expect(r.qid).toBe("Q9696");
  });

  it("AC4: the bell hooks split — canonical 'Bell hooks', display 'bell hooks'", async () => {
    // MediaWiki capitalizes the first letter of every title (canonical `Bell hooks`),
    // but the rendered displaytitle carries the author's lowercase stylization.
    mockQuery({
      pageid: 234567,
      title: "Bell hooks",
      displaytitle: "bell hooks",
      pageprops: { wikibase_item: "Q259507" },
    });
    const r = await resolvePage("bell hooks");
    expect(r.canonicalTitle).toBe("Bell hooks"); // keys URL/slug
    expect(r.displayTitle).toBe("bell hooks"); // keys heading
    expect(r.canonicalTitle).not.toBe(r.displayTitle); // they legitimately differ
  });

  it("falls displayTitle back to the canonical title when none is rendered", async () => {
    mockQuery({
      pageid: 1,
      title: "Photosynthesis",
      pageprops: { wikibase_item: "Q11982" },
    });
    const r = await resolvePage("photosynthesis");
    expect(r.canonicalTitle).toBe("Photosynthesis");
    expect(r.displayTitle).toBe("Photosynthesis");
  });

  it("AC6: a MISSING page resolves to all-null (no canonicalization upstream)", async () => {
    // A nonexistent title comes back `{ missing: "", title: … }` with no pageid.
    mockQuery({ missing: "", title: "Glorpwobble nonexistent thing" });
    const r = await resolvePage("Glorpwobble nonexistent thing");
    expect(r).toEqual({ canonicalTitle: null, displayTitle: null, qid: null });
  });

  it("AC6: a non-OK response resolves to all-null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 })
    );
    const r = await resolvePage("X");
    expect(r).toEqual({ canonicalTitle: null, displayTitle: null, qid: null });
  });

  it("strips HTML in displaytitle to plain text (formula heading — out of scope)", async () => {
    mockQuery({
      pageid: 9,
      title: "Water",
      displaytitle: "H<sub>2</sub>O",
      pageprops: { wikibase_item: "Q283" },
    });
    const r = await resolvePage("water");
    expect(r.displayTitle).toBe("H2O");
  });
});

describe("titleToQid delegates to resolvePage (kept working for QID-only callers)", () => {
  it("returns the QID for a resolved page", async () => {
    mockQuery({
      pageid: 1,
      title: "Photosynthesis",
      pageprops: { wikibase_item: "Q11982" },
    });
    expect(await titleToQid("Photosynthesis")).toBe("Q11982");
  });

  it("returns null for a missing page", async () => {
    mockQuery({ missing: "", title: "Nope" });
    expect(await titleToQid("Nope")).toBeNull();
  });
});
