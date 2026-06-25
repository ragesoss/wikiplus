import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Acceptance checks for issue #156 — the dark-mode cleanup pass (docs/design/dark-mode-cleanup.md).
// Like the #119 skin QA suite, these gate the SOURCE OF TRUTH (app/globals.css) offline and
// deterministically: the full rendered surfaces are covered by the Playwright screenshot harness
// (scenes home / home-header / about / topic-loading on both skins). Here we assert the four
// scoped dark-skin treatments exist and — critically — that the LIGHT skin is byte-stable (every
// fix is dark-scoped or routed through a token whose light value equals the literal it replaced).

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
const projector = readFileSync(
  resolve(process.cwd(), "components/wordmark/HeaderProjector.tsx"),
  "utf8"
);
const catalog = readFileSync(
  resolve(process.cwd(), "e2e/screenshots/catalog.ts"),
  "utf8"
);

/** Pull the value of a `--token: value;` declaration from a CSS substring. */
function tokenValue(scope: string, token: string): string | undefined {
  const m = scope.match(new RegExp(`${token}\\s*:\\s*([^;]+);`));
  return m?.[1].trim();
}

/** The top-level `[data-skin="zine-dark"] { … }` declaration block. */
const darkBlock = (() => {
  const start = css.indexOf('[data-skin="zine-dark"] {');
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open, close);
})();

