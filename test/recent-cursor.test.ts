import { describe, expect, it } from "vitest";
import {
  decodeRecentCursor,
  encodeRecentCursor,
} from "@/lib/data/recent-cursor";

// The opaque recent-feed keyset cursor (issue #160 / §3.4). Round-trips `(createdAt, id)` and
// degrades safely (null, never a throw) on absent / malformed / wrong-shape input — so a forged or
// stale cursor from the client just starts the feed at the head rather than corrupting the read.

describe("recent-curations cursor (issue #160)", () => {
  it("round-trips a numeric-id cursor (the DrizzleDataStore shape)", () => {
    const c = { t: "2026-06-25T12:00:00.000Z", i: 42 };
    expect(decodeRecentCursor(encodeRecentCursor(c))).toEqual(c);
  });

  it("round-trips a string-id cursor (the localStorage reference shape)", () => {
    const c = { t: "2026-06-25T12:00:00.000Z", i: "c_ab12cd34" };
    expect(decodeRecentCursor(encodeRecentCursor(c))).toEqual(c);
  });

  it("decodes absent / empty input to null (start from the head)", () => {
    expect(decodeRecentCursor(null)).toBeNull();
    expect(decodeRecentCursor(undefined)).toBeNull();
    expect(decodeRecentCursor("")).toBeNull();
  });

  it("decodes garbage / wrong-shape to null without throwing", () => {
    expect(decodeRecentCursor("not-base64!!")).toBeNull();
    expect(
      decodeRecentCursor(Buffer.from("{}", "utf8").toString("base64url"))
    ).toBeNull();
    expect(
      decodeRecentCursor(
        Buffer.from(JSON.stringify({ t: 5, i: 1 }), "utf8").toString("base64url")
      )
    ).toBeNull();
  });
});
