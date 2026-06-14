import { describe, expect, it } from "vitest";
import { titleFromPathname, topicHref } from "@/lib/wiki/topicRoute";
import { pluralize } from "@/lib/format";

// Canonical title-based Topic routing (owner directive D1; AC5/AC23) + the N3 count fix.
// BASE_PATH is empty in the test env (no NEXT_PUBLIC_BASE_PATH), matching local dev.

describe("topicHref — canonical title route", () => {
  it("builds an encoded, trailing-slashed /topic/<Title>/ href (no QID)", () => {
    expect(topicHref("Photosynthesis")).toBe("/topic/Photosynthesis/");
    expect(topicHref("Calvin cycle")).toBe("/topic/Calvin%20cycle/");
    expect(topicHref("Photosynthesis")).not.toMatch(/qid|Q\d/);
  });

  it("omits the basePath for <Link>/router (Next adds it) but can prefix it for raw hrefs", () => {
    // withBase uses BASE_PATH, which is "" here → same as the default.
    expect(topicHref("X", { withBase: true })).toBe("/topic/X/");
  });
});

describe("titleFromPathname — SPA fallback path parsing", () => {
  it("extracts and decodes the title from a /topic/<Title>/ path", () => {
    expect(titleFromPathname("/topic/Photosynthesis/")).toBe("Photosynthesis");
    expect(titleFromPathname("/topic/Photosynthesis")).toBe("Photosynthesis");
    expect(titleFromPathname("/topic/Calvin%20cycle/")).toBe("Calvin cycle");
  });

  it("returns null for the bare /topic shell and non-topic paths", () => {
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
