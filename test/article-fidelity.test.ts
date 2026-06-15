import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFullArticle } from "@/lib/wiki/article";

// Article-fidelity build (#24–#27): the transform behavior for the four restored
// content categories, plus the cross-cutting sanitize-still-blocks-XSS guarantee.
// The live MediaWiki fetch is MOCKED; fixtures mirror the LIVE Parsoid markup
// inspected for Photosynthesis / Cellular_respiration / Lion / Pythagorean_theorem.
//
// QA extends these per AC (A1–A7, B1–B8, C1–C4, D1–D7, X1–X5); this is the first cut.

function mockArticleHtml(body: string): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(`<html><body>${body}</body></html>`, {
      status: 200,
      headers: { "content-type": "text/html" },
    })
  );
}
afterEach(() => vi.restoreAllMocks());

async function fullHtml(body: string): Promise<string> {
  mockArticleHtml(body);
  const a = await fetchFullArticle("X");
  return a.lead.leadHtml + "\n" + a.sections.map((s) => s.html).join("\n");
}

// Realistic Parsoid fragments (trimmed from live output) ───────────────────────
const MARKER = (n: string, note = `cite_note-${n}`, ref = `cite_ref-${n}`) =>
  `<sup class="mw-ref reference" id="${ref}"><a href="./X#${note}">` +
  `<span class="mw-reflink-text"><span class="cite-bracket">[</span>${n}` +
  `<span class="cite-bracket">]</span></span></a></sup>`;

const REFLIST_LI = (n: string) =>
  `<li id="cite_note-${n}" data-mw-footnote-number="${n}">` +
  `<span class="mw-cite-backlink"><a href="./X#cite_ref-${n}" rel="mw:referencedBy">` +
  `<span class="mw-linkback-text">↑</span></a></span> ` +
  `<span class="mw-reference-text reference-text">Smith, J. (2020). ` +
  `<a rel="mw:WikiLink" href="./Calvin_cycle">Calvin cycle</a>. ` +
  `<a href="https://doi.org/10.1/x">doi:10.1/x</a>.</span></li>`;

// ───────────────────────── GROUP A — citations ─────────────────────────
describe("A — citations & references (#24)", () => {
  it("A1 keeps inline sup.reference markers (no longer stripped)", async () => {
    const out = await fullHtml(`<section><p>Carbon is fixed${MARKER("12")}.</p></section>`);
    expect(out).toContain('class="mw-ref reference"');
    expect(out).toContain("[</span>12<span"); // literal bracketed number survives
  });

  it("A1/A7 tags the marker as a focusable control with a text aria-label", async () => {
    const out = await fullHtml(`<section><p>x${MARKER("12")}</p></section>`);
    expect(out).toContain("data-cite-marker");
    expect(out).toMatch(/aria-label="Citation 12"/);
  });

  it("A4/A6 normalizes marker + back-ref anchors to functional in-page #cite_* hashes", async () => {
    const out = await fullHtml(
      `<section><p>x${MARKER("3")}</p></section>` +
        `<section><h2>References</h2><ol class="mw-references references">${REFLIST_LI(
          "3"
        )}</ol></section>`
    );
    // marker anchor → pure in-page hash (the path ./X is dropped); NOT a /topic/ route
    expect(out).toContain('href="#cite_note-3"');
    expect(out).not.toContain("/topic/X");
    // back-ref → in-page hash to the marker, kept functional + labeled
    expect(out).toContain('href="#cite_ref-3"');
    expect(out).toContain("data-cite-backref");
    expect(out).toMatch(/aria-label="Back to citation"/);
  });

  it("A3 keeps the References section + its numbered <ol> through the section walk", async () => {
    mockArticleHtml(
      `<section><h2>Overview</h2><p>x${MARKER("1")}</p></section>` +
        `<section><h2>References</h2><ol class="mw-references references">${REFLIST_LI(
          "1"
        )}</ol></section>`
    );
    const a = await fetchFullArticle("X");
    expect(a.sections.map((s) => s.title)).toContain("References");
    const refSec = a.sections.find((s) => s.title === "References")!;
    expect(refSec.html).toContain('id="cite_note-1"');
    expect(refSec.html).toContain("Smith, J. (2020)");
  });

  it("A5 routes external citation links (DOI) out in a new tab", async () => {
    const out = await fullHtml(
      `<section><h2>References</h2><ol class="mw-references">${REFLIST_LI("1")}</ol></section>`
    );
    expect(out).toMatch(/href="https:\/\/doi\.org\/10\.1\/x"[^>]*target="_blank"/);
    expect(out).toContain('rel="noopener"');
  });

  it("A6 routes internal /wiki/ links inside citations to /topic/ (rewriteLinks)", async () => {
    const out = await fullHtml(
      `<section><h2>References</h2><ol class="mw-references">${REFLIST_LI("1")}</ol></section>`
    );
    expect(out).toContain('href="/topic/Calvin_cycle/"');
    expect(out).toContain('data-topic-title="Calvin cycle"');
  });

  it("D7 keeps a note-group reference list as its own section (footnotes-as-citations)", async () => {
    mockArticleHtml(
      `<section><h2>Notes</h2><ol class="mw-references references">` +
        `<li id="cite_note-fn1" data-mw-group="note"><span class="mw-cite-backlink">` +
        `<a href="./X#cite_ref-fn1" data-mw-group="note" rel="mw:referencedBy">` +
        `<span class="mw-linkback-text">↑</span></a></span> ` +
        `<span class="mw-reference-text">A footnote.</span></li></ol></section>` +
        `<section><h2>References</h2><ol class="mw-references references">${REFLIST_LI(
          "1"
        )}</ol></section>`
    );
    const a = await fetchFullArticle("X");
    // Both the note-group "Notes" and the main "References" survive as distinct sections.
    expect(a.sections.map((s) => s.title)).toEqual(["Notes", "References"]);
  });
});

