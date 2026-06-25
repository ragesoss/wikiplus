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

  // DEF-1: VALUE validation. A non-date `t` and a non-finite/non-integer NUMBER `i` decode to null
  // (they could never be a real cursor and would otherwise reach the keyset as a bad value — an
  // Invalid Date or a non-integer). A STRING `i` stays VALID (the localStorage reference's `c_xxxx`
  // id is a legitimate keyset key in that store); the Drizzle keyset guards the `Number(i)`→NaN
  // coercion at the QUERY (it drops the id tiebreak), so decode need not reject a string `i`.
  it("rejects a non-date `t` and a non-integer numeric `i` (decodes to null)", () => {
    const enc = (c: { t: unknown; i: unknown }) =>
      Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
    expect(decodeRecentCursor(enc({ t: "garbage-not-a-date", i: 1 }))).toBeNull();
    expect(
      decodeRecentCursor(enc({ t: "2026-06-25T12:00:00.000Z", i: 3.14 }))
    ).toBeNull();
    expect(
      decodeRecentCursor(enc({ t: "2026-06-25T12:00:00.000Z", i: Number.NaN }))
    ).toBeNull();
    // DEF-1b: a numeric `i` beyond Postgres int4 range could never be a real serial id and would
    // overflow the int4 column at bind time → decode to null (degrade to a head read).
    expect(
      decodeRecentCursor(enc({ t: "2026-06-25T12:00:00.000Z", i: 9_999_999_999_999 }))
    ).toBeNull();
    // The int4 boundary itself is still a valid id.
    expect(
      decodeRecentCursor(enc({ t: "2026-06-25T12:00:00.000Z", i: 2147483647 }))
    ).toEqual({ t: "2026-06-25T12:00:00.000Z", i: 2147483647 });
  });

  it("accepts a string `i` (the reference store's `c_xxxx` keyset id round-trips)", () => {
    const c = { t: "2026-06-25T12:00:00.000Z", i: "c_forged" };
    expect(decodeRecentCursor(encodeRecentCursor(c))).toEqual(c);
  });
});
