"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AuthControl } from "@/components/auth/AuthControl";
import { SiteHeader } from "@/components/header/SiteHeader";
import { RecentFeedItem } from "@/components/recent/RecentFeedItem";
import { store } from "@/lib/data";
import type { ContributorClip } from "@/lib/data/types";

// The recent-curations feed view (`/recent`, issue #160 / design). The first NON-topic-centric
// surface: a single full-viewport vertical snap-scroll of the clips most recently CURATED across the
// whole site, newest first, click-to-play, paged by an opaque keyset cursor. It composes the
// universal projector header (host="page") and is fully browsable LOGGED-OUT (§5/§6).
//
// SCROLL MODEL (§3.1): a vertical, mandatory-snap track; each item is one full-viewport snap stop
// sized to `100dvh - SLIM_BAR_HEIGHT` so it clears the sticky header's collapsed slim bar and snap
// stops land cleanly. Snap is a native SETTLING behavior layered on ordinary scrolling — we do NOT
// hijack the wheel/keys; Tab/arrows/Page move normally and snap settles the result.
//
// PLAYBACK (§3.2/§3.3): click-to-play embed facade with a SINGLE ACTIVE PLAYER (playing a second
// clip stops the first) AND auto-pause on scroll-away (an IntersectionObserver tears a playing
// off-screen item back to its poster). This is NOT autoplay — the next item never auto-starts.
//
// PAGINATION (§3.4): an IntersectionObserver SENTINEL a screenful before the end fetches the next
// page; a keyboard/AT "Show more" button at the tail is the always-present fallback. Pages APPEND —
// loaded items never reorder. `nextCursor === null` ⇒ the end-of-feed marker.

// The collapsed slim-bar height (host="page"); items size to 100dvh minus this so the first item is
// fully visible at scroll-top and after the beam collapses (mirrors SiteHeader's SLIM_BAR_HEIGHT).
const SLIM_BAR_HEIGHT = 56;
const ITEM_HEIGHT = `calc(100dvh - ${SLIM_BAR_HEIGHT}px)`;

type FeedState = "loading" | "empty" | "error" | "populated";
type TailState = "idle" | "loading" | "error" | "end";

// ── Feed SCOPE (issue #162). ─────────────────────────────────────────────────────────────────────
// The one feed body serves BOTH `/recent` (the whole-site discovery feed, #160) and `/watchlist` (the
// per-user feed of curations on watched topics, #162). The scroll/playback/pagination/a11y model is
// IDENTICAL — only the data source + a little copy differ — so the difference is captured in a small
// `FeedScope` the view is parameterized by, NOT a forked component (the issue's "reuse, don't rebuild"
// contract). The route picks the scope; `/recent` defaults to `recentScope`.
export interface FeedPage {
  items: ContributorClip[];
  nextCursor: string | null;
  /** Watchlist only (#162): how many topics the viewer watches — distinguishes the two empties. */
  watchedTopicCount?: number;
}
export interface FeedScope {
  /** The document's single (visually-hidden) <h1>. */
  h1: string;
  /** The initial-loading announcement + status copy. */
  loadingLabel: string;
  /** The initial-error panel heading + body. */
  errorHeading: string;
  errorBody: string;
  /** The end-of-feed marker's two lines. */
  endPrimary: string;
  endSecondary: string;
  /** Fetch the first page (newest first). */
  loadInitial(): Promise<FeedPage>;
  /** Fetch the page strictly older than `cursor`. */
  loadMore(cursor: string): Promise<FeedPage>;
  /** Render the zero-items empty panel — scope-specific (the initial page is passed so the watchlist
   *  scope can tell "no topics watched" from "watched but no curations" via `watchedTopicCount`). */
  renderEmpty(page: FeedPage): React.ReactNode;
}

/** The `/recent` scope (#160): the whole-site feed, the original copy + the global recent read. */
export const recentScope: FeedScope = {
  h1: "Recent curations",
  loadingLabel: "Loading recent curations…",
  errorHeading: "Couldn't load the feed",
  errorBody: "Something went wrong loading recent curations.",
  endPrimary: "You're all caught up.",
  endSecondary: "That's every curation, newest first.",
  loadInitial: () => store.listRecentCurations({}),
  loadMore: (cursor) => store.listRecentCurations({ cursor }),
  renderEmpty: () => <RecentEmptyPanel />,
};

