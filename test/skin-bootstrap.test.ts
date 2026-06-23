import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Skin pre-paint bootstrap tests (issue #143, spec §6.1/§6.2 — AC8/AC9/AC10/AC11). The bootstrap is
// the load-bearing piece: it resolves the skin ENTIRELY in the browser before first paint, so the SSR
// shell stays skin-agnostic (no `data-skin` in server markup) and the cache is never fragmented by
// skin. These extract the actual `SKIN_BOOTSTRAP` script string from app/layout.tsx and EXECUTE it
// against a controlled fake document/window, asserting the resolution order:
//   explicit cookie → (logged-in DB pref, already mirrored into the cookie) → OS prefers-color-scheme
//   → light default. An explicit cookie ALWAYS overrides the OS signal.

const layoutSrc = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");

/** Pull the runtime IIFE body out of the `SKIN_BOOTSTRAP = \`…\`` template literal in the source. The
 *  build-time env interpolation `${JSON.stringify(DEFAULT_SKIN)}` is replaced with `""` (no env
 *  default), so the script is runnable standalone — exactly the deployed default-config behavior. */
function extractBootstrap(): string {
  const m = layoutSrc.match(/const SKIN_BOOTSTRAP = `([\s\S]*?)`;/);
  if (!m) throw new Error("SKIN_BOOTSTRAP template literal not found in app/layout.tsx");
  return m[1].replace("${JSON.stringify(\n  DEFAULT_SKIN\n)}", '""').replace(
    /\$\{JSON\.stringify\([\s\S]*?DEFAULT_SKIN[\s\S]*?\)\}/,
    '""'
  );
}

/** Run the bootstrap in a sandbox with a given cookie + OS dark preference, returning the resulting
 *  `data-skin` value (or null). Models the browser the pre-paint script runs in. */
function runBootstrap(opts: { cookie?: string; osDark?: boolean }): string | null {
  let attr: string | null = null;
  const fakeEl = {
    setAttribute: (name: string, value: string) => {
      if (name === "data-skin") attr = value;
    },
  };
  const sandbox = {
    document: { cookie: opts.cookie ?? "", documentElement: fakeEl },
    window: {
      matchMedia: (q: string) => ({
        matches: q.includes("dark") ? Boolean(opts.osDark) : false,
      }),
    },
  };
  // The script references bare `document` / `window`; run it with them as locals.
  const fn = new Function("document", "window", extractBootstrap());
  fn(sandbox.document, sandbox.window);
  return attr;
}

describe("SKIN_BOOTSTRAP — resolution order (spec §6.1/§6.2, AC11)", () => {
  it("no cookie + OS light → light (no data-skin set)", () => {
    expect(runBootstrap({ osDark: false })).toBeNull();
  });

  it("no cookie + OS dark → zine-dark (honors prefers-color-scheme, AC11)", () => {
    expect(runBootstrap({ osDark: true })).toBe("zine-dark");
  });

  it("explicit dark cookie → zine-dark", () => {
    expect(runBootstrap({ cookie: "wikiplus-skin=zine-dark", osDark: false })).toBe(
      "zine-dark"
    );
  });

  it("explicit LIGHT cookie ('zine') overrides an OS-dark device → light (no data-skin, AC11)", () => {
    // The explicit choice always beats the OS signal — the reader is never trapped in dark.
    expect(runBootstrap({ cookie: "wikiplus-skin=zine", osDark: true })).toBeNull();
  });

  it("explicit dark cookie wins even when the OS is light", () => {
    expect(runBootstrap({ cookie: "wikiplus-skin=zine-dark", osDark: false })).toBe(
      "zine-dark"
    );
  });

  it("an unrelated cookie present + OS dark still resolves via OS (no explicit skin cookie)", () => {
    expect(runBootstrap({ cookie: "other=1; another=x", osDark: true })).toBe(
      "zine-dark"
    );
  });
});

describe("SKIN_BOOTSTRAP — cache-agnostic SSR (AC9/AC10)", () => {
  it("the server-rendered <html> carries NO data-skin (resolution is browser-only)", () => {
    // The JSX <html lang="en"> must not gain a server-side data-skin attribute — the attribute is
    // ONLY ever set by the pre-paint script (setAttribute), so the same cached HTML serves every skin.
    expect(layoutSrc).not.toMatch(/<html[^>]*data-skin/);
    expect(layoutSrc).toMatch(/setAttribute\("data-skin"/);
  });

  it("resolves prefers-color-scheme via matchMedia in the script, never in server markup", () => {
    expect(layoutSrc).toMatch(/matchMedia\("\(prefers-color-scheme: dark\)"\)/);
  });

  it("keeps the #119 light-default branch intact (s !== 'zine' guards the cached light shell)", () => {
    expect(layoutSrc).toMatch(/if\s*\(\s*s\s*&&\s*s\s*!==\s*"zine"\s*\)/);
  });
});
