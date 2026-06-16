/** @type {import('next').NextConfig} */

// basePath: KEPT, env-driven. Empty for local dev / `next start` at the root; a
// future host (issue A.2) sets `NEXT_PUBLIC_BASE_PATH` if it serves under a subpath.
// Kept so the routing/href helpers (lib/wiki/topicRoute.ts) keep one knob to honor.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  // Node SSR server (issue #37): `next build` produces a server build; `next start`
  // serves it, rendering unknown Topic titles on demand. No more `output: 'export'`
  // (which forced the `dynamicParams = false` + `404.html`-as-SPA-shell workaround and
  // could not run Server Actions). The production read-path (ISR + Redis cacheHandler)
  // is still later work — see docs/ARCHITECTURE.md "Path to production".
  //
  // Export-only concessions, reassessed:
  //   - output: 'export'      → DROPPED. The whole point of this issue.
  //   - images.unoptimized    → KEPT. We use no next/image, and a plain Node `next start`
  //                             has no image-optimization infra wired up; leaving it true
  //                             is a harmless no-op now and the safe default until A.2.
  //   - trailingSlash: true   → KEPT. The canonical Topic URL is `/topic/<Title>/` (with
  //                             the slash) everywhere — topicHref, the seed params, the
  //                             #13 redirect target, the wikilink rewrite, and the e2e
  //                             URL assertions all bake it in. Dropping it would change the
  //                             reader-visible canonical URL (a parity regression), so it
  //                             stays — now enforced by the server's own redirect, not by
  //                             a static file living at `<route>/index.html`.
  //   - assetPrefix           → DROPPED as a separate setting. Under export it duplicated
  //                             basePath to absolute-prefix assets so the SPA shell could
  //                             boot from any path (incl. 404.html). With a real server
  //                             Next prefixes `_next/` assets from basePath itself; a
  //                             distinct assetPrefix is unneeded. (A future CDN/edge host
  //                             can reintroduce it in A.2 if it serves assets off-origin.)
  basePath,
  // Standalone server output (issue A.2 / #42). `next build` emits a self-contained
  // `.next/standalone/` tree — `server.js` plus only the `node_modules` actually traced as
  // used — so the runtime Docker image copies that (+ `.next/static` + `public`) and runs
  // `node server.js` WITHOUT a full `node_modules` or the Next CLI. This is what keeps the
  // runtime image tiny and lets the 1GB Nanode *run* the server while never *building* it
  // (the build happens in CI; the box only `docker compose pull`s — see deploy/ + the
  // rewritten .github/workflows/deploy.yml). Tracing relies on `outputFileTracingRoot`
  // (below) being correct. No behavior change for `yarn dev`/`yarn start`.
  output: "standalone",
  // Pin the workspace root (a stray lockfile in $HOME otherwise confuses inference). KEPT.
  // Doubly load-bearing now: `output:'standalone'` traces the dependency closure relative to
  // this root, so it must point at the app dir (set to import.meta.dirname).
  outputFileTracingRoot: import.meta.dirname,
  images: { unoptimized: true },
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
