"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { liveCandidatesEnabled } from "@/lib/candidates";
import { curatedVideoKeys, deriveStats, seedIfEmpty, store } from "@/lib/data";
import { isDismissed, recordDismissal } from "@/lib/candidates/dismissals";
import type { Candidate, Clip, Topic } from "@/lib/data/types";
import {
  fetchFullArticle,
  qidToTitle,
  titleToQid,
  type FullArticle,
} from "@/lib/wiki/article";
import { titleFromPathname, topicHref } from "@/lib/wiki/topicRoute";

const HEAD = 64;
const READ = 120;
const IDENTITY = "@sage"; // stubbed signed-in curator (design §6.1; A7)

type FetchState = "loading" | "ready" | "error";

export function TopicView() {
  const router = useRouter();
  const pathname = usePathname();
  const qidParam = useSearchParams().get("qid");

  // Canonical route is title-based: `/topic/<Title>` (owner directive D1; AC5/AC23).
  // The title in the path is the source of truth; the QID is resolved UNDER THE HOOD
  // and never shown. `?qid=` is a back-compat entry that we canonicalize away (below).
  const routeTitle = useMemo(
    () => (pathname ? titleFromPathname(pathname) : null),
    [pathname]
  );

  // Resolved identity for this page: { qid, title }. `qid` keys the store; `title`
  // drives the article fetch + display. Either the path title or the ?qid= resolves it.
  const [resolved, setResolved] = useState<{
    qid: string | null;
    title: string;
  } | null>(null);
  const [resolveError, setResolveError] = useState(false);

  const [topic, setTopic] = useState<Topic | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [article, setArticle] = useState<FullArticle | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [storeReady, setStoreReady] = useState(false);
  // Live-candidate loading is DECOUPLED from storeReady (design §5.4): a slow YouTube
  // search must not block the infobox / TOC / band from rendering. It announces to AT.
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateAnnounce, setCandidateAnnounce] = useState("");

  const [player, setPlayer] = useState<Clip | null>(null);
  const [curateFor, setCurateFor] = useState<Candidate | null>(null);
  const [curateOpen, setCurateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  // ── Resolve the page identity (title ⇄ QID), then canonicalize the URL. ──
  // Title route: title is canonical; resolve QID under the hood (seeded store first,
  // then the Wikipedia API). ?qid= route: resolve QID→title, then replace the URL with
  // the canonical /topic/<Title>/ so the QID never lingers in the address bar.
  useEffect(() => {
    let alive = true;
    setResolveError(false);
    (async () => {
      await seedIfEmpty();
      if (routeTitle) {
        const known = await store.getTopicByTitle(routeTitle);
        const title = known?.title ?? routeTitle.replace(/_/g, " ");
        const qid = known?.qid ?? (await titleToQid(routeTitle));
        if (!alive) return;
        setResolved({ qid, title });
        return;
      }
      if (qidParam) {
        const t = await store.getTopic(qidParam);
        const title = t?.title ?? (await qidToTitle(qidParam));
        if (!alive) return;
        if (title) {
          // Canonicalize: swap ?qid= for the title-based URL (QID drops out of the bar).
          router.replace(topicHref(title));
          setResolved({ qid: qidParam, title });
        } else {
          setResolveError(true);
        }
        return;
      }
      if (alive) setResolveError(true);
    })();
    return () => {
      alive = false;
    };
  }, [routeTitle, qidParam, router]);

  const qid = resolved?.qid ?? null;
  const resolvedTitle = resolved?.title ?? null;

  // Load store data (keyed by the resolved QID; doesn't gate on the article fetch).
  useEffect(() => {
    if (!qid) return;
    let alive = true;
    (async () => {
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
    if (!resolvedTitle) return;
    setFetchState("loading");
    try {
      const full = await fetchFullArticle(resolvedTitle);
      setArticle(full);
      setFetchState("ready");
      // Keep the store's title in sync with the live article (no-op for seeded topics).
      if (qid && (!topic || topic.title !== full.title)) {
        await store.upsertTopic({ qid, title: full.title });
      }
    } catch {
      setFetchState("error");
    }
    // `topic` intentionally excluded: it's a sync-target, not an input that should re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTitle, qid]);

  useEffect(() => {
    void loadArticle();
  }, [loadArticle]);

  // ── Live candidate suggestion (spec AC2/AC11; design §5.4). ──
  // Runs once the article sections are known (so section matching has its input) and
  // the store has loaded (so we can dedup against curated clips, AC8). The seeded
  // result from listCandidates is already in `candidates`; if the live pipeline returns
  // a set (a key is present) we replace it, else we keep the seed (no-key no-op, AC1).
  // Decoupled from storeReady so a slow search never blocks the page chrome (§5.4).
  useEffect(() => {
    if (!qid || !storeReady || fetchState !== "ready" || !article) return;
    // No source enabled (every local/CI/cloud build — no key) → the live path is a no-op.
    // Do NOT flash the loading skeleton or fire the AT announcement; nothing about a
    // missing key should surface to the user (design §5.3). Keep the seeded/empty set.
    if (!liveCandidatesEnabled()) return;
    let alive = true;
    setCandidatesLoading(true);
    setCandidateAnnounce("Looking for suggested videos…");
    (async () => {
      const live = await store.suggestCandidates({
        topicQid: qid,
        topicTitle: article.title,
        sections: article.sections.map((s) => ({
          slug: s.slug,
          title: s.title,
          level: s.level,
        })),
        curatedVideoKeys: curatedVideoKeys(clips),
      });
      if (!alive) return;
      if (live) {
        setCandidates(live);
        setCandidateAnnounce(
          live.length === 0
            ? "No suggested videos found."
            : `Found ${live.length} suggested videos.`
        );
      } else {
        // No-key no-op: keep the seeded/empty set already loaded; nothing to announce.
        setCandidateAnnounce("");
      }
      setCandidatesLoading(false);
    })();
    return () => {
      alive = false;
    };
    // `clips` intentionally excluded: it's a dedup input captured at run time, not a
    // re-trigger (the curated set is stable for a topic in the prototype).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qid, storeReady, fetchState, article]);

  const mode: "curated" | "empty" = clips.length > 0 ? "curated" : "empty";
  const topicTitle =
    article?.title ?? topic?.title ?? resolvedTitle ?? qid ?? "";

  // Displayed candidates exclude both the in-memory dismissals (this session) AND any
  // persisted dismissal (AC9; design §6.3). The persisted check makes a dismissal sticky
  // across a reload even on the no-key seeded path, where the pipeline's cache-read filter
  // never runs — without it, a seeded candidate dismissed before reload would reappear.
  const liveCandidates = useMemo(
    () => candidates.filter((c) => !dismissed.has(c.id) && !isDismissed(c)),
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

  // ── Wikilink click interception (AC5). ──
  // Rewritten article-namespace links carry `data-topic-title` + an `/topic/<Title>/`
  // href. Intercept ordinary left-clicks and route them through the Next client router
  // so navigation stays in-SPA (no full reload). Modified clicks (new-tab/copy) and the
  // externalized red/namespaced links (which lack `data-topic-title`) are left alone.
  const onArticleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const link = (e.target as HTMLElement).closest("a[data-topic-title]");
      if (!link) return;
      const title = link.getAttribute("data-topic-title");
      if (!title) return;
      e.preventDefault();
      router.push(topicHref(title));
    },
    [router]
  );

  // ── Candidate actions. Dismissal is now STICKY (spec AC9; design §6.3): persist
  // (topicQid, platform, videoId) to localStorage so the candidate does not resurface
  // on reload/re-fetch, and hide it immediately (count decrements via liveCandidates).
  const dismiss = useCallback((c: Candidate) => {
    recordDismissal(c);
    setDismissed((prev) => new Set(prev).add(c.id));
    // Move focus sensibly off the removed node (design §8): to the band heading.
    if (typeof document !== "undefined") {
      const heading = document.querySelector<HTMLElement>("#general-band h2");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus();
    }
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

  // No title in the path and no resolvable ?qid= ⇒ nothing to show. (While resolving,
  // `resolved` is null but `resolveError` is false → fall through to the loading shell.)
  if (resolveError || (!resolved && !routeTitle && !qidParam)) {
    return (
      <p className="p-6 text-sm text-ink/60">
        Topic not found.{" "}
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
          <div className="min-w-0" onClick={onArticleClick}>
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
          loading={candidatesLoading}
          prefersReduced={prefersReduced.current}
          onPlay={setPlayer}
          onPromote={promote}
          onDismiss={dismiss}
          onAdd={() => setAddOpen(true)}
        />
      )}

      {/* Polite live region — announces the candidate search (design §5.4 / §8). */}
      <p className="sr-only" role="status" aria-live="polite">
        {mode === "empty" ? candidateAnnounce : ""}
      </p>

      {/* Reader: article body sections (left) + the sticky rail (right). */}
      <div className="mx-auto max-w-[1200px] px-5 pb-16">
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0" onClick={onArticleClick}>
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
                    active={activeSlug === c.sectionSlug}
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
            {/* Rail loading / zero-results lines (design §5.2 / §5.4). */}
            {mode === "empty" && candidatesLoading && (
              <p className="text-sm text-muted" aria-live="polite">
                Looking for suggestions…
              </p>
            )}
            {mode === "empty" &&
              !candidatesLoading &&
              sectionCandidates.length === 0 && (
                <p className="text-sm text-muted">
                  No suggestions for this topic yet — use &lsquo;Find more&rsquo;
                  above to add the first video.
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
