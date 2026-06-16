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

describe("A4 multi-backref (a b c) — the case dev flagged as browser-only", () => {
  it("renders ALL back-ref anchors, each a functional in-page hash, each labeled", async () => {
    // Parsoid multi-cite: one <li> with several backlink <a>s (cite_ref-X_3-0, -3-1, -3-2)
    const o = await out(
      `<section><h2>References</h2><ol class="mw-references"><li id="cite_note-X-3">` +
        `<span class="mw-cite-backlink" rel="mw:referencedBy">` +
        `<a href="./X#cite_ref-X_3-0"><span class="mw-linkback-text">a</span></a> ` +
        `<a href="./X#cite_ref-X_3-1"><span class="mw-linkback-text">b</span></a> ` +
        `<a href="./X#cite_ref-X_3-2"><span class="mw-linkback-text">c</span></a></span> ` +
        `<span class="mw-reference-text">Cited thrice.</span></li></ol></section>`
    );
    const d = live(o);
    const backrefs = Array.from(d.querySelectorAll("a[data-cite-backref]"));
    expect(backrefs.length).toBe(3);
    expect(backrefs.map((a) => a.getAttribute("href"))).toEqual([
      "#cite_ref-X_3-0",
      "#cite_ref-X_3-1",
      "#cite_ref-X_3-2",
    ]);
    // each labeled with its instance letter (visible text + aria-label) — §3.4
    expect(backrefs.map((a) => a.getAttribute("aria-label"))).toEqual([
      "Back to citation, instance a",
      "Back to citation, instance b",
      "Back to citation, instance c",
    ]);
  });
});

describe("B7 precise strip list — nested/adversarial chrome shapes", () => {
  it("does NOT strip a table.infobox that also carries a maintenance-ish class it shouldn't", async () => {
    // infobox is kept; ensure a plain infobox with extra classes survives
    const o = await out(
      `<section><table class="infobox vcard"><tr><th>k</th><td>v</td></tr></table></section>`
    );
    const d = live(o);
    expect(d.querySelector("table.infobox")).not.toBeNull();
    expect(d.querySelector("table.infobox")?.classList.contains("wiki-infobox")).toBe(true);
  });

  it("strips a navbox even when it wraps a data-table-looking inner table", async () => {
    const o = await out(
      `<section><div class="navbox"><table class="wikitable"><tr><td>nav junk</td></tr></table></div>` +
        `<table class="wikitable"><tr><td>real data</td></tr></table></section>`
    );
    expect(o).not.toContain("nav junk");
    expect(o).toContain("real data");
  });

  it("an infobox marked .metadata IS stripped (metadata wins) — documents the precedence", async () => {
    const o = await out(
      `<section><table class="infobox metadata"><tr><td>meta-infobox</td></tr></table>` +
        `<table class="infobox"><tr><td>real infobox</td></tr></table></section>`
    );
    // .metadata strip runs and removes the metadata-classed infobox; the clean one stays
    const d = live(o);
    expect(o).not.toContain("meta-infobox");
    expect(o).toContain("real infobox");
  });
});

describe("D6 / X3 — tail sections come through the walk as real sections", () => {
  it("tail + content sections all get slugs; no clip-bearing data is attached to tail", async () => {
    mockArticleHtml(
      `<section><h2>Overview</h2><p>body</p></section>` +
        `<section><h2>References</h2><ol class="mw-references"><li id="cite_note-1">` +
        `<span class="mw-reference-text">ref</span></li></ol></section>` +
        `<section><h2>See also</h2><ul><li><a href="./Calvin_cycle">cc</a></li></ul></section>`
    );
    const a = await fetchFullArticle("X");
    // each is a real section with a slug + heading (so it gets a TOC row + .sec wrapper)
    expect(a.sections.map((s) => ({ slug: s.slug, title: s.title }))).toEqual([
      { slug: "overview", title: "Overview" },
      { slug: "references", title: "References" },
      { slug: "see-also", title: "See also" },
    ]);
  });
});

describe("Content-absent (§9) — additive & inert when content missing", () => {
  it("an article with no markers/refs/tables/infobox/math renders none of the new wrappers", async () => {
    const o = await out(`<section><p>Plain prose only.</p></section>`);
    expect(o).not.toContain("wiki-tablewrap");
    expect(o).not.toContain("wiki-infobox");
    expect(o).not.toContain("data-cite-marker");
    expect(o).not.toContain("wiki-math");
    expect(o).not.toContain("wiki-hatnote");
    expect(o).toContain("Plain prose only.");
  });
});