// ───────────────────────── GROUP B — tables & infobox ─────────────────────────
describe("B — tables & infobox (#25)", () => {
  it("B1/B2 un-hides data tables and wraps each in a keyboard-scrollable region", async () => {
    const out = await fullHtml(
      `<section><h2>Yields</h2><table class="wikitable"><caption>ATP</caption>` +
        `<tbody><tr><th>Step</th><th>ATP</th></tr><tr><td>Glycolysis</td><td>2</td></tr>` +
        `</tbody></table></section>`
    );
    expect(out).toContain('class="wiki-tablewrap"');
    expect(out).toContain('role="region"');
    expect(out).toContain('tabindex="0"');
    expect(out).toMatch(/aria-label="ATP"/); // wrapper labeled by the caption
    expect(out).toContain("Glycolysis"); // the table is present (not display:none-stripped)
  });

  it("B3 keeps the Wikipedia infobox and tags it for the float frame", async () => {
    const out = await fullHtml(
      `<section><table class="infobox biota"><caption>Lion</caption>` +
        `<tbody><tr><th>Species</th><td>P. leo</td></tr></tbody></table>` +
        `<p>The lion is a big cat.</p></section>`
    );
    expect(out).toContain("infobox"); // retained, not stripped
    expect(out).toContain("wiki-infobox"); // tagged for the float frame (CSS)
    expect(out).not.toContain("wiki-tablewrap"); // the infobox is NOT scroll-wrapped (it floats)
  });

  it("B7 still strips genuine navboxes / metadata / sidebars / maintenance banners", async () => {
    const out = await fullHtml(
      `<section><h2>End</h2>` +
        `<div role="navigation" class="navbox"><table class="navbox-inner"><tr><td>Botany links</td></tr></table></div>` +
        `<div class="side-box metadata side-box-right">meta</div>` +
        `<table class="sidebar"><tr><td>sidebar nav</td></tr></table>` +
        `<table class="vertical-navbox"><tr><td>vnav</td></tr></table>` +
        `<div class="ambox"><span class="mbox-text">maintenance</span></div>` +
        `</section>`
    );
    expect(out).not.toContain("Botany links");
    expect(out.toLowerCase()).not.toContain("navbox");
    expect(out).not.toContain("sidebar nav");
    expect(out).not.toContain("vnav");
    expect(out).not.toContain("maintenance");
    expect(out).not.toContain("side-box");
  });

  it("B7 precise: a data table and the infobox are NOT caught by the strip list", async () => {
    const out = await fullHtml(
      `<section><table class="wikitable"><tr><td>real data</td></tr></table>` +
        `<table class="infobox"><tr><td>infobox fact</td></tr></table></section>`
    );
    expect(out).toContain("real data");
    expect(out).toContain("infobox fact");
  });

  it("B6 routes links inside tables (internal → /topic/, external → new tab)", async () => {
    const out = await fullHtml(
      `<section><table class="wikitable"><tr><td>` +
        `<a rel="mw:WikiLink" href="./Glycolysis">Glycolysis</a> ` +
        `<a href="https://example.com">ext</a></td></tr></table></section>`
    );
    expect(out).toContain('href="/topic/Glycolysis/"');
    expect(out).toMatch(/href="https:\/\/example\.com"[^>]*target="_blank"/);
  });
});

