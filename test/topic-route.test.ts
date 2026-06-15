import { describe, expect, it } from "vitest";
import {
  slugToTitle,
  titleFromPathname,
  titleToSlug,
  topicHref,
} from "@/lib/wiki/topicRoute";
import { SEEDED_TITLES, staticTopicParams } from "@/lib/data/seed";
import { pluralize } from "@/lib/format";

// Canonical title-based Topic routing (owner directive D1; AC5/AC23) + the N3 count fix.
// #11 added the space↔underscore encoding (Wikipedia parity): spaces serialize to `_`
// (not `%20`) in the URL, while every other character keeps standard
// `encodeURIComponent`/`decodeURIComponent` behavior. BASE_PATH is empty in the test
// env (no NEXT_PUBLIC_BASE_PATH), matching local dev.

describe("topicHref — canonical title route", () => {
  it("builds an underscore-encoded, trailing-slashed /topic/<Title>/ href (no QID)", () => {
    expect(topicHref("Photosynthesis")).toBe("/topic/Photosynthesis/");
    // #11 AC1: spaces → underscores, not %20.
    expect(topicHref("Calvin cycle")).toBe("/topic/Calvin_cycle/");
    expect(topicHref("Photosynthesis")).not.toMatch(/qid|Q\d/);
  });

  it("omits the basePath for <Link>/router (Next adds it) but can prefix it for raw hrefs", () => {
    // withBase uses BASE_PATH, which is "" here → same as the default.
    expect(topicHref("X", { withBase: true })).toBe("/topic/X/");
  });

  // ── #11 acceptance criteria ─────────────────────────────────────────────────

  describe("#11 AC1 — multi-word title → underscore href", () => {
    it("turns spaces into underscores, no %20, no literal space", () => {
      const href = topicHref("San Francisco");
      expect(href).toBe("/topic/San_Francisco/");
      expect(href).not.toContain("%20");
      expect(href).not.toMatch(/ /);
    });
    it("applies the same encoding under { withBase: true }", () => {
      expect(topicHref("San Francisco", { withBase: true })).toBe(
        "/topic/San_Francisco/"
      );
    });
  });

  describe("#11 AC3 — multi-word round-trip", () => {
    for (const title of [
      "San Francisco",
      "Cellular respiration",
      "The Lord of the Rings",
    ]) {
      it(`parse(build(${JSON.stringify(title)})) === title`, () => {
        expect(titleFromPathname(topicHref(title))).toBe(title);
      });
    }
    it("'/topic/San_Francisco/' parses to 'San Francisco' and rebuilds", () => {
      expect(titleFromPathname("/topic/San_Francisco/")).toBe("San Francisco");
      expect(topicHref("San Francisco")).toBe("/topic/San_Francisco/");
    });
  });

  describe("#11 AC5 — static slug and runtime href agree", () => {
    const params = staticTopicParams();
    SEEDED_TITLES.forEach((title, i) => {
      it(`seeded title ${JSON.stringify(title)} agrees byte-for-byte`, () => {
        expect(`/topic/${params[i].slug[0]}/`).toBe(topicHref(title));
      });
    });
  });

  describe("#11 AC6 — reserved URL characters stay percent-encoded", () => {
    it("encodes &, +, /, ?, # (no raw reserved chars)", () => {
      expect(topicHref("AT&T")).toBe("/topic/AT%26T/");
      expect(topicHref("C++")).toBe("/topic/C%2B%2B/");
      expect(topicHref("OS/2")).toBe("/topic/OS%2F2/");
      expect(topicHref("Who?")).toBe("/topic/Who%3F/");
      expect(topicHref("C#")).toBe("/topic/C%23/");
      expect(topicHref("AT&T")).not.toContain("&");
    });
    for (const title of ["AT&T", "C++", "OS/2", "Who?", "C#", "Rock & Roll"]) {
      it(`round-trips ${JSON.stringify(title)}`, () => {
        expect(titleFromPathname(topicHref(title))).toBe(title);
      });
    }
  });

  describe("#11 AC7 — underscores are not over-escaped", () => {
    it("'San Francisco' segment is literal San_Francisco, not %5F", () => {
      const href = topicHref("San Francisco");
      expect(href).toContain("San_Francisco");
      expect(href).not.toContain("%5F");
    });
    it("a literal underscore in a title also maps to _ (accepted Wikipedia-parity collision)", () => {
      expect(topicHref("San_Francisco")).toBe("/topic/San_Francisco/");
      expect(titleFromPathname("/topic/San_Francisco/")).toBe("San Francisco");
    });
  });

  describe("#11 AC10 — single-word titles are unaffected", () => {
    it("builds and round-trips unchanged", () => {
      expect(topicHref("Photosynthesis")).toBe("/topic/Photosynthesis/");
      expect(titleFromPathname("/topic/Photosynthesis/")).toBe("Photosynthesis");
    });
  });

  it("titleToSlug / slugToTitle round-trip directly", () => {
    for (const t of ["San Francisco", "AT&T", "Photosynthesis", "C++"]) {
      expect(slugToTitle(titleToSlug(t))).toBe(t);
    }
  });
});

describe("titleFromPathname — SPA fallback path parsing", () => {
  it("extracts and decodes the title from a /topic/<Title>/ path", () => {
    expect(titleFromPathname("/topic/Photosynthesis/")).toBe("Photosynthesis");
    expect(titleFromPathname("/topic/Photosynthesis")).toBe("Photosynthesis");
    // Underscore form (canonical going forward).
    expect(titleFromPathname("/topic/Calvin_cycle/")).toBe("Calvin cycle");
  });

  describe("#11 AC9 — legacy %20 URLs still resolve to the same space-title", () => {
    it("'%20' and '_' forms both decode to the space-form title", () => {
      expect(titleFromPathname("/topic/San%20Francisco/")).toBe("San Francisco");
      expect(titleFromPathname("/topic/San_Francisco/")).toBe("San Francisco");
      expect(titleFromPathname("/topic/San%20Francisco/")).toBe(
        titleFromPathname("/topic/San_Francisco/")
      );
    });
    it("the legacy Calvin%20cycle entry still works", () => {
      expect(titleFromPathname("/topic/Calvin%20cycle/")).toBe("Calvin cycle");
    });
  });

  it("returns null for the bare /topic shell and non-topic paths (#11 AC11)", () => {
    // bare /topic (the ?qid= back-compat shell) is NOT a title path
    expect(titleFromPathname("/topic")).toBeNull();
    expect(titleFromPathname("/topic/")).toBeNull();
    expect(titleFromPathname("/")).toBeNull();
    expect(titleFromPathname("/contribute/")).toBeNull();
  });
});

describe("pluralize (N3 — grammatical counts)", () => {
  it("is singular at 1 and plural otherwise", () => {
    expect(pluralize(1, "video")).toBe("1 video");
    expect(pluralize(0, "video")).toBe("0 videos");
    expect(pluralize(3, "candidate")).toBe("3 candidates");
    expect(pluralize(1, "auto-suggestion")).toBe("1 auto-suggestion");
  });
});
