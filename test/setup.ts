import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});
