"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { store } from "@/lib/data";
import type { Topic } from "@/lib/data/types";
import { topicHref } from "@/lib/wiki/topicRoute";
import { TopicSearch } from "@/components/search/TopicSearch";
import { AuthControl } from "@/components/auth/AuthControl";

export default function HomePage() {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  // Read-error floor (design §"read failure"): a server read can now fail (DB down) — show
  // an honest line rather than hang on "Loading…" forever. localStorage never failed.
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // The seeded topics now come from shared Postgres (the DB seed) — no per-browser
        // seedIfEmpty. Every visitor sees the same seeded list + anyone's curated topics.
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
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="space-y-4 border-b border-ink/10 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-lg font-semibold text-brand">
            wiki<span className="text-sprout">+</span>
          </Link>
          {/* Top row right end: Contribute link + the sign-in affordance (design §1b). */}
          <div className="flex items-center gap-4">
            <Link
              href="/contribute"
              className="text-sm text-action hover:underline"
            >
              Contribute
            </Link>
            <AuthControl variant="home" />
          </div>
        </div>
        {/* Always-visible, full-width topic search — the primary entry (#12, design
            §Placement Host 1: the must-ship floor; never collapses to an icon on home). */}
        <TopicSearch variant="home" />
      </header>
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">Topics</h1>
        <p className="max-w-2xl text-sm text-ink/70">
          A curation layer over Wikipedia — each topic pairs the article with
          curated, contextualized clips.{" "}
          <span className="text-ink/50">
            (Prototype: curations are shared — everyone sees the same topics and
            clips.)
          </span>
        </p>
      </section>

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
    </main>
  );
}