/** Mount-time reduced-motion signal (the SiteHeader/useIsPhone matchMedia pattern). Default false
 *  for SSR; refines after mount. Gates any PROGRAMMATIC smooth scroll (§3.1/§8.5). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mql.matches);
    apply();
    if (mql.addEventListener) mql.addEventListener("change", apply);
    else mql.addListener(apply);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", apply);
      else mql.removeListener(apply);
    };
  }, []);
  return reduced;
}

export function RecentFeedView({ scope = recentScope }: { scope?: FeedScope }) {
  // The signed-in viewer (already-authenticated client session — no read-path cost). Used ONLY to
  // pass `signedIn` to the CurationBlock (it renders the same feed either way — §6.3); never a gate.
  const { data: session } = useSession();
  const signedIn = typeof session?.user?.contributorId === "number";
  const reduced = useReducedMotion();

  const [feedState, setFeedState] = useState<FeedState>("loading");
  const [tailState, setTailState] = useState<TailState>("idle");
  const [items, setItems] = useState<ContributorClip[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  // The initial page is kept so the scope's empty panel can read scope-specific fields (the
  // watchlist's `watchedTopicCount` distinguishes its two empty states — #162).
  const [initialPage, setInitialPage] = useState<FeedPage | null>(null);
  // Which item is the single active player (its id), or null when nothing plays (§3.3).
  const [playingId, setPlayingId] = useState<string | null>(null);

  const trackRef = useRef<HTMLOListElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  const firstStageRef = useRef<HTMLElement | null>(null);
  // Per-item stage elements, so the auto-pause observer can map an intersection back to an id.
  const stageEls = useRef<Map<string, HTMLElement>>(new Map());
  // A loading guard so the sentinel + the "Show more" button can't double-fetch the same page.
  const loadingRef = useRef(false);

  // ── The initial load (the first page). Honest states: error > loading > empty > populated
  //    (§4.5). A read failure shows the error panel rather than hanging on "Loading…" forever. ──
  const loadInitial = useCallback(async () => {
    loadingRef.current = true;
    setFeedState("loading");
    setTailState("idle");
    try {
      const page = await scope.loadInitial();
      setInitialPage(page);
      setItems(page.items);
      setCursor(page.nextCursor);
      if (page.items.length === 0) {
        setFeedState("empty");
      } else {
        setFeedState("populated");
        setTailState(page.nextCursor ? "idle" : "end");
      }
    } catch {
      setFeedState("error");
    } finally {
      loadingRef.current = false;
    }
  }, [scope]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  // ── Load the next page (the cursor path). Shared by the sentinel + the "Show more" button + the
  //    tail "Try again". APPENDS — never reorders loaded items (a playing item is never yanked). ──
  const loadMore = useCallback(async () => {
    if (loadingRef.current || cursor === null) return;
    loadingRef.current = true;
    setTailState("loading");
    try {
      const page = await scope.loadMore(cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setTailState(page.nextCursor ? "idle" : "end");
    } catch {
      setTailState("error");
    } finally {
      loadingRef.current = false;
    }
  }, [cursor, scope]);

  // ── The infinite-scroll sentinel (§3.4): when it scrolls into view, fetch the next page. The
  //    keyboard/AT "Show more" button (rendered in the tail) is the always-present fallback for a
  //    non-scroll user or a stalled observer. Re-armed whenever the cursor / tail state changes. ──
  useEffect(() => {
    if (feedState !== "populated") return;
    if (tailState !== "idle") return; // not loading, not errored, not ended
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      // A screenful of root margin so the next page is fetched BEFORE the reader hits the end.
      { root: trackRef.current, rootMargin: "100% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feedState, tailState, loadMore]);

  // ── Auto-pause on scroll-away (§3.3). One IntersectionObserver over the item stages: when the
  //    PLAYING item's stage leaves the active window (mostly off-screen), tear its iframe down back
  //    to the poster so audio never trails. This is NOT autoplay — it only STOPS the one the reader
  //    walked away from; the next item never auto-starts. Re-evaluated when the playing id changes. ──
  useEffect(() => {
    if (playingId === null) return;
    if (typeof IntersectionObserver === "undefined") return;
    const el = stageEls.current.get(playingId);
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Below half-visible ⇒ the reader has scrolled away ⇒ stop playback (poster returns).
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
            setPlayingId((cur) => (cur === playingId ? null : cur));
          }
        }
      },
      { root: trackRef.current, threshold: [0, 0.5, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [playingId]);

  // "Back to top" (the end marker, §4.4): scroll the track to the first item and move focus to its
  // play affordance, so a keyboard user is returned to the top, not dropped to <body>. Programmatic
  // scroll respects reduced motion (jump, not animate — §8.5).
  const backToTop = useCallback(() => {
    const track = trackRef.current;
    track?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    const stage = firstStageRef.current;
    // The stage is the wrapper; focus its inner play affordance (the button/link).
    const playable = stage?.querySelector<HTMLElement>("button, a[href]");
    playable?.focus({ preventScroll: true });
  }, [reduced]);

  const header = <SiteHeader host="page" auth={<AuthControl variant="home" />} />;

  // ── State precedence (§4.5): error > loading > empty > populated. The header always renders. ──
  if (feedState === "loading") {
    return (
      <Shell header={header} h1={scope.h1}>
        <InitialLoading label={scope.loadingLabel} />
      </Shell>
    );
  }
  if (feedState === "error") {
    return (
      <Shell header={header} h1={scope.h1}>
        <InitialError
          heading={scope.errorHeading}
          body={scope.errorBody}
          onRetry={() => void loadInitial()}
        />
      </Shell>
    );
  }
  if (feedState === "empty") {
    return (
      <Shell header={header} h1={scope.h1}>
        {scope.renderEmpty(initialPage ?? { items: [], nextCursor: null })}
      </Shell>
    );
  }

  // ── Populated (§4.4). The snap track: one full-viewport item per curation, then the tail (the
  //    sentinel + the load-more / end-of-feed region). ──
  return (
    <main>
      {header}
      {/* The document's single top-level heading, visually hidden (§8.1) — like the home page. */}
      <h1 className="sr-only">{scope.h1}</h1>
      <ol
        ref={trackRef}
        role="list"
        // Mandatory vertical snap (§3.1); the track is the scroll container sized to the usable
        // viewport below the slim header. `overflow-y-auto` + `h-[calc(100dvh-56px)]` makes IT the
        // scroller (not the window), so the sticky header stays put and the IntersectionObservers
        // can use it as their root.
        className="snap-y snap-mandatory overflow-y-auto overflow-x-hidden"
        style={{ height: ITEM_HEIGHT }}
      >
        {items.map((clip, i) => (
          <li
            key={clip.id}
            className="snap-start"
            style={{ height: ITEM_HEIGHT }}
          >
            <RecentFeedItem
              clip={clip}
              signedIn={signedIn}
              index={i + 1}
              total={items.length}
              isPlaying={playingId === clip.id}
              onPlay={() => setPlayingId(clip.id)}
              registerStage={(el) => {
                if (el) stageEls.current.set(clip.id, el);
                else stageEls.current.delete(clip.id);
                if (i === 0) firstStageRef.current = el;
              }}
            />
          </li>
        ))}

        {/* The tail snap stop: the invisible sentinel + the visible load-more / end region. It is a
            full snap stop so the reader settles on it and the end marker / "Show more" is reachable. */}
        <li
          ref={sentinelRef}
          className="flex snap-start items-center justify-center bg-[var(--color-content-white)] px-5"
          style={{ height: ITEM_HEIGHT }}
        >
          <Tail
            state={tailState}
            endPrimary={scope.endPrimary}
            endSecondary={scope.endSecondary}
            onMore={() => void loadMore()}
            onRetry={() => void loadMore()}
            onBackToTop={backToTop}
          />
        </li>
      </ol>
    </main>
  );
}

