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
import { CandidateCard, CandidateSetHeader } from "@/components/topic/CandidateBits";
import { CitationLayer } from "@/components/topic/CitationLayer";
import { ClipCard } from "@/components/topic/ClipCard";
import { CurateModal } from "@/components/topic/CurateModal";
import { DeleteConfirmDialog } from "@/components/topic/DeleteConfirmDialog";
import { EditModal } from "@/components/topic/EditModal";
import type { ClipEditFormPatch } from "@/components/topic/curate-clip";
import type { SubmitOutcome } from "@/components/topic/useCurateSubmit";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import { Infobox } from "@/components/topic/Infobox";
import { PinnedPlayer, type PinnedClip } from "@/components/topic/PinnedPlayer";
import { PlayerModal } from "@/components/topic/PlayerModal";
import { Toc, type TocEntry } from "@/components/topic/Toc";
import { TopicHeader } from "@/components/topic/TopicHeader";
import { useRequireLogin } from "@/components/auth/useRequireLogin";
import { useSession } from "next-auth/react";
import { isAuthRequired } from "@/lib/auth/auth-error";
import { liveCandidatesEnabled } from "@/lib/candidates";
import {
  curatedVideoKeys,
  deriveStats,
  dismissedVideoKeys,
  store,
} from "@/lib/data";
import { identityKey, videoIdOf } from "@/lib/candidates/dismissals";
import type { Candidate, Clip, Topic } from "@/lib/data/types";
import {
  fetchFullArticle,
  qidToTitle,
  resolvePage,
  type FullArticle,
} from "@/lib/wiki/article";
import {
  currentTopicSlug,
  titleFromPathname,
  titleToSlug,
  topicHref,
} from "@/lib/wiki/topicRoute";

const HEAD = 64;
const READ = 120;

type FetchState = "loading" | "ready" | "error";

