import { Suspense } from "react";
import { TopicView } from "../TopicView";
import { staticTopicParams } from "@/lib/data/seed";

// Canonical Topic route is title-based: `/topic/<Title>`, paralleling Wikipedia's
// `/wiki/<Title>` (owner directive D1; AC5/AC23; ARCHITECTURE "Internal-link
// resolution"). The QID stays the internal key and never appears in the address bar.
//
// Routing mechanism (recorded in ARCHITECTURE "Prototype phase → routing"): an
// OPTIONAL catch-all so the one client SPA shell serves both forms:
//   - `/topic`           — slug undefined; the `?qid=` back-compat entry (TopicView
//                          resolves QID→title and replaces the URL with the canonical one).
//   - `/topic/<Title>/`  — the canonical title route.
//
// Under the Node SSR server (issue #37) this catch-all owns EVERY `/topic/...` path:
// a known/seeded title and an arbitrary never-seeded one alike are rendered on demand
// by the running server (`dynamicParams = true`). The old static export needed
// `dynamicParams = false` + a `404.html`-as-SPA-shell trick for unseeded titles; with a
// server that trick is gone — an unknown `/topic/<Title>/` is just served here, then
// `TopicView` resolves it client-side exactly as before (the server never talks to
// Wikipedia; title→QID, the article body, and candidate search stay client-side).
export function generateStaticParams(): { slug?: string[] }[] {
  // Still earns its keep: pre-render the bare `/topic` shell (slug omitted) + one page
  // per seeded title at build time, so the common reader paths are warm without waiting
  // on an on-demand render. With `dynamicParams = true`, any title NOT listed here is
  // simply rendered on demand instead of 404'd — no exhaustive list required.
  return [{ slug: [] }, ...staticTopicParams()];
}

// Node SSR: titles not in generateStaticParams are rendered on demand by the running
// server (no more `dynamicParams = false`, no 404.html fallback). Default is `true`,
// but we set it explicitly to document the deliberate switch away from the export
// constraint.
export const dynamicParams = true;

export default function TopicPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-plus/50">Loading…</p>}>
      <TopicView />
    </Suspense>
  );
}
