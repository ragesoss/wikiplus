import { describe, expect, it } from "vitest";
import { scopeArticleCss } from "@/lib/wiki/cssScope";

// SELECTOR-RESOLUTION regression (#105, fix round 2) — the dead-`.mw-parser-output`-selector
// fidelity bug. Wikipedia keys every TemplateStyles rule under its content-root class
// `.mw-parser-output`, but `fetchFullArticle`'s sanitize/section-split DROPS that wrapper, so
// the rendered article DOM has ZERO `.mw-parser-output` elements. A scoped rule that still
// demands a `.mw-parser-output` ancestor matches nothing and is inert — the cladogram drew no
// branch lines and the `.tmulti` montage collapsed to a single column.
//
// The existing fidelity tests only assert the scoped CSS STRING contains the rules and that a
// `<style>` mounts — they never assert the rules MATCH the sanitized DOM, and jsdom does not
// run the cascade, so the dead-selector mismatch slipped through. This test closes that gap by
// parsing the emitted selectors out of the real scoped stylesheet and resolving them against a
// DOM fragment that mirrors the SANITIZED article structure (no `.mw-parser-output` wrapper)
// with jsdom's `Element.matches`. It FAILS on the pre-fix output (selectors carry
// `.mw-parser-output`, match nothing) and PASSES after the `.mw-parser-output` translation.

// Real `Template:Clade/styles.css` (the rules that draw the right-angled bracket tree —
// the per-cell border segments and the in-flow `clade-bar`). Wikipedia ships every rule
// rooted at `.mw-parser-output`, exactly as the live page does.
const CLADE_CSS = `
.mw-parser-output table.clade {
  border-spacing: 0;
  margin: 0;
  font-size: 100%;
  line-height: 100%;
  border-collapse: separate;
}
.mw-parser-output table.clade td {
  padding: 0 0.5em;
  vertical-align: middle;
  text-align: center;
  white-space: nowrap;
}
.mw-parser-output td.clade-label {
  width: 0.7em;
  padding: 0 0.15em;
  vertical-align: bottom;
  text-align: center;
  border-left: 1px solid black;
  border-bottom: 1px solid black;
}
.mw-parser-output td.clade-label.first {
  border-left: none;
  border-right: none;
}
.mw-parser-output td.clade-slabel {
  padding: 0 0.15em;
  vertical-align: top;
  text-align: center;
  border-left: 1px solid black;
}
.mw-parser-output td.clade-bar {
  vertical-align: middle;
  text-align: left;
  padding: 0 0.5em;
  position: relative;
}
.mw-parser-output td.clade-leaf {
  border: 0;
  padding: 0;
  text-align: left;
}
`;

// Real `Template:Multiple image`/`.tmulti` montage layout CSS (the flex row + tiles +
// captions that turn the "Various types of cats" montage into a multi-column captioned grid).
const TMULTI_CSS = `
.mw-parser-output .tmulti .thumbinner {
  display: flex;
  flex-direction: column;
}
.mw-parser-output .tmulti .trow {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
}
.mw-parser-output .tmulti .tsingle {
  margin: 1px;
  float: left;
}
.mw-parser-output .tmulti .thumbcaption {
  text-align: left;
  font-size: 88%;
}
`;

// Build the SANITIZED article DOM — a `.wiki-body` host with NO `.mw-parser-output` wrapper,
// mirroring what `fetchFullArticle` actually renders (sectioned `.wiki-body` divs).
function sanitizedClade(): { label: Element; slabel: Element; bar: Element } {
  document.body.innerHTML = `
    <div class="wiki-body">
      <div class="clade">
        <table class="clade">
          <tbody>
            <tr>
              <td class="clade-label first">A</td>
              <td class="clade-bar">
                <table class="clade">
                  <tbody>
                    <tr>
                      <td class="clade-slabel">node</td>
                      <td class="clade-leaf">Leaf taxon</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  return {
    label: document.querySelector("td.clade-label")!,
    slabel: document.querySelector("td.clade-slabel")!,
    bar: document.querySelector("td.clade-bar")!,
  };
}

function sanitizedTmulti(): { trow: Element; tsingle: Element; caption: Element } {
  document.body.innerHTML = `
    <div class="wiki-body">
      <div class="thumb tmulti">
        <div class="thumbinner">
          <div class="trow">
            <div class="tsingle">
              <div class="thumbcaption">A tabby cat</div>
            </div>
            <div class="tsingle">
              <div class="thumbcaption">A black cat</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  return {
    trow: document.querySelector(".trow")!,
    tsingle: document.querySelector(".tsingle")!,
    caption: document.querySelector(".thumbcaption")!,
  };
}

