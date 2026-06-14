"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { store, seedIfEmpty } from "@/lib/data";
import type { Clip, Topic } from "@/lib/data/types";
import {
  fetchArticleSummary,
  fetchArticleBody,
  qidToTitle,
  titleToQid,
  type ArticleSummary,
  type ArticleBody,
} from "@/lib/wiki/article";
import { PlusInfobox } from "@/components/PlusInfobox";
import { TocCard, MiniToc } from "@/components/TableOfContents";
import { GeneralStrip } from "@/components/GeneralStrip";
import { ClipCardFull } from "@/components/ClipCardFull";
import { VideoSuggestions } from "@/components/VideoSuggestions";

export function TopicView() {
  const searchParams = useSearchParams();
  const qidParam = searchParams.get("qid");
  const titleParam = searchParams.get("title");

  const [qid, setQid] = useState<string | null>(qidParam);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [article, setArticle] = useState<ArticleSummary | null>(null);
  const [articleBody, setArticleBody] = useState<ArticleBody | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Refs for scroll sync
  const asideRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const artLock = useRef(false);
  const plusLock = useRef(false);
  const rafId = useRef<number>(0);

  // If only title param given, resolve QID first
  useEffect(() => {
    if (qidParam) {
      setQid(qidParam);
      return;
    }
    if (!titleParam) return;
    let alive = true;
    (async () => {
      const resolved = await titleToQid(titleParam);
      if (alive && resolved) setQid(resolved);
      else if (alive) {
        // Use title as a fallback — create a stub topic
        setQid(null);
        setError("Could not resolve Wikidata QID for this title.");
      }
    })();
    return () => { alive = false; };
  }, [qidParam, titleParam]);

  // Load topic data
  useEffect(() => {
    if (!qid) return;
    let alive = true;
    (async () => {
      try {
        await seedIfEmpty();
        const t = await store.getTopic(qid);
        if (alive) setTopic(t);
        if (alive) setClips(await store.listClips(qid));

        const resolvedTitle = (await qidToTitle(qid)) ?? t?.title ?? null;
        if (!resolvedTitle) {
          if (alive) setError("No Wikipedia article found for this QID.");
          return;
        }
        const [summary, body] = await Promise.all([
          fetchArticleSummary(resolvedTitle),
          fetchArticleBody(resolvedTitle),
        ]);
        if (!alive) return;
        setArticle(summary);
        setArticleBody(body);
        if (!t || t.title !== resolvedTitle) {
          await store.upsertTopic({ qid, title: resolvedTitle, description: summary.description });
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load.");
      }
    })();
    return () => { alive = false; };
  }, [qid]);

  // Derived: split clips into general (no sectionAnchor) and section-anchored
  const generalClips = clips.filter((c) => !c.sectionAnchor);
  const sectionedClips = clips.filter((c) => c.sectionAnchor);

  // Build clipsBySection map
  const clipsBySection: Record<string, Clip[]> = {};
  for (const clip of sectionedClips) {
    if (!clip.sectionAnchor) continue;
    if (!clipsBySection[clip.sectionAnchor]) {
      clipsBySection[clip.sectionAnchor] = [];
    }
    clipsBySection[clip.sectionAnchor].push(clip);
  }

  // sectionClipOrder: sections that have clips, in article order
  const sectionClipOrder = (articleBody?.sections ?? [])
    .filter((s) => (clipsBySection[s.id]?.length ?? 0) > 0)
    .map((s) => s.id);

  // Navigate article to a section (article scroll → rail sync)
  const goToSection = useCallback((sid: string) => {
    if (artLock.current) return;
    artLock.current = true;
    setActiveSectionId(sid);

    const heading = document.getElementById(`h-${sid}`);
    if (heading) {
      heading.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Scroll the rail card into view
    setTimeout(() => {
      const card = cardRefs.current[sid];
      if (card && asideRef.current) {
        plusLock.current = true;
        const aside = asideRef.current;
        const miniTocEl = aside.querySelector("[data-mini-toc]") as HTMLElement | null;
        const miniTocHeight = miniTocEl ? miniTocEl.offsetHeight : 0;
        aside.scrollTo({
          top: card.offsetTop - miniTocHeight - 8,
          behavior: "smooth",
        });
        setTimeout(() => { plusLock.current = false; }, 400);
      }
      artLock.current = false;
    }, 400);
  }, []);

  // Article scroll → find active section
  useEffect(() => {
    if (!articleBody || articleBody.sections.length === 0) return;

    function onScroll() {
      if (artLock.current) return;
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const OFFSET = 64 + 120; // header + reading threshold
        let found: string | null = null;
        const sections = articleBody?.sections ?? [];
        for (const sec of sections) {
          const el = document.getElementById(`h-${sec.id}`);
          if (!el) continue;
          const top = el.getBoundingClientRect().top;
          if (top <= OFFSET) {
            found = sec.id;
          }
        }
        if (found && found !== activeSectionId) {
          setActiveSectionId(found);

          // Sync rail
          if (!plusLock.current) {
            plusLock.current = true;
            const card = cardRefs.current[found];
            if (card && asideRef.current) {
              const aside = asideRef.current;
              const miniTocEl = aside.querySelector("[data-mini-toc]") as HTMLElement | null;
              const miniTocHeight = miniTocEl ? miniTocEl.offsetHeight : 0;
              aside.scrollTo({
                top: card.offsetTop - miniTocHeight - 8,
                behavior: "smooth",
              });
            }
            setTimeout(() => { plusLock.current = false; }, 400);
          }
        }
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId.current);
    };
  }, [articleBody, activeSectionId]);

  // Rail scroll → sync article
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside || !articleBody) return;

    function onRailScroll() {
      if (plusLock.current) return;

      const aside = asideRef.current;
      if (!aside) return;

      const asideCenter = aside.scrollTop + aside.clientHeight / 2;
      let nearest: string | null = null;
      let nearestDist = Infinity;

      for (const sid of sectionClipOrder) {
        const card = cardRefs.current[sid];
        if (!card) continue;
        const cardCenter = card.offsetTop + card.offsetHeight / 2;
        const dist = Math.abs(cardCenter - asideCenter);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = sid;
        }
      }

      if (nearest && nearest !== activeSectionId) {
        artLock.current = true;
        setActiveSectionId(nearest);
        const heading = document.getElementById(`h-${nearest}`);
        if (heading) {
          heading.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setTimeout(() => { artLock.current = false; }, 400);
      }
    }

    aside.addEventListener("scroll", onRailScroll, { passive: true });
    return () => aside.removeEventListener("scroll", onRailScroll);
  }, [articleBody, sectionClipOrder, activeSectionId]);

  const title = article?.title ?? topic?.title ?? qid ?? "";

  if (!qid && !titleParam) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-[#54595d]">
          Missing topic id.{" "}
          <Link href="/" className="text-[#1F6F95] underline">
            Back home
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 h-16 bg-white border-b-2 border-[#2C2C2C]">
        <div className="max-w-[1200px] mx-auto px-5 h-full grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-7 items-center">
          {/* Wiki left */}
          <div className="flex items-baseline gap-3 min-w-0">
            <Link
              href="/"
              className="flex-shrink-0"
              aria-label="wiki+ home"
            >
              <span
                style={{ fontFamily: "Georgia, serif" }}
                className="text-2xl font-semibold text-slate-900"
              >
                Wiki
              </span>
              <span
                className="font-black text-[#676EB4] text-2xl"
                style={{
                  fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                ＋
              </span>
            </Link>
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 hidden sm:inline flex-shrink-0">
              the encyclopedia article
            </span>
            {title && (
              <span
                className="ml-auto text-sm text-slate-500 truncate hidden md:inline"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {title}
              </span>
            )}
          </div>
          {/* Plus right — lg+ only */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#676EB4] border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C] w-fit">
            <span className="text-white text-2xl font-bold leading-none">＋</span>
            <span
              className="text-white text-lg leading-none font-black"
              style={{
                fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              plus
            </span>
            <span
              className="ml-1 text-[10px] uppercase tracking-[0.18em] text-white/90 font-bold"
              style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
            >
              curated video
            </span>
          </div>
        </div>
      </header>

      {/* Masthead zone */}
      <div className="max-w-[1200px] mx-auto px-5 pt-5 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-7 items-start">
        {/* Left: title + attribution + lead */}
        <div className="min-w-0">
          <p className="text-xs text-[#54595d] mb-2">
            From{" "}
            <a
              href={article?.url}
              target="_blank"
              rel="noreferrer"
              className="text-[#3366cc] hover:underline"
            >
              Wikipedia
            </a>{" "}
            · CC BY-SA 4.0
          </p>
          <h1
            style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}
            className="text-[1.9rem] leading-[1.2] border-b border-[#a2a9b1] pb-1 mb-2"
          >
            {article?.title ?? topic?.title ?? qid}
          </h1>
          {article?.description && (
            <p className="text-sm text-[#54595d] mb-3 italic">
              {article.description}
            </p>
          )}
          {error && (
            <p className="mb-3 rounded bg-red-50 border border-red-200 p-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {article ? (
            <div
              className="article-html text-[0.95rem] leading-[1.65]"
              dangerouslySetInnerHTML={{ __html: article.extractHtml }}
            />
          ) : !error ? (
            <p className="text-sm text-[#54595d] mt-4">Loading article…</p>
          ) : null}
        </div>

        {/* Right: PlusInfobox + TOC — sticky */}
        <aside
          className="sticky top-16 self-start"
          aria-label="wiki+ overview and contents"
        >
          <PlusInfobox clips={clips} qid={qid ?? ""} />
          <TocCard
            sections={articleBody?.sections ?? []}
            clipsBySection={clipsBySection}
            currentSectionId={activeSectionId}
            onNavigate={goToSection}
          />
          {clips.length > 0 && (
            <Link
              href={`/contribute?qid=${encodeURIComponent(qid ?? "")}`}
              className="block text-center text-xs text-[#1F6F95] hover:underline mt-2 focus-visible:outline-2 focus-visible:outline-[#676EB4] rounded"
            >
              + Contribute a video
            </Link>
          )}
        </aside>
      </div>

      {/* General strip */}
      <GeneralStrip
        clips={generalClips}
        qid={qid ?? ""}
        topicTitle={article?.title ?? topic?.title}
      />

      {/* Reader zone */}
      <div className="max-w-[1200px] mx-auto px-5 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-7 items-start">
        {/* Article body */}
        <main className="min-w-0 pb-32 article-body" aria-label="Wikipedia article">
          {articleBody && articleBody.sections.length > 0 ? (
            articleBody.sections.map((section) => (
              <section
                key={section.id}
                id={`sec-${section.id}`}
                data-sid={section.id}
                className="sec scroll-mt-20"
              >
                {section.level === 2 ? (
                  <h2
                    id={`h-${section.id}`}
                    style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}
                    className="text-[1.5rem] border-b border-[#a2a9b1] pb-1 mt-6 mb-2"
                  >
                    {section.title}
                  </h2>
                ) : (
                  <h3
                    id={`h-${section.id}`}
                    style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}
                    className="text-[1.2rem] mt-4 mb-2"
                  >
                    {section.title}
                  </h3>
                )}
                <div
                  className="article-html text-[0.95rem] leading-[1.65]"
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
              </section>
            ))
          ) : article && !articleBody ? (
            <p className="text-sm text-[#54595d] mt-4">Loading sections…</p>
          ) : null}

          {/* CC attribution */}
          {article && (
            <div className="mt-12 pt-4 border-t border-[#a2a9b1] text-xs text-[#54595d]">
              Article text from{" "}
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="text-[#3366cc] hover:underline"
              >
                Wikipedia
              </a>
              , licensed under{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer"
                className="text-[#3366cc] hover:underline"
              >
                CC BY-SA 4.0
              </a>
              .
            </div>
          )}
        </main>

        {/* Plus rail */}
        <aside
          ref={asideRef}
          className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden px-3 py-3"
          aria-label="wiki+ curated videos"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#2C2C2C #D9D9D9" }}
        >
          {/* Mini TOC */}
          <div data-mini-toc="">
            <MiniToc
              sections={articleBody?.sections ?? []}
              clipsBySection={clipsBySection}
              currentSectionId={activeSectionId}
              onNavigate={goToSection}
            />
          </div>

          {/* Section clips */}
          {sectionClipOrder.length > 0 && (
            <>
              <div
                className="text-[11px] uppercase tracking-widest font-bold text-[#5248AF] px-1 mb-2"
                style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
              >
                Videos ↓
              </div>
              <div className="space-y-3 pb-[60vh]">
                {sectionClipOrder.map((sid) => {
                  const secTitle =
                    articleBody?.sections.find((s) => s.id === sid)?.title;
                  return (clipsBySection[sid] ?? []).map((clip, i) => (
                    <ClipCardFull
                      key={clip.id}
                      clip={clip}
                      sectionTitle={i === 0 ? secTitle : undefined}
                      isActive={activeSectionId === sid}
                      onSectionClick={() => goToSection(sid)}
                      ref={(el) => {
                        if (i === 0) cardRefs.current[sid] = el;
                      }}
                    />
                  ));
                })}
              </div>
            </>
          )}

          {/* Empty state — YouTube suggestions in candidate card style */}
          {sectionClipOrder.length === 0 && clips.length === 0 && article && (
            <>
              <div
                className="text-[11px] uppercase tracking-widest font-bold text-[#5248AF] px-1 mb-2"
                style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}
              >
                Suggested ↓ · uncurated
              </div>
              <VideoSuggestions
                topicTitle={article.title}
                topicQid={qid ?? ""}
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
