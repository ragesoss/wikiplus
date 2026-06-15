import { describe, expect, it } from "vitest";
import {
  RESERVED_SEGMENTS,
  bareTitleSegment,
  barePathRedirectTarget,
  isReservedSegment,
} from "@/lib/routing/reserved";
import { topicHref } from "@/lib/wiki/topicRoute";

// Bare-path fallback — redirect `/<Title>` → `/topic/<Title>/` (issue #13).
// Spec: docs/specs/bare-path-redirect.md (AC1–AC11). These cover the pure pieces:
// the allowlist predicate (AC2/AC8), the redirect-target computation incl. #11
// encoding (AC6), query/hash preservation (AC3), single-segment-only (AC7), and the
// loop guard (AC4). BASE_PATH is empty in the test env (matches local dev).

describe("isReservedSegment — the allowlist predicate (AC2/AC8)", () => {
  it("reserves every enumerated top-level route segment", () => {
    for (const seg of RESERVED_SEGMENTS) {
      expect(isReservedSegment(seg)).toBe(true);
    }
  });

  it("reserves a `.`-extension (asset) segment", () => {
    expect(isReservedSegment("favicon.ico")).toBe(true);
    expect(isReservedSegment("404.html")).toBe(true);
    expect(isReservedSegment("main.js")).toBe(true);
    expect(isReservedSegment(".nojekyll")).toBe(true);
  });

  it("reserves a `:`-namespace segment", () => {
    expect(isReservedSegment("Help:Contents")).toBe(true);
    expect(isReservedSegment("Special:Random")).toBe(true);
    expect(isReservedSegment("File:Example.png")).toBe(true);
  });

  it("does NOT reserve a plain bare title segment", () => {
    expect(isReservedSegment("San_Francisco")).toBe(false);
    expect(isReservedSegment("Photosynthesis")).toBe(false);
  });
});

describe("AC8 — every current top-level route is reserved (future-proof guard)", () => {
  // If a future `app/<section>/` route is added without updating RESERVED_SEGMENTS,
  // this list drifts and the test fails — the loud failure the spec requires.
  const currentTopLevelRoutes = ["topic", "contribute"];
  for (const route of currentTopLevelRoutes) {
    it(`/${route} is classified reserved`, () => {
      expect(bareTitleSegment(`/${route}`)).toBeNull();
      expect(isReservedSegment(route)).toBe(true);
    });
  }
  it("the framework + predicate classes are reserved", () => {
    expect(bareTitleSegment("/_next")).toBeNull();
    expect(bareTitleSegment("/favicon.ico")).toBeNull();
    expect(bareTitleSegment("/Help:Contents")).toBeNull();
  });
  it("a representative plain bare segment is classified a bare title", () => {
    expect(bareTitleSegment("/San_Francisco")).toBe("San_Francisco");
  });
});

describe("bareTitleSegment — the normative rule (single unreserved segment)", () => {
  it("home `/` is not a bare title", () => {
    expect(bareTitleSegment("/")).toBeNull();
    expect(bareTitleSegment("")).toBeNull();
  });

  it("a single unreserved segment IS a bare title (trailing slash tolerated)", () => {
    expect(bareTitleSegment("/San_Francisco")).toBe("San_Francisco");
    expect(bareTitleSegment("/San_Francisco/")).toBe("San_Francisco");
  });

  it("AC7 — a multi-segment path is NOT a bare title", () => {
    expect(bareTitleSegment("/foo/bar")).toBeNull();
    expect(bareTitleSegment("/foo/bar/")).toBeNull();
  });

  it("AC4 loop guard — a `/topic/...` path is never a bare title", () => {
    expect(bareTitleSegment("/topic")).toBeNull();
    expect(bareTitleSegment("/topic/")).toBeNull();
    expect(bareTitleSegment("/topic/San_Francisco/")).toBeNull();
    expect(bareTitleSegment("/topic/San_Francisco")).toBeNull();
  });
});

describe("barePathRedirectTarget — redirect-target computation", () => {
  it("AC6 — uses #11 encoding: `/Multi Word` and `/Multi_Word` both → /topic/Multi_Word/", () => {
    expect(barePathRedirectTarget("/Multi_Word")).toBe("/topic/Multi_Word/");
    expect(barePathRedirectTarget("/Multi Word")).toBe("/topic/Multi_Word/");
    // Agrees with the #11 canonical href for the resolved space-form title.
    expect(barePathRedirectTarget("/Multi_Word")).toBe(topicHref("Multi Word"));
  });

  it("AC1 — a plain bare title redirects to its canonical /topic/<Title>/", () => {
    expect(barePathRedirectTarget("/San_Francisco")).toBe(
      "/topic/San_Francisco/"
    );
    expect(barePathRedirectTarget("/Photosynthesis")).toBe(
      "/topic/Photosynthesis/"
    );
  });

  it("AC6 — a reserved-character title round-trips through the #11 encoding (no path break)", () => {
    // `/AT&T` arrives as a decoded segment in location.pathname; it re-encodes safely.
    expect(barePathRedirectTarget("/AT&T")).toBe("/topic/AT%26T/");
  });

  it("AC3 — preserves query string AND hash, in that order", () => {
    expect(
      barePathRedirectTarget("/San_Francisco", "?foo=bar", "#sec-history")
    ).toBe("/topic/San_Francisco/?foo=bar#sec-history");
  });

  it("AC3 — hash only / query only are each preserved", () => {
    expect(barePathRedirectTarget("/San_Francisco", "", "#sec-history")).toBe(
      "/topic/San_Francisco/#sec-history"
    );
    expect(barePathRedirectTarget("/San_Francisco", "?foo=bar", "")).toBe(
      "/topic/San_Francisco/?foo=bar"
    );
  });

  it("AC3 — accepts query/hash with or without leading punctuation", () => {
    expect(barePathRedirectTarget("/San_Francisco", "foo=bar", "x")).toBe(
      "/topic/San_Francisco/?foo=bar#x"
    );
  });

  it("AC2 — returns null (no redirect) for every reserved path", () => {
    for (const p of [
      "/",
      "/contribute",
      "/contribute/",
      "/topic",
      "/topic/",
      "/topic/Cellular_respiration/",
      "/_next/static/chunk.js",
      "/favicon.ico",
      "/.nojekyll",
      "/404.html",
      "/Help:Contents",
      "/Special:Random",
    ]) {
      expect(barePathRedirectTarget(p)).toBeNull();
    }
  });

  it("AC7 — returns null for a multi-segment path", () => {
    expect(barePathRedirectTarget("/foo/bar")).toBeNull();
  });

  it("AC4 — the loop guard holds: the destination is itself a no-op", () => {
    const target = barePathRedirectTarget("/San_Francisco");
    expect(target).toBe("/topic/San_Francisco/");
    // Re-applying the rule to the destination yields null → no second hop, no loop.
    expect(barePathRedirectTarget(target!)).toBeNull();
    // Even with the preserved query+hash carried onto the destination.
    const withQH = barePathRedirectTarget(
      "/San_Francisco",
      "?foo=bar",
      "#sec-history"
    )!;
    expect(barePathRedirectTarget(withQH)).toBeNull();
  });
});
