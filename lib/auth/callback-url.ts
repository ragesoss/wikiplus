// The OAuth return target (issue C, design §3): after authorizing at en.wikipedia.org the
// user lands back on THIS page. We read the live path+query from `window.location` at CLICK
// time rather than via `useSearchParams()` at render — that keeps the statically-prerendered
// home page (`/`) free of a Suspense/CSR-bailout (Next.js forces `useSearchParams` consumers
// into a Suspense boundary on a prerendered route), and it captures the exact current URL
// (e.g. `/contribute?qid=Q…`) so the QID is preserved across login (§2a).
export function currentCallbackUrl(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}
