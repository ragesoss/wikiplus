"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { store, seedIfEmpty } from "@/lib/data";
import type { Topic } from "@/lib/data/types";
import { topicHref } from "@/lib/wiki/topicRoute";

export default function HomePage() {
  const [topics, setTopics] = useState<Topic[] | null>(null);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      setTopics(await store.listTopics());
    })();
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between border-b border-ink/10 pb-3">
        <Link href="/" className="text-lg font-semibold text-brand">
          wiki<span className="text-sprout">+</span>
        </Link>
        <Link href="/contribute" className="text-sm text-action hover:underline">
          Contribute
        </Link>
      </header>
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">Topics</h1>
        <p className="max-w-2xl text-sm text-ink/70">
          A curation layer over Wikipedia — each topic pairs the article with
          curated, contextualized clips.{" "}
          <span className="text-ink/50">
            (Prototype: data lives in your browser&apos;s local storage.)
          </span>
        </p>
      </section>

      {topics === null ? (
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
