import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFullArticle } from "@/lib/wiki/article";

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
function noLiveHandlers(div: HTMLElement) {
  let n = 0;
  div.querySelectorAll("*").forEach((el) =>
    el.getAttributeNames().forEach((a) => {
      if (a.startsWith("on")) n++;
    })
  );
  return n === 0;
}

describe("ADVERSARIAL XSS probe (QA independent, live-DOM asserted)", () => {
  it("svg <use href>/xlink:href smuggle is stripped", async () => {
    const o = await out(
      `<section><p>x</p><svg><use href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg=="/></svg>` +
        `<svg><use xlink:href="#evil"/></svg></section>`
    );
    const d = live(o);
    expect(d.querySelector("svg")).toBeNull();
    expect(d.querySelector("use")).toBeNull();
    expect(noLiveHandlers(d)).toBe(true);
  });

  it("foreignObject (svg to html mXSS) is stripped", async () => {
    const o = await out(
      `<section><svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg></section>`
    );
    const d = live(o);
    expect(d.querySelector("svg, foreignObject, foreignobject")).toBeNull();
    expect(noLiveHandlers(d)).toBe(true);
  });

  it("widened attrs (aria-label/role/data-mw-group) cannot break out into live markup", async () => {
    const o = await out(
      `<section><p role="region" aria-label="&quot;><img src=x onerror=alert(1)>" ` +
        `data-mw-group="x&quot; onmouseover=&quot;alert(1)">hi</p></section>`
    );
    const d = live(o);
    expect(d.querySelectorAll("img").length).toBe(0);
    expect(noLiveHandlers(d)).toBe(true);
  });

  it("title attribute does not become a live handler", async () => {
    const o = await out(`<section><a href="./X" title="onerror=alert(1)">y</a></section>`);
    const d = live(o);
    expect(noLiveHandlers(d)).toBe(true);
  });

  it("math href=javascript in HTML namespace stripped, no js URI", async () => {
    const o = await out(
      `<section><p>x</p><math href="javascript:alert(1)"><mtext>t</mtext></math></section>`
    );
    const d = live(o);
    expect(d.querySelector("math")).toBeNull();
    expect(o.toLowerCase()).not.toContain("javascript:");
  });

  it("malformed marker / noscript mXSS yields no live handler", async () => {
    const o = await out(
      `<section><sup class="mw-ref reference"><a href="./X#cite_note-1">` +
        `<noscript><p title="</noscript><img src=x onerror=alert(1)>">x</p></noscript>[1]</a></sup></section>`
    );
    const d = live(o);
    expect(noLiveHandlers(d)).toBe(true);
  });

  it("encoded/numeric-entity javascript and DATA:text/html on <a> are neutralized", async () => {
    const o = await out(
      `<section><a href="DATA:text/html,boom">u</a>` +
        `<a href="&#106;avascript:alert(1)">e</a></section>`
    );
    const d = live(o);
    for (const a of Array.from(d.querySelectorAll("a"))) {
      const href = (a.getAttribute("href") || "").toLowerCase().replace(/[\s-]/g, "");
      expect(href.startsWith("javascript:")).toBe(false);
      expect(href.startsWith("data:text/html")).toBe(false);
    }
  });

  it("style attr on an allowed table cell is dropped (no CSS injection)", async () => {
    const o = await out(
      `<section><table class="wikitable"><tr><td style="background:url(javascript:alert(1))">c</td></tr></table></section>`
    );
    const d = live(o);
    expect(d.querySelector("td")?.hasAttribute("style")).toBe(false);
  });

  it("citation external link carries rel=noopener (no reverse-tabnabbing regression)", async () => {
    const o = await out(
      `<section><h2>References</h2><ol class="mw-references"><li id="cite_note-1">` +
        `<span class="mw-reference-text"><a href="https://evil.example/x">pub</a></span></li></ol></section>`
    );
    const d = live(o);
    const a = d.querySelector("a[href^='https://evil']");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toContain("noopener");
  });

  it("data:image/svg on <img src> stays an inert <img> (no live handler promoted)", async () => {
    const o = await out(
      `<section><p><img src="data:image/svg+xml,<svg onload=alert(1)>"></p></section>`
    );
    const d = live(o);
    const img = d.querySelector("img");
    expect(img?.hasAttribute("onload")).toBe(false);
    expect(noLiveHandlers(d)).toBe(true);
  });
});