export function TopicView() {
  const router = useRouter();
  // Issue C: the gate seam for the four contribute entry points (design §2 / §9). It runs the
  // action when signed in, else opens the right login gate (no auto-resume on return — UX-2).
  const { requireLogin, showExpiredGate, gateElement } = useRequireLogin();
  // D2 (issue #53, design §3.1 / Decision 6 (a)): the signed-in contributor id, read in the
  // ALREADY-AUTHENTICATED client session, to decide which clips show the owner-only Edit/Delete
  // affordances (by comparing to `clip.curatorId`). This is the affordance mechanism ONLY — the
  // server-side, id-based gate is the security control. No read-path cost (runs only in the
  // authenticated session, on data already loaded; an anonymous render reads no session here).
  const { data: session } = useSession();
  const myContributorId = session?.user?.contributorId;
  const pathname = usePathname();
  const qidParam = useSearchParams().get("qid");

  // Canonical route is title-based: `/topic/<Title>` (owner directive D1; AC5/AC23).
  // The title in the path is the source of truth; the QID is resolved UNDER THE HOOD
  // and never shown. `?qid=` is a back-compat entry that we canonicalize away (below).
  const routeTitle = useMemo(
    () => (pathname ? titleFromPathname(pathname) : null),
    [pathname]
  );

  // Resolved identity for this page (#23 canonical/display split). `qid` keys the
  // store; `canonicalTitle` keys the URL/slug, the article fetch, and the "From
  // Wikipedia" link; `displayTitle` (plain-text Wikipedia `displaytitle`) drives the
  // human heading ONLY. Either the path title or the ?qid= resolves it.
  const [resolved, setResolved] = useState<{
    qid: string | null;
    canonicalTitle: string;
    displayTitle: string;
  } | null>(null);
  const [resolveError, setResolveError] = useState(false);

  const [topic, setTopic] = useState<Topic | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  // In-session optimistic dismissals (by candidate id) — hides a card instantly on dismiss.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Persisted, SHARED dismissals for this topic (issue #45): the `platform:videoId` keys
  // fetched from Postgres through the server boundary. A candidate dismissed by ANYONE
  // (this or another browser/session) stays gone (AC5) — replaces the per-browser
  // localStorage `isDismissed` check.
  const [persistedDismissed, setPersistedDismissed] = useState<Set<string>>(
    new Set()
  );
  // Optimistic-dismissal failure notice (design §"dismissal — optimistic rollback"): a
  // non-blocking polite line shown when a dismissal write fails and the card reappears.
  const [dismissError, setDismissError] = useState(false);
  // ── Upvotes (issue #55 / D4). ──────────────────────────────────────────────────────────
  // The PER-VIEWER voted-state — the set of clip ids THIS viewer has upvoted — resolved in the
  // ALREADY-AUTHENTICATED client session, OFF the cached read path (Decision 6 / design §8). It
  // hydrates AFTER the topic shell renders (the hydrate-on-mount effect below); an anonymous load
  // does ZERO voted-state work. The DISPLAYED count rides `clips` (the derived total `listClips`
  // computed — public, Decision 2). An optimistic ±1 to the count lives in `clips` directly (the
  // same in-memory clip-state the add/edit/delete paths mutate), reconciled to the server's
  // authoritative `{ voted, count }` on the toggle's return.
  const [votedClipIds, setVotedClipIds] = useState<Set<string>>(new Set());
  // Non-blocking polite notice when a non-auth toggle write fails (design §6.4). The rolled-back
  // count/state is the honest signal; this line names why.
  const [upvoteError, setUpvoteError] = useState(false);
  // Per-clip in-flight guard (design §2.4.5): a second activation for the same clip is ignored
  // until the first resolves, so a double-click can't desync the optimistic count.
  const upvoteInFlight = useRef<Set<string>>(new Set());
  // Store-read error floor (design §"read failure"): a clip/dismissal read can now fail.
  const [storeError, setStoreError] = useState(false);
  const [article, setArticle] = useState<FullArticle | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [storeReady, setStoreReady] = useState(false);
  // Live-candidate loading is DECOUPLED from storeReady (design §5.4): a slow YouTube
  // search must not block the infobox / TOC / band from rendering. It announces to AT.
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateAnnounce, setCandidateAnnounce] = useState("");

  // Curated clips keep the blocking PlayerModal (Decision 4 — kept, not unified;
  // see the candidate `onPlay` note below). Candidates play in the NON-MODAL,
  // single-instance PinnedPlayer driven by its own single state value (§3, AC4).
  const [player, setPlayer] = useState<Clip | null>(null);
  const [pinned, setPinned] = useState<PinnedClip | null>(null);
  const [curateFor, setCurateFor] = useState<Candidate | null>(null);
  const [curateOpen, setCurateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // D2 (issue #53): the clip currently being edited / the clip pending delete-confirmation.
  const [editClip, setEditClip] = useState<Clip | null>(null);
  const [deleteFor, setDeleteFor] = useState<Clip | null>(null);

  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  // ── Resolve the page identity (title ⇄ QID), then canonicalize the URL. ──
  // Title route: title is canonical; resolve QID under the hood (seeded store first,
  // then the Wikipedia API). ?qid= route: resolve QID→title, then replace the URL with
  // the canonical /topic/<Title>/ so the QID never lingers in the address bar.
  useEffect(() => {
    let alive = true;
    setResolveError(false);
    (async () => {
      if (routeTitle) {
        // `routeTitle` is already the clean space-form title (titleFromPathname
        // maps underscores → spaces), so it flows straight into the store lookup
        // and the Wikipedia resolution — no further underscore handling (#11 AC4).
        //
        // #23: resolve the canonical title + plain-text display title + QID in ONE
        // action-API call (`resolvePage`); `redirects=1` follows aliases (jfk →
        // John F. Kennedy). The LIVE canonical title wins over a differing seeded
        // store title (keeps URL + store key + heading mutually consistent — spec
        // Open question); the store is the fallback when the API resolves nothing
        // (e.g. offline / a seeded topic the API didn't return).
        //
        // issue #45: `getTopicByTitle` is now a Server Action that can REJECT when the
        // DB is down. A rejection must NOT escape to React (→ blank screen, DEFECT-1):
        // the article + QID resolution are client-side (AC8) and don't need the DB, so
        // a failed store read degrades to `known = null` (treat as "no seeded topic")
        // AND sets the store-read error floor so the ＋plus rail shows an honest line
        // instead of a permanent skeleton (design §"read failure"). Title→QID still
        // resolves via the client-side Wikipedia call (`resolvePage`), so the article
        // renders. The separate store-read effect (below) also sets `storeError` once
        // `qid` is known, but DEFECT-1 was that `getTopic`/`getTopicByTitle` rejecting
        // HERE meant `qid` never got set, so that guarded effect never ran.
        const [known, page] = await Promise.all([
          store.getTopicByTitle(routeTitle).catch(() => {
            if (alive) setStoreError(true);
            return null;
          }),
          resolvePage(routeTitle),
        ]);
        if (!alive) return;
        const canonicalTitle = page.canonicalTitle ?? known?.title ?? null;
        // Unresolved (no canonical title AND no QID AND no seeded topic) → reach the
        // existing not-found / resolve-error path (#19). Never canonicalize to an
        // empty/typed slug (AC6).
        if (!canonicalTitle && !page.qid && !known) {
          setResolveError(true);
          return;
        }
        const finalCanonical = canonicalTitle ?? routeTitle;
        const qid = page.qid ?? known?.qid ?? null;
        const displayTitle = page.displayTitle ?? finalCanonical;
        setResolved({ qid, canonicalTitle: finalCanonical, displayTitle });
        // Canonicalize the address bar: replace ONLY when we resolved a live
        // canonical title AND the slug a reader arrived on differs from
        // titleToSlug(canonicalTitle) (AC1–AC4). Already-canonical arrivals replace
        // ZERO times (AC5); `replace` (never `push`) so Back doesn't bounce through
        // the typed/typo URL (AC7). Built via topicHref → trailing slash + (optional)
        // basePath. Guarded on `page.canonicalTitle` so an unresolved title is never
        // canonicalized to a guessed slug (AC6).
        if (
          page.canonicalTitle &&
          currentTopicSlug(pathname ?? "") !== titleToSlug(page.canonicalTitle)
        ) {
          router.replace(topicHref(page.canonicalTitle));
        }
        return;
      }
      if (qidParam) {
        // issue #45 / DEFECT-1: `getTopic` is a Server Action that can REJECT (DB down).
        // Degrade to `t = null` + set the store-read floor rather than let the rejection
        // crash to a blank page; `qidToTitle` (client-side) still resolves the title so
        // the article renders and the URL canonicalizes.
        const t = await store.getTopic(qidParam).catch(() => {
          if (alive) setStoreError(true);
          return null;
        });
        const title = t?.title ?? (await qidToTitle(qidParam));
        if (!alive) return;
        if (title) {
          // Canonicalize: swap ?qid= for the title-based URL (QID drops out of the
          // bar). The ?qid= entry has no separate display title (out of scope #23) —
          // the heading uses the title until the article fetch refines it.
          router.replace(topicHref(title));
          setResolved({ qid: qidParam, canonicalTitle: title, displayTitle: title });
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
  }, [routeTitle, qidParam, router, pathname]);

  const qid = resolved?.qid ?? null;
  const resolvedTitle = resolved?.canonicalTitle ?? null;
  const resolvedDisplayTitle = resolved?.displayTitle ?? null;

  // Load store data (keyed by the resolved QID; doesn't gate on the article fetch). All
  // reads now go through the server boundary to shared Postgres (issue #45) — including the
  // SHARED dismissed-keys set (AC5). A read can now FAIL (DB down); on failure we set the
  // store-read error floor and still render the chrome (the article is client-side, AC8).
  useEffect(() => {
    if (!qid) return;
    let alive = true;
    setStoreError(false);
    (async () => {
      try {
        const [t, cl, ca, dk] = await Promise.all([
          store.getTopic(qid),
          store.listClips(qid),
          store.listCandidates(qid),
          dismissedVideoKeys(qid),
        ]);
        if (!alive) return;
        setTopic(t);
        setClips(cl);
        setCandidates(ca);
        setPersistedDismissed(dk);
      } catch {
        if (alive) setStoreError(true);
      } finally {
        // storeReady gates the chrome (infobox/TOC/band); flip it even on error so the page
        // shows an honest rail line rather than a permanent skeleton (design read-failure floor).
        if (alive) setStoreReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [qid]);

  // ── Per-viewer voted-state hydration (issue #55 / D4, Decision 6 / design §8). ─────────────
  // OFF the cached read path: this runs ONLY in the already-authenticated client session, AFTER
  // the clips (and thus the public derived counts) have loaded — never baked into `listClips` or
  // the SSG shell. An ANONYMOUS viewer (no `myContributorId`) does ZERO voted-state work (AC7):
  // the effect bails before any read, and the control renders the logged-out "Log in to upvote"
  // form. For a signed-in viewer it reads WHICH of the visible clips they have voted on (a small
  // viewer-scoped read of their own votes), then the controls show the voted cue — a quiet
  // correction, never a flash of a wrong "voted" before it is confirmed (it only ADDS the cue).
  useEffect(() => {
    if (typeof myContributorId !== "number" || clips.length === 0) {
      setVotedClipIds(new Set());
      return;
    }
    let alive = true;
    (async () => {
      try {
        const ids = await store.votedClipIds(clips.map((c) => c.id));
        if (alive) setVotedClipIds(new Set(ids));
      } catch {
        // A failed voted-state read is non-fatal: leave the controls in the not-voted default
        // (the count is already correct from `listClips`); the viewer can still toggle.
        if (alive) setVotedClipIds(new Set());
      }
    })();
    return () => {
      alive = false;
    };
  }, [myContributorId, clips]);

  const loadArticle = useCallback(async () => {
    if (!resolvedTitle) return;
    setFetchState("loading");
    try {
      // Fetch by the CANONICAL title (keys the article body + source URL); pass the
      // resolved plain-text display title so the heading paints as the display title
      // on the FIRST ready render — no interim canonical-then-display swap (#23,
      // design §States→loading).
      const full = await fetchFullArticle(resolvedTitle, resolvedDisplayTitle);
      setArticle(full);
      setFetchState("ready");
      // Keep the store's CANONICAL title in sync with the live article (no-op for seeded
      // topics whose title already matches). This is now a server-boundary WRITE (issue #45)
      // and is BEST-EFFORT: a failed title-sync must NOT flip the (successful) article render
      // into the error state, so it has its own try/catch and is swallowed.
      if (qid && (!topic || topic.title !== full.title)) {
        try {
          await store.upsertTopic({ qid, title: full.title });
        } catch {
          /* title-sync is non-fatal — the article already rendered */
        }
      }
    } catch {
      setFetchState("error");
    }
    // `topic` intentionally excluded: it's a sync-target, not an input that should re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTitle, resolvedDisplayTitle, qid]);

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
        // Shared dismissals (issue #45) feed the pipeline's AC9 dedup — the live pipeline is
        // pure + client-side, so the (server-fetched) dismissed set is passed in, not read.
        dismissedVideoKeys: persistedDismissed,
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

  // #23: split the formerly-overloaded `topicTitle` into canonical vs display.
  //   - `canonicalTitle` (space-form) keys the "From Wikipedia"/ArticleError URL, the
  //     store/QID context, and the General strip / sections context labels.
  //   - `displayTitle` (plain-text Wikipedia `displaytitle`) drives the human HEADING
  //     ONLY — the masthead <h1> and the compact TopicHeader echo. The two legitimately
  //     differ (e.g. canonical `Bell hooks` / display `bell hooks`); neither leaks into
  //     the other's surface (AC4).
  const canonicalTitle =
    article?.title ?? topic?.title ?? resolvedTitle ?? qid ?? "";
  const displayTitle =
    article?.displayTitle ?? resolvedDisplayTitle ?? canonicalTitle;

  // Displayed candidates exclude both the in-memory optimistic dismissals (this session) AND
  // any SHARED persisted dismissal from Postgres (AC5/AC9; design §6.3). The persisted check
  // keeps a dismissal sticky across reloads and ACROSS BROWSERS — a candidate dismissed by
  // anyone is filtered out for everyone, matched by the `platform:videoId` identity.
  const isPersistedDismissed = useCallback(
    (c: Candidate): boolean => {
      const videoId = videoIdOf(c);
      if (!videoId) return false;
      return persistedDismissed.has(identityKey(c.platform, videoId));
    },
    [persistedDismissed]
  );
  const liveCandidates = useMemo(
    () =>
      candidates.filter(
        (c) => !dismissed.has(c.id) && !isPersistedDismissed(c)
      ),
    [candidates, dismissed, isPersistedDismissed]
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

  // ── Wide-table overflow flag (article-fidelity #25, design §4.2). ──
  // After the article renders, mark each `.wiki-tablewrap` whose table is wider than
  // its wrapper with `data-overflow` so the CSS "Scroll table →" hint appears ONLY
  // when scrolling is actually needed. Re-measures on resize. Inert when no tables.
  useEffect(() => {
    if (fetchState !== "ready") return;
    const measure = () => {
      for (const wrap of Array.from(
        document.querySelectorAll<HTMLElement>(".wiki-tablewrap")
      )) {
        const overflowing = wrap.scrollWidth > wrap.clientWidth + 1;
        if (overflowing) wrap.setAttribute("data-overflow", "");
        else wrap.removeAttribute("data-overflow");
      }
    };
    // Measure after layout settles (next frame), then on resize.
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [fetchState, article]);

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

  // Send focus to the General band heading (design §8) — the shared "move focus
  // sensibly off a removed node" anchor, reused by both candidate dismissal and the
  // PinnedPlayer keyboard dismiss (AC11).
  const focusBandHeading = useCallback(() => {
    if (typeof document === "undefined") return;
    const heading = document.querySelector<HTMLElement>("#general-band h2");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
  }, []);

  // ── Candidate actions. Dismissal is now SHARED + DURABLE (issue #45; AC5) and written
  // through the server boundary. The write is OPTIMISTIC with ROLLBACK (design §"optimistic
  // vs awaited"): hide the card instantly (same instant feel as before — count decrements
  // via liveCandidates), fire the persistence in the background, and if the server write
  // fails, REVERT the optimistic hide (the card reappears) + show a non-blocking polite
  // notice. No silent loss; a card is never hidden-but-unsaved beyond the round-trip.
  // The actual optimistic-with-rollback dismissal — only run when SIGNED IN (the gate is at
  // the entry point below). Issue C (design §2d): a logged-out dismiss must NOT optimistically
  // hide (the boundary would reject it — a false "dismissed"); so the hide lives here, after
  // the gate. A boundary `AuthRequiredError` (session expired between render and click) rolls
  // the hide back AND surfaces the expired-session gate, not the generic failure notice (§4).
  const runDismiss = useCallback(
    (c: Candidate) => {
      const videoId = videoIdOf(c);
      // Unparseable id can't be persisted as a dismissal — keep the prior in-session-hide
      // behavior (no server write to attempt) rather than block the triage action.
      setDismissed((prev) => new Set(prev).add(c.id));
      focusBandHeading();
      if (!videoId) return;
      setDismissError(false);
      void (async () => {
        try {
          await store.recordDismissal({
            topicQid: c.topicQid,
            platform: c.platform,
            videoId,
          });
          // Reflect the now-persisted, shared dismissal so it stays gone across re-renders.
          setPersistedDismissed((prev) =>
            new Set(prev).add(identityKey(c.platform, videoId))
          );
        } catch (err) {
          // Rollback the optimistic hide: the card reappears (the honest "that didn't take"
          // signal). Focus is NOT stolen back to the card.
          setDismissed((prev) => {
            const next = new Set(prev);
            next.delete(c.id);
            return next;
          });
          // Defense in depth (design §2d/§4): a session that expired between render and click
          // is rejected at the boundary — surface the expired-session login gate rather than
          // the generic "couldn't dismiss" notice.
          if (isAuthRequired(err)) showExpiredGate();
          else setDismissError(true);
        }
      })();
    },
    [focusBandHeading, showExpiredGate]
  );

  // Entry point (design §2d): gate first. Signed in → run the optimistic dismiss; logged out →
  // the dismiss login gate WITHOUT any optimistic hide (the card stays visible — honest).
  const dismiss = useCallback(
    (c: Candidate) => {
      requireLogin({ gate: "dismiss", action: () => runDismiss(c) });
    },
    [requireLogin, runDismiss]
  );

  // ── Candidate play (issue #10, design §3/§9). Open the NON-MODAL PinnedPlayer for
  // a YouTube candidate WITH an embedUrl (AC1). A YouTube candidate without an
  // embedUrl, and every non-YouTube candidate, never reach here: VideoThumb only
  // calls onPlay for `platform === "youtube"`, and we only PASS onPlay when an
  // embedUrl exists — so the no-embed YouTube and non-YouTube paths both fall through
  // to VideoThumb's existing window.open(watchUrl) (design §9 State F/G; AC7/AC8). No
  // src-less iframe is ever rendered. Setting `pinned` to candidate B while A plays
  // SWAPS in place — the same dock element stays mounted, only its payload (and thus
  // the iframe src/caption/credit) changes (AC4/AC5, single instance, no second dock).
  const playCandidate = useCallback((c: Candidate) => {
    if (!c.embedUrl) return; // defensive — only wired when embedUrl is present
    setPinned({
      embedUrl: c.embedUrl,
      caption: c.caption,
      orientation: c.orientation,
      creator: { handle: c.creator.handle },
      platformLabel: c.platformLabel,
    });
  }, []);

  // Dismiss the PinnedPlayer (AC6): drop the state so the dock + iframe unmount
  // (playback stops; no hidden iframe). On a keyboard dismiss the Close button is the
  // activeElement inside the dock, so we move focus to the band heading rather than
  // dropping it to <body> (AC11/§8). When the dock was clicked away with the mouse we
  // still anchor focus there — harmless and keeps behavior uniform.
  const dismissPinned = useCallback(() => {
    setPinned(null);
    focusBandHeading();
  }, [focusBandHeading]);
  // Curate (candidate Promote) — gated (design §2b). Signed in → open the real CurateModal
  // (now a REAL persisting submit, issue #52 / D1); logged out → "Log in to curate". No auto-resume.
  const promote = useCallback(
    (c: Candidate) => {
      requireLogin({
        gate: "curate",
        action: () => {
          setCurateFor(c);
          setCurateOpen(true);
        },
      });
    },
    [requireLogin]
  );
  // "Be the first to curate" — same curate gate (design §2b). The empty-state scroll fallback
  // (no candidate to curate) is not a write, so it runs regardless of session.
  const curateFirst = useCallback(() => {
    const first = liveCandidates[0] ?? null;
    if (!first) {
      document.getElementById("general-band")?.scrollIntoView({ block: "start" });
      return;
    }
    requireLogin({
      gate: "curate",
      action: () => {
        setCurateFor(first);
        setCurateOpen(true);
      },
    });
  }, [liveCandidates, requireLogin]);
  // Add video — gated (design §2c). Signed in → open AddModal; logged out → "Log in to add".
  const openAdd = useCallback(() => {
    requireLogin({ gate: "add", action: () => setAddOpen(true) });
  }, [requireLogin]);

  // ── Persist a curated clip (issue #52 / D1, AC1–AC5). ──────────────────────────────────
  // The two modals (Promote / Add) hand the assembled clip + the CC BY-SA consent up here; the
  // host owns the write (the auth-gated boundary), the in-memory clip-state update (the new clip
  // renders with no reload — AC2/AC5, flipping empty→curated when first since `mode` derives from
  // `clips.length`), and the expired-session gate (it holds `useRequireLogin`). It returns the
  // SubmitOutcome the modal's submit machine expects: "added" / "expired" resolve (modal closes),
  // a generic error THROWS (modal stays open with the note intact + the §6 alert — AC11).
  const persistClip = useCallback(
    async (
      clip: Omit<Clip, "id" | "createdAt">,
      agreed: boolean,
      opts: {
        /** Run before the add (add-by-link upserts the topic if it is not yet in the store). */
        before?: () => Promise<void>;
        /** Dedup the live suggestion set after the add (AC3/AC5); return the focus follow-up. */
        afterAdd?: (added: Clip) => void;
      } = {}
    ): Promise<SubmitOutcome> => {
      try {
        await opts.before?.();
        // The boundary stamps attribution (curatorId/curatedBy) + the note-license agreement from
        // the consent boolean; the client supplies neither (C AC6 / D1 §3.5 / AC7).
        const added = await store.addClip(clip, undefined, undefined, agreed);
        setClips((prev) => [added, ...prev]);
        opts.afterAdd?.(added);
        return { outcome: "added" };
      } catch (err) {
        // Session expired between opening the modal and submit (design §7.2 / AC9): surface the
        // expired-session gate exactly like the dismiss path — NOT the generic in-modal error.
        if (isAuthRequired(err)) {
          showExpiredGate();
          return { outcome: "expired" };
        }
        throw err; // generic server/boundary error → the modal keeps open + shows its §6 alert
      }
    },
    [showExpiredGate]
  );

  // Promote a candidate (design §2.1 / AC1–AC3). On success: drop the promoted candidate from the
  // LIVE suggestion set deduped by `platform:videoId` (it must not linger as an un-vouched-for
  // suggestion — AC3), and — since the originating candidate CARD is removed — move focus to the
  // General band heading rather than let `ModalShell`'s return-to-trigger target a detached node
  // (design §4.4 / §7.3). Scheduled post-close (rAF) so it runs AFTER the shell's `prevActive`.
  const onCurateSubmit = useCallback(
    (clip: Omit<Clip, "id" | "createdAt">, agreed: boolean): Promise<SubmitOutcome> => {
      const promoted = curateFor;
      return persistClip(clip, agreed, {
        afterAdd: () => {
          if (!promoted) return;
          const videoId = videoIdOf(promoted);
          if (videoId) {
            const key = identityKey(promoted.platform, videoId);
            setDismissed((prev) => new Set(prev).add(promoted.id));
            // Mark the identity so it stays filtered even if the live pipeline re-surfaces it.
            setPersistedDismissed((prev) => new Set(prev).add(key));
          } else {
            // Unparseable id: at least hide the exact card this session by its candidate id.
            setDismissed((prev) => new Set(prev).add(promoted.id));
          }
          // The promoted candidate card was removed — anchor focus on the band heading after
          // the modal's own focus-return fires (else focus is lost to <body>).
          if (typeof requestAnimationFrame !== "undefined") {
            requestAnimationFrame(() => focusBandHeading());
          } else {
            focusBandHeading();
          }
        },
      });
    },
    [curateFor, persistClip, focusBandHeading]
  );

  // Add-by-link (design §2.2 / AC4/AC5). Upsert the topic first if it is not yet in the store
  // (the page's QID is resolved), then add the clip. On success, also dedup a duplicate live
  // suggestion for the same `platform:videoId` if one was showing (§4.3 / AC5). The "＋ Add video"
  // trigger is NOT removed, so focus-return is the normal `ModalShell` `prevActive`.
  const onAddSubmit = useCallback(
    (clip: Omit<Clip, "id" | "createdAt">, agreed: boolean): Promise<SubmitOutcome> => {
      return persistClip(clip, agreed, {
        before: async () => {
          // Ensure the parent topic exists (addClip's prerequisite). Idempotent upsert; skipped
          // when the topic is already loaded. Both upsert + add are auth-gated at the boundary.
          if (qid && !topic) {
            await store.upsertTopic({ qid, title: canonicalTitle });
          }
        },
        afterAdd: (added) => {
          const videoId = videoIdOf(added);
          if (videoId) {
            // Drop any live suggestion matching the just-added video so it does not linger.
            setPersistedDismissed((prev) =>
              new Set(prev).add(identityKey(added.platform, videoId))
            );
          }
        },
      });
    },
    [persistClip, qid, topic, canonicalTitle]
  );

  // ── Owner-only edit / delete (issue #53 / D2, design §§2–9). ───────────────────────────
  // The AFFORDANCE check (Decision 6 (a)): a clip is "owned" by the viewer iff the viewer is
  // signed in AND `clip.curatorId` equals their session contributor id. This decides which
  // cards show Edit/Delete; a legacy `@prototype` clip has no `curatorId` → never owned (AC8).
  // It is NOT the security control — `updateClipAction`/`deleteClipAction` re-check ownership
  // server-side, id-based, regardless of any button (AC4/AC5/AC6/AC8).
  const ownsClip = useCallback(
    (clip: Clip): boolean =>
      typeof myContributorId === "number" && clip.curatorId === myContributorId,
    [myContributorId]
  );

  // ── Upvote toggle (issue #55 / D4, design §2.4 — clones the `runDismiss` posture). ─────────
  // OPTIMISTIC-WITH-ROLLBACK (not an awaited spinner): on a signed-in activation flip the
  // per-viewer voted-state AND adjust the displayed count by ±1 IMMEDIATELY (in `clips`, the same
  // in-memory clip-state the add/edit/delete paths mutate), then fire `toggleUpvoteAction` in the
  // background and RECONCILE to the server's authoritative `{ voted, count }`. On error ROLL BACK
  // to the pre-click truth: an expired session (`isAuthRequired`) surfaces the expired-session
  // gate (the D1 path); any other error shows the polite §6.4 notice. Per-clip in-flight guard
  // (§2.4.5) prevents a double-click from desyncing the count. Self-vote is allowed — no
  // `ownsClip` special case (Decision 3 / §2.3); this runs for any clip the viewer activates.
  const runUpvote = useCallback(
    (clip: Clip) => {
      const id = clip.id;
      // Guard: ignore a second activation for the SAME clip while one is in flight (§2.4.5).
      if (upvoteInFlight.current.has(id)) return;
      upvoteInFlight.current.add(id);

      // Snapshot the pre-click truth for an exact rollback.
      const wasVoted = votedClipIds.has(id);
      const willVote = !wasVoted;
      const delta = willVote ? 1 : -1;

      setUpvoteError(false);
      // Optimistic apply (instant): flip the voted-state + the displayed count by ±1.
      setVotedClipIds((prev) => {
        const next = new Set(prev);
        if (willVote) next.add(id);
        else next.delete(id);
        return next;
      });
      setClips((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, upvotes: (c.upvotes ?? 0) + delta } : c
        )
      );

      void (async () => {
        try {
          const result = await store.toggleUpvote(id);
          // Reconcile to the server's AUTHORITATIVE values (not the optimistic guess), so the
          // displayed count is the true derived total and the voted-state matches the row truth.
          setVotedClipIds((prev) => {
            const next = new Set(prev);
            if (result.voted) next.add(id);
            else next.delete(id);
            return next;
          });
          setClips((prev) =>
            prev.map((c) => (c.id === id ? { ...c, upvotes: result.count } : c))
          );
        } catch (err) {
          // Roll back the optimistic vote to the pre-click truth.
          setVotedClipIds((prev) => {
            const next = new Set(prev);
            if (wasVoted) next.add(id);
            else next.delete(id);
            return next;
          });
          setClips((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, upvotes: (c.upvotes ?? 0) - delta } : c
            )
          );
          // Expired session (valid at render, gone at click) → the expired-session gate, not a
          // generic error (the D1 path); else the polite non-blocking notice (§6.4 / S32).
          if (isAuthRequired(err)) showExpiredGate();
          else setUpvoteError(true);
        } finally {
          upvoteInFlight.current.delete(id);
        }
      })();
    },
    [votedClipIds, showExpiredGate]
  );

  // Entry point (design §2.2): gate first. Signed in → run the optimistic toggle; logged out →
  // the "Log in to upvote" gate WITHOUT any optimistic vote (the count does not move — a vote that
  // can't persist must never read as cast; AC4). No auto-resume on return (the C/D1 UX-2 rule).
  const upvote = useCallback(
    (clip: Clip) => {
      requireLogin({ gate: "upvote", action: () => runUpvote(clip) });
    },
    [requireLogin, runUpvote]
  );

  // Whether the upvote control renders as a real toggle (signed in) or the login gate trigger.
  const signedIn = typeof myContributorId === "number";
  const votedClip = useCallback(
    (clip: Clip): boolean => votedClipIds.has(clip.id),
    [votedClipIds]
  );

  // Edit submit (design §6.3 / §7.1 / AC1/AC2). The Edit modal hands up the editable-set patch +
  // the agreement boolean; the host calls the auth-gated `updateClipAction` (the server decides
  // ownership + the §5.3 re-stamp), then REPLACES the clip object in the in-memory `clips` array
  // by id so it re-renders in place with no reload (a section change re-anchors via the existing
  // `sectionClips`/`generalClips`/`tocEntries` derivations). Edit does NOT remove the card, so
  // focus-return is the normal `ModalShell` `prevActive` (no band-heading exception — §7.1).
  // Errors branch exactly like `persistClip`: `AuthRequiredError` → the expired gate (modal
  // closes via "expired"); any other error throws so the modal stays open with the §6 alert.
  const onEditSubmit = useCallback(
    (patch: ClipEditFormPatch, agreed: boolean): Promise<SubmitOutcome> => {
      const target = editClip;
      if (!target) return Promise.resolve<SubmitOutcome>({ outcome: "added" });
      return (async () => {
        try {
          const updated = await store.updateClip(
            target.id,
            patch,
            undefined,
            agreed
          );
          setClips((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
          );
          return { outcome: "added" } satisfies SubmitOutcome;
        } catch (err) {
          if (isAuthRequired(err)) {
            showExpiredGate();
            return { outcome: "expired" } satisfies SubmitOutcome;
          }
          throw err; // generic error → the modal keeps open + shows its §6 alert
        }
      })();
    },
    [editClip, showExpiredGate]
  );

  // Delete confirm (design §2.2 / §7.2 / §7.3 / AC3). The confirm dialog runs this; the host
  // calls the auth-gated `deleteClipAction` (server re-checks ownership), then REMOVES the clip
  // from the in-memory `clips` set so it disappears with no reload (counts drop; the last clip
  // flips curated→empty via the existing `mode = clips.length > 0` switch). Because the card is
  // REMOVED, focus must not be lost to <body>: move it to `focusBandHeading()` after the shell's
  // own `prevActive` fires (the rAF pattern the promote/dismiss paths use — §7.3). Errors branch
  // like `persistClip`: auth → expired gate; other → throw (dialog stays open with its alert).
  const onDeleteConfirm = useCallback((): Promise<SubmitOutcome> => {
    const target = deleteFor;
    if (!target) return Promise.resolve<SubmitOutcome>({ outcome: "added" });
    return (async () => {
      try {
        await store.deleteClip(target.id);
        setClips((prev) => prev.filter((c) => c.id !== target.id));
        if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(() => focusBandHeading());
        } else {
          focusBandHeading();
        }
        return { outcome: "added" } satisfies SubmitOutcome;
      } catch (err) {
        if (isAuthRequired(err)) {
          showExpiredGate();
          return { outcome: "expired" } satisfies SubmitOutcome;
        }
        throw err;
      }
    })();
  }, [deleteFor, focusBandHeading, showExpiredGate]);

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
      <TopicHeader articleTitle={displayTitle} />

      <div className="mx-auto max-w-[1200px] px-5">
        {/* Masthead: title + attribution + lead (left) + infobox + TOC (right). */}
        <div className="grid grid-cols-1 gap-7 pt-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0" onClick={onArticleClick}>
            {fetchState === "loading" && <ArticleSkeleton />}
            {fetchState === "error" && (
              <ArticleError
                url={`https://en.wikipedia.org/wiki/${encodeURIComponent(canonicalTitle)}`}
                onRetry={loadArticle}
              />
            )}
            {fetchState === "ready" && article && (
              <ArticleLeadBlock
                title={article.displayTitle}
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
          topicTitle={canonicalTitle}
          generalClips={generalClips}
          generalCandidates={generalCandidates}
          totalGeneral={
            mode === "curated" ? generalClips.length : generalCandidates.length
          }
          loading={candidatesLoading}
          prefersReduced={prefersReduced.current}
          onPlay={setPlayer}
          onPlayCandidate={playCandidate}
          onPromote={promote}
          onDismiss={dismiss}
          onAdd={openAdd}
          /* D3 (issue #54, design §9.2): the owner-only Edit/Delete affordance now reaches
             General-band clips too — closing the D2 gap — reusing the SAME `ownsClip` compare
             and the SAME `setEditClip`/`setDeleteFor` handlers (and the SAME EditModal /
             DeleteConfirmDialog) the rail card uses. The server gate is unchanged (AC8). */
          ownsClip={ownsClip}
          onEdit={(c) => setEditClip(c)}
          onDelete={(c) => setDeleteFor(c)}
          /* D4 (issue #55, design §5): the interactive upvote control on the General tiles —
             signed-in toggle vs. the login gate, the per-viewer voted-state (off the read path),
             and the host's optimistic-with-rollback `upvote`. */
          signedIn={signedIn}
          votedClip={votedClip}
          onUpvote={upvote}
        />
      )}

      {/* Polite live region — announces the candidate search (design §5.4 / §8). */}
      <p className="sr-only" role="status" aria-live="polite">
        {mode === "empty" ? candidateAnnounce : ""}
      </p>

      {/* Dismissal-failure notice (issue #45; design §"dismissal — optimistic rollback").
          Non-blocking + polite: the rolled-back card reappearing is the honest signal; this
          line names why. role="status"/aria-live="polite" — does NOT steal focus or block. */}
      {dismissError && (
        <div className="mx-auto max-w-[1200px] px-5">
          <p
            role="status"
            aria-live="polite"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            Couldn&apos;t dismiss that — please try again.
          </p>
        </div>
      )}

      {/* Upvote-failure notice (issue #55 / D4; design §6.4). NON-BLOCKING + POLITE (role="status"
          aria-live="polite", NOT alert/assertive — an upvote failure is informational, not urgent,
          and must not interrupt the reader). After it shows, the optimistic vote is already rolled
          back (the control shows the truth); this line names why. Verbatim §6.4 copy. */}
      {upvoteError && (
        <div className="mx-auto max-w-[1200px] px-5">
          <p
            role="status"
            aria-live="polite"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            Couldn&apos;t record your upvote — please try again.
          </p>
        </div>
      )}

      {/* Reader: article body sections (left) + the sticky rail (right). */}
      <div className="mx-auto max-w-[1200px] px-5 pb-16">
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0" onClick={onArticleClick}>
            {fetchState === "ready" && article && (
              <ArticleSections
                sections={article.sections}
                activeSlug={activeSlug}
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
            {/* Store-read error floor (issue #45; design §"read failure"). If the clip/
                dismissal read failed (DB down), show an honest line — NOT a permanent
                skeleton, and NOT routed into ArticleError (which is the Wikipedia fetch).
                The article (client-side, AC8) still renders on the left. */}
            {storeError && (
              <p className="text-sm text-red-700">
                Couldn&apos;t load curated videos — please refresh.
              </p>
            )}
            {/* #14 AC5: the one-time "unvetted set" header introduces the rail
                candidate list ONCE — replacing v2's per-card "auto-suggested / no
                context yet" repetition. Names the sources from data; carries no count
                (the volume lives once in the ＋plus panel — AC7). Shown when there are
                rail candidates to introduce. */}
            {mode === "empty" && sectionCandidates.length > 0 && (
              <CandidateSetHeader sources={sources} />
            )}
            {mode === "curated"
              ? sectionClips.map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    active={activeSlug === clip.sectionSlug}
                    owned={ownsClip(clip)}
                    signedIn={signedIn}
                    voted={votedClip(clip)}
                    onUpvote={upvote}
                    onPlay={setPlayer}
                    onGoToSection={(slug) => slug && goTo(slug)}
                    onEdit={(c) => setEditClip(c)}
                    onDelete={(c) => setDeleteFor(c)}
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
                    onPlay={playCandidate}
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

      {/* Mobile-only bottom spacer (design §6.2, AC3): while the full-width pinned
          bar is open it reserves scroll space at the page BOTTOM so the last
          candidate's Promote / Not-relevant row can be scrolled clear of the bar.
          Additive at the bottom only — never shifts content the reader is viewing.
          Desktop needs none (the dock sits in the empty lower-left). Removed on
          dismiss (pinned → null) so the page reflows to full height (§9 State H). */}
      {pinned && (
        <div aria-hidden className="h-[min(60vh,500px)] lg:hidden" />
      )}

      {/* Non-modal, single-instance candidate player (issue #10). Mounts on play,
          unmounts on dismiss — iframe created/torn down with it (embed-never-host).
          Sibling of the modals; if a modal opens it correctly covers this (z-40 <
          z-50). Reuses TopicView's existing prefersReduced signal (AC12). */}
      {pinned && (
        <PinnedPlayer
          clip={pinned}
          onClose={dismissPinned}
          prefersReduced={prefersReduced.current}
        />
      )}

      {/* Citation popover layer (article-fidelity #24, design §3.3). Document-scoped
          (markers in the lead point at reference entries in the section block), so it
          wires every inline `[n]` marker once the article is ready. Non-modal; does
          not touch scroll-sync. Inert until the article's `[data-cite-marker]`s exist. */}
      {fetchState === "ready" && article && <CitationLayer />}

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
          onSubmit={onCurateSubmit}
        />
      )}
      {addOpen && qid && (
        <AddModal
          sections={sectionList}
          topicQid={qid}
          onClose={() => setAddOpen(false)}
          onSubmit={onAddSubmit}
        />
      )}

      {/* Owner-only Edit modal (D2, design §6). Pre-filled; the conditional §5.3 re-agreement
          lives inside CurateFields. The host owns the write (auth-gated updateClipAction) + the
          in-place re-render. The card is not removed, so focus returns to the Edit trigger. */}
      {editClip && (
        <EditModal
          clip={editClip}
          sections={sectionList}
          onClose={() => setEditClip(null)}
          onSubmit={onEditSubmit}
        />
      )}

      {/* Owner-only Delete confirm dialog (D2, design §9). Cancel-as-default; the destructive
          confirm runs the auth-gated deleteClipAction. On success the host removes the clip
          (no reload) and moves focus to the band heading (§7.3). */}
      {deleteFor && (
        <DeleteConfirmDialog
          clip={deleteFor}
          onClose={() => setDeleteFor(null)}
          onConfirm={onDeleteConfirm}
        />
      )}

      {/* Login gate (issue C, design §2 / §9): the modal a logged-out contribute attempt
          (Curate / Add / dismiss) resolves to, and the expired-session gate (§2d). Rendered
          once; null when no gate is open. */}
      {gateElement}
    </>
  );
}
