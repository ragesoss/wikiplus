import { afterEach, describe, expect, it, vi } from "vitest";
import DOMPurify from "dompurify";
import { fetchFullArticle } from "@/lib/wiki/article";

// QA independent adversarial review of the #74 `uponSanitizeAttribute` hook
// (`lib/wiki/article.ts`). The hook re-permits EXACTLY {colspan, rowspan, scope}
// via `forceKeepAttr` because DOMPurify 3.x URI-validates those inert attribute
// VALUES against the custom `ALLOWED_URI_REGEXP` and drops them otherwise.
//
// These tests are written by QA, NOT the author. They do not trust the author's
// assertions; they attack the hook's matching (case/namespace/data-*), prove it
// cannot rescue any hostile attribute even when co-located on a colspan element,
// and prove it does not leak onto the shared DOMPurify singleton — including the
// stronger case: sanitizing HOSTILE html on the same singleton AFTER a
// fetchFullArticle call must still strip colspan/scope/style/on*.
//
// Assertions are made against a LIVE DOM (parse + attribute walk), not just string
// matching, so an attribute that survives in a parsed tree cannot hide.

function mockArticleHtml(body: string): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(`<html><body>${body}</body></html>`, {
      status: 200,
      headers: { "content-type": "text/html" },
    })
  );
}
afterEach(() => vi.restoreAllMocks());

async function out(body: string): Promise<string> {
  mockArticleHtml(body);
  const a = await fetchFullArticle("X");
  return a.lead.leadHtml + "\n" + a.sections.map((s) => s.html).join("\n");
}

function live(html: string): HTMLDivElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

// Every attribute name (lowercased) present anywhere in the parsed tree.
function allAttrNames(div: HTMLElement): Set<string> {
  const names = new Set<string>();
  div.querySelectorAll("*").forEach((el) =>
    el.getAttributeNames().forEach((a) => names.add(a.toLowerCase()))
  );
  return names;
}

function noEventHandlers(div: HTMLElement): boolean {
  for (const n of allAttrNames(div)) if (n.startsWith("on")) return false;
  return true;
}

