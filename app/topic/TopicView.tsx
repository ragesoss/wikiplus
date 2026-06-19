"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArticleError,
  ArticleLeadBlock,
  ArticleSections,
  ArticleSkeleton,
} from "@/components/topic/ArticleBody";
import { AddModal } from "@/components/topic/AddModal";
import {
  ArticleNotFound,
  type ArticleNotFoundKind,
} from "@/components/topic/ArticleNotFound";
import { CandidateCard, CandidateSetHeader } from "@/components/topic/CandidateBits";
import { CitationLayer } from "@/components/topic/CitationLayer";
import { ClipCard } from "@/components/topic/ClipCard";
import { CurateModal } from "@/components/topic/CurateModal";
import { DeleteConfirmDialog } from "@/components/topic/DeleteConfirmDialog";
import { RemoveConfirmDialog } from "@/components/topic/RemoveConfirmDialog";
import { EditModal } from "@/components/topic/EditModal";
import type { ClipEditFormPatch } from "@/components/topic/curate-clip";
import type { SubmitOutcome } from "@/components/topic/useCurateSubmit";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import { Infobox } from "@/components/topic/Infobox";
import { PinnedPlayer, type PinnedClip } from "@/components/topic/PinnedPlayer";
import { PlayerModal } from "@/components/topic/PlayerModal";
import { Toc, type TocEntry } from "@/components/topic/Toc";
import { SiteHeader, TopicHeaderSearch } from "@/components/header/SiteHeader";
import { HeaderAuth } from "@/components/header/HeaderAuth";
import { useRequireLogin } from "@/components/auth/useRequireLogin";
import { useSession } from "next-auth/react";
import { isAuthRequired, isRateLimited } from "@/lib/auth/auth-error";
import { AUTH_COPY } from "@/lib/auth/microcopy";
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

