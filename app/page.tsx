"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { store } from "@/lib/data";
import type { Topic } from "@/lib/data/types";
import { topicHref } from "@/lib/wiki/topicRoute";
import { TopicSearch } from "@/components/search/TopicSearch";
import { AuthControl } from "@/components/auth/AuthControl";
import { HeaderProjector } from "@/components/wordmark/HeaderProjector";

// The landing page (#15) — the product's FRONT DOOR. A single centered column (design §2):
//   Daylight Projector header (Tier A) → "Find a topic" search (the dominant focus, AC1) →
//   the concise VISION-sourced explanation (AC6) → a quiet rule → the DEMOTED topic list under
//   "Explore example topics" (AC7, all four states preserved).
// The search is REUSED unforked (one TopicSearch import, variant="home" — AC2). The projector
// owns its responsive tier degradation (Tier A ≥ lg / B md / C < md, design §7) via CSS media
// queries — SSR-safe. See docs/specs/landing-page.md + docs/design/landing-page.md.

export default function HomePage() {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  // Read-error floor (design §6.1): a server read can fail (DB down) — show an honest line
  // rather than hang on "Loading…" forever. Preserved verbatim from the prior page (AC7).
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Seeded topics come from shared storage (the DB seed) — no per-browser seedIfEmpty.
        const list = await store.listTopics();
        if (alive) setTopics(list);
      } catch {
        if (alive) setLoadError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main>
      {/* Visually-hidden top-level heading so the document has an <h1> for landmarks WITHOUT
          adding visible prose above the search (design §2 / OQ-3). The visible "Find a topic"
          label remains the hero's heading. */}
      <h1 className="sr-only">wiki+</h1>

      {/* ── The Daylight Projector header (full-bleed so the gold border runs off both real
          page edges — VISUAL_IDENTITY §6.3 / design §4.5). The header chrome (Contribute +
          AuthControl) sits at the right, kept as today.
          - ≥ lg (Tier A): the band is tall, so the chrome is ABSOLUTELY positioned in the cool
            fluorescent field, top-right, beside the projector (no collision with the beam).
          - < lg (Tier B/C): the band is short, so the chrome flows on the SAME ROW as the
            (left-aligned) lockup — a normal header bar — never overlapping the wordmark. ── */}
      <div className="relative">
        <HeaderProjector variant="projector" />
        {/* ≥ lg (Tier A): the tall fluorescent band has room for the chrome ABSOLUTELY placed
            top-right, beside the projector (clear of the centered beam). */}
        <div className="absolute right-0 top-0 z-10 hidden items-center gap-4 px-4 py-3 lg:flex">
          <Link href="/contribute" className="text-sm text-action hover:underline">
            Contribute
          </Link>
          <AuthControl variant="home" />
        </div>
      </div>
      {/* < lg (Tier B/C): the short band can't safely host the chrome over the lockup at narrow
          widths, so the chrome FLOWS on its own header row directly under the lockup (right-
          aligned), on the same cool fluorescent field — one continuous header, never overlapping
          the wordmark, and the search below is never pushed off-screen. */}
      <div className="flex items-center justify-end gap-3 bg-[var(--color-header-field)] px-4 pb-3 lg:hidden">
        <Link href="/contribute" className="text-sm text-action hover:underline">
          Contribute
        </Link>
        <AuthControl variant="home" />
      </div>

      {/* ── The hero — paints --content-white so the beam's burn-to-white resolves into it
          (design §4.4). The search is the dominant, full-width focus (AC1); the explanation
          sits directly under it (AC6). ── */}
      <div className="bg-[var(--color-content-white)]">
        <div className="mx-auto max-w-[640px] px-4 pb-10 pt-2 lg:pt-0">
          <TopicSearch variant="home" />
          <p className="mt-4 max-w-[60ch] text-center text-[0.95rem] text-ink2">
            <span className="font-medium text-ink">
              wiki+ is a curation and contextualization layer over Wikipedia.
            </span>{" "}
            It attaches creator-made videos to the topics you read about — each with a
            human-written note that separates the facts from the creator&apos;s opinion.
          </p>
        </div>
      </div>

      {/* ── The DEMOTED topic list (AC7) — secondary "explore" content below a quiet rule. The
          data path (store.listTopics) and all four states are unchanged; only prominence and
          framing change. The page sits on the body's #F7F7F7 from here down. ── */}
      <section className="mx-auto max-w-5xl border-t border-ink/10 px-4 pb-12 pt-8">
        <h2 className="text-lg font-medium text-ink">Explore example topics</h2>
        <p className="mt-1 text-xs text-ink/50">
          (Prototype: curations are shared — everyone sees the same topics and clips.)
        </p>

        <div className="mt-4">
          {loadError ? (
            <p className="text-sm text-ink/50">Couldn&apos;t load topics — please refresh.</p>
          ) : topics === null ? (
            <p className="text-sm text-ink/50">Loading…</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-ink/50">No topics yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {topics.map((t) => (
                <li key={t.qid}>
                  <Link
                    href={topicHref(t.title)}
                    className="block rounded-xl border border-ink/10 bg-white p-4 shadow-sm transition hover:border-brand/40"
                  >
                    <span className="block font-medium text-ink">{t.title}</span>
                    {t.description && (
                      <span className="mt-1 block text-sm text-ink/60">
                        {t.description}
                      </span>
                    )}
                    <span className="mt-2 block text-xs text-brand">{t.qid}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
