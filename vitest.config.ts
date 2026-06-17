import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Unit + component tests run in jsdom with the wiki fetch MOCKED (the sandbox has
// no network egress to the live MediaWiki API). E2E lives under e2e/ and runs via
// Playwright (`yarn test:e2e`) — excluded here.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // next-auth imports `next/server` as a bare specifier; under vitest's resolver that
      // resolves to the package dir, not the file. Map it to the file so importing the
      // Server Actions boundary (which now imports the Auth.js config) loads in tests.
      "next/server": fileURLToPath(
        new URL("./node_modules/next/server.js", import.meta.url)
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    css: false,
    server: {
      deps: {
        // Inline next-auth + @auth/core so vitest's resolver (and the `next/server` alias
        // above) applies to their imports — externalized, next-auth's bare `next/server`
        // import resolves to the package dir instead of the file under vitest.
        inline: ["next-auth", "@auth/core"],
      },
    },
  },
});
