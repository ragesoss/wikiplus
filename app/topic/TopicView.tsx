"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArticleError,
  ArticleLeadBlock,
  ArticleSections,
  ArticleSkeleton,
} from "@/components/topic/ArticleBody";
import { AddModal } from "@/components/topic/AddModal";
import { CandidateCard } from "@/components/topic/CandidateBits";
import { ClipCard } from "@/components/topic/ClipCard";
import { CurateModal } from "@/components/topic/CurateModal";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import { Infobox } from "@/components/topic/Infobox";
import { PlayerModal } from "@/components/topic/PlayerModal";
import { Toc, type TocEntry } from "@/components/topic/Toc";
import { TopicHeader } from "@/components/topic/TopicHeader";
import { deriveStats, seedIfEmpty, store } from "@/lib/data";
import type { Candidate, Clip, Topic } from "@/lib/data/types";
import {
  fetchFullArticle,
  qidToTitle,
  type FullArticle,
} from "@/lib/wiki/article";

const HEAD = 64;
const READ = 120;
const IDENTITY = "@sage"; // stubbed signed-in curator (design §6.1; A7)

type FetchState = "loading" | "ready" | "error";

export function TopicView() {
  const qid = useSearchParams().get("qid");

  const [topic, setTopic] = useState<Topic | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [article, setArticle] = useState<FullArticle | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [storeReady, setStoreReady] = useState(false);

  const [player, setPlayer] = useState<Clip | null>(null);
  const [curateFor, setCurateFor] = useState<Candidate | null>(null);
  const [curateOpen, setCurateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  // Load store data (synchronous-ish; doesn't gate on the article fetch).
  useEffect(() => {
    if (!qid) return;
    let alive = true;
    (async () => {
      await seedIfEmpty();
      const [t, cl, ca] = await Promise.all([
        store.getTopic(qid),
        store.listClips(qid),
        store.listCandidates(qid),
      ]);
      if (!alive) return;
      setTopic(t);
      setClips(cl);
      setCandidates(ca);
      setStoreReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [qid]);

  const loadArticle = useCallback(async () => {
    if (!qid) return;
    setFetchState("loading");
    try {
      const t = await store.getTopic(qid);
      const title = (await qidToTitle(qid)) ?? t?.title ?? null;
      if (!title) throw new Error("No Wikipedia article for this QID.");
      const full = await fetchFullArticle(title);
      setArticle(full);
      setFetchState("ready");
      if (!t || t.title !== title) {
        await store.upsertTopic({ qid, title });
      }
    } catch {
      setFetchState("error");
    }
  }, [qid]);

  useEffect(() => {
    void loadArticle();
  }, [loadArticle]);

  const mode: "curated" | "empty" = clips.length > 0 ? "curated" : "empty";
  const topicTitle = article?.title ?? topic?.title ?? qid ?? "";

  const liveCandidates = useMemo(
    () => candidates.filter((c) => !dismissed.has(c.id)),
    [candidates, dismissed]
  );

  const stats = useMemo(() => deriveStats(clips), [clips]);

  // ── Anchored clips/candidates grouped by section slug. ──
  const generalClips = useMemo(() => clips.filter((c) => c.general), [clips]);
  const sectionClips = useMemo(() => clips.filter((c) => !c.general), [clips]);
  const generalCandidates = useMemo(
    () => liveCandidates.filter((c) => c.general),
    [liveCandidates]
  );
  const sectionCandidates = useMemo(
    () => liveCandidates.filter((c) => !c.general),
    [liveCandidates]
  );

  // One inline candidate per matching section (design §6.4).
  const inlineCandidates = useMemo(() => {
    const m = new Map<string, Candidate>();
    for (const c of sectionCandidates) {
      if (c.sectionSlug && !m.has(c.sectionSlug)) m.set(c.sectionSlug, c);
    }
    return m;
  }, [sectionCandidates]);

  // ── TOC entries: ＋ band row first, then sections with counts. ──
  const tocEntries: TocEntry[] = useMemo(() => {
    const sections = article?.sections ?? [];
    const countFor = (slug: string) =>
      mode === "curated"
        ? sectionClips.filter((c) => c.sectionSlug === slug).length
        : sectionCandidates.filter((c) => c.sectionSlug === slug).length;
    const bandCount =
      mode === "curated" ? generalClips.length : generalCandidates.length;
    return [
      { slug: "__general", title: "General", level: 2, count: bandCount },
      ...sections.map((s) => ({
        slug: s.slug,
        title: s.title,
        level: s.level,
        count: countFor(s.slug),
      })),
    ];
  }, [
    article,
    mode,
    sectionClips,
    sectionCandidates,
    generalClips,
    generalCandidates,
  ]);

  // ── Refs for scroll-sync. ──
  const sectionEls = useRef<Map<string, HTMLElement>>(new Map());
  const cardEls = useRef<Map<string, HTMLElement>>(new Map());
  const railRef = useRef<HTMLElement>(null);
  const lockUntil = useRef(0);
  const prefersReduced = useRef(false);

  useEffect(() => {
    prefersReduced.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const setSectionRef = useCallback((slug: string, el: HTMLElement | null) => {
    if (el) sectionEls.current.set(slug, el);
    else sectionEls.current.delete(slug);
  }, []);

  // First clip/candidate per section (the rail card to scroll to).
  const railItems = useMemo(
    () => (mode === "curated" ? sectionClips : sectionCandidates),
    [mode, sectionClips, sectionCandidates]
  );

  const scrollBehavior = (): ScrollBehavior =>
    prefersReduced.current ? "auto" : "smooth";

  const goTo = useCallback(
    (slug: string) => {
      lockUntil.current = Date.now() + 200;
      if (slug === "__general") {
        document
          .getElementById("general-band")
          ?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
        return;
      }
      const el = sectionEls.current.get(slug);
      if (el) {
        const y = window.scrollY + el.getBoundingClientRect().top - HEAD - 16;
        window.scrollTo({ top: y, behavior: scrollBehavior() });
      }
      // Bring the matching card into the rail.
      const item = railItems.find((c) => c.sectionSlug === slug);
      const card = item && cardEls.current.get(item.id);
      const rail = railRef.current;
      if (card && rail) {
        rail.scrollTo({ top: card.offsetTop - 8, behavior: "auto" });
      }
      setActiveSlug(slug);
    },
    [railItems]
  );

  // Article → rail sync (AC12). Active = deepest section whose heading crossed
  // the reading line. Only sections that bear a rail item drive the rail scroll.
  useEffect(() => {
    if (fetchState !== "ready") return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (Date.now() < lockUntil.current) return;
        const line = HEAD + READ;
        let current: string | null = null;
        for (const [slug, el] of sectionEls.current) {
          if (el.getBoundingClientRect().top <= line) current = slug;
        }
        if (current && current !== activeSlug) {
          setActiveSlug(current);
          const item = railItems.find((c) => c.sectionSlug === current);
          const card = item && cardEls.current.get(item.id);
          const rail = railRef.current;
          if (card && rail) {
            lockUntil.current = Date.now() + 180;
            rail.scrollTo({ top: card.offsetTop - 8, behavior: "auto" });
          }
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [fetchState, activeSlug, railItems]);

  // Rail → article sync (AC13). The card nearest the rail's vertical center wins.
  const onRailScroll = useCallback(() => {
    if (Date.now() < lockUntil.current) return;
    const rail = railRef.current;
    if (!rail) return;
    const center = rail.scrollTop + rail.clientHeight / 2;
    let best: { slug: string; dist: number } | null = null;
    for (const item of railItems) {
      const card = cardEls.current.get(item.id);
      if (!card || !item.sectionSlug) continue;
      const cardCenter = card.offsetTop + card.offsetHeight / 2;
      const dist = Math.abs(cardCenter - center);
      if (!best || dist < best.dist) best = { slug: item.sectionSlug, dist };
    }
    if (best && best.slug !== activeSlug) {
      setActiveSlug(best.slug);
      const el = sectionEls.current.get(best.slug);
      if (el) {
        lockUntil.current = Date.now() + 180;
        const y = window.scrollY + el.getBoundingClientRect().top - HEAD - 16;
        window.scrollTo({ top: y, behavior: "auto" });
      }
    }
  }, [railItems, activeSlug]);

  // ── Candidate actions (A7: non-persisting). ──
  const dismiss = useCallback((c: Candidate) => {
    setDismissed((prev) => new Set(prev).add(c.id));
  }, []);
  const promote = useCallback((c: Candidate) => {
    setCurateFor(c);
    setCurateOpen(true);
  }, []);
  const curateFirst = useCallback(() => {
    const first = liveCandidates[0] ?? null;
    if (first) {
      setCurateFor(first);
      setCurateOpen(true);
    } else {
      document.getElementById("general-band")?.scrollIntoView({ block: "start" });
    }
  }, [liveCandidates]);

  const sectionList = useMemo(
    () => (article?.sections ?? []).map((s) => ({ slug: s.slug, title: s.title })),
    [article]
  );

  if (!qid) {
    return (
      <p className="p-6 text-sm text-ink/60">
        Missing topic id.{" "}
        <Link href="/" className="text-action underline">
          Back home
        </Link>
      </p>
    );
  }

  const sources =
    [...new Set(candidates.map((c) => c.source))].join(" + ") || "YouTube";

  return (
    <>
      <TopicHeader
        articleTitle={topicTitle}
        identityHandle={mode === "empty" ? IDENTITY : undefined}
      />

      <div className="mx-auto max-w-[1200px] px-5">
        {/* Masthead: title + attribution + lead (left) + infobox + TOC (right). */}
        <div className="grid grid-cols-1 gap-7 pt-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            {fetchState === "loading" && <ArticleSkeleton />}
            {fetchState === "error" && (
              <ArticleError
                url={`https://en.wikipedia.org/wiki/${encodeURIComponent(topicTitle)}`}
                onRetry={loadArticle}
              />
            )}
            {fetchState === "ready" && article && (
              <ArticleLeadBlock
                title={article.title}
                url={article.url}
                qid={qid}
                lead={article.lead}
              />
            )}
          </div>

          {storeReady && (
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <Infobox
                mode={mode}
                stats={stats}
                suggestionCount={liveCandidates.length}
                sources={sources}
                syncedLabel="just now"
                onCurateFirst={curateFirst}
              />
              <Toc
                entries={tocEntries}
                mode={mode}
                currentSlug={activeSlug}
                onGo={goTo}
              />
            </aside>
          )}
        </div>
      </div>

      {/* General / Suggested band — full bleed (the one crossover). */}
      {storeReady && (
        <GeneralStrip
          mode={mode}
          topicTitle={topicTitle}
          generalClips={generalClips}
          generalCandidates={generalCandidates}
          totalGeneral={
            mode === "curated" ? generalClips.length : generalCandidates.length
          }
          onPlay={setPlayer}
          onPromote={promote}
          onDismiss={dismiss}
          onAdd={() => setAddOpen(true)}
        />
      )}

      {/* Reader: article body sections (left) + the sticky rail (right). */}
      <div className="mx-auto max-w-[1200px] px-5 pb-16">
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            {fetchState === "ready" && article && (
              <ArticleSections
                sections={article.sections}
                activeSlug={activeSlug}
                mode={mode}
                topicTitle={topicTitle}
                inlineCandidates={inlineCandidates}
                onPromote={promote}
                onDismiss={dismiss}
                sectionRef={setSectionRef}
              />
            )}
          </div>
          <aside
            ref={railRef}
            onScroll={onRailScroll}
            aria-label={
              mode === "curated"
                ? "wiki+ curated videos"
                : "wiki+ suggested videos"
            }
            className="space-y-4 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto"
          >
            {mode === "curated"
              ? sectionClips.map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    active={activeSlug === clip.sectionSlug}
                    onPlay={setPlayer}
                    onGoToSection={(slug) => slug && goTo(slug)}
                    cardRef={(el) => {
                      if (el) cardEls.current.set(clip.id, el);
                      else cardEls.current.delete(clip.id);
                    }}
                  />
                ))
              : sectionCandidates.map((c) => (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    onPromote={promote}
                    onDismiss={dismiss}
                    cardRef={(el) => {
                      if (el) cardEls.current.set(c.id, el);
                      else cardEls.current.delete(c.id);
                    }}
                  />
                ))}
            {mode === "curated" && sectionClips.length === 0 && (
              <p className="text-sm text-muted">
                All curated clips for this topic are general overviews — see the
                strip above.
              </p>
            )}
          </aside>
        </div>
      </div>

      {player && (
        <PlayerModal clip={player} onClose={() => setPlayer(null)} />
      )}
      {curateOpen && (
        <CurateModal
          candidate={curateFor}
          sections={sectionList}
          onClose={() => {
            setCurateOpen(false);
            setCurateFor(null);
          }}
        />
      )}
      {addOpen && (
        <AddModal
          sections={sectionList}
          identityHandle={IDENTITY}
          onClose={() => setAddOpen(false)}
        />
      )}
    </>
  );
}