// ── The non-populated shell: the header + a centred full-viewport panel (loading / empty / error).
//    The track height keeps the panel centred in the usable viewport below the slim header. ──
function Shell({
  header,
  h1,
  children,
}: {
  header: React.ReactNode;
  h1: string;
  children: React.ReactNode;
}) {
  return (
    <main>
      {header}
      <h1 className="sr-only">{h1}</h1>
      <div
        className="flex items-center justify-center bg-[var(--color-content-white)] px-5"
        style={{ minHeight: ITEM_HEIGHT }}
      >
        {children}
      </div>
    </main>
  );
}

// ── Loading (initial, §4.1). A polite announcement + 2 skeleton item placeholders (a black stage box
//    + a light note-card silhouette) so the layout reads as the feed, not a blank page. Static under
//    reduced motion (no pulse) — handled by the global .animate-pulse reduced-motion suppression. ──
function InitialLoading({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      className="w-full max-w-[760px]"
    >
      <p className="sr-only" role="status" aria-live="polite">
        {label}
      </p>
      <div className="space-y-6">
        {[0, 1].map((i) => (
          <div key={i} aria-hidden className="overflow-hidden">
            <div className="aspect-video w-full animate-pulse bg-black/80" />
            <div className="mt-3 border-2 border-hardbox bg-surface-raised p-4">
              <div className="h-4 w-1/2 animate-pulse rounded bg-hardbox/10" />
              <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-hardbox/10" />
              <div className="mt-3 h-12 w-full animate-pulse rounded bg-hardbox/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty (§4.2): the read succeeded with ZERO items (the bootstrap state). A light-register panel
//    that sends the reader to find a topic — the honest path (you curate ON a topic). Mirrors the
//    home page's empty "Recently curated" voice so the two surfaces read as one product. ──
function RecentEmptyPanel() {
  return (
    <div className="w-full max-w-[460px] border-2 border-hardbox bg-surface-raised p-6 text-center shadow-[4px_4px_0_var(--color-hardbox-offset)]">
      <h2 className="plus-disp text-xl font-bold text-ink-plus">No curations yet</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink2">
        The recent feed shows videos as people curate them onto topics across wiki+. Be the first —
        find a topic and add a video with a context note.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex min-h-[48px] items-center gap-2 border-2 border-hardbox bg-brand px-5 py-2.5 text-base font-bold text-white shadow-[4px_4px_0_var(--color-hardbox-offset)] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hardbox"
      >
        Find a topic <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

// ── Error (initial read failed, §4.3): an honest line + a Try-again button (one keyboard action),
//    never a spinner-forever. The header still renders (the Shell provides it). ──
function InitialError({
  heading,
  body,
  onRetry,
}: {
  heading: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <div className="w-full max-w-[460px] border-2 border-hardbox bg-surface-raised p-6 text-center shadow-[4px_4px_0_var(--color-hardbox-offset)]">
      <h2 className="plus-disp text-xl font-bold text-ink-plus">{heading}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink2">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-[48px] items-center border-2 border-hardbox bg-surface-raised px-5 py-2.5 text-base font-bold text-ink-plus shadow-[4px_4px_0_var(--color-hardbox-offset)] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hardbox"
      >
        Try again
      </button>
    </div>
  );
}

// ── The tail region (§3.5 / §4.4) — the load-more status that doubles as the keyboard fallback. It
//    is an aria-live polite region. Four states:
//      idle    → the always-present "Show more curations" button (keyboard/AT + stalled-observer
//                fallback; the invisible sentinel drives normal scroll).
//      loading → "Loading more curations…" (aria-busy), the button disabled.
//      error   → "Couldn't load more — Try again" (a real button; loaded items stay).
//      end     → the end-of-feed marker + a "Back to top" button.
function Tail({
  state,
  endPrimary,
  endSecondary,
  onMore,
  onRetry,
  onBackToTop,
}: {
  state: TailState;
  endPrimary: string;
  endSecondary: string;
  onMore: () => void;
  onRetry: () => void;
  onBackToTop: () => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-busy={state === "loading"}
      className="w-full max-w-[460px] text-center"
    >
      {state === "end" ? (
        <>
          <p className="plus-disp text-lg font-bold text-ink-plus">{endPrimary}</p>
          <p className="mt-1 text-sm text-ink2">{endSecondary}</p>
          <button
            type="button"
            onClick={onBackToTop}
            className="mt-5 inline-flex min-h-[44px] items-center border-2 border-hardbox bg-surface-raised px-4 py-2 text-sm font-bold text-ink-plus shadow-[3px_3px_0_var(--color-hardbox-offset)] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hardbox"
          >
            Back to top
          </button>
        </>
      ) : state === "error" ? (
        <p className="text-sm font-bold text-ink-plus">
          Couldn&apos;t load more —{" "}
          <button
            type="button"
            onClick={onRetry}
            className="text-link underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
          >
            Try again
          </button>
        </p>
      ) : state === "loading" ? (
        <p className="text-sm font-semibold text-ink2">Loading more curations…</p>
      ) : (
        <button
          type="button"
          onClick={onMore}
          className="inline-flex min-h-[44px] w-full items-center justify-center border-2 border-hardbox bg-surface-raised px-4 py-2 text-sm font-bold text-ink-plus shadow-[3px_3px_0_var(--color-hardbox-offset)] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hardbox"
        >
          Show more curations
        </button>
      )}
    </div>
  );
}
