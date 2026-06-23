import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// QA supplement (skin system + zine-dark) — independent, non-author acceptance-criterion tests
// written by the qa-reviewer role for issue #119, against docs/design/skin-system-zine-dark.md.
// These close the coverage the author's three updated tests did not map: the LIGHT-skin byte
// stability (#1/#9 — the new role tokens must resolve to the exact literals they replaced), the
// SEAM (#10 — the pre-paint bootstrap sets data-skin only for a non-default, allowlisted skin and
// never reflects a raw cookie/env value into executable script), the DARK token block defining the
// spec hexes (#2/#5), and the absence of any remaining literal light-on-light leak utilities in the
// routed surfaces (#4). Rendering the full app needs a browser (Playwright screenshot harness, #6);
// these gate the seam's SOURCE OF TRUTH (globals.css + layout.tsx) the way the header-integration QA
// suite gates the projector tokens.

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");

/** Pull the value of a `--token: value;` declaration from a CSS substring. */
function tokenValue(scope: string, token: string): string | undefined {
  const m = scope.match(new RegExp(`${token}\\s*:\\s*([^;]+);`));
  return m?.[1].trim();
}

/** The `:root`/`@theme` (light) block — everything before the dark scope opens. */
const lightBlock = css.slice(0, css.indexOf('[data-skin="zine-dark"]'));
/** The dark scope's first declaration block. */
const darkBlock = (() => {
  const start = css.indexOf('[data-skin="zine-dark"] {');
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open, close);
})();

describe("#119 AC1/AC9 — the LIGHT skin is byte-stable (role tokens = the literals they replace)", () => {
  // The seam introduces role tokens; for the default render to be visually unchanged, each light
  // value must equal the exact pre-change literal (docs spec §9). A drift here is high-severity.
  const expected: Record<string, string> = {
    "--color-ink-plus": "#2c2c2c", // = old --color-ink
    "--color-ink-plus-2": "#595959", // = old --color-ink2
    "--color-ink-plus-muted": "#717171", // = old --color-muted
    "--color-surface": "#f7f7f7", // = old --color-body-grey (the Topic/body field)
    "--color-surface-2": "#f0f1f3", // = old --color-bg2
    "--color-surface-raised": "#ffffff", // the white hardbox card fill
    "--color-hardbox": "#2c2c2c", // = old --color-ink (the 2px border)
    "--color-hardbox-offset": "#2c2c2c", // = old --color-ink (the solid offset)
    "--color-ink-article": "#2c2c2c", // faithful Wikipedia body ink
    "--article-bg": "#ffffff",
    "--article-ink-strong": "#1b1b1b",
    "--article-link": "#3366cc", // = old --color-wikilink
    "--article-rule": "#a2a9b1", // = old --color-wikirule
    "--article-th-bg": "#eaecf0",
    "--article-box-bg": "#f8f9fa",
    "--color-accent-brand": "#676eb4", // = old --color-brand
    "--color-accent-brand-fill": "#676eb4", // the indigo FILL keeps the brand hex on BOTH skins
    "--color-accent-sprout": "#2a8270",
    "--color-accent-action": "#1f6f95",
    "--color-accent-violet": "#5248af",
    "--color-accent-red": "#b0353b",
    "--color-focus-ring": "#676eb4",
  };
  for (const [token, value] of Object.entries(expected)) {
    it(`light ${token} resolves to ${value}`, () => {
      expect(tokenValue(lightBlock, token)).toBe(value);
    });
  }

  it("the candidate hatch stripe is the original 44,44,44 ink at 0.10 alpha on the light skin", () => {
    expect(tokenValue(lightBlock, "--candthumb-stripe")).toBe("rgba(44, 44, 44, 0.1)");
  });
});