// HEAD = the sticky header's steady-state occupied height, used by the scroll-sync math to compute
// section scroll targets. The shared header's slim sticky bar is 56px (#72 design §2/§8 — the
// SLIM_BAR_HEIGHT); the Tier-A extra height (104px) only exists at scroll-top, before any sync
// runs, so the slim height is the correct steady-state offset (#72 DQ-3 — no article jump).
const HEAD = 56;
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
  // D5b (issue #58, design §4.1): the moderator/reviewer predicate, resolved the SAME off-read-path
  // way as `myContributorId` — from the authenticated client session claim Dev derived server-side
  // (the DB column OR the env allowlist, lib/auth/config.ts), NEVER a client-typed flag. Default
  // false (logged-out + every non-moderator). It decides which clips show the reviewer Hold/Approve
  // affordances; the SECURITY control is the server-side role-gate inside the two actions. An
  // anonymous reader does ZERO role work and the read-path render is byte-for-byte unchanged (AC7).
  const isModerator = session?.user?.isModerator === true;
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
  // Resolve outcome (issue #19): the resolve step distinguishes a NONEXISTENT well-formed
  // title (`"missing"` — there's no Wikipedia article by that title, the #19 case) from a
  // /topic/ URL with nothing to resolve at all (`"no-identifier"`). Both render the full-page
  // `ArticleNotFound`, differing only by `kind`; `null` = still resolving / resolved fine.
  // This replaces the prior single `resolveError` boolean that conflated the two.
  const [resolveOutcome, setResolveOutcome] = useState<
    null | ArticleNotFoundKind
  >(null);
  // The header topic-search prefill+focus signal (issue #19, article-not-found §7). The
  // not-found page's primary action sets this; `TopicHeaderSearch` forwards it to the
  // underlying `TopicSearch`, which seeds + focuses on each `nonce` bump (so re-searching
  // the SAME attempted title still re-focuses). Keeps the reader IN-APP, prefilled — no
  // bounce to Wikipedia and no navigation to a guessed/dead slug.
  const [searchPrefill, setSearchPrefill] = useState<{
    value: string;
    nonce: number;
  } | null>(null);
  const onNotFoundSearch = useCallback((prefill: string) => {
    setSearchPrefill((prev) => ({
      value: prefill,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, []);

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
  // Optimistic-dismissal notice REASON (design §"dismissal — optimistic rollback"; D5a §5.3): a
  // non-blocking polite line shown when a dismissal write is rolled back and the card reappears.
  // `null` = no notice; "generic" = the red "couldn't dismiss" failure; "limited" = the calm D5a
  // rate-limit notice. One surface, reason-aware (the optimistic rollback is unchanged).
  const [dismissNotice, setDismissNotice] = useState<
    null | "generic" | "limited"
  >(null);
  // ── Upvotes (issue #55 / D4). ──────────────────────────────────────────────────────────
  // The PER-VIEWER voted-state — the set of clip ids THIS viewer has upvoted — resolved in the
  // ALREADY-AUTHENTICATED client session, OFF the cached read path (Decision 6 / design §8). It
  // hydrates AFTER the topic shell renders (the hydrate-on-mount effect below); an anonymous load
  // does ZERO voted-state work. The DISPLAYED count rides `clips` (the derived total `listClips`
  // computed — public, Decision 2). An optimistic ±1 to the count lives in `clips` directly (the
  // same in-memory clip-state the add/edit/delete paths mutate), reconciled to the server's
  // authoritative `{ voted, count }` on the toggle's return.
  const [votedClipIds, setVotedClipIds] = useState<Set<string>>(new Set());
  // Non-blocking polite notice REASON when a non-auth toggle write is rolled back (design §6.4;
  // D5a §5.2). `null` = no notice; "generic" = the red "couldn't record your upvote" failure;
  // "limited" = the calm D5a rate-limit notice. The rolled-back count/state is the honest signal;
  // this line names why. One surface, reason-aware (the optimistic rollback is unchanged).
  const [upvoteNotice, setUpvoteNotice] = useState<
    null | "generic" | "limited"
  >(null);
  // Per-clip in-flight guard (design §2.4.5): a second activation for the same clip is ignored
  // until the first resolves, so a double-click can't desync the optimistic count.
  const upvoteInFlight = useRef<Set<string>>(new Set());
  // ── Review-hold (issue #58 / D5b). ───────────────────────────────────────────────────────
  // The set of clip ids with a hold/approve IN FLIGHT (drives the busy word + disable; the per-clip
  // double-submit guard — design §5.2). A `useState` (not a ref) so the busy word re-renders. The
  // reason-aware notice mirrors `upvoteNotice`/`dismissNotice`: `null` = none; "generic" = the red
  // "couldn't hold/approve" failure; "limited" = the calm D5a rate-limit notice (design §6).
  const [reviewInFlightIds, setReviewInFlightIds] = useState<Set<string>>(
    new Set()
  );
  const [reviewNotice, setReviewNotice] = useState<
    null | { reason: "generic" | "limited"; verb: "hold" | "approve" }
  >(null);
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
  // D5c (issue #59): the clip pending the moderator Remove-confirmation (the RemoveConfirmDialog
  // target — set by the Remove affordance, cleared on cancel/success). Distinct from `deleteFor`
  // (the D2 owner-delete confirm) — a separate dialog, action, and persistence (soft vs. hard).
  const [removeFor, setRemoveFor] = useState<Clip | null>(null);

  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  // ── Resolve the page identity (title ⇄ QID), then canonicalize the URL. ──
  // Title route: title is canonical; resolve QID under the hood (seeded store first,
  // then the Wikipedia API). ?qid= route: resolve QID→title, then replace the URL with
  // the canonical /topic/<Title>/ so the QID never lingers in the address bar.
  useEffect(() => {
    let alive = true;
    setResolveOutcome(null);
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
          // A well-formed title that Wikipedia could not resolve → the #19 "missing" case
          // (there IS an attempted title to echo + offer search for). Never canonicalize
          // to the typed slug (AC6).
          setResolveOutcome("missing");
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
          // A `?qid=` that resolved to no title → "missing" (no attempted title to echo;
          // ArticleNotFound shows the generic missing body since `attemptedTitle` is omitted).
          setResolveOutcome("missing");
        }
        return;
      }
      // No path title AND no `?qid=` at all — nothing to resolve, nothing to echo.
      if (alive) setResolveOutcome("no-identifier");
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

  // The STABLE identity of the visible clip set — the comma-joined ids in render order. The
  // voted-state hydration keys off THIS, not the whole `clips` array: an optimistic upvote toggle
  // mutates a clip's `upvotes` count (a new `clips` array ref) but NOT the id set, so it must not
  // re-fire the read mid-flight (design §8 — "a quiet correction, never a flash of wrong state").
  // A genuine change to the visible set (navigating, a clip added/removed) DOES change this key
  // and correctly re-hydrates. `useMemo` recomputes the joined string every render, but the value
  // is referentially equal when the id set is unchanged, so the effect below does not re-fire.
  const clipIdsKey = useMemo(() => clips.map((c) => c.id).join(","), [clips]);
  // The id array the read consumes, recomputed only when the STABLE key changes (an empty key
  // means no clips). Keying off `clipIdsKey` keeps this array referentially stable across a
  // count-only `clips` mutation, so neither it nor the effect below re-fires mid-toggle.
  const clipIds = useMemo(
    () => (clipIdsKey === "" ? [] : clipIdsKey.split(",")),
    [clipIdsKey]
  );

  // ── Per-viewer voted-state hydration (issue #55 / D4, Decision 6 / design §8). ─────────────
  // OFF the cached read path: this runs ONLY in the already-authenticated client session, AFTER
  // the clips (and thus the public derived counts) have loaded — never baked into `listClips` or
  // the SSG shell. An ANONYMOUS viewer (no `myContributorId`) does ZERO voted-state work (AC7):
  // the effect bails before any read, and the control renders the logged-out "Log in to upvote"
  // form. For a signed-in viewer it reads WHICH of the visible clips they have voted on (a small
  // viewer-scoped read of their own votes), then the controls show the voted cue — a quiet
  // correction, never a flash of a wrong "voted" before it is confirmed (it only ADDS the cue).
  // It depends on `clipIds` (the STABLE id-set identity, a memo keyed off `clipIdsKey`), NOT
  // `clips`, so an in-flight optimistic toggle's ±1 count mutation cannot re-fire this read and
  // clobber the optimistic voted-state flip with a stale pre-write server read (the D4 flicker
  // fix — design §8).
  useEffect(() => {
    if (typeof myContributorId !== "number" || clipIds.length === 0) {
      setVotedClipIds(new Set());
      return;
    }
    let alive = true;
    (async () => {
      try {
        const ids = await store.votedClipIds(clipIds);
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
    // Depends on `clipIds` (a memo keyed off the STABLE `clipIdsKey`), NOT `clips`: it is
    // referentially stable across a count-only `clips` mutation, so an in-flight optimistic
    // upvote does not re-fire this read and clobber the optimistic voted-state flip.
  }, [myContributorId, clipIds]);

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

  // The topic title is split into canonical vs. display.
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

  // ── Three-state derivation (issue #60 §0). Retires the binary `mode = clips.length > 0`.
  // Two independent facts drive coexistence: curated content (the priority content) and the
  // REMAINING, deduped suggestions (`liveCandidates`). When both are non-empty the page reads
  // as "mixed" and renders BOTH, curated first. This is a presentation derivation, not a
  // data-model change — and it is a STABLE FILTER over the already-derived `liveCandidates`:
  // curating one suggestion only removes that one id (via `setDismissed`/`setPersistedDismissed`
  // in the curate path) and the candidate-pipeline effect deliberately excludes `clips` from
  // its deps, so no re-run / re-fetch / reshuffle happens on curation (AC9/AC10 — the bar).
  const hasCurated = clips.length > 0;
  const hasSuggestions = liveCandidates.length > 0;

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

  // ── TOC entries: ＋ band row first, then sections with DUAL counts (issue #60 §5.2). ──
  // Each row carries BOTH a curated count and a suggested count; the Toc renders both badges
  // where a row has both. The ＋General row uses
  // the general clip/candidate counts; section rows use the section-anchored counts.
  const tocEntries: TocEntry[] = useMemo(() => {
    const sections = article?.sections ?? [];
    const curatedFor = (slug: string) =>
      sectionClips.filter((c) => c.sectionSlug === slug).length;
    const suggestedFor = (slug: string) =>
      sectionCandidates.filter((c) => c.sectionSlug === slug).length;
    return [
      {
        slug: "__general",
        title: "General",
        level: 2,
        curated: generalClips.length,
        suggested: generalCandidates.length,
      },
      ...sections.map((s) => ({
        slug: s.slug,
        title: s.title,
        level: s.level,
        curated: curatedFor(s.slug),
        suggested: suggestedFor(s.slug),
      })),
    ];
  }, [
    article,
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

  // First clip/candidate per section (the rail card to scroll to). Issue #60 §2.3: the
  // union, curated-first — `sectionClips` come before `sectionCandidates`, so for any section
  // that has a curated clip `railItems.find(...)` resolves to the curated card as the sync
  // anchor; a section with only suggestions anchors on its first suggestion. The sync mechanics
  // (active-section pairing, the TOC highlight) are otherwise untouched.
  const railItems = useMemo(
    () => [...sectionClips, ...sectionCandidates],
    [sectionClips, sectionCandidates]
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
      setDismissNotice(null);
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
          // Three-arm catch (D5a §2 — mutually exclusive): an expired session → the login gate
          // (D1); the per-identity write cap (RateLimitedError) → the CALM limit notice; any other
          // failure → the generic red "couldn't dismiss" notice. The rollback above already ran.
          if (isAuthRequired(err)) showExpiredGate();
          else if (isRateLimited(err)) setDismissNotice("limited");
          else setDismissNotice("generic");
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
  // ＋plus panel primary action (plus-overview-redesign §6 / §10): Browse/Jump ALWAYS scrolls
  // to the General band / first video — never opens curate. Not a write, so it runs regardless
  // of session. (Splits the formerly-overloaded `curateFirst`, which scrolled OR curated.)
  const browseVideos = useCallback(() => {
    document.getElementById("general-band")?.scrollIntoView({ block: "start" });
  }, []);
  // Add video — gated (design §2c). Signed in → open AddModal; logged out → "Log in to add".
  const openAdd = useCallback(() => {
    requireLogin({ gate: "add", action: () => setAddOpen(true) });
  }, [requireLogin]);

  // ── Persist a curated clip (issue #52 / D1, AC1–AC5). ──────────────────────────────────
  // The two modals (Promote / Add) hand the assembled clip + the CC BY-SA consent up here; the
  // host owns the write (the auth-gated boundary), the in-memory clip-state update (the new clip
  // renders with no reload — AC2/AC5; the first curation moves the page empty→mixed since
  // `hasCurated` derives from `clips.length`, issue #60 §0), and the expired-session gate (it
  // holds `useRequireLogin`). It returns the
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
        // D5a §5.1: the per-identity write cap was hit (RateLimitedError). The modal STAYS OPEN
        // with the note + fields intact and shows the CALM limit notice (publish to idle) — NOT
        // the gate (the user is signed in) and NOT the generic red error (nothing is broken).
        if (isRateLimited(err)) {
          return { outcome: "limited" };
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

  // ── Review-hold affordances + actions (issue #58 / D5b, design §4/§5/§6). ──────────────────
  // The AFFORDANCE predicates (design §4.1) — computed in the already-authenticated client session,
  // off the read path (like `ownsClip`). NOT the security control: the server re-resolves the role
  // and gates the write regardless of any button (AC4/AC5).
  //   - Hold renders iff (moderator OR own-curator) AND the clip is PUBLISHED (!held).
  //   - Approve renders iff MODERATOR AND the clip is HELD. No one else — not the curator.
  const canHold = useCallback(
    (clip: Clip): boolean =>
      !clip.held && (isModerator || ownsClip(clip)),
    [isModerator, ownsClip]
  );
  const canApprove = useCallback(
    (clip: Clip): boolean => Boolean(clip.held) && isModerator,
    [isModerator]
  );
  // D5c (issue #59, design §4.1): the Remove-affordance predicate — MODERATOR-ONLY, on ANY clip,
  // with NO own-curator OR-arm (the KEY contrast with `canHold`). A curator who is not a moderator
  // never sees Remove, even on their own clip (they have D2 Delete for that). Off the read path
  // (the `isModerator` claim is already read for D5b) — no read-path cost (AC7). NOT the security
  // control: `removeClipAction` re-resolves the role server-side and rejects a non-moderator (incl.
  // the clip's own curator) regardless of any button (AC2/AC3). `_clip` is unused — Remove renders
  // for a moderator on every clip, never gated by the clip's chips/owner/held state.
  const canRemove = useCallback(
    (_clip: Clip): boolean => isModerator,
    [isModerator]
  );
  const reviewInFlight = useCallback(
    (clip: Clip): boolean => reviewInFlightIds.has(clip.id),
    [reviewInFlightIds]
  );

  // Focus after the action (design §5.3, binding a11y): neither hold nor approve REMOVES the card,
  // so focus must NOT be lost to <body> and must NOT jump to `focusBandHeading()` (that anchor is
  // for the removed-node case). Move focus to the SWAPPED control on the SAME card (the reviewer
  // row's button), or — the curator-hold edge, where the curator's only affordance disappears —
  // to a stable same-card anchor (the card's section link). Scheduled post-render via rAF so the
  // row has re-rendered with the swapped button.
  const focusAfterReview = useCallback((clipId: string) => {
    const run = () => {
      const card = cardEls.current.get(clipId);
      if (!card) return;
      // Prefer a control inside the reviewer row ("Review this clip"); else the card's first
      // interactive element (the section link). NEVER <body>.
      const target =
        card.querySelector<HTMLElement>(
          '[aria-label="Review this clip"] button'
        ) ?? card.querySelector<HTMLElement>("button, a");
      target?.focus();
    };
    if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(run);
    else run();
  }, []);

  // The awaited busy-state hold/approve (design §5.2 — NOT optimistic: infrequent, deliberate
  // reviewer acts). Disable + busy word, fire the role-gated action, and on SUCCESS flip the
  // in-memory `clips` clip's `held` flag (no reload — §5.1) and move focus per §5.3; on ERROR
  // leave the clip UNCHANGED and surface the THREE-ARM catch (§6): isAuthRequired → the expired
  // gate; isRateLimited → the calm rateLimit.notice; else the polite red notice. A per-clip
  // in-flight guard blocks a double-submit.
  const runReview = useCallback(
    (clip: Clip, verb: "hold" | "approve") => {
      const id = clip.id;
      if (reviewInFlightIds.has(id)) return; // double-submit guard (§5.2)
      setReviewNotice(null);
      setReviewInFlightIds((prev) => new Set(prev).add(id));
      void (async () => {
        try {
          // setClipVetted routes to the role-gated action: approve → vetted=true; hold → false.
          const updated = await store.setClipVetted(id, verb === "approve");
          // No-reload flag flip: replace the clip object by id so the marking + the row's
          // Hold↔Approve swap re-render in place (§5.1). No other field changes.
          setClips((prev) => prev.map((c) => (c.id === id ? updated : c)));
          focusAfterReview(id);
        } catch (err) {
          // Three-arm catch (§6 — mutually exclusive); the clip is left UNCHANGED (no false success).
          if (isAuthRequired(err)) showExpiredGate();
          else if (isRateLimited(err)) setReviewNotice({ reason: "limited", verb });
          else setReviewNotice({ reason: "generic", verb });
        } finally {
          setReviewInFlightIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      })();
    },
    [reviewInFlightIds, focusAfterReview, showExpiredGate]
  );

  const runHold = useCallback(
    (clip: Clip) => runReview(clip, "hold"),
    [runReview]
  );
  const runApprove = useCallback(
    (clip: Clip) => runReview(clip, "approve"),
    [runReview]
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

      setUpvoteNotice(null);
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
          // Three-arm catch (D5a §2 — mutually exclusive): an expired session → the expired-session
          // gate (the D1 path); the per-identity write cap (RateLimitedError) → the CALM limit
          // notice; any other failure → the generic red §6.4 notice. The rollback above already ran,
          // so the control shows the truth (the vote did not happen — AC2).
          if (isAuthRequired(err)) showExpiredGate();
          else if (isRateLimited(err)) setUpvoteNotice("limited");
          else setUpvoteNotice("generic");
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
          // D5a §5.3: the edit is a counted gated write — on the rate-limit cap keep the modal open
          // with the edits intact + the calm limit notice (not the gate, not the generic red error).
          if (isRateLimited(err)) {
            return { outcome: "limited" } satisfies SubmitOutcome;
          }
          throw err; // generic error → the modal keeps open + shows its §6 alert
        }
      })();
    },
    [editClip, showExpiredGate]
  );

  // Delete confirm (design §2.2 / §7.2 / §7.3 / AC3). The confirm dialog runs this; the host
  // calls the auth-gated `deleteClipAction` (server re-checks ownership), then REMOVES the clip
  // from the in-memory `clips` set so it disappears with no reload (counts drop; deleting the
  // last clip moves the page back to empty/mixed via the `hasCurated`/`hasSuggestions`
  // derivation, issue #60 §0). Because the card is
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
        // D5a §5.3: a delete is a counted gated write — on the rate-limit cap keep the confirm
        // dialog open with the calm limit notice (the dialog renders it per its surface).
        if (isRateLimited(err)) {
          return { outcome: "limited" } satisfies SubmitOutcome;
        }
        throw err;
      }
    })();
  }, [deleteFor, focusBandHeading, showExpiredGate]);

  // Remove confirm (issue #59 / D5c, design §5.5 / §6). MIRRORS `onDeleteConfirm`: the
  // RemoveConfirmDialog runs this with the OPTIONAL audit-only reason; the host calls the
  // role-gated `removeClipAction` (server re-resolves the moderator role — no own-curator arm),
  // then FILTERS the clip out of the in-memory `clips` set so it disappears with NO reload (counts
  // drop; removing the last clip moves the page back to empty/mixed via the
  // `hasCurated`/`hasSuggestions` derivation, issue #60 §0). The
  // SERVER soft-remove (`removed_at` set) + the `removed_at IS NULL` read filter are the durable
  // truth; this in-memory filter is the no-reload reflect (the clip leaves the read either way).
  // Because the card is REMOVED, focus must not be lost to <body>: move it to `focusBandHeading()`
  // (the same removed-node anchor D2 Delete uses — §6.2) after the shell's `prevActive` fires (the
  // rAF pattern). The THREE-ARM catch (§5.5, mutually exclusive): isAuthRequired → the expired gate
  // (dialog closes via "expired"); isRateLimited → the calm limit notice in the dialog (it stays
  // open via "limited"); else throw (the dialog keeps open with its role="alert"). No false success
  // — the clip only leaves the page on a real server success.
  const onRemoveConfirm = useCallback(
    (reason: string | null): Promise<SubmitOutcome> => {
      const target = removeFor;
      if (!target) return Promise.resolve<SubmitOutcome>({ outcome: "added" });
      return (async () => {
        try {
          await store.removeClip(target.id, undefined, reason);
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
          if (isRateLimited(err)) {
            return { outcome: "limited" } satisfies SubmitOutcome;
          }
          throw err;
        }
      })();
    },
    [removeFor, focusBandHeading, showExpiredGate]
  );

  const sectionList = useMemo(
    () => (article?.sections ?? []).map((s) => ({ slug: s.slug, title: s.title })),
    [article]
  );

  // Not-found (issue #19). A NONEXISTENT well-formed title / unresolvable identifier reaches
  // the full-page `ArticleNotFound` — distinct from the in-pane transient `ArticleError`
  // (which only fires AFTER a page resolved and its article fetch failed; see fetchState
  // below). `no-identifier` also covers a /topic/ URL with no title and no ?qid= that hasn't
  // even reached the resolve branch yet. The page IS this state, so we return BEFORE the
  // split-pane shell — but WITH the shared header so the reader has the topic search (§2/§7).
  // The kind drives copy; for "missing" the attempted title is the path title (space-form).
  const notFoundKind: ArticleNotFoundKind | null =
    resolveOutcome ?? (!resolved && !routeTitle && !qidParam ? "no-identifier" : null);
  if (notFoundKind) {
    return (
      <>
        <SiteHeader
          host="topic"
          articleTitle={undefined}
          search={<TopicHeaderSearch prefill={searchPrefill ?? undefined} />}
          auth={<HeaderAuth />}
        />
        <ArticleNotFound
          kind={notFoundKind}
          attemptedTitle={
            notFoundKind === "missing" ? (routeTitle ?? undefined) : undefined
          }
          onSearch={onNotFoundSearch}
        />
      </>
    );
  }

  const sources =
    [...new Set(candidates.map((c) => c.source))].join(" + ") || "YouTube";

  return (
    <>
      {/* The ONE shared Daylight Projector header (#72), Topic host: search upper-left (inline ≥ md
          / disclosure icon-reveal < md — AC6/AC7), the lockup seam aligned to the real article↔plus
          divider at ≥ lg (AC2), scroll-aware Tier-A → slim Tier-C bar (AC4), the wordmark a home
          link (AC3), ONE consolidated AuthControl reachable at every breakpoint (AC8/AC9 — `home`
          skin ≥ md on the light field / `topic-compact` < md), and the muted slim-state title cue
          (A4). Replaces the retired bespoke TopicHeader (AC1). */}
      <SiteHeader
        host="topic"
        articleTitle={displayTitle}
        search={<TopicHeaderSearch />}
        auth={<HeaderAuth />}
      />

      {/* Illumination falloff (design header-topic-integration Decision 2 / §3.2 / AC8 / AC8b):
          the FIRST thing in the Topic page content, flush beneath the sticky header. It is a
          FULL-BLEED, decorative BACKGROUND paint (the `.topic-illum` white→grey gradient over a grey
          base) — NOT a spacer, so it adds NO vertical height (the masthead's pt-6 + the article
          title/lead do not shift down — AC10). The white beam lands on the white page top with no
          seam; the brightness falls off to the body grey over 96px, then flat grey. It is ordinary
          page content that scrolls away with the article, so by the collapse threshold the field is
          out of view and flat grey sits under the slim bar (AC8b). aria-hidden via no text; it never
          intercepts pointer events over the masthead (the gradient is a passive background). */}
      <div className="topic-illum">
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
                  hasCurated={hasCurated}
                  stats={stats}
                  suggestionCount={liveCandidates.length}
                  storeError={storeError}
                  onBrowse={browseVideos}
                />
                <Toc
                  entries={tocEntries}
                  currentSlug={activeSlug}
                  onGo={goTo}
                />
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* General / Suggested band — full bleed (the one crossover). */}
      {storeReady && (
        <GeneralStrip
          topicTitle={canonicalTitle}
          generalClips={generalClips}
          generalCandidates={generalCandidates}
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
          /* D5b (issue #58, design §4): the reviewer-only Hold/Approve affordances on General tiles,
             reusing the SAME off-read-path predicates + the SAME runHold/runApprove the rail uses. */
          canHold={canHold}
          canApprove={canApprove}
          reviewInFlight={reviewInFlight}
          onHold={runHold}
          onApprove={runApprove}
          /* D5c (issue #59, design §4.2): the moderator-only Remove affordance on General tiles,
             reusing the SAME off-read-path `canRemove` predicate + the SAME setRemoveFor the rail
             uses. The server-side role-gate is the security control; this affordance mirrors it. */
          canRemove={canRemove}
          onRemove={(c) => setRemoveFor(c)}
        />
      )}

      {/* Polite live region — announces the candidate search (design §5.4 / §8; issue #60
          §7.4). It fires WHENEVER a candidate fetch runs — in MIXED as well as empty (the
          legacy gate was `mode === "empty"`). `candidateAnnounce` is "" until a fetch runs,
          so a fully-curated / no-key load announces nothing. */}
      <p className="sr-only" role="status" aria-live="polite">
        {candidateAnnounce}
      </p>

      {/* Dismissal notice (issue #45; design §"dismissal — optimistic rollback"; D5a §5.3).
          Non-blocking + polite: the rolled-back card reappearing is the honest signal; this line
          names why. role="status"/aria-live="polite" — does NOT steal focus or block. REASON-AWARE:
          "generic" = the red failure; "limited" = the CALM (non-red, ink-on-bg2) D5a limit notice. */}
      {dismissNotice && (
        <div className="mx-auto max-w-[1200px] px-5">
          <p
            role="status"
            aria-live="polite"
            className={
              dismissNotice === "limited"
                ? "rounded-md border-l-4 border-brand bg-bg2 px-3 py-2 text-sm text-ink"
                : "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
            }
          >
            {dismissNotice === "limited"
              ? AUTH_COPY.rateLimit.notice
              : "Couldn't dismiss that — please try again."}
          </p>
        </div>
      )}

      {/* Upvote notice (issue #55 / D4; design §6.4; D5a §5.2). NON-BLOCKING + POLITE (role="status"
          aria-live="polite", NOT alert/assertive — informational, not urgent, must not interrupt the
          reader). After it shows, the optimistic vote is already rolled back (the control shows the
          truth — AC2); this line names why. REASON-AWARE: "generic" = the red §6.4 failure copy;
          "limited" = the CALM (non-red, ink-on-bg2) D5a limit notice (the same surface, the words
          switch). Announced ONCE on appearance (the reason flip), never per render (§7). */}
      {upvoteNotice && (
        <div className="mx-auto max-w-[1200px] px-5">
          <p
            role="status"
            aria-live="polite"
            className={
              upvoteNotice === "limited"
                ? "rounded-md border-l-4 border-brand bg-bg2 px-3 py-2 text-sm text-ink"
                : "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
            }
          >
            {upvoteNotice === "limited"
              ? AUTH_COPY.rateLimit.notice
              : "Couldn't record your upvote — please try again."}
          </p>
        </div>
      )}

      {/* Review-hold notice (issue #58 / D5b; design §6). NON-BLOCKING + POLITE (role="status"
          aria-live="polite"). REASON-AWARE, mirroring the upvote/dismiss surface: "limited" = the
          CALM (non-red, ink-on-bg2, border-l-4 border-brand) D5a rate-limit notice; "generic" = the
          polite red failure, verb-specific ("hold" vs. "approve"). On failure the clip is unchanged
          (no false success — the marking only changes on a real server success). */}
      {reviewNotice && (
        <div className="mx-auto max-w-[1200px] px-5">
          <p
            role="status"
            aria-live="polite"
            className={
              reviewNotice.reason === "limited"
                ? "rounded-md border-l-4 border-brand bg-bg2 px-3 py-2 text-sm text-ink"
                : "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
            }
          >
            {reviewNotice.reason === "limited"
              ? AUTH_COPY.rateLimit.notice
              : reviewNotice.verb === "approve"
                ? "Couldn't approve that — please try again."
                : "Couldn't hold that — please try again."}
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
              hasCurated && hasSuggestions
                ? "wiki+ curated and suggested videos"
                : hasCurated
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
            {/* Issue #60 §2.2: the rail renders TWO stacked groups, curated FIRST. The
                section-anchored curated ClipCards (full chrome) lead; then the one-time
                CandidateSetHeader introduces the suggestion subset; then the section-anchored
                CandidateCards. Curated and suggested are NEVER interleaved. The curated cards
                paint from `clips` regardless of candidate loading (§7.4) — a slow/failed
                candidate fetch never disturbs them (AC10). */}
            {sectionClips.map((clip) => (
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
                /* D5b (issue #58, design §4): reviewer-only Hold/Approve on the rail card. */
                canHold={canHold(clip)}
                canApprove={canApprove(clip)}
                reviewInFlight={reviewInFlight(clip)}
                onHold={runHold}
                onApprove={runApprove}
                /* D5c (issue #59, design §4.2): moderator-only Remove on the rail card. */
                canRemove={canRemove(clip)}
                onRemove={(c) => setRemoveFor(c)}
                cardRef={(el) => {
                  if (el) cardEls.current.set(clip.id, el);
                  else cardEls.current.delete(clip.id);
                }}
              />
            ))}
            {/* #14 AC5 / issue #60 §2.2/§5.3: the one-time "unvetted set" header introduces
                the rail suggestion subset ONCE. Its gate is now "≥1 rail suggestion" — NOT
                `mode === "empty"` — so it sits BETWEEN the curated group and the suggestion
                group in a mixed rail. In mixed it uses the "The suggested videos below…"
                copy (`scope="subset"`); in a pure-suggestion rail (0 curated) it keeps the
                #14 empty-state copy. Carries no count (the volume lives once in the ＋plus
                panel — AC7). */}
            {sectionCandidates.length > 0 && (
              <CandidateSetHeader
                sources={sources}
                scope={hasCurated ? "subset" : "all"}
              />
            )}
            {sectionCandidates.map((c) => (
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
            {/* Fully-curated edge: every curated clip is a general overview (no section-
                anchored cards) AND there are no suggestions — the rail body is empty, so
                point the reader at the strip above (unchanged copy, §7.3). */}
            {hasCurated &&
              sectionClips.length === 0 &&
              sectionCandidates.length === 0 &&
              !candidatesLoading && (
                <p className="text-sm text-muted">
                  All curated clips for this topic are general overviews — see the
                  strip above.
                </p>
              )}
            {/* Rail suggestion-region loading / zero-results lines (design §5.2 / §5.4;
                issue #60 §7.4/§7.5). The loading line shows whenever a candidate fetch is in
                flight AND no rail suggestions have resolved yet — in MIXED as well as empty;
                it sits AFTER the curated group, so curated cards are never disturbed. */}
            {candidatesLoading && sectionCandidates.length === 0 && (
              <p className="text-sm text-muted" aria-live="polite">
                Looking for suggestions…
              </p>
            )}
            {/* The honest "no suggestions" line shows only when there is NO curated content
                either (the empty-with-no-results case). With curated clips present a zero
                suggestion count simply reads as fully-curated — no suggestion chrome (§7.5). */}
            {!hasCurated &&
              !candidatesLoading &&
              sectionCandidates.length === 0 &&
              generalCandidates.length === 0 && (
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

      {/* Moderator-only Remove confirm dialog (D5c, design §5). Cancel-as-default; the destructive
          confirm runs the role-gated removeClipAction with the OPTIONAL audit-only reason. On
          success the host filters the clip out of `clips` (no reload — soft-removed server-side; the
          read excludes it) and moves focus to the band heading (§6.2). Distinct from the D2 Delete
          confirm above (soft tombstone vs. hard delete; "Remove clip" vs. "Delete clip"). */}
      {removeFor && (
        <RemoveConfirmDialog
          clip={removeFor}
          onClose={() => setRemoveFor(null)}
          onConfirm={onRemoveConfirm}
        />
      )}

      {/* Login gate (issue C, design §2 / §9): the modal a logged-out contribute attempt
          (Curate / Add / dismiss) resolves to, and the expired-session gate (§2d). Rendered
          once; null when no gate is open. */}
      {gateElement}
    </>
  );
}