// ───────────────────────── GROUP C — math ─────────────────────────
const MATH_BLOCK =
  `<span class="mwe-math-element mwe-math-element-block" typeof="mw:Extension/math">` +
  `<span class="mwe-math-mathml-display mwe-math-mathml-a11y" style="display: none;">` +
  `<math xmlns="http://www.w3.org/1998/Math/MathML" alttext="{a^2+b^2=c^2}">` +
  `<semantics><script>alert(1)</script><annotation>tex</annotation></semantics></math></span>` +
  `<img src="https://wikimedia.org/api/rest_v1/media/math/render/svg/abc" ` +
  `class="mwe-math-fallback-image-display mw-invert" aria-hidden="true" ` +
  `alt="{\\displaystyle a^{2}+b^{2}=c^{2}}"></span>`;

const MATH_INLINE =
  `<span class="mwe-math-element" typeof="mw:Extension/math">` +
  `<span class="mwe-math-mathml-inline mwe-math-mathml-a11y" style="display:none">` +
  `<math><mi>x</mi></math></span>` +
  `<img src="//wikimedia.org/x/render/svg/xy" class="mwe-math-fallback-image-inline" ` +
  `aria-hidden="true" alt="x"></span>`;

describe("C — math (#26)", () => {
  it("C1/C2 keeps the visible SVG fallback image (the chosen render mechanism, C4)", async () => {
    const out = await fullHtml(`<section><h2>Statement</h2><p>${MATH_BLOCK}</p></section>`);
    expect(out).toContain("mwe-math-fallback-image-display");
    expect(out).toContain("media/math/render/svg/abc");
    expect(out).toContain("wiki-math-display"); // display equation tagged + scroll-wrapped
    expect(out).toMatch(/role="region"/);
    expect(out).toMatch(/aria-label="Equation"/);
  });

  it("C3/§5.3 makes the equation perceivable: un-hides the image so its alt is announced", async () => {
    const out = await fullHtml(`<section><p>${MATH_BLOCK}</p></section>`);
    // aria-hidden removed from the fallback image (alt = TeX is now announced)
    const doc = new DOMParser().parseFromString(out, "text/html");
    const img = doc.querySelector("img.mwe-math-fallback-image-display")!;
    expect(img).not.toBeNull();
    expect(img.hasAttribute("aria-hidden")).toBe(false);
    expect(img.getAttribute("alt")).toContain("a^{2}+b^{2}");
  });

  it("C3/X4 drops the MathML payload (and any script inside it) at sanitize", async () => {
    const out = await fullHtml(`<section><p>${MATH_BLOCK}</p></section>`);
    expect(out.toLowerCase()).not.toContain("<math");
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
    expect(out).not.toContain("mwe-math-mathml-a11y"); // empty hidden span removed
  });

  it("C1 upgrades protocol-relative inline math image src to https", async () => {
    const out = await fullHtml(`<section><p>let ${MATH_INLINE} be</p></section>`);
    expect(out).toContain('src="https://wikimedia.org/x/render/svg/xy"');
    expect(out).toContain("wiki-math-inline");
  });
});