describe("#119 AC2/AC5 — the [data-skin='zine-dark'] block defines the spec dark tokens (exact hexes)", () => {
  const expected: Record<string, string> = {
    // §4.1 surfaces
    "--color-surface": "#16161d",
    "--color-surface-2": "#1e1e27",
    "--color-surface-raised": "#22222c",
    // §4.2 light-ink hardbox + near-black offset
    "--color-ink-plus": "#eceaf1",
    "--color-ink-plus-2": "#c5c3ce",
    "--color-ink-plus-muted": "#9a98a6",
    "--color-hardbox": "#eceaf1",
    "--color-hardbox-offset": "#0b0b10",
    // §4.3 lifted accents (text/glyph) + the fill kept at the brand hex
    "--color-accent-brand": "#9097d8",
    "--color-accent-brand-fill": "#676eb4",
    "--color-accent-sprout": "#3fb39a",
    "--color-accent-action": "#4fa6ce",
    "--color-accent-violet": "#7e76c9",
    "--color-accent-red": "#e0696e",
    "--color-focus-ring": "#9097d8",
    // §5 faithful dark Wikipedia article palette
    "--color-ink-article": "#e8e6e3",
    "--article-bg": "#101418",
    "--article-ink-strong": "#f8f9fa",
    "--article-link": "#6ea8ff",
    "--article-rule": "#54595d",
    "--article-th-bg": "#27292d",
    "--article-box-bg": "#1b1f23",
  };
  for (const [token, value] of Object.entries(expected)) {
    it(`dark ${token} = ${value}`, () => {
      expect(tokenValue(darkBlock, token)).toBe(value);
    });
  }

  it("re-points --color-body-grey + --color-content-white to flat dark so the illum falloff resolves flat (§6)", () => {
    expect(tokenValue(darkBlock, "--color-body-grey")).toBe("#16161d");
    expect(tokenValue(darkBlock, "--color-content-white")).toBe("#16161d");
  });

  it("flips the candidate hatch stripe to a LIGHT ink so the hatch reads on dark (§7.1)", () => {
    expect(tokenValue(darkBlock, "--candthumb-stripe")).toBe("rgba(236, 234, 241, 0.1)");
  });

  it("hides the lit/beam header layers and keeps the flat Tier-C lockup under the dark scope (§6)", () => {
    expect(css).toMatch(
      /\[data-skin="zine-dark"\] \.header-shared \.projector-beamfade,\s*\[data-skin="zine-dark"\] \.header-shared \.projector-litlockup\s*\{\s*display:\s*none/
    );
    expect(css).toMatch(
      /\[data-skin="zine-dark"\] \.header-shared \.projector-flatlockup\s*\{\s*opacity:\s*1/
    );
  });

  it("suppresses the recovered per-taxon inline band colours to the faithful grey on dark (§5)", () => {
    expect(css).toMatch(
      /\[data-skin="zine-dark"\] \.wiki-body table\.infobox th\[colspan\]\[style\][\s\S]*?background:\s*var\(--article-th-bg\)\s*!important/
    );
  });
});

describe("#119 AC5 — WCAG AA contrast holds on the dark skin (recomputed, not asserted from the spec)", () => {
  function lin(c: number): number {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }
  function lum(hex: string): number {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  function ratio(a: string, b: string): number {
    const la = lum(a);
    const lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  // [fg, bg, bar, label]. Body/heading/link/accent text → 4.5:1; the white-on-indigo fill and the
  // focus ring → the AA-large/non-text 3:1 bar (the committed exemption, spec §4.3).
  const cases: [string, string, number, string][] = [
    ["#eceaf1", "#16161d", 4.5, "ink-plus on surface"],
    ["#eceaf1", "#22222c", 4.5, "ink-plus on surface-raised"],
    ["#c5c3ce", "#22222c", 4.5, "ink-plus-2 on surface-raised"],
    ["#9a98a6", "#22222c", 4.5, "ink-plus-muted on surface-raised"],
    ["#9097d8", "#16161d", 4.5, "accent-brand text on surface"],
    ["#3fb39a", "#16161d", 4.5, "accent-sprout text on surface"],
    ["#4fa6ce", "#16161d", 4.5, "accent-action text on surface"],
    ["#e0696e", "#16161d", 4.5, "accent-red text on surface"],
    ["#9097d8", "#16161d", 3.0, "focus ring on surface (3px non-text)"],
    ["#ffffff", "#676eb4", 3.0, "white on indigo FILL (AA-large exemption)"],
    ["#e8e6e3", "#101418", 4.5, "article body ink on article-bg"],
    ["#f8f9fa", "#101418", 4.5, "article heading on article-bg"],
    ["#6ea8ff", "#101418", 4.5, "article wikilink on article-bg"],
    ["#a2a9b1", "#1b1f23", 4.5, "article muted on box-bg"],
    // Chip pattern B — JS-literal fills (lib/curation/labels.ts), white text, unchanged on dark.
    ["#ffffff", "#5248af", 4.5, "white on stance-violet chip"],
    ["#ffffff", "#1f6757", 4.5, "white on accurate teal-dk chip"],
    ["#ffffff", "#1f6f95", 4.5, "white on action chip"],
    ["#ffffff", "#b0353b", 4.5, "white on opinion-red chip"],
  ];
  for (const [fg, bg, bar, label] of cases) {
    it(`${label} ≥ ${bar}:1`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(bar);
    });
  }
});

describe("#119 AC3/AC10 — the skin seam in layout.tsx (allowlisted, no injection)", () => {
  it("sets data-skin via setAttribute (the DOM API), never by writing the cookie into markup", () => {
    expect(layout).toMatch(/setAttribute\("data-skin",\s*s\)/);
  });

  it("only activates a NON-default skin — the light shell ('' / 'zine') leaves <html> untouched", () => {
    // The guard `s && s !== "zine"` is what keeps the cached, skin-agnostic shell byte-identical on
    // the default skin (#9 / read-path constraint).
    expect(layout).toMatch(/if\s*\(\s*s\s*&&\s*s\s*!==\s*"zine"\s*\)/);
  });

  it("does NOT bake data-skin into the SSR markup (read-path: the cached shell stays skin-agnostic)", () => {
    // The <html> element must carry no server-rendered data-skin attribute — the attribute is set by
    // the pre-paint script only, so the same cached HTML serves every skin.
    expect(layout).not.toMatch(/<html[^>]*data-skin/);
  });

  it("interpolates ONLY the build-time env default via JSON.stringify (no raw cookie in the script)", () => {
    // The cookie value `s` is read at runtime by the browser and only ever passed to setAttribute;
    // it is never string-concatenated into the inline <script> source. The single interpolation is
    // the env default, JSON-encoded.
    expect(layout).toMatch(/\$\{JSON\.stringify\(\s*DEFAULT_SKIN\s*\)\}/);
    expect(layout).toMatch(/DEFAULT_SKIN = process\.env\.WIKIPLUS_SKIN/);
  });
});

describe("#119 AC4 — no literal light-on-light leak utilities remain in the routed surfaces", () => {
  // Independent grep of the shipped component/page sources: a stray bg-white / bare text-ink /
  // border-ink utility would not theme (it is not token-backed), leaving a white surface on the dark
  // skin. The author's swap should have replaced them all with the token-backed classes.
  it("the working tree has no bg-white / border-ink / bare text-ink in the SKINNED surfaces", async () => {
    const { globSync } = await import("node:fs");
    const files = [
      ...globSync("app/**/*.tsx", { cwd: process.cwd() }),
      ...globSync("components/**/*.tsx", { cwd: process.cwd() }),
    ];
    // The /about projector-theater centerpiece is the ONE documented exemption (spec §7.1): fixed
    // warm-theater art on a light warm card, deliberately NOT skinned (its --color-ink / --color-card
    // tokens are intentionally left un-re-pointed by the dark skin so the warm scene stays faithful).
    // So a `text-ink` there is correct, not a leak — exclude the exempt centerpiece component dir.
    const exempt = /^components\/about\//;
    const offenders: string[] = [];
    const leak = /\b(bg-white|border-ink(?![-\w])|text-ink(?![-\w]))\b/;
    for (const rel of files) {
      if (exempt.test(rel)) continue;
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      src.split("\n").forEach((line, i) => {
        if (leak.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