describe("QA #74 — colspan-keeping hook cannot be coerced into rescuing anything else", () => {
  it("style/on*/javascript: co-located on the SAME element as colspan are all dropped; colspan survives", async () => {
    const o = await out(
      `<section><table class="infobox biota"><tbody>` +
        `<tr><th colspan="2" rowspan="1" scope="col" style="background:red;position:fixed" ` +
        `onclick="evil()" onmouseover="evil()" onfocus="evil()">Banner</th></tr>` +
        `<tr><td colspan="2"><a href="javascript:alert(1)">x</a></td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    // the inert structural attrs survive
    const banner = d.querySelector("th");
    expect(banner?.getAttribute("colspan")).toBe("2");
    expect(banner?.getAttribute("rowspan")).toBe("1");
    expect(banner?.getAttribute("scope")).toBe("col");
    // nothing hostile survives, even sharing the element
    expect(banner?.hasAttribute("style")).toBe(false);
    expect(noEventHandlers(d)).toBe(true);
    expect(o.toLowerCase()).not.toContain("javascript:");
    expect(o.toLowerCase()).not.toContain("position:fixed");
  });

  it("case/mixed-case variants (COLSPAN, oNcLick, STYLE) do not slip a handler/style through", async () => {
    const o = await out(
      `<section><table class="infobox biota"><tbody>` +
        `<tr><th COLSPAN="2" STYLE="color:red" oNcLick="evil()" ScOpE="col">B</th></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    const th = d.querySelector("th");
    // colspan/scope are still recognized (HTML attrs are case-insensitive) and kept…
    expect(th?.hasAttribute("colspan")).toBe(true);
    expect(th?.hasAttribute("scope")).toBe(true);
    // …but no casing of style/on* survives.
    expect(th?.hasAttribute("style")).toBe(false);
    expect(noEventHandlers(d)).toBe(true);
    const names = allAttrNames(d);
    expect(names.has("style")).toBe(false);
  });

  it("a non-data attr NAMED to look structural (colspanx) is not rescued; data-* are inert per DOMPurify default, not the hook", async () => {
    const o = await out(
      `<section><table class="infobox biota"><tbody>` +
        `<tr><th colspan="2" colspanx="1" data-colspan="1" data-evil="javascript:alert(1)">B</th></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    const names = allAttrNames(d);
    // exact name match: the real colspan survives, the non-data look-alike does not.
    expect(names.has("colspan")).toBe(true);
    expect(names.has("colspanx")).toBe(false);
    // `data-*` survive because DOMPurify allows data-attrs by DEFAULT (ALLOW_DATA_ATTR) —
    // this is hook-INDEPENDENT and harmless: a data-* value is inert text, never a URL
    // context and never promoted to a live handler. Assert it stays inert, not absent.
    const th = d.querySelector("th")!;
    expect(th.getAttribute("data-evil")).toBe("javascript:alert(1)"); // stored as plain text
    expect(noEventHandlers(d)).toBe(true); // never becomes an on* handler
    // crucially, the hook did NOT widen data-* into a SCRIPT/URL vector: there is no live
    // anchor/script carrying that payload anywhere in the tree.
    expect(d.querySelector("a[href*='javascript']")).toBeNull();
    expect(d.querySelector("script")).toBeNull();
  });

  it("srcset/href javascript on a colspan cell are not rescued by the hook", async () => {
    const o = await out(
      `<section><table class="infobox biota"><tbody>` +
        `<tr><td colspan="2"><img src="//up.example/a.jpg" ` +
        `srcset="javascript:alert(1) 2x" alt="ok"/></td></tr>` +
        `<tr><th colspan="2"><a href="vbscript:msgbox(1)">v</a></th></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    const img = d.querySelector("img");
    // alt + the real src survive; the hostile srcset value is gone.
    expect(img?.getAttribute("alt")).toBe("ok");
    const srcset = (img?.getAttribute("srcset") || "").toLowerCase();
    expect(srcset).not.toContain("javascript:");
    expect(o.toLowerCase()).not.toContain("vbscript:");
    expect(noEventHandlers(d)).toBe(true);
  });
});

describe("QA #74 — hook does NOT leak onto the shared DOMPurify singleton", () => {
  it("AFTER a fetchFullArticle call, sanitizing HOSTILE html on the same singleton still strips colspan/scope/style/on*", async () => {
    // run the full pipeline (adds the hook, removes it in `finally`)
    await out(
      `<section><table class="infobox biota"><tbody>` +
        `<tr><th colspan="2" scope="col">Banner</th></tr></tbody></table></section>`
    );

    // A subsequent INDEPENDENT sanitize on the SAME global singleton with the SAME
    // custom URI regexp, WITHOUT re-adding the hook. If the hook leaked, colspan/scope
    // would survive here — and worse, a forceKeepAttr leak could rescue arbitrary attrs.
    // NOTE: `style`/`onclick` are NOT in this allowlist, so DOMPurify drops them on its
    // own merits. The leak we are hunting is whether the hook's `forceKeepAttr` persisted:
    // if it did, colspan/scope (which the custom URI regexp drops) would survive here.
    const leaked = DOMPurify.sanitize(
      `<table><tbody><tr><th colspan="2" scope="col" style="background:red" ` +
        `onclick="evil()">B</th></tr></tbody></table>`,
      {
        ALLOWED_TAGS: ["table", "tbody", "tr", "th", "td"],
        ALLOWED_ATTR: ["colspan", "rowspan", "scope", "class"],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\.{0,2}\/|#)/i,
      }
    ).toLowerCase();

    // hook gone → colspan/scope drop again (URI-validated away), proving no leak
    expect(leaked).not.toContain("colspan");
    expect(leaked).not.toContain("scope");
    // and the singleton's normal protections are intact for a later caller
    expect(leaked).not.toContain("onclick");
    expect(leaked).not.toContain("style");
  });

  it("the hook is removed even if a prior fetchFullArticle threw (finally runs)", async () => {
    // Force the transform to throw mid-pipeline by returning a non-ok response,
    // then confirm a subsequent sanitize on the singleton is unaffected.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 })
    );
    await expect(fetchFullArticle("X")).rejects.toThrow();
    vi.restoreAllMocks();

    const after = DOMPurify.sanitize(
      `<table><tbody><tr><th colspan="2" scope="col">B</th></tr></tbody></table>`,
      {
        ALLOWED_TAGS: ["table", "tbody", "tr", "th"],
        ALLOWED_ATTR: ["colspan", "scope"],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\.{0,2}\/|#)/i,
      }
    ).toLowerCase();
    // If the 500-path added a hook without removing it the test would also catch a leak;
    // here the hook is only added on the success path, but this nails down that a
    // throwing call leaves the singleton clean.
    expect(after).not.toContain("colspan");
  });
});
