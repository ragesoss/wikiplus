"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ClipCard } from "@/components/ClipCard";
import { store } from "@/lib/data";
import type { Clip, Topic } from "@/lib/data/types";
import {
  fetchArticleSummary,
  qidToTitle,
  type ArticleSummary,
} from "@/lib/wiki/article";

export function TopicView() {
  const qid = useSearchParams().get("qid");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [article, setArticle] = useState<ArticleSummary | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!qid) return;
    let alive = true;
    (async () => {
      try {
        const t = await store.getTopic(qid);
        if (alive) setTopic(t);
        if (alive) setClips(await store.listClips(qid));

        // QID is the canonical key — resolve the article title from Wikidata.
        const title = (await qidToTitle(qid)) ?? t?.title ?? null;
        if (!title) {
          if (alive) setError("No Wikipedia article found for this QID.");
          return;
        }
        const a = await fetchArticleSummary(title);
        if (!alive) return;
        setArticle(a);
        if (!t || t.title !== title) {
          await store.upsertTopic({ qid, title, description: a.description });
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [qid]);

  if (!qid) {
    return (
      <p className="text-sm text-ink/50">
        Missing topic id.{" "}
        <Link href="/" className="text-action underline">
          Back home
        </Link>
      </p>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <section>
        <h1 className="text-2xl font-semibold text-ink">
          {article?.title ?? topic?.title ?? qid}
        </h1>
        {article?.description && (
          <p className="mt-1 text-sm text-ink/60">{article.description}</p>
        )}
        {error && (
          <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {article ? (
          <div
            className="article-html mt-4 text-ink"
            dangerouslySetInnerHTML={{ __html: article.extractHtml }}
          />
        ) : !error ? (
          <p className="mt-4 text-sm text-ink/50">Loading article…</p>
        ) : null}
        {article && (
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm text-action underline"
          >
            Read the full article on Wikipedia ↗
          </a>
        )}
        <p className="mt-2 text-xs text-ink/40">
          Article text from Wikipedia, licensed CC BY-SA.
        </p>
      </section>

      <aside className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Curated clips</h2>
          <Link
            href={`/contribute?qid=${encodeURIComponent(qid)}`}
            className="text-sm text-action hover:underline"
          >
            + Add
          </Link>
        </div>
        {clips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
            No clips yet.{" "}
            <Link
              href={`/contribute?qid=${encodeURIComponent(qid)}`}
              className="text-action underline"
            >
              Add the first one.
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {clips.map((c) => (
              <ClipCard key={c.id} clip={c} />
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
