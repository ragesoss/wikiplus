import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// `server-only` (issue #45) throws if imported outside a React Server Component build. Our
// server modules (lib/db/client.ts) import it as a build-time guard with NO runtime behavior;
// stub it to a no-op so the DrizzleDataStore contract test (pglite) can import the store under
// vitest's node environment. The real build still enforces server-only — this is test-only.
vi.mock("server-only", () => ({}));

// next-auth/react (issue C). The auth client hooks require a <SessionProvider> at runtime;
// rather than wrap every existing component test, stub the client surface here:
//   - `useSession` defaults to an AUTHENTICATED stub user — this preserves the pre-C behavior
//     the existing component tests encode (the prototype rendered as the always-signed-in
//     "@sage" curator, so Curate / Add / dismiss ran). Tests that need the logged-out gate can
//     override `useSession` per-test. The SERVER-side gate (AC7/AC8) is verified separately in
//     test/auth-boundary.test.ts by mocking lib/auth/config's `auth()`, independent of this.
//   - `signIn`/`signOut` are no-op spies (no real OAuth navigation in jsdom — AC13).
//   - `SessionProvider` is a passthrough.
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { contributorId: 1, username: "TestCurator" } },
    status: "authenticated",
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

// Guard the jsdom-only shims so this shared setup also runs cleanly under the `node`
// environment (the pglite DrizzleDataStore test sets `// @vitest-environment node`).
if (typeof window !== "undefined") {
  // jsdom lacks matchMedia; default to "no reduced-motion preference" so components
  // that read prefers-reduced-motion don't throw. Individual tests can override.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  // jsdom doesn't implement scrollTo / scrollIntoView; stub so goTo/sync don't throw.
  window.scrollTo = window.scrollTo || (vi.fn() as unknown as typeof window.scrollTo);
  Element.prototype.scrollIntoView =
    Element.prototype.scrollIntoView || (vi.fn() as unknown as () => void);
  Element.prototype.scrollTo =
    Element.prototype.scrollTo || (vi.fn() as unknown as Element["scrollTo"]);
}

afterEach(() => {
  cleanup();
  if (typeof window !== "undefined") window.localStorage.clear();
  vi.restoreAllMocks();
});
