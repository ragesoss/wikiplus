import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFullArticle } from "@/lib/wiki/article";

// Fresh-eyes QA for the wikitable float / alignment fidelity change
// (docs/design/wikitable-float-align.md): the `floatright`/`floatleft` class + inline table
// `float` → a floated `.wiki-tablewrap--right|--left` scroll region, with the inline-style
// allowlist unchanged and no XSS / style smuggling through the new raw pre-pass.

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
async function render(body: string): Promise<HTMLDivElement> {
  return live(await out(`<section>${body}</section>`));
}
const ROW = `<tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr>`;
function wrapOf(d: HTMLElement, sel = "table"): HTMLElement {
  const t = d.querySelector(sel)!;
  expect(t).not.toBeNull();
  const w = t.parentElement!;
  expect(w.classList.contains("wiki-tablewrap")).toBe(true);
  return w;
}
function floatClasses(el: Element): string[] {
  return Array.from(el.classList).filter((c) => /float|tablewrap--/.test(c));
}

describe("1. floatright / floatleft class → floated scroll region", () => {
  it("class=\"wikitable floatright\" → wrapper wiki-tablewrap--right", async () => {
    const d = await render(`<table class="wikitable floatright">${ROW}</table>`);
    const w = wrapOf(d);
    expect(w.classList.contains("wiki-tablewrap--right")).toBe(true);
    expect(w.classList.contains("wiki-tablewrap--left")).toBe(false);
    // the region keeps its a11y contract
    expect(w.getAttribute("role")).toBe("region");
    expect(w.getAttribute("tabindex")).toBe("0");
  });

  it("class=\"wikitable floatleft\" → wrapper wiki-tablewrap--left", async () => {
    const w = wrapOf(await render(`<table class="wikitable floatleft">${ROW}</table>`));
    expect(w.classList.contains("wiki-tablewrap--left")).toBe(true);
    expect(w.classList.contains("wiki-tablewrap--right")).toBe(false);
  });

  it("plain wikitable → neither modifier", async () => {
    const w = wrapOf(await render(`<table class="wikitable">${ROW}</table>`));
    expect(floatClasses(w)).toEqual([]);
  });

  it("both classes → right wins, only one modifier", async () => {
    const w = wrapOf(await render(`<table class="wikitable floatright floatleft">${ROW}</table>`));
    expect(floatClasses(w)).toEqual(["wiki-tablewrap--right"]);
  });
});

describe("2. inline table float → fixed class + floated region", () => {
  it("style=\"float: right; margin-left:1em\" → floatright + right wrapper", async () => {
    const d = await render(
      `<table class="wikitable" style="float: right; margin-left:1em">${ROW}</table>`
    );
    const t = d.querySelector("table")!;
    expect(t.classList.contains("floatright")).toBe(true);
    expect(wrapOf(d).classList.contains("wiki-tablewrap--right")).toBe(true);
  });

  it("float:left (and upper-case, float not first) → floatleft + left wrapper", async () => {
    for (const style of ["float:left", "width:10em; FLOAT : LEFT"]) {
      const d = await render(`<table style="${style}">${ROW}</table>`);
      expect(d.querySelector("table")!.classList.contains("floatleft")).toBe(true);
      expect(wrapOf(d).classList.contains("wiki-tablewrap--left")).toBe(true);
    }
  });

  it("float:none / no float / non-float property → nothing", async () => {
    for (const style of ["float:none", "margin:0 auto", "width:50%", ""]) {
      const d = await render(`<table class="wikitable" style="${style}">${ROW}</table>`);
      expect(floatClasses(d.querySelector("table")!)).toEqual([]);
      expect(floatClasses(wrapOf(d))).toEqual([]);
    }
  });

  it("a `float` substring of another property does not match", async () => {
    const d = await render(`<table style="x-float:right">${ROW}</table>`);
    expect(floatClasses(d.querySelector("table")!)).toEqual([]);
  });

  it("non-table element with float:right → no float class", async () => {
    const d = await render(
      `<div style="float:right">side</div><p style="float:left">p</p>` +
        `<table class="wikitable">${ROW}</table>`
    );
    expect(d.querySelector("div.floatright, p.floatleft, .floatright, .floatleft")).toBeNull();
    expect(floatClasses(wrapOf(d))).toEqual([]);
  });
});