// Split a scoped stylesheet into its individual selectors (across comma lists). Naive but
// sufficient here: the reused clade/tmulti CSS carries no commas inside selectors and no
// at-rules survive in these fixtures, so each `<selector>{…}` block yields its selectors.
function emittedSelectors(scoped: string): string[] {
  const out: string[] = [];
  for (const block of scoped.split("}")) {
    const head = block.split("{")[0]?.trim();
    if (!head) continue;
    for (const sel of head.split(",")) {
      const s = sel.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

const matchesAny = (el: Element, selectors: string[]): boolean =>
  selectors.some((sel) => {
    try {
      return el.matches(sel);
    } catch {
      return false; // an unsupported selector can't be the one that styles this cell
    }
  });

describe("scopeArticleCss — reused rules resolve against the sanitized DOM (no .mw-parser-output)", () => {
  it("clade cells match at least one emitted selector (branch geometry can render)", async () => {
    const scoped = await scopeArticleCss(CLADE_CSS);
    const selectors = emittedSelectors(scoped);
    const { label, slabel, bar } = sanitizedClade();
    // The cells that draw the bracket tree must each be reachable by a scoped rule.
    expect(matchesAny(label, selectors)).toBe(true);
    expect(matchesAny(slabel, selectors)).toBe(true);
    expect(matchesAny(bar, selectors)).toBe(true);
    // Specifically, the clade-label cell matches the border-bearing rule (the bug: it did
    // not, because the rule demanded a `.mw-parser-output` ancestor that does not exist).
    expect(label.matches(".wiki-body td.clade-label")).toBe(true);
    expect(label.matches(".wiki-body table.clade td")).toBe(true);
  });

  it("a .tmulti .trow matches an emitted selector (montage grid can render)", async () => {
    const scoped = await scopeArticleCss(TMULTI_CSS);
    const selectors = emittedSelectors(scoped);
    const { trow, tsingle, caption } = sanitizedTmulti();
    expect(matchesAny(trow, selectors)).toBe(true);
    expect(matchesAny(tsingle, selectors)).toBe(true);
    expect(matchesAny(caption, selectors)).toBe(true);
    // The flex row specifically resolves (was inert pre-fix).
    expect(trow.matches(".wiki-body .tmulti .trow")).toBe(true);
  });

  it("NO emitted selector contains .mw-parser-output (the dead content-root ancestor)", async () => {
    const cladeScoped = await scopeArticleCss(CLADE_CSS);
    const tmultiScoped = await scopeArticleCss(TMULTI_CSS);
    expect(cladeScoped).not.toContain("mw-parser-output");
    expect(tmultiScoped).not.toContain("mw-parser-output");
    for (const sel of [
      ...emittedSelectors(cladeScoped),
      ...emittedSelectors(tmultiScoped),
    ]) {
      expect(sel).not.toContain("mw-parser-output");
    }
  });

  it("every emitted selector still begins with the .wiki-body scope prefix (X4 confinement)", async () => {
    for (const css of [CLADE_CSS, TMULTI_CSS]) {
      const scoped = await scopeArticleCss(css);
      for (const sel of emittedSelectors(scoped)) {
        expect(sel.startsWith(".wiki-body")).toBe(true);
      }
    }
  });
});

// Translation unit tests — the exact rewrites the fix performs, including the X4 invariant
// (every output still starts with `.wiki-body `, and a selector that was ONLY
// `.mw-parser-output` becomes exactly `.wiki-body`, never empty/unscoped).
describe("scopeArticleCss — .mw-parser-output translation cases", () => {
  it("drops the leading content-root + its descendant combinator", async () => {
    const out = await scopeArticleCss(
      ".mw-parser-output table.clade td.clade-label{border-left:1px solid}"
    );
    expect(out).toContain(".wiki-body table.clade td.clade-label");
    expect(out).not.toContain("mw-parser-output");
  });

  it("compound `.mw-parser-output.foo` drops only the content-root class", async () => {
    const out = await scopeArticleCss(".mw-parser-output.biota th{background:#d3d3a4}");
    expect(out).toContain(".wiki-body .biota th");
    expect(out).not.toContain("mw-parser-output");
  });

  it("compound `div.mw-parser-output` keeps the type selector", async () => {
    const out = await scopeArticleCss("div.mw-parser-output{color:red}");
    expect(out).toContain(".wiki-body div");
    expect(out).not.toContain("mw-parser-output");
  });

  it("a trailing `> .mw-parser-output` drops the preceding combinator (no dangling `>`)", async () => {
    const out = await scopeArticleCss(".a > .mw-parser-output{color:red}");
    expect(out).toContain(".wiki-body .a");
    expect(out).not.toContain("mw-parser-output");
    expect(out).not.toMatch(/>\s*{/); // no `.a >{…}`
  });

  it("`.mw-parser-output` ALONE becomes exactly `.wiki-body` (scoped, never empty)", async () => {
    const out = await scopeArticleCss(".mw-parser-output{font-size:100%}");
    expect(out).toMatch(/^\.wiki-body\s*{/);
    expect(out).not.toContain("mw-parser-output");
    // never an empty/unscoped selector that would reach chrome
    expect(out).not.toMatch(/(^|})\s*{/);
  });

  it("translates inside :is() while keeping every branch confined under .wiki-body", async () => {
    const out = await scopeArticleCss(
      ":is(.mw-parser-output .tmulti, .other) .trow{display:flex}"
    );
    expect(out).not.toContain("mw-parser-output");
    expect(out.startsWith(".wiki-body")).toBe(true);
    // the translated inner branch resolves against the sanitized DOM
    expect(out).toMatch(/:is\([^)]*\.wiki-body \.tmulti/);
  });

  it("handles repeated content-root occurrences in one selector", async () => {
    const out = await scopeArticleCss(
      ".mw-parser-output .mw-parser-output .x{color:red}"
    );
    expect(out).toContain(".wiki-body .x");
    expect(out).not.toContain("mw-parser-output");
  });
});
