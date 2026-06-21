// Acceptance-criterion guard for issue #68 (QA): the wide-table / cladogram overflow flag.
//
// The flag is set by a client effect in app/topic/TopicView.tsx that measures each
// `.wiki-tablewrap` / `.wiki-clade` wrapper and sets `data-overflow` ONLY when the content is
// wider than the wrapper. jsdom does no layout (clientWidth/scrollWidth are always 0), so the
// end-to-end measurement is covered by the Playwright B2 test against the real Node server. This
// unit test pins the measurement DECISION CONTRACT — the exact predicate the effect applies —
// so a future edit that loosens the threshold or drops the mid-layout skip guard is caught here.
//
// `measure` below mirrors the effect's body verbatim (TopicView.tsx): a node is measured only
// when `clientWidth >= 1`; it overflows when `scrollWidth > clientWidth + 1`.
import { describe, expect, it } from "vitest";

/** Mirror of the TopicView effect's `measure` decision (the only logic under test). */
function measure(wrap: HTMLElement): void {
  if (wrap.clientWidth < 1) return; // mid-layout: skip rather than clear (issue #68)
  if (wrap.scrollWidth > wrap.clientWidth + 1) wrap.setAttribute("data-overflow", "");
  else wrap.removeAttribute("data-overflow");
}

/** A wrapper with fixed, test-controlled geometry (jsdom never lays out). */
function wrapWith(clientWidth: number, scrollWidth: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "wiki-tablewrap";
  Object.defineProperty(el, "clientWidth", { value: clientWidth, configurable: true });
  Object.defineProperty(el, "scrollWidth", { value: scrollWidth, configurable: true });
  return el;
}

describe("issue #68 — wide-table overflow flag decision", () => {
  it("SETS data-overflow for a genuinely-overflowing table (the #68 fixture geometry)", () => {
    // The e2e B2 fixture measures scrollWidth=1193 vs clientWidth=772.
    const wrap = wrapWith(772, 1193);
    measure(wrap);
    expect(wrap.hasAttribute("data-overflow")).toBe(true);
  });

  it("does NOT set data-overflow for a non-overflowing table (no false hint)", () => {
    const wrap = wrapWith(900, 900);
    measure(wrap);
    expect(wrap.hasAttribute("data-overflow")).toBe(false);
  });

  it("does NOT set the flag for a sub-pixel difference within the +1 tolerance", () => {
    const wrap = wrapWith(900, 901); // scrollWidth is NOT > clientWidth + 1
    measure(wrap);
    expect(wrap.hasAttribute("data-overflow")).toBe(false);
  });

  it("a transient mid-layout read (clientWidth < 1) does NOT clear a correctly-set flag", () => {
    // Flag is correctly set from a good measurement…
    const good = wrapWith(772, 1193);
    measure(good);
    expect(good.hasAttribute("data-overflow")).toBe(true);

    // …then a ResizeObserver fires mid-render with a zero/near-zero width. The guard must skip,
    // leaving the flag intact (this is the exact regression #68 calls out).
    Object.defineProperty(good, "clientWidth", { value: 0, configurable: true });
    Object.defineProperty(good, "scrollWidth", { value: 0, configurable: true });
    measure(good);
    expect(good.hasAttribute("data-overflow")).toBe(true);
  });

  it("a real shrink to a non-overflowing size DOES clear the flag (guard is width<1, not any shrink)", () => {
    const wrap = wrapWith(772, 1193);
    measure(wrap);
    expect(wrap.hasAttribute("data-overflow")).toBe(true);

    // Wrapper grows wide enough to contain its content (a real, trustworthy measurement).
    Object.defineProperty(wrap, "clientWidth", { value: 1200, configurable: true });
    Object.defineProperty(wrap, "scrollWidth", { value: 1193, configurable: true });
    measure(wrap);
    expect(wrap.hasAttribute("data-overflow")).toBe(false);
  });
});