describe("3. security — no style pass-through, no XSS, only fixed class names", () => {
  it("the inline float never survives as a style declaration", async () => {
    const d = await render(
      `<table class="wikitable" style="float:right;width:12em">${ROW}</table>`
    );
    const t = d.querySelector("table")!;
    const style = t.getAttribute("style") || "";
    expect(style).not.toMatch(/float/i);
    expect(style).toMatch(/width/); // the allowlisted subset is still recovered
    expect(d.innerHTML).not.toMatch(/float\s*:/i);
  });

  it("float + hostile background url → floatright only, no url/javascript anywhere", async () => {
    const o = await out(
      `<section><table style="float:right;background:url(javascript:alert(1));` +
        `background-image:url(//evil.example/x.png);position:fixed">${ROW}</table></section>`
    );
    expect(o).not.toMatch(/javascript:/i);
    expect(o).not.toMatch(/url\(/i);
    expect(o).not.toMatch(/evil\.example/);
    expect(o).not.toMatch(/position\s*:\s*fixed/i);
    const d = live(o);
    expect(floatClasses(d.querySelector("table")!)).toEqual(["floatright"]);
  });

  it("escaped property name (\\66loat:right) → no class, no float style", async () => {
    const d = await render(`<table style="\\66loat:right">${ROW}</table>`);
    const t = d.querySelector("table")!;
    expect(floatClasses(t)).toEqual([]);
    expect(t.getAttribute("style") || "").not.toMatch(/float|66/i);
  });

  it("attribute-breakout attempt in the style value → no handler, no injected attr", async () => {
    // entity-encoded quotes land INSIDE the attribute value (the raw-parse reality)
    const o = await out(
      `<section><table style="float: right&quot; onload=&quot;alert(1)&quot; x=&quot;">${ROW}` +
        `</table><table style='float:left" onmouseover="alert(2)'>${ROW}</table></section>`
    );
    expect(o).not.toMatch(/\son\w+\s*=/i);
    expect(o).not.toMatch(/alert\(/);
    const d = live(o);
    for (const el of Array.from(d.querySelectorAll("*"))) {
      for (const a of Array.from(el.attributes)) expect(a.name).not.toMatch(/^on/i);
    }
    const [t1, t2] = Array.from(d.querySelectorAll("table"));
    // at most the fixed class name is derived from the value
    expect(floatClasses(t1)).toEqual(["floatright"]);
    expect(floatClasses(t2)).toEqual(["floatleft"]);
  });

  it("a crafted value cannot mint any class other than floatright/floatleft", async () => {
    const d = await render(
      `<table style="float:right evil-class;float:leftx;float: right-to-left">${ROW}</table>`
    );
    const t = d.querySelector("table")!;
    const added = Array.from(t.classList).filter((c) => c !== "wiki-table");
    for (const c of added) expect(["floatright", "floatleft"]).toContain(c);
  });

  it("CSS comment / expression / nested float in url → no script, no style leak", async () => {
    const o = await out(
      `<section><table style="/*x*/float:right;width:expression(alert(1))">${ROW}</table>` +
        `<table style="background:url(a;float:right)">${ROW}</table></section>`
    );
    expect(o).not.toMatch(/expression\(/i);
    expect(o).not.toMatch(/url\(/i);
    expect(o).not.toMatch(/float\s*:/i);
  });

  it("source-supplied class path: a spoofed wrapper class stays inert text, never script", async () => {
    // `class` is already a DOMPurify-permitted attr; this change adds no new class plumbing.
    const o = await out(
      `<section><table class="wikitable floatright &quot; onclick=&quot;alert(1)">${ROW}</table></section>`
    );
    // the quote stays entity-escaped INSIDE the class value — inert text, no attribute
    const d = live(o);
    for (const el of Array.from(d.querySelectorAll("*"))) {
      for (const a of Array.from(el.attributes)) expect(a.name).not.toMatch(/^on/i);
    }
    expect(d.querySelector("table")!.hasAttribute("onclick")).toBe(false);
  });

  it("a source data-wikiplus-style carrier still cannot smuggle a float", async () => {
    const d = await render(
      `<table data-wikiplus-style="float:right;position:fixed">${ROW}</table>`
    );
    const t = d.querySelector("table")!;
    expect(t.getAttribute("style") || "").not.toMatch(/float|position/i);
    expect(floatClasses(wrapOf(d))).toEqual([]);
  });
});

describe("4. regressions — infobox, clade tables and carriers untouched", () => {
  it("infobox with floatright / inline float is not wrapped (own float rule)", async () => {
    const d = await render(
      `<table class="infobox floatright" style="float:left"><tr><th>k</th><td>v</td></tr></table>`
    );
    const ib = d.querySelector("table.infobox")!;
    expect(ib.classList.contains("wiki-infobox")).toBe(true);
    expect(ib.closest(".wiki-tablewrap")).toBeNull();
    expect(d.querySelector(".wiki-tablewrap--right, .wiki-tablewrap--left")).toBeNull();
  });

  it("clade table and clade carrier with a float are not wrapped/floated", async () => {
    const d = await render(
      `<table class="floatright" style="float:right"><tr><td class="cladogram">` +
        `<div class="clade"><table class="clade" style="float:left"><tr><td class="clade-label">x</td>` +
        `</tr></table></div></td></tr></table>`
    );
    expect(d.querySelector(".wiki-tablewrap")).toBeNull();
    expect(d.querySelector("table.wiki-clade-carrier")).not.toBeNull();
  });

  it("a nested floatright table inside a wrapped table is not re-wrapped", async () => {
    const d = await render(
      `<table class="wikitable"><tr><td><table class="wikitable floatright">${ROW}</table>` +
        `</td></tr></table>`
    );
    expect(d.querySelectorAll(".wiki-tablewrap").length).toBe(1);
    expect(d.querySelector(".wiki-tablewrap--right")).toBeNull();
  });
});

describe("5. percentage-width floated table — width moves onto the floated region", () => {
  it("a floated table's % width sizes the region; the table fills it", async () => {
    const d = await render(`<table class="wikitable floatright" style="width:30%">${ROW}</table>`);
    const w = wrapOf(d);
    expect(w.style.width).toBe("30%");
    expect((d.querySelector("table") as HTMLElement).style.width).toBe("100%");
  });

  it("a fixed-px width and an unfloated % width are left on the table", async () => {
    const d = await render(
      `<table class="wikitable floatright" style="width:200px">${ROW}</table>` +
        `<table class="wikitable" style="width:30%">${ROW}</table>`
    );
    const [a, b] = Array.from(d.querySelectorAll("table")) as HTMLElement[];
    expect(a.style.width).toBe("200px");
    expect(a.parentElement!.style.width).toBe("");
    expect(b.style.width).toBe("30%");
    expect(b.parentElement!.style.width).toBe("");
  });
});