// ── §3 Home header reads clearly "off" ────────────────────────────────────────────────────────
describe("#156 §3 — the home header presents the flat 'off' lockup on zine-dark (no beam)", () => {
  it("flips the Tier-A block off on the non-.header-shared home projector under the dark scope", () => {
    // The home host is a `.header-projector` that is NOT inside `.header-shared`. The fix reuses the
    // committed forced-colors fallback path: hide .tier-a (which carries the beam, the lit-aperture
    // glow, AND the burn-bg slab) and reveal the always-shipped flat Tier-C lockup.
    expect(css).toMatch(
      /\[data-skin="zine-dark"\] \.header-projector:not\(\.header-shared \.header-projector\) \.tier-a\s*\{\s*display:\s*none/
    );
    expect(css).toMatch(
      /\[data-skin="zine-dark"\] \.header-projector:not\(\.header-shared \.header-projector\) \.tier-c\s*\{\s*display:\s*block/
    );
  });

  it("re-points --projector-burn-bg to the flat dark band so no white slab can paint below the burn line", () => {
    expect(tokenValue(darkBlock, "--projector-burn-bg")).toBe("#1e1e27");
  });

  it("does NOT change the home projector component (no DOM/logic edit — the flat Tier-C lockup already ships)", () => {
    // The Tier-C wrapper exists in the component and renders the FLAT (unlit) lockup; the dark fix is
    // a pure CSS visibility flip, so the component still renders the lit Tier-A on home with no class
    // hook added for this issue. (Guards the §2.2 isolation invariant for the home beam path.)
    expect(projector).toMatch(/className="tier-c [^"]*"/);
    expect(projector).toMatch(/<Lockup lit=\{false\} uid=\{`\$\{uid\}-c`\}/);
  });
});

// ── §4.2 /about centerpiece insulation ─────────────────────────────────────────────────────────
describe("#156 §4.2 — the /about centerpiece's intentional whites are restored under the theater scope", () => {
  it("re-asserts --color-content-white: #ffffff scoped to [data-skin='zine-dark'] .about-theater-field", () => {
    expect(css).toMatch(
      /\[data-skin="zine-dark"\] \.about-theater-field\s*\{[^}]*--color-content-white:\s*#ffffff/
    );
  });

  it("leaves the TOP-LEVEL dark --color-content-white flattened to #16161d (the header falloff still flattens)", () => {
    // The insulation is scoped to the theater ONLY; the global re-point that flattens the header's
    // burn-to-white falloff to the dark page must stay (#119 §6). A leak of #ffffff here would
    // re-light the header falloff.
    expect(tokenValue(darkBlock, "--color-content-white")).toBe("#16161d");
  });

  it("does NOT re-point the off-state aperture / theater tokens (the off '+' keeps its by-geometry read)", () => {
    // The off lens reads --color-aperture-off / --color-lens-off-* and the field reads --color-theater-*;
    // none of these are re-pointed under the dark scope (they need no value per §4.2).
    expect(tokenValue(darkBlock, "--color-aperture-off")).toBeUndefined();
    expect(tokenValue(darkBlock, "--color-lens-off-interior")).toBeUndefined();
    expect(tokenValue(darkBlock, "--color-theater-1")).toBeUndefined();
  });
});

// ── §4.3 the mini-preview title input ──────────────────────────────────────────────────────────
describe("#156 §4.3 — the /about title input reads a token, not a hardcoded #000", () => {
  /** The `.about-title-input { … }` rule block. */
  const inputBlock = (() => {
    const start = css.indexOf(".about-title-input {");
    const open = css.indexOf("{", start);
    const close = css.indexOf("}", open);
    return css.slice(open, close);
  })();

  it("routes the input color through a token whose light value is #000 (exact-preserving)", () => {
    expect(tokenValue(inputBlock, "--about-title-ink")).toBe("#000");
    expect(inputBlock).toMatch(/color:\s*var\(--about-title-ink\)/);
    // The literal #000 color declaration is gone (it now lives only as the token's default value).
    expect(inputBlock).not.toMatch(/color:\s*#000\s*;/);
  });

  it("routes the title-block focus ring to --color-focus-ring (light value = brand indigo, so light is unchanged)", () => {
    expect(css).toMatch(
      /\.about-title-block:has\(\.about-title-input:focus-visible\)\s*\{[^}]*outline:\s*3px solid var\(--color-focus-ring\)/
    );
  });
});

// ── §5 the article loading sweep ────────────────────────────────────────────────────────────────
describe("#156 §5 — the loading sweep is recolored to a cool light-ink wash on dark, keyframe/timing intact", () => {
  /** The base `.projector-scan { … }` rule block (the light token defaults). */
  const scanBlock = (() => {
    const start = css.indexOf(".projector-scan {");
    const open = css.indexOf("{", start);
    const close = css.indexOf("}", open);
    return css.slice(open, close);
  })();

  it("the light defaults keep the daylight golds verbatim (byte-stable light skin)", () => {
    expect(tokenValue(scanBlock, "--scan-edge")).toBe("rgb(238 206 135 / 0.42)");
    expect(tokenValue(scanBlock, "--scan-crest")).toBe("rgb(255 252 246 / 0.65)");
  });

  it("the gradient reads the tokens (one declaration, recolored per skin)", () => {
    expect(css).toMatch(
      /\.projector-scan::before\s*\{[\s\S]*?var\(--scan-edge\)[\s\S]*?var\(--scan-crest\)[\s\S]*?var\(--scan-edge\)/
    );
  });

  it("the dark skin re-points the scan tokens to the cool light-ink wash (no gold)", () => {
    expect(css).toMatch(
      /\[data-skin="zine-dark"\] \.projector-scan\s*\{[^}]*--scan-edge:\s*rgb\(236 234 241 \/ 0\.1\)[^}]*--scan-crest:\s*rgb\(236 234 241 \/ 0\.18\)/
    );
    expect(css).toMatch(
      /\[data-skin="zine-dark"\] \.projector-scan-plus\s*\{[^}]*--scan-crest:\s*rgb\(236 234 241 \/ 0\.24\)/
    );
    // No daylight gold survives in the dark scan re-point.
    expect(css).not.toMatch(
      /\[data-skin="zine-dark"\] \.projector-scan[^{]*\{[^}]*238 206 135/
    );
  });

  it("keeps the keyframe, 1.8s timing, screen blend, blur, and the reduced-motion static band untouched", () => {
    expect(css).toMatch(/animation:\s*wikiplus-projector-scan 1\.8s ease-in-out infinite/);
    expect(css).toMatch(/\.projector-scan::before\s*\{[\s\S]*?mix-blend-mode:\s*screen/);
    expect(css).toMatch(/\.projector-scan::before\s*\{[\s\S]*?filter:\s*blur\(8px\)/);
    // The reduced-motion fallback still kills the animation and centers a static band.
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.projector-scan::before\s*\{\s*animation:\s*none;\s*left:\s*50%/
    );
  });
});

// ── §7.6 catalog cells ─────────────────────────────────────────────────────────────────────────
describe("#156 §7.6 — the touched scenes carry a zine-dark capture cell", () => {
  it("home-header opts into both skins", () => {
    expect(catalog).toMatch(
      /id:\s*"home-header",\s*\n\s*skins:\s*\["light",\s*"zine-dark"\]/
    );
  });

  it("topic-loading opts into both skins", () => {
    expect(catalog).toMatch(
      /id:\s*"topic-loading",\s*\n\s*skins:\s*\["light",\s*"zine-dark"\]/
    );
  });
});
