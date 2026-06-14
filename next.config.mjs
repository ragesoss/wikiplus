/** @type {import('next').NextConfig} */

// Empty for local dev; the GitHub Pages workflow sets it to "/<repo>" so assets
// and routing resolve under the project subpath.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  // Static SPA export — deployable to GitHub Pages, no server. The production
  // build later drops this to add ISR + Server Actions (see docs/ARCHITECTURE.md).
  output: "export",
  // Pin the workspace root (a stray lockfile in $HOME otherwise confuses inference).
  outputFileTracingRoot: import.meta.dirname,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
