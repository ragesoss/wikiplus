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
// `generateStaticParams` pre-renders the seeded topics, so a hard navigation / refresh
// to those resolves directly from a built HTML file. For ARBITRARY (unseeded) titles,
// the static export has no pre-built page, so GitHub Pages serves `404.html` — which the
// deploy step makes a copy of this same SPA shell; the client router then reads the
// title from `location.pathname` and renders. In-app `<Link>` navigation never reloads.
export function generateStaticParams(): { slug?: string[] }[] {
  // The bare `/topic` shell (slug omitted) + one pre-built page per seeded title.
  return [{ slug: [] }, ...staticTopicParams()];
}

// Static export: only the params above are emitted; arbitrary titles fall through to
// the 404.html SPA fallback rather than being generated, which is what we want.
export const dynamicParams = false;

export default function TopicPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink/50">Loading…</p>}>
      <TopicView />
    </Suspense>
  );
}