// ───────────────────────── GROUP D — tail & hatnotes ─────────────────────────
describe("D — navigational tail & hatnotes (#27)", () => {
  it("D1 keeps See also / Further reading / External links as real sections", async () => {
    mockArticleHtml(
      `<section><h2>Body</h2><p>x</p></section>` +
        `<section><h2>See also</h2><ul><li><a rel="mw:WikiLink" href="./Calvin_cycle">Calvin cycle</a></li></ul></section>` +
        `<section><h2>Further reading</h2><ul><li>A book.</li></ul></section>` +
        `<section><h2>External links</h2><ul><li><a href="https://example.org">Site</a></li></ul></section>`
    );
    const a = await fetchFullArticle("X");
    expect(a.sections.map((s) => s.title)).toEqual([
      "Body",
      "See also",
      "Further reading",
      "External links",
    ]);
  });

  it("D3/D4 routes See-also internal links in, External links out", async () => {
    const out = await fullHtml(
      `<section><h2>See also</h2><ul><li><a rel="mw:WikiLink" href="./Calvin_cycle">cc</a></li></ul></section>` +
        `<section><h2>External links</h2><ul><li><a href="https://example.org">site</a></li></ul></section>`
    );
    expect(out).toContain('href="/topic/Calvin_cycle/"');
    expect(out).toMatch(/href="https:\/\/example\.org"[^>]*target="_blank"/);
  });

  it("D2 keeps hatnotes (lead + in-section) and tags them distinct", async () => {
    const out = await fullHtml(
      `<div role="note" class="hatnote navigation-not-searchable">For other uses, see ` +
        `<a rel="mw:WikiLink" href="./Photosynthesis_(disambiguation)">disambig</a>.</div>` +
        `<p>Lead prose.</p>` +
        `<section><h2>Overview</h2>` +
        `<div role="note" class="hatnote">Main article: <a rel="mw:WikiLink" href="./Glycolysis">Glycolysis</a></div>` +
        `<p>body</p></section>`
    );
    expect(out).toContain("wiki-hatnote"); // tagged for the indented-italic style
    expect(out).toContain("For other uses");
    expect(out).toContain("Main article");
    // hatnote internal links still route internally (D3)
    expect(out).toContain('href="/topic/Glycolysis/"');
  });
});

// ───────────────────────── X4 — sanitize still blocks XSS after widening ─────────
describe("X4 — sanitize blocks XSS alongside the widened (citations/tables/math) markup", () => {
  it("drops <script>, event-handler attrs, javascript:/data:text/html, <style>, <math>, <svg>", async () => {
    const out = await fullHtml(
      `<section><h2>Refs</h2>` +
        // legit widened markup in the same payload as hostile markup:
        `<table class="wikitable"><tr><td>ok${MARKER("1")}</td></tr></table>` +
        MATH_BLOCK +
        // hostile:
        `<script>window.__pwned=1</script>` +
        `<img src="x" onerror="window.__x=1">` +
        `<div onclick="evil()">z</div>` +
        `<a href="javascript:alert(1)">j</a>` +
        `<a href="data:text/html,<script>alert(1)</script>">d</a>` +
        `<style>@import url(https://evil.test)</style>` +
        `<svg><script>alert(1)</script></svg>` +
        `<p style="background:url(javascript:alert(1))">s</p>` +
        `</section>`
    );
    // hostile artifacts gone
    expect(out).not.toContain("__pwned");
    expect(out).not.toContain("__x");
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out).not.toMatch(/onerror=/i);
    expect(out).not.toMatch(/onclick=/i);
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out.toLowerCase()).not.toContain("data:text/html");
    expect(out.toLowerCase()).not.toContain("<style");
    expect(out).not.toContain("evil.test");
    expect(out.toLowerCase()).not.toContain("<svg");
    expect(out.toLowerCase()).not.toContain("<math");
    expect(out).not.toMatch(/style=/i); // no inline style attribute survives
    // legit widened markup survives in the SAME payload
    expect(out).toContain("wiki-tablewrap");
    expect(out).toContain("mwe-math-fallback-image-display");
    expect(out).toContain("data-cite-marker");
  });
});
