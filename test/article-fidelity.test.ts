import { afterEach, describe, expect, it, vi } from "vitest";
import DOMPurify from "dompurify";
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
  it("A1 keeps inline sup.reference markers (not stripped)", async () => {
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

// ───────────────────── #74 — infobox / taxobox layout fidelity ─────────────────────
// Fixtures mirror the LIVE Parsoid markup inspected for Dendrobium_kingianum (the anchor
// taxobox) and Marie_Curie / San_Francisco (modern semantic-class infoboxes). The internal
// layout is reached by STRUCTURE-KEYED CSS in globals.css (mechanism option (a) — no
// DOMPurify allowlist change); these tests assert the transform leaves the structure the
// CSS keys off INTACT after sanitize (and that the inline `style` it relied on is gone).

// A taxobox section banner is a classless <th colspan="2"> (its centering + taxon band live
// in inline style that sanitize strips). The "Scientific classification" banner wraps the
// .taxobox-edit-taxonomy pencil. The lead image is a SEPARATE classless <td colspan="2"> cell
// (NO `.infobox-image` class), its caption the classless <td colspan="2"> in the row right
// after it. The synonyms are a classless <td colspan="2"> wrapping a <ul> under the "Synonyms"
// <th colspan="2"> banner. These four classless `td[colspan]` shapes are why the image-centering
// CSS keys off the `<img>` element + the image-bearing row, NOT `td[colspan]` broadly — so the
// LEFT-aligned synonyms list is never caught. (Mirrors live Parsoid markup of Dendrobium kingianum.)
const TAXOBOX = (opts: { withEdit?: boolean } = {}) =>
  `<table class="infobox biota" style="text-align: left; width: 200px">` +
  `<tbody>` +
  `<tr><th colspan="2" style="text-align:center;background-color:rgb(180,250,180)">Pink rock orchid</th></tr>` +
  `<tr><td colspan="2" style="text-align:center"><img src="//up.example/orchid.jpg" ` +
  `alt="Dendrobium kingianum flower" width="250" height="188"/></td></tr>` +
  `<tr><td colspan="2" style="text-align:center">Dendrobium kingianum flower detail</td></tr>` +
  `<tr><th colspan="2" style="text-align:center;background-color:rgb(180,250,180)">` +
  `<a rel="mw:WikiLink" href="./Taxonomy" title="Taxonomy">Scientific classification</a>` +
  (opts.withEdit
    ? `<span class="plainlinks taxobox-edit-taxonomy skin-invert" style="float:right">` +
      `<a href="./Template:Taxonomy/Dendrobium" title="Edit this classification">` +
      `<img alt="Edit this classification" src="//up.example/edit.png" width="15" height="15"/></a></span>`
    : "") +
  `</th></tr>` +
  `<tr><td>Kingdom:</td><td><a rel="mw:WikiLink" href="./Plant" title="Plant">Plantae</a></td></tr>` +
  `<tr class="taxonrow"><td><i>Clade</i>:</td>` +
  `<td><a rel="mw:WikiLink" href="./Embryophyte" title="Embryophyte">Embryophytes</a></td></tr>` +
  `<tr><th colspan="2" style="text-align:center;background-color:rgb(180,250,180)">Binomial name</th></tr>` +
  `<tr><td colspan="2" style="text-align:center"><span class="binomial">Dendrobium kingianum</span></td></tr>` +
  `<tr><th colspan="2" style="text-align:center;background-color:rgb(180,250,180)">Synonyms</th></tr>` +
  `<tr><td colspan="2" style="text-align:left"><ul><li>Callista kingiana</li>` +
  `<li>Dendrocoryne kingianum</li></ul></td></tr>` +
  `</tbody></table>`;

const MODERN_INFOBOX =
  `<table class="infobox biography vcard">` +
  `<tbody>` +
  `<tr><th colspan="2" class="infobox-above"><div class="fn">Marie Curie</div></th></tr>` +
  `<tr><td colspan="2" class="infobox-image"><img src="//up.example/curie.jpg" ` +
  `alt="Head shot of Curie" width="250" height="340"/>` +
  `<div class="infobox-caption">Marie Skłodowska Curie</div></td></tr>` +
  `<tr><th scope="row" class="infobox-label">Born</th>` +
  `<td class="infobox-data">7 November 1867</td></tr>` +
  `<tr><th colspan="2" class="infobox-header">Government</th></tr>` +
  `<tr><td colspan="2" class="infobox-subheader">Consolidated city-county</td></tr>` +
  `<tr><td colspan="2" class="infobox-full-data">Footer note</td></tr>` +
  `</tbody></table>`;

describe("#74 — infobox / taxobox layout fidelity", () => {
  it("D6 strips the .taxobox-edit-taxonomy pencil (editor chrome)", async () => {
    const out = await fullHtml(`<section><p>x</p>${TAXOBOX({ withEdit: true })}</section>`);
    expect(out).not.toContain("taxobox-edit-taxonomy");
    expect(out).not.toContain("Edit this classification");
    expect(out).not.toContain("up.example/edit.png");
    // …while the "Scientific classification" banner heading itself stays.
    expect(out).toContain("Scientific classification");
  });

  it("D6 preserves the taxobox lead image's alt while stripping the edit pencil", async () => {
    const out = await fullHtml(`<section><p>x</p>${TAXOBOX({ withEdit: true })}</section>`);
    const doc = new DOMParser().parseFromString(out, "text/html");
    const leadImg = doc.querySelector('img[src*="orchid.jpg"]');
    expect(leadImg).not.toBeNull();
    expect(leadImg!.getAttribute("alt")).toBe("Dendrobium kingianum flower");
  });

  it("keeps the taxobox + tags it for the float frame; never scroll-wraps it", async () => {
    const out = await fullHtml(`<section><p>x</p>${TAXOBOX()}</section>`);
    expect(out).toContain("infobox biota"); // class retained (CSS keys `.infobox.biota`)
    expect(out).toContain("wiki-infobox"); // tagged for the float frame
    expect(out).not.toContain("wiki-tablewrap"); // the infobox is NOT scroll-wrapped (it floats)
  });

  it("banner <th colspan> rows are distinguishable from <td> data rows in the DOM (the CSS key)", async () => {
    const out = await fullHtml(`<section><p>x</p>${TAXOBOX()}</section>`);
    const doc = new DOMParser().parseFromString(out, "text/html");
    const box = doc.querySelector("table.infobox.biota")!;
    // Banners: every <th> carries colspan → `table.infobox th[colspan]` catches ALL and
    // ONLY banner rows.
    const ths = Array.from(box.querySelectorAll("th"));
    expect(ths.length).toBeGreaterThan(0);
    expect(ths.every((th) => th.hasAttribute("colspan"))).toBe(true);
    // Data ladder cells are plain <td> WITHOUT colspan → not caught by the banner rule.
    const ladderKeys = Array.from(box.querySelectorAll("tr.taxonrow td"));
    expect(ladderKeys.length).toBeGreaterThan(0);
    expect(ladderKeys.every((td) => !td.hasAttribute("colspan"))).toBe(true);
    // The "Kingdom:" row is a bare <tr> of two <td> (no colspan) — also left-aligned by CSS.
    expect(out).toContain("<td>Kingdom:</td>");
  });

  it("the taxobox lead image is a CLASSLESS td[colspan] (the centering CSS keys off the <img> + image row)", async () => {
    // Guards the A.1.2 image-centering fix: the lead image has NO `.infobox-image` class and
    // its inline `text-align:center` is stripped, so centering must key off the <img> element
    // inside a classless `td[colspan]`. If a future markup/CSS change moves the image out of a
    // classless `td[colspan]` (or adds a class the selector no longer matches), this fails —
    // catching a silently-broken centering selector that a render test would miss.
    const out = await fullHtml(`<section><p>x</p>${TAXOBOX()}</section>`);
    const doc = new DOMParser().parseFromString(out, "text/html");
    const box = doc.querySelector("table.infobox.biota")!;
    const leadImg = box.querySelector('img[src*="orchid.jpg"]')!;
    expect(leadImg).not.toBeNull();
    // The image's cell is a colspanned <td> with no class — the structure the
    // `table.infobox.biota td[colspan] img { margin-inline:auto }` rule targets.
    const cell = leadImg.closest("td")!;
    expect(cell.tagName).toBe("TD");
    expect(cell.hasAttribute("colspan")).toBe(true);
    expect(cell.getAttribute("class")).toBeNull();
  });

  it("the LEFT-aligned synonyms <ul> is a classless td[colspan] NOT in an image row (centering can't reach it)", async () => {
    // Guards the A.1.5 constraint: synonyms stay left-aligned. The synonyms cell is the same
    // classless `td[colspan]` shape as the image/caption cells, so the centering rule deliberately
    // keys on the <img> element / an image-bearing row — never `td[colspan]` broadly. This asserts
    // the synonyms `<ul>` lives in a `td[colspan]` whose row holds no <img> and is preceded by a
    // <th> banner (not an image row), so neither the `td[colspan] img` nor the
    // `tr:has(td[colspan] img) + tr` caption selector can center it.
    const out = await fullHtml(`<section><p>x</p>${TAXOBOX()}</section>`);
    const doc = new DOMParser().parseFromString(out, "text/html");
    const box = doc.querySelector("table.infobox.biota")!;
    const ul = box.querySelector("ul")!;
    expect(ul).not.toBeNull();
    const synCell = ul.closest("td")!;
    expect(synCell.hasAttribute("colspan")).toBe(true);
    expect(synCell.getAttribute("class")).toBeNull();
    // The synonyms cell's own row carries no image (so `td[colspan] img` does not apply)…
    const synRow = synCell.closest("tr")!;
    expect(synRow.querySelector("img")).toBeNull();
    // …and the row before it is the "Synonyms" <th> banner, not an image-bearing row (so the
    // `tr:has(td[colspan] img) + tr` caption-centering rule does not apply either).
    const prevRow = synRow.previousElementSibling as HTMLElement;
    expect(prevRow.querySelector("th")).not.toBeNull();
    expect(prevRow.querySelector("img")).toBeNull();
  });

  it("the inline style that carried the taxobox banner band/width is stripped (X4 — option a is necessary)", async () => {
    const out = await fullHtml(`<section><p>x</p>${TAXOBOX()}</section>`);
    expect(out).not.toMatch(/style=/i); // banners/box carry NO surviving inline style
    expect(out).not.toContain("rgb(180,250,180)"); // the taxon band color does not survive
    expect(out).not.toContain("width: 200px");
  });

  it("modern infobox-* semantic classes survive sanitize (the CSS keys off them)", async () => {
    const out = await fullHtml(`<section><p>x</p>${MODERN_INFOBOX}</section>`);
    for (const cls of [
      "infobox-above",
      "infobox-image",
      "infobox-caption",
      "infobox-label",
      "infobox-data",
      "infobox-header",
      "infobox-subheader",
      "infobox-full-data",
    ]) {
      expect(out).toContain(cls);
    }
    // The modern key cell is a `th scope="row"` WITHOUT colspan (left-aligned key, not a banner);
    // the title/section bands ARE `th colspan` (banner). Both survive distinct.
    const doc = new DOMParser().parseFromString(out, "text/html");
    const box = doc.querySelector("table.infobox")!;
    const label = box.querySelector("th.infobox-label")!;
    expect(label.hasAttribute("colspan")).toBe(false);
    expect(label.getAttribute("scope")).toBe("row");
    const above = box.querySelector("th.infobox-above")!;
    expect(above.hasAttribute("colspan")).toBe(true);
  });

  it("modern infobox image keeps its Parsoid alt", async () => {
    const out = await fullHtml(`<section><p>x</p>${MODERN_INFOBOX}</section>`);
    const doc = new DOMParser().parseFromString(out, "text/html");
    const img = doc.querySelector('img[src*="curie.jpg"]')!;
    expect(img.getAttribute("alt")).toBe("Head shot of Curie");
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

  // #74: the `uponSanitizeAttribute` hook that re-permits the inert `colspan`/
  // `rowspan`/`scope` attrs (which the custom ALLOWED_URI_REGEXP would otherwise
  // drop, #74) must NOT rescue any other attribute and must NOT leak past the
  // sanitize call. These two assertions guard the new XSS surface directly.
  it("X4 (#74): the colspan-keeping hook rescues ONLY colspan/rowspan/scope — never style/on*/javascript:", async () => {
    const out = await fullHtml(
      `<section><table class="infobox biota"><tbody>` +
        `<tr><th colspan="2" style="background:red" onclick="evil()">Banner</th></tr>` +
        `<tr><td colspan="2" rowspan="3"><a href="javascript:alert(1)">x</a></td></tr>` +
        `</tbody></table></section>`
    );
    expect(out).toContain('colspan="2"'); // load-bearing inert span survives
    expect(out).toContain('rowspan="3"');
    expect(out).not.toMatch(/style=/i); // the hook did NOT rescue style
    expect(out).not.toMatch(/onclick/i); // …nor the event handler
    expect(out.toLowerCase()).not.toContain("javascript:"); // …nor the hostile href
  });

  it("X4 (#74): the colspan-keeping hook is removed after sanitize — it does not leak to the global DOMPurify singleton", async () => {
    // Run fetchFullArticle (adds the hook, then removes it in `finally`).
    await fullHtml(
      `<section><table class="infobox biota"><tbody>` +
        `<tr><th colspan="2">Banner</th></tr></tbody></table></section>`
    );
    // A fresh, independent sanitize on the SAME singleton, with the same custom
    // URI regexp but WITHOUT re-adding the hook: colspan/scope must drop again —
    // proving the hook did not persist on the shared instance.
    const leaked = DOMPurify.sanitize(
      `<table><tbody><tr><th colspan="2" scope="col">B</th></tr></tbody></table>`,
      {
        ALLOWED_TAGS: ["table", "tbody", "tr", "th", "td"],
        ALLOWED_ATTR: ["colspan", "rowspan", "scope", "class"],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\.{0,2}\/|#)/i,
      }
    );
    expect(leaked).not.toContain("colspan");
    expect(leaked).not.toContain("scope");
  });
});
